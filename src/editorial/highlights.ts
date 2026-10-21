import type { Word } from '../core/types';
import { ENERGY_STEP_SEC, meanDbBetween, speechMedianDb } from '../analysis/energy';
import { isQuestion, keywordScore, normalizeToken, parseNumberAt } from './detect';
import { sentencesOf } from './hooks';

/**
 * Melhores momentos de um vídeo longo (v0.22, ADR-0023). Puro, sem IA e testado (tests/highlights.test.ts).
 *
 * 1. A fala vira pedaços: frases (pontuação ou pausa); frase comprida demais é dividida nas pausas.
 * 2. Cada janela de pedaços seguidos com o tamanho pedido é candidata: sempre começa e termina em pedaço
 *    inteiro, então nenhum corte pega palavra pela metade.
 * 3. A nota (0–100) soma abertura forte, conteúdo, ritmo, energia do áudio, fim de ideia, tamanho e sinais
 *    (pergunta, número) e desconta silêncio morto e começo com conectivo ("e", "mas", "então").
 * 4. Escolhe as melhores sem sobreposição. Cada momento diz por que foi escolhido.
 */

export type ClipLength = 'curto' | 'medio' | 'longo';

export const CLIP_LENGTHS: Record<ClipLength, { label: string; min: number; max: number; ideal: number }> = {
  curto: { label: 'Curtos (15 a 30 s)', min: 15, max: 30, ideal: 22 },
  medio: { label: 'Médios (30 a 60 s)', min: 30, max: 60, ideal: 45 },
  longo: { label: 'Longos (60 a 90 s)', min: 60, max: 90, ideal: 75 },
};
export const CLIP_LENGTH_IDS = Object.keys(CLIP_LENGTHS) as ClipLength[];

/** Quantos clipes a pessoa pode pedir. */
export const CLIP_COUNTS = [3, 5, 8, 10] as const;
/** Máximo de sugestões mostradas (as pedidas + reservas). */
export const MAX_MOMENTS = 20;

/** Folga antes da primeira e depois da última palavra, sem pegar a palavra vizinha. */
export const LEAD_SEC = 0.25;
export const TAIL_SEC = 0.4;
/** Distância mínima entre dois momentos escolhidos. */
export const MOMENT_GAP_SEC = 1;

export interface Moment {
  /** 'm1', 'm2'… na ordem da nota */
  id: string;
  /** 1 = melhor */
  rank: number;
  /** no vídeo original (s), já com a folga */
  start: number;
  end: number;
  /** frase de destaque (falada, nunca inventada pelas regras) */
  title: string;
  /** fala inteira do trecho */
  text: string;
  /** 0–100 */
  score: number;
  /** por que foi escolhido, em português */
  reasons: string[];
  wordCount: number;
}

export interface MomentOptions {
  length: ClipLength;
  /** quantos momentos devolver (no máximo MAX_MOMENTS) */
  count: number;
  /** energia do áudio (dB por passo), de analysis/energy.ts; sem ela a energia não pesa */
  energy?: ArrayLike<number> | null;
  energyStep?: number;
}

interface Piece {
  words: Word[];
  /** índice da 1ª e da última palavra na lista completa */
  first: number;
  last: number;
  start: number;
  end: number;
  /** terminou com pontuação (ideia fechada) */
  complete: boolean;
  question: boolean;
  number: boolean;
  /** abertura: 0–1 */
  hook: number;
  strong: number;
  connector: boolean;
}

const PIECE_SOFT_SEC = 8;
const PIECE_HARD_SEC = 14;
const PIECE_GAP_SEC = 0.25;
/** silêncio entre pedaços além disso conta como "morto" */
const DEAD_AIR_SEC = 1;
const IDEAL_WPS = 2.7;

const CONNECTORS = new Set(['e', 'mas', 'então', 'entao', 'porque', 'pois', 'aí', 'ai', 'daí', 'dai', 'né', 'ne', 'tipo', 'ou', 'que', 'também', 'tambem', 'só', 'so', 'senão', 'senao']);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const textOf = (ws: Word[]) => ws.map((w) => w.text.trim()).filter(Boolean).join(' ');

