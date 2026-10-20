import type { StyleDNA } from '../core/style';
import type { Emphasis } from '../core/brief';
import type { SceneInstance, SceneKind, Segment, Word } from '../core/types';
import { outputDuration, sourceToOutput } from '../engine/timeline';
import { findName, isQuestion, keywordScore, normalizeToken, ordinalOf, parseNumberAt, splitSentences } from './detect';
import type { Emoji } from '../core/emoji';
import { FALLBACK_EMOJIS, emojiForWords } from './emoji-pick';

/**
 * Seletor de cenas por regras. Lê as palavras (já no tempo do vídeo editado) e propõe cenas:
 * número grande, lista, citação de pergunta, lower third, destaque de palavra, zoom, transição,
 * barra de progresso e chamada final. Densidade, intervalo e duração vêm do StyleDNA.
 *
 * Regras de composição:
 * - cenas "centrais" (título, número, lista, citação, chamada final) nunca se sobrepõem e têm
 *   intervalo mínimo entre si; o lower third fica numa faixa própria;
 * - prioridade: título > chamada final > lista > lower third > número > citação;
 * - anti-repetição: a mesma cena com os mesmos parâmetros nunca aparece duas vezes seguidas
 *   (nem na sequência de cenas centrais, nem na sequência do mesmo tipo).
 */

type Draft = SceneInstance extends infer S ? (S extends SceneInstance ? Omit<S, 'id'> : never) : never;

export const OVERLAY_KINDS: ReadonlySet<SceneInstance['kind']> = new Set(['kinetic-title', 'big-number', 'list', 'quote', 'end-cta']);

/** Identidade de uma cena para a anti-repetição: tipo + parâmetros (sem tempos nem id). */
export function sceneKey(s: Draft | SceneInstance): string {
  switch (s.kind) {
    case 'kinetic-title':
    case 'highlight-word':
    case 'quote':
    case 'end-cta':
      return `${s.kind}|${s.text.toLowerCase()}`;
    case 'big-number':
      return `${s.kind}|${s.value}|${s.label.toLowerCase()}`;
    case 'list':
      return `${s.kind}|${s.items.map((i) => i.text.toLowerCase()).join('/')}`;
    case 'lower-third':
      return `${s.kind}|${s.title}|${s.subtitle}`;
    case 'emphasis-zoom':
      return `${s.kind}|${s.scale}`;
    case 'cut-transition':
      return `${s.kind}|${s.at}`;
    case 'progress-bar':
      return s.kind;
    case 'emoji':
      return `${s.kind}|${s.emoji}`;
  }
}

/** Primeiras palavras da primeira frase (até 4), para o título de abertura. */
export function openingTitle(words: Pick<Word, 'text'>[], maxWords = 4): string | null {
  const picked: string[] = [];
  for (const w of words) {
    const clean = w.text.trim();
    if (!clean) continue;
    picked.push(clean.replace(/[.,!?;:]+$/, ''));
    if (picked.length >= maxWords || /[.!?]$/.test(clean)) break;
  }
  const text = picked.join(' ').trim();
  return text.length > 0 ? text.slice(0, 60) : null;
}

