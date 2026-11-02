import type { Word } from '../core/types';
import { CLIP_LENGTHS, LEAD_SEC, TAIL_SEC, MAX_MOMENTS, clock, type Moment, type MomentOptions } from './highlights';
import { buildTranscriptIndex, sentenceBounds, type TranscriptIndex } from './clip-context';
import { CONTEXT_LABELS, contextFlags } from './context-policy';
import { hookCached, leadingFillers, plain, scoreSpan } from './clip-score';

export function groundedMoment(index: TranscriptIndex, first: number, last: number, opts: MomentOptions, source: 'local-context' | 'ai-context' = 'local-context', titleBounds?: [number, number], manual = false, lazyTitle = false): Moment | null {
  const limit = manual ? { min: 5, max: 180, ideal: 45 } : CLIP_LENGTHS[opts.length];
  if (first < 0 || last < first || last >= index.words.length) return null;
  const bounds = sentenceBounds(index, first, last, limit.max);
  // Sem enrolação no começo ("é…", "hum", "então,"): o clipe já abre na frase de verdade (v0.37).
  const skip = manual ? 0 : leadingFillers(index.words.slice(bounds.first, index.sentences[index.sentenceAt[bounds.first]!]!.last + 1));
  const firstWord = bounds.first + skip;
  const words = index.words.slice(firstWord, bounds.last + 1);
  const a = words[0]!; const b = words.at(-1)!;
  const duration = b.end - a.start;
  if (duration < limit.min || duration > limit.max) return null;
  const text = words.map((word) => word.text.trim()).join(' ');
  const previous = index.words[firstWord - 1]; const next = index.words[bounds.last + 1];
  const requestedStart = Math.min(a.start, Math.max(0, a.start - LEAD_SEC, previous ? previous.end + 0.02 : 0));
  const requestedEnd = Math.max(b.end, Math.min(index.duration, b.end + TAIL_SEC, next ? next.start - 0.02 : Infinity));
  const lead = a.start - requestedStart, tail = requestedEnd - b.end;
  const paddingScale = lead + tail > 0 ? Math.min(1, Math.max(0, limit.max - duration) / (lead + tail)) : 0;
  const start = a.start - lead * paddingScale, end = Math.min(start + limit.max, b.end + tail * paddingScale);
  // Nota profissional (gancho, emoção, conclusão, energia, ritmo, fechamento, autonomia, assunto): clip-score.ts.
  const rated = scoreSpan(words, { limit, energy: opts.energy, energyStep: opts.energyStep });
  const score = Math.round(Math.max(0, Math.min(100, rated.score + (source === 'ai-context' ? 3 : 0) - bounds.flags.length * 10)) * 10) / 10;
  // Busca local: o título só é calculado para os escolhidos no fim (withTitle), não para os milhares de candidatos.
  const title = lazyTitle ? '' : titleFor(index, firstWord, bounds.last, titleBounds) ?? `Trecho em ${clock(start)}`;
  return {
    id: `ctx-${a.id}-${b.id}`, rank: 0, start, end,
    title, text, score, wordCount: words.length, breakdown: rated.parts,
    // Alerts are review prompts, not proof of a semantic defect: do NOT distort the
    // ranking by penalizing a correct negation, a condition or a comparison.
    reasons: [...rated.reasons, ...(bounds.flags.length ? ['precisa de revisão de contexto antes de selecionar'] : []), source === 'ai-context' ? 'trecho proposto pela IA e conferido na transcrição' : 'escolhido pelas regras locais', 'nota estimada; não prevê visualizações', ...contextFlags(text).map(flag => CONTEXT_LABELS[flag])],
    sourceEvidence: { firstWordId: a.id, lastWordId: b.id, review: bounds.flags, source },
  };
}