/** Divide a frase comprida nas pausas: depois de 8 s corta na próxima pausa curta; aos 14 s corta de qualquer jeito. */
function splitLong(ws: Word[]): Word[][] {
  if (ws.length === 0 || ws.at(-1)!.end - ws[0]!.start <= PIECE_HARD_SEC) return [ws];
  const out: Word[][] = [];
  let cur: Word[] = [];
  ws.forEach((w, i) => {
    cur.push(w);
    const next = ws[i + 1];
    if (!next) return;
    const dur = w.end - cur[0]!.start;
    if ((dur >= PIECE_SOFT_SEC && next.start - w.end >= PIECE_GAP_SEC) || next.end - cur[0]!.start > PIECE_HARD_SEC) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

function hookOf(tokens: string[]): number {
  let s = 0;
  if (isQuestion(tokens)) s += 3;
  if (tokens.some((_, k) => parseNumberAt(tokens, k) !== null)) s += 2;
  s += Math.min(2, tokens.filter((t) => keywordScore(t) >= 1).length) * 1.5;
  if (/!["”']?$/.test(tokens.at(-1) ?? '')) s += 1;
  if (tokens.length >= 4 && tokens.length <= 14) s += 1;
  if (tokens.length < 3) s -= 1;
  return clamp01(s / 6);
}

/** Pedaços de fala em ordem. */
export function speechPieces(words: Word[]): Piece[] {
  const spoken = words.filter((w) => w.text.trim());
  const index = new Map(spoken.map((w, i) => [w, i]));
  const pieces: Piece[] = [];
  for (const sentence of sentencesOf(spoken)) {
    const parts = splitLong(sentence.words);
    parts.forEach((ws, k) => {
      const tokens = ws.map((w) => w.text.trim());
      const lastOfSentence = k === parts.length - 1;
      pieces.push({
        words: ws,
        first: index.get(ws[0]!)!,
        last: index.get(ws.at(-1)!)!,
        start: ws[0]!.start,
        end: ws.at(-1)!.end,
        complete: lastOfSentence && !sentence.byPause,
        question: isQuestion(tokens),
        number: tokens.some((_, i) => parseNumberAt(tokens, i) !== null),
        hook: hookOf(tokens),
        strong: tokens.reduce((n, t) => n + (keywordScore(t) >= 1 ? 1 : 0), 0),
        connector: CONNECTORS.has(normalizeToken(tokens[0] ?? '')),
      });
    });
  }
  return pieces;
}

interface Candidate {
  i: number;
  j: number;
  score: number;
  parts: { hook: number; content: number; pace: number; energy: number; ending: number; dead: number };
  wordCount: number;
}

/** Nota de cada janela de pedaços [i..j] com o tamanho pedido. */
function candidates(pieces: Piece[], opts: MomentOptions): Candidate[] {
  const L = CLIP_LENGTHS[opts.length];
  const env = opts.energy ?? null;
  const step = opts.energyStep ?? ENERGY_STEP_SEC;
  const median = env ? speechMedianDb(env) : null;
  const out: Candidate[] = [];
  for (let i = 0; i < pieces.length; i++) {
    let words = 0;
    let strong = 0;
    let gaps = 0;
    let signals = 0;
    for (let j = i; j < pieces.length; j++) {
      const p = pieces[j]!;
      const dur = p.end - pieces[i]!.start;
      if (dur > L.max) break;
      words += p.words.length;
      strong += p.strong;
      if (p.question || p.number) signals++;
      if (j > i) gaps += Math.max(0, p.start - pieces[j - 1]!.end - DEAD_AIR_SEC);
      if (dur < L.min) continue;

      const first = pieces[i]!;
      const second = pieces[i + 1];
      const hook = Math.max(first.hook, first.end - first.start < 2.5 && second && i + 1 <= j ? 0.6 * second.hook : 0);
      const content = clamp01(strong / (dur / 60) / 14);
      const pace = clamp01(1 - Math.abs(words / dur - IDEAL_WPS) / 2.2);
      let energy = 0.5;
      if (env && median !== null) {
        const m = meanDbBetween(env, first.start, p.end, step);
        if (m !== null) energy = clamp01(0.5 + (m - median) / 8);
      }
      const ending = p.complete ? (/\?["”']?$/.test(p.words.at(-1)!.text.trim()) ? 0.4 : 1) : 0.2;
      const fit = clamp01(1 - Math.abs(dur - L.ideal) / (L.max - L.min));
      const dead = gaps / dur;
      const raw = 28 * hook + 18 * content + 10 * pace + 16 * energy + 12 * ending + 8 * fit + 8 * clamp01(signals / 3) - 25 * dead - (first.connector ? 12 : 0);
      out.push({ i, j, score: Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10, parts: { hook, content, pace, energy, ending, dead }, wordCount: words });
    }
  }
  return out;
}

const TITLE_MAX = 60;

/** Corta no limite sem partir palavra. */
export function shortTitle(text: string, max = TITLE_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

function reasonsOf(c: Candidate, pieces: Piece[]): string[] {
  const window = pieces.slice(c.i, c.j + 1);
  const r: string[] = [];
  if (pieces[c.i]!.question) r.push('começa com pergunta');
  else if (c.parts.hook >= 0.5) r.push('começa forte');
  if (c.parts.energy >= 0.65) r.push('fala mais animada que o resto');
  if (c.parts.content >= 0.6) r.push('muitas palavras fortes');
  if (window.some((p) => p.number)) r.push('tem número');
  if (c.parts.ending === 1) r.push('fecha a ideia');
  if (c.parts.pace >= 0.75) r.push('ritmo bom');
  if (r.length === 0) r.push('trecho de fala contínua');
  return r.slice(0, 4);
}

/**
 * Os `count` melhores momentos, sem sobreposição, do melhor para o pior.
 * `durationSec` limita a folga do fim. Sem fala, ou sem janela do tamanho pedido, devolve [].
 */
export function findMoments(words: Word[], durationSec: number, opts: MomentOptions): Moment[] {
  const pieces = speechPieces(words);
  const spoken = words.filter((w) => w.text.trim());
  const count = Math.max(1, Math.min(MAX_MOMENTS, Math.round(opts.count)));
  const all = candidates(pieces, opts).sort((a, b) => b.score - a.score || pieces[a.i]!.start - pieces[b.i]!.start);
  const chosen: { c: Candidate; start: number; end: number }[] = [];
  for (const c of all) {
    if (chosen.length >= count) break;
    const firstWord = spoken[pieces[c.i]!.first]!;
    const lastWord = spoken[pieces[c.j]!.last]!;
    const prev = spoken[pieces[c.i]!.first - 1];
    const next = spoken[pieces[c.j]!.last + 1];
    const start = Math.min(firstWord.start, Math.max(0, firstWord.start - LEAD_SEC, prev ? prev.end + 0.02 : 0));
    const end = Math.max(lastWord.end, Math.min(durationSec, lastWord.end + TAIL_SEC, next ? next.start - 0.02 : Infinity));
    if (chosen.some((x) => start < x.end + MOMENT_GAP_SEC && end > x.start - MOMENT_GAP_SEC)) continue;
    chosen.push({ c, start, end });
  }
  return chosen.map(({ c, start, end }, k) => {
    const window = pieces.slice(c.i, c.j + 1);
    const titled = window.filter((p) => p.words.length <= 14);
    const best = (titled.length ? titled : window).reduce((a, b) => (b.hook > a.hook ? b : a));
    return {
      id: `m${k + 1}`,
      rank: k + 1,
      start: round3(start),
      end: round3(end),
      title: shortTitle(textOf(best.words)),
      text: textOf(window.flatMap((p) => p.words)),
      score: c.score,
      reasons: reasonsOf(c, pieces),
      wordCount: c.wordCount,
    };
  });
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** "1:02:05" ou "12:05". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Quanto cada clique em "começar antes / terminar depois" anda, mais ou menos (encaixa na palavra mais perto). */
export const NUDGE_SEC = 3;
/** Clipe ajustado à mão: limites para continuar sendo um Reels. */
export const NUDGE_MIN_SEC = 5;
export const NUDGE_MAX_SEC = 180;

/**
 * Ajuste fino de um momento: move o começo (`edge: 'start'`) ou o fim (`'end'`) cerca de NUDGE_SEC para
 * antes (`dir: -1`) ou depois (`+1`), sempre encaixando numa palavra (nunca corta palavra no meio) e com a
 * mesma folga da escolha automática. O texto é refeito com as palavras dentro do novo trecho.
 * Sem palavra para onde ir, ou se o clipe ficaria curto/longo demais, devolve o momento como estava.
 */
export function nudgeMoment(m: Moment, words: Word[], durationSec: number, edge: 'start' | 'end', dir: -1 | 1): Moment {
  const spoken = words.filter((w) => w.text.trim());
  if (spoken.length === 0) return m;
  const inside = (s: number, e: number) => spoken.filter((w) => w.start >= s - 1e-6 && w.end <= e + 1e-6);
  let start = m.start;
  let end = m.end;
  if (edge === 'start') {
    const cur = inside(m.start, m.end)[0];
    const target = (cur?.start ?? m.start) + dir * NUDGE_SEC;
    const options = spoken.filter((w) => (dir < 0 ? w.start < (cur?.start ?? m.start) - 1e-6 : w.start > (cur?.start ?? m.start) + 1e-6) && w.end <= m.end);
    if (options.length === 0) return m;
    const w = options.reduce((a, b) => (Math.abs(b.start - target) < Math.abs(a.start - target) ? b : a));
    const prev = spoken[spoken.indexOf(w) - 1];
    start = Math.min(w.start, Math.max(0, w.start - LEAD_SEC, prev ? prev.end + 0.02 : 0));
  } else {
    const cur = inside(m.start, m.end).at(-1);
    const target = (cur?.end ?? m.end) + dir * NUDGE_SEC;
    const options = spoken.filter((w) => (dir > 0 ? w.end > (cur?.end ?? m.end) + 1e-6 : w.end < (cur?.end ?? m.end) - 1e-6) && w.start >= m.start);
    if (options.length === 0) return m;
    const w = options.reduce((a, b) => (Math.abs(b.end - target) < Math.abs(a.end - target) ? b : a));
    const next = spoken[spoken.indexOf(w) + 1];
    end = Math.max(w.end, Math.min(durationSec, w.end + TAIL_SEC, next ? next.start - 0.02 : Infinity));
  }
  if (end - start < NUDGE_MIN_SEC || end - start > NUDGE_MAX_SEC) return m;
  const ws = inside(start, end);
  return { ...m, start: round3(start), end: round3(end), text: textOf(ws), wordCount: ws.length };
}