interface Placed {
  raw: string;
  start: number;
  end: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const strip = (raw: string) => raw.trim().replace(/^[^\p{L}\p{N}$]+/u, '').replace(/[^\p{L}\p{N}%]+$/u, '');
const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const endsSentence = (raw: string) => /[.!?…]["”']?$/.test(raw.trim()) && !/^[1-9][.)]$/.test(raw.trim());

const GENERIC = new Set(['dica', 'passo', 'ponto', 'coisa', 'regra', 'erro', 'motivo', 'lugar', 'etapa', 'item', 'hábito', 'segredo']);
const FUNCTION_WORDS = new Set('a o as os um uma de do da dos das em no na nos nas por para pra com e ou que se meu minha seu sua'.split(' '));
const CONNECTORS = new Set(['e', 'em', 'o', 'a', 'depois', 'agora', 'então', 'por']);

function placeWords(words: Word[], segments: Segment[]): Placed[] {
  const out: Placed[] = [];
  for (const w of words) {
    const start = sourceToOutput(segments, w.start);
    const end = sourceToOutput(segments, Math.max(w.start, w.end - 1e-3));
    if (start === null || end === null || !w.text.trim()) continue;
    out.push({ raw: w.text.trim(), start, end: end + 1e-3 });
  }
  return out;
}

/** Até `maxWords` palavras a partir de `from`, parando no fim da frase, sem conectivos soltos no fim. */
function phrase(ws: Placed[], from: number, maxWords: number, maxChars: number): { text: string; last: number } {
  const parts: string[] = [];
  let last = from - 1;
  for (let k = from; k < ws.length && parts.length < maxWords; k++) {
    const piece = strip(ws[k]!.raw);
    if (piece && [...parts, piece].join(' ').length > maxChars) break;
    if (piece) parts.push(piece);
    last = k;
    if (endsSentence(ws[k]!.raw)) break;
  }
  while (parts.length > 1 && FUNCTION_WORDS.has(normalizeToken(parts[parts.length - 1]!))) parts.pop();
  return { text: parts.join(' '), last };
}

interface Candidate {
  scene: Draft;
  priority: number;
}

/** O que o pedido (CreativeBrief) muda no seletor. Sem opções = comportamento da Fase 3. */
export interface SceneOptions {
  /** tipos de cena proibidos: nunca aparecem */
  forbid: ReadonlySet<SceneKind>;
  /** destaques pedidos: ganham prioridade e não contam no orçamento de cenas */
  emphasize: ReadonlySet<Emphasis>;
  /** frase do gancho escolhido: vira o título de abertura (texto falado, nunca inventado) */
  title: string | null;
  /** emojis preferidos quando a fala não sugere nenhum (do pedido ou da IA) */
  emojiPrefer?: readonly Emoji[];
}

export const NO_SCENE_OPTIONS: SceneOptions = { forbid: new Set(), emphasize: new Set(), title: null, emojiPrefer: [] };

/**
 * Emojis perto da fala (v0.6). "interval": um a cada N segundos, puxado para a palavra que sugere o emoji
 * se ela estiver perto; "keywords": só nas palavras da tabela. Nunca se sobrepõem; emoji igual seguido é evitado.
 */
export function proposeEmojis(ws: { raw: string; start: number; end: number }[], total: number, style: StyleDNA, prefer: readonly Emoji[] = []): Draft[] {
  const E = style.emoji;
  if (E.mode === 'off' || total < 1) return [];
  const out: Draft[] = [];
  const fallback = prefer.length ? prefer : FALLBACK_EMOJIS;
  let fb = 0;
  let prevEnd = -Infinity;
  let prevEmoji: Emoji | null = null;
  const nextFallback = (): Emoji => {
    for (let k = 0; k < fallback.length; k++) {
      const e = fallback[(fb + k) % fallback.length]!;
      if (e !== prevEmoji || fallback.length === 1) {
        fb = (fb + k + 1) % fallback.length;
        return e;
      }
    }
    return fallback[0]!;
  };
  const push = (emoji: Emoji, start: number, len: number) => {
    const a = r3(Math.max(start, prevEnd + 0.05, 0));
    const b = r3(Math.min(total, a + len));
    if (b - a < 0.4) return;
    out.push({ kind: 'emoji', emoji, start: a, end: b });
    prevEnd = b;
    prevEmoji = emoji;
  };
  if (E.mode === 'interval') {
    const every = E.everySec;
    const len = Math.min(2, Math.max(0.6, every * 0.8));
    for (let t = Math.min(0.5, total / 4); t < total - 0.4; t += every) {
      // palavras perto deste instante (um pouco antes e depois)
      const near = ws.filter((w) => w.start >= t - every * 0.4 && w.start < t + every * 0.6);
      const hit = emojiForWords(near.map((w) => w.raw));
      const pick = hit && hit.emoji === prevEmoji ? null : hit;
      const at = pick ? near[pick.index]!.start : t;
      push(pick ? pick.emoji : nextFallback(), at, len);
    }
  } else {
    let last = -Infinity;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      const hit = emojiForWords([w.raw, ws[i + 1]?.raw ?? ''].filter(Boolean));
      if (!hit || hit.index !== 0 || w.start - last < 1.5 || hit.emoji === prevEmoji) continue;
      push(hit.emoji, w.start, 1.4);
      last = w.start;
    }
  }
  return out;
}

const EMPHASIS_KIND: Record<Emphasis, SceneKind | null> = { numeros: 'big-number', perguntas: 'quote', listas: 'list', nome: 'lower-third', palavras: 'highlight-word' };

export function proposeScenes(words: Word[], segments: Segment[], style: StyleDNA, opts: SceneOptions = NO_SCENE_OPTIONS): SceneInstance[] {
  const boosted = new Set([...opts.emphasize].map((e) => EMPHASIS_KIND[e]).filter((k): k is SceneKind => k !== null && !opts.forbid.has(k)));
  const total = outputDuration(segments);
  const ws = placeWords(words, segments);
  const tokens = ws.map((w) => w.raw);
  const sentences = splitSentences(tokens);
  const sentenceOf = new Map<number, number[]>();
  for (const s of sentences) for (const i of s) sentenceOf.set(i, s);
  const R = style.rhythm;
  const candidates: Candidate[] = [];
  const dur = (start: number, d: number) => ({ start: r3(Math.max(0, start)), end: r3(Math.min(total, Math.max(0, start) + d)) });

  // números
  const numbers: Candidate[] = [];
  for (let i = 0; i < ws.length; i++) {
    if (ordinalOf(ws[i]!.raw) !== null) continue;
    const num = parseNumberAt(tokens, i);
    if (!num) continue;
    const special = /[%$]/.test(num.value);
    const lastOfNumber = i + num.consumed - 1;
    const label = endsSentence(ws[lastOfNumber]!.raw) ? '' : phrase(ws, i + num.consumed, 5, 28).text.toLowerCase();
    if (num.value.length > 12 || (!special && (num.n < 2 || (!label && !boosted.has('big-number'))))) continue;
    numbers.push({ scene: { kind: 'big-number', value: num.value, label, ...dur(ws[i]!.start - 0.15, R.sceneSec) }, priority: boosted.has('big-number') ? 92 : 80 });
    i = lastOfNumber;
  }
  candidates.push(...numbers);

  // nome → lower third (faixa própria)
  const name = findName(tokens);
  const nameAt = name && (ws[name.index]!.start < 20 || boosted.has('lower-third')) ? ws[name.index]! : null;
  if (name && nameAt) {
    candidates.push({ scene: { kind: 'lower-third', title: name.name.slice(0, 32), subtitle: '', ...dur(nameAt.start - 0.2, Math.max(R.sceneSec, 2.6)) }, priority: 85 });
  }

  // título de abertura: não quando a fala abre com apresentação ou com um número
  const title = openingTitle(ws.map((w) => ({ text: w.raw })));
  const opensWithNumber = numbers.some((n) => n.scene.start < 1);
  const opensWithName = !!nameAt && nameAt.start < 3;
  const opensWithQuestion = sentences.length > 0 && isQuestion(sentences[0]!.map((k) => tokens[k]!));
  if (opts.title) {
    // gancho escolhido pela pessoa: sempre abre o vídeo, com tempo para ler a frase inteira
    const readSec = Math.min(5, Math.max(R.titleSec, opts.title.split(/\s+/).length * 0.4));
    candidates.push({ scene: { kind: 'kinetic-title', text: opts.title.slice(0, 60), ...dur(0, Math.min(readSec, total)) }, priority: 100 });
  } else if (title && total > 1.5 && !opensWithNumber && !opensWithName && !opensWithQuestion) {
    candidates.push({ scene: { kind: 'kinetic-title', text: title, ...dur(0, Math.min(R.titleSec, total)) }, priority: 100 });
  }

  // enumerações
  const markers: { i: number; ord: number }[] = [];
  for (let i = 0; i < ws.length; i++) {
    const ord = ordinalOf(ws[i]!.raw);
    if (ord === null) continue;
    const sent = sentenceOf.get(i)!;
    const before = sent.slice(0, sent.indexOf(i)).map((k) => normalizeToken(tokens[k]!));
    const atStart = before.every((t) => CONNECTORS.has(t)) && before.length <= 2;
    const prev = markers.at(-1);
    const continues = !!prev && prev.ord === ord - 1 && ws[i]!.start - ws[prev.i]!.start < 45;
    if ((atStart && (ord === 1 || continues || !/^(segund|quart|quint)/.test(normalizeToken(ws[i]!.raw)))) || continues) markers.push({ i, ord });
  }
  /** Texto do item depois do marcador ("Primeiro, comece pequeno" → "Comece pequeno"); null se não houver conteúdo. */
  const itemText = (m: { i: number; ord: number }): string | null => {
    let from = m.i + 1;
    const generic = ws[from] && GENERIC.has(normalizeToken(ws[from]!.raw)) ? strip(ws[from]!.raw) : '';
    if (generic) from++;
    if (generic && ws[from - 1] && endsSentence(ws[from - 1]!.raw) && !(ws[from] && ws[from]!.start - ws[from - 1]!.end < 1.5)) return null;
    const p = phrase(ws, from, 4, 40).text.replace(/^(é|:)\s*/i, '');
    return p ? capitalize(p).slice(0, 40) : null;
  };
  const sequences: { i: number; ord: number }[][] = [];
  for (const m of markers) {
    const seq = sequences.at(-1);
    const last = seq?.at(-1);
    if (seq && last && m.ord === last.ord + 1) seq.push(m);
    else sequences.push([m]);
  }
  for (const all of sequences) {
    const seq = all.filter((m) => itemText(m) !== null);
    if (seq.length === 0) continue;
    const items = seq.map((m) => ({ text: itemText(m)!, at: r3(ws[m.i]!.start) }));
    const first = ws[seq[0]!.i]!;
    const lastAt = ws[seq.at(-1)!.i]!;
    if (seq.length >= 2 && lastAt.start - first.start <= 25) {
      const start = Math.max(0, first.start - 0.2);
      candidates.push({ scene: { kind: 'list', items: items.slice(0, 5), ...dur(start, lastAt.start - start + R.sceneSec + 0.6) }, priority: boosted.has('list') ? 93 : 90 });
    } else {
      seq.forEach((m, k) => {
        candidates.push({ scene: { kind: 'list', items: items.slice(Math.max(0, k - 4), k + 1), ...dur(ws[m.i]!.start - 0.1, R.sceneSec) }, priority: 90 });
      });
    }
  }

  // perguntas → citação
  for (const sent of sentences) {
    const toks = sent.map((k) => tokens[k]!);
    if (!isQuestion(toks) || toks.length < 3 || toks.length > 12) continue;
    let text = toks.join(' ').replace(/[.!…]+$/, '');
    if (!text.endsWith('?')) text += '?';
    if (text.length > 80) continue;
    const a = ws[sent[0]!]!;
    const b = ws[sent.at(-1)!]!;
    const start = a.start - 0.1;
    candidates.push({ scene: { kind: 'quote', text: capitalize(text), ...dur(start, Math.min(4.5, Math.max(1.5, b.end + 0.3 - start))) }, priority: boosted.has('quote') ? 91 : 70 });
  }

  // chamada final
  if (total >= 8) candidates.push({ scene: { kind: 'end-cta', text: style.cta, ...dur(total - Math.min(2.4, R.sceneSec + 0.4), 10) }, priority: 95 });

  const accepted = placeOverlays(
    candidates.filter((c) => !opts.forbid.has(c.scene.kind)),
    total,
    style,
    boosted,
  );

  // destaque de palavra-chave: a melhor palavra de cada frase, espaçadas pelo ritmo do estilo
  const quotes = accepted.filter((s) => s.kind === 'quote');
  const highlights: Draft[] = [];
  const zooms: Draft[] = [];
  let lastKw = -Infinity;
  let lastZoom = -Infinity;
  for (const sent of sentences) {
    let best = -1;
    let bestScore = 0;
    for (const k of sent) {
      const sc = keywordScore(tokens[k]!);
      if (sc > bestScore) {
        best = k;
        bestScore = sc;
      }
    }
    const w = best >= 0 ? ws[best]! : null;
    const prev = highlights.at(-1);
    const word = w ? strip(w.raw).slice(0, 30) : '';
    const inQuote = w && quotes.some((q) => w.start < q.end && w.end > q.start);
    if (w && bestScore >= (boosted.has('highlight-word') ? 0.5 : 0.75) && !inQuote && w.start - lastKw >= R.keywordEverySec && (!prev || sceneKey(prev) !== `highlight-word|${word.toLowerCase()}`)) {
      highlights.push({ kind: 'highlight-word', text: word, ...dur(w.start, w.end - w.start + 0.5) });
      lastKw = w.start;
    }
    // zoom de ênfase: frase com exclamação ou palavra muito forte
    const a = ws[sent[0]!]!;
    const exclaims = /!["”']?$/.test(tokens[sent.at(-1)!]!.trim());
    if ((exclaims || bestScore >= 1.5) && a.start - lastZoom >= R.zoomEverySec) {
      const prevZoom = zooms.at(-1);
      const strong = r3(style.zoomScale);
      const soft = r3(1 + (style.zoomScale - 1) * 0.6);
      const scale = prevZoom && prevZoom.kind === 'emphasis-zoom' && prevZoom.scale === strong ? soft : strong;
      const b = ws[sent.at(-1)!]!;
      zooms.push({ kind: 'emphasis-zoom', scale, ...dur(a.start - 0.1, Math.max(1.2, Math.min(3, b.end - a.start + 0.4))) });
      lastZoom = a.start;
    }
  }

  // transições nas emendas
  const transitions: Draft[] = [];
  if (style.transition !== 'none') {
    const window = { zoom: [0, 0.5], flash: [0.08, 0.22], dip: [0.15, 0.15] }[style.transition];
    let offset = 0;
    let lastAt = -Infinity;
    for (const s of segments.slice(0, -1)) {
      offset += s.srcEnd - s.srcStart;
      const at = r3(offset);
      if (at - lastAt < 1 || at <= 0 || at >= total) continue;
      transitions.push({ kind: 'cut-transition', at, start: r3(Math.max(0, at - window[0]!)), end: r3(Math.min(total, at + window[1]!)) });
      lastAt = at;
    }
  }

  const progress: Draft[] = style.progress !== 'none' && total >= 3 ? [{ kind: 'progress-bar', start: 0, end: r3(total) }] : [];
  const emojis = opts.forbid.has('emoji') ? [] : proposeEmojis(ws, total, style, opts.emojiPrefer);

  return [...progress, ...transitions, ...zooms, ...accepted, ...highlights, ...emojis]
    .filter((s) => s.end - s.start > 0.05 && !opts.forbid.has(s.kind))
    .sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind))
    .map((s, i) => ({ ...s, id: `s${i + 1}` }) as SceneInstance);
}