/** Frase inteira cabe até 80 caracteres (o cartão e a legenda do título aguentam; o nome do arquivo corta em 40). */
const TITLE_MAX = 80;
const terminal = (text: string) => /[.!?…]["”')]*$/.test(text);
/** Palavras que mudam o sentido: um título cortado nunca pode deixá-las de fora. */
const MEANING = /\b(nao|nunca|nem|sem|jamais|se|caso|mas|porem|exceto|ate|menos|not|never|no|if|unless|but|except)\b/;
const LEADING_CONNECTOR = /^(e|mas|entao|ai|tipo|bom|so|and|but|so)[,]?\s+/i;

function cleanTitle(text: string): string {
  let t = text.trim();
  const p = plain(t);
  const m = LEADING_CONNECTOR.exec(p);
  // tira só o conectivo do começo ("E o segredo é…" → "O segredo é…"); o resto é a fala exata
  if (m && t.length - m[0].length >= 12) t = t.slice(m[0].length);
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

/**
 * Título = a frase com o gancho mais forte DENTRO do clipe, falada de verdade (nunca inventada).
 * Frase curta e completa vale inteira; frase longa pode virar o começo até a vírgula, com "…", só se o
 * pedaço que fica de fora não tiver palavra que muda o sentido ("não", "se", "mas", "até"…).
 * Sem nada seguro: null (quem chama usa "Trecho em 12:05").
 */
export function titleFor(index: TranscriptIndex, first: number, last: number, titleBounds?: [number, number]): string | null {
  const textOf = (a: number, b: number) => index.words.slice(a, b + 1).map((word) => word.text.trim()).join(' ');
  const inside: { a: number; b: number; text: string; hook: number }[] = [];
  const from = titleBounds ? index.sentenceAt[titleBounds[0]]! : index.sentenceAt[first]!;
  const to = titleBounds ? index.sentenceAt[titleBounds[0]]! : index.sentenceAt[last]!;
  for (let s = from; s <= to; s++) {
    const sentence = index.sentences[s]!;
    const a = Math.max(sentence.first, first), b = Math.min(sentence.last, last);
    if (b < a) continue;
    const text = textOf(a, b);
    // O título deve casar com o começo do clipe: frases mais para o fim valem um pouco menos.
    inside.push({ a, b, text, hook: hookCached(text) - 0.25 * ((a - first) / Math.max(1, last - first)) + (a === first ? 0.05 : 0) });
  }
  const ranked = inside.sort((x, y) => y.hook - x.hook);
  const whole = ranked.find((s) => terminal(s.text) && cleanTitle(s.text).length <= TITLE_MAX && s.text.split(/\s+/).length >= 3);
  if (whole) return cleanTitle(whole.text);
  for (const s of ranked) {
    if (!terminal(s.text) && s.b !== last) continue;
    const comma = s.text.search(/[,;:]\s/);
    if (comma < 12 || comma > TITLE_MAX) continue;
    const kept = s.text.slice(0, comma);
    const dropped = s.text.slice(comma + 1);
    if (MEANING.test(plain(dropped))) continue;
    return `${cleanTitle(kept)}…`;
  }
  return null;
}

/** Review-worthy quality stays first, but near-equal moments should not all come
 * from the beginning of a long recording. The first 20 picks use small temporal
 * novelty (max +14 points); everything else is filled by the original ranking.
 * This is NOT an estimate of views or semantic understanding.
 */
export function rankContextualMoments(input: readonly Moment[], count: number): Moment[] {
  const sorted = [...input].sort((a, b) => (a.sourceEvidence?.review.length ?? 0) - (b.sourceEvidence?.review.length ?? 0) || b.score - a.score || a.start - b.start);
  const limit = Math.min(600, Math.max(1, count));
  const selected: Moment[] = [];
  const midpoint = (moment: Moment) => (moment.start + moment.end) / 2;
  const positions = sorted.map(midpoint);
  const temporalSpan = sorted.length ? Math.max(1, Math.max(...positions) - Math.min(...positions)) : 1;
  const noOverlap = (candidate: Moment) => selected.every(other => {
    const overlap = Math.max(0, Math.min(candidate.end, other.end) - Math.max(candidate.start, other.start));
    return overlap / Math.max(0.001, Math.min(candidate.end - candidate.start, other.end - other.start)) <= 0.5;
  });
  for (let i = 0; i < Math.min(limit, 20); i++) {
    let choice: Moment | null = null;
    let value = -Infinity;
    for (const candidate of sorted) {
      if (selected.includes(candidate) || !noOverlap(candidate)) continue;
      const distance = selected.length ? Math.min(...selected.map(s => Math.abs(midpoint(s) - midpoint(candidate)))) : 0;
      const novelty = selected.length ? 14 * distance / temporalSpan : 0;
      const score = candidate.score - (candidate.sourceEvidence?.review.length ?? 0) * 120 + novelty;
      if (score > value) { choice = candidate; value = score; }
    }
    if (!choice) break;
    selected.push(choice);
  }
  for (const candidate of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(candidate) && noOverlap(candidate)) selected.push(candidate);
  }
  return selected.map((moment, i) => ({ ...moment, rank: i + 1 }));
}

/** Preenche o título de um momento local que foi criado sem título (busca em vídeo longo). */
function withTitle(index: TranscriptIndex, moment: Moment): Moment {
  if (moment.title) return moment;
  const a = moment.sourceEvidence ? index.positions.get(moment.sourceEvidence.firstWordId) : undefined;
  const b = moment.sourceEvidence ? index.positions.get(moment.sourceEvidence.lastWordId) : undefined;
  return { ...moment, title: (a !== undefined && b !== undefined ? titleFor(index, a, b) : null) ?? `Trecho em ${clock(moment.start)}` };
}

/** All sentence starts are explored, not only a heuristic top-N. Candidate memory is bounded. */
export function findContextualMoments(words: readonly Word[], duration: number, opts: MomentOptions): Moment[] {
  const index = buildTranscriptIndex(words, duration);
  const limit = CLIP_LENGTHS[opts.length];
  let pool: Moment[] = [];
  // Monotone search keys tolerate overlapping ASR word ends without an all-pairs loop.
  let furthest = 0;
  const ends = index.sentences.map(sentence => (furthest = Math.max(furthest, index.words[sentence.last]!.end)));
  for (let a = 0; a < index.sentences.length; a++) {
    const first = index.sentences[a]!.first;
    const choices = new Set<number>();
    for (const target of [limit.min, limit.ideal, limit.max]) {
      let lo = a, hi = ends.length;
      const at = index.words[first]!.start + target;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (ends[mid]! < at) lo = mid + 1; else hi = mid; }
      for (const b of [lo - 1, lo, lo + 1]) if (b >= a && b < ends.length) choices.add(b);
    }
    for (const b of choices) {
      const last = index.sentences[b]!.last;
      const seconds = index.words[last]!.end - index.words[first]!.start;
      if (seconds < limit.min || seconds > limit.max) continue;
      const moment = groundedMoment(index, first, last, opts, 'local-context', undefined, false, true);
      if (moment) pool.push(moment);
    }
    // Retain temporal diversity across the whole recording rather than a prefix-only cap.
    if (pool.length > 600) pool = rankContextualMoments(pool, 200);
  }
  // The old finder remains an explicit UI baseline; do not allocate its all-pairs pool on this bounded path.
  return rankContextualMoments(pool, Math.min(MAX_MOMENTS, opts.count)).map((moment) => withTitle(index, moment));
}

/** Manual curation snaps to entire indexed sentences, then re-evaluates the new bounds. */
export function nudgeContextMoment(moment: Moment, words: readonly Word[], duration: number, edge: 'start' | 'end', direction: -1 | 1): Moment {
  const index = buildTranscriptIndex(words, duration);
  const first = words.findIndex((word) => word.start >= moment.start - 0.001);
  let last = first;
  while (last + 1 < words.length && words[last + 1]!.end <= moment.end + 0.001) last++;
  if (first < 0 || last < first) return moment;
  const a = index.sentenceAt[first]! + (edge === 'start' ? direction : 0);
  const b = index.sentenceAt[last]! + (edge === 'end' ? direction : 0);
  if (a < 0 || b >= index.sentences.length || a > b) return moment;
  const next = groundedMoment(index, index.sentences[a]!.first, index.sentences[b]!.last, { length: 'longo', count: 1 }, 'local-context', undefined, true);
  if (next && next.start === moment.start && next.end === moment.end) return moment;
  return next ? { ...next, rank: moment.rank, userBounds: true, title: moment.userTitle ? moment.title : next.title, userTitle: moment.userTitle, reasons: ['bordas ajustadas manualmente por frase; confira o contexto', ...next.reasons] } : moment;
}