/** Escolhe as cenas de sobreposição respeitando prioridade, intervalo, orçamento e anti-repetição. */
function placeOverlays(candidates: Candidate[], total: number, style: StyleDNA, boosted: ReadonlySet<SceneKind>): Draft[] {
  const R = style.rhythm;
  const budget = Math.ceil((total / 10) * R.overlaysPer10s);
  const exempt = (s: Draft) => s.kind === 'kinetic-title' || s.kind === 'end-cta' || boosted.has(s.kind);
  const central: Draft[] = [];
  const lower: Draft[] = [];
  let used = 0;
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority || a.scene.start - b.scene.start);
  for (const { scene } of sorted) {
    if (scene.end - scene.start < 0.8) continue;
    if (scene.kind === 'lower-third') {
      if (lower.length === 0) lower.push(scene);
      continue;
    }
    if (!exempt(scene) && used >= budget) continue;
    // destaque pedido: intervalo curto (1 s no máximo), mas nunca sobreposto
    const gap = boosted.has(scene.kind) ? Math.min(R.minGapSec, 1) : R.minGapSec;
    const clash = central.some((o) => scene.start < o.end + gap && o.start < scene.end + gap);
    if (clash) continue;
    const key = sceneKey(scene);
    const byTime = [...central, scene].sort((a, b) => a.start - b.start);
    const idx = byTime.indexOf(scene);
    const sameKind = byTime.filter((s) => s.kind === scene.kind);
    const kIdx = sameKind.indexOf(scene);
    const neighbors = [byTime[idx - 1], byTime[idx + 1], sameKind[kIdx - 1], sameKind[kIdx + 1]];
    if (neighbors.some((n) => n && sceneKey(n) === key)) continue;
    central.push(scene);
    if (!exempt(scene)) used++;
  }
  return [...central, ...lower];
}
