import type { Word } from '../core/types';
import { CLIP_LENGTHS, LEAD_SEC, TAIL_SEC, MAX_MOMENTS, clock, type Moment, type MomentOptions } from './highlights';
import { buildTranscriptIndex, sentenceBounds, type TranscriptIndex } from './clip-context';

export function groundedMoment(index: TranscriptIndex, first: number, last: number, opts: MomentOptions, source: 'local-context' | 'ai-context' = 'local-context', titleBounds?: [number, number], manual = false): Moment | null {
  const limit = manual ? { min: 5, max: 180 } : CLIP_LENGTHS[opts.length];
  if (first < 0 || last < first || last >= index.words.length) return null;
  const bounds = sentenceBounds(index, first, last, limit.max);
  const words = index.words.slice(bounds.first, bounds.last + 1);
  const a = words[0]!; const b = words.at(-1)!;
  const duration = b.end - a.start;
  if (duration < limit.min || duration > limit.max) return null;
  const text = words.map((word) => word.text.trim()).join(' ');
  const previous = index.words[bounds.first - 1]; const next = index.words[bounds.last + 1];
  const start = Math.min(a.start, Math.max(0, a.start - LEAD_SEC, previous ? previous.end + 0.02 : 0));
  const end = Math.max(b.end, Math.min(index.duration, b.end + TAIL_SEC, next ? next.start - 0.02 : Infinity));
  const questions = text.includes('?');
  const specificity = Math.min(10, (text.match(/\d+/g)?.length ?? 0) * 2);
  const score = Math.max(0, Math.min(100, 65 + specificity + (questions ? 4 : 0) + (source === 'ai-context' ? 3 : 0) - bounds.flags.length * 20));
  const titleSentence = index.sentences[index.sentenceAt[titleBounds?.[0] ?? bounds.first]!]!;
  const titleWords = titleSentence.first >= bounds.first && titleSentence.last <= bounds.last
    ? index.words.slice(titleSentence.first, titleSentence.last + 1)
    : index.words.slice(bounds.first, index.sentences[index.sentenceAt[bounds.first]!]!.last + 1);
  const titleText = titleWords.map((word) => word.text.trim()).join(' ');
  // A cropped quotation can drop 'não/if/até'. Use a whole short sentence or a neutral time label.
  const title = titleText.length <= 60 && /[.!?…]["”')]*$/.test(titleText) ? titleText : `Trecho em ${clock(start)}`;
  return {
    id: `ctx-${a.id}-${b.id}`, rank: 0, start, end,
    title, text, score, wordCount: words.length,
    reasons: [source === 'ai-context' ? 'span proposto pela IA e ancorado na transcrição' : 'candidato local por frases da gravação', 'nota estrutural estimada; não prevê visualizações', ...(bounds.flags.length ? ['precisa de revisão de contexto antes de selecionar'] : ['sem sinal estrutural óbvio de frase interrompida; confira o sentido'])],
    sourceEvidence: { firstWordId: a.id, lastWordId: b.id, review: bounds.flags, source },
  };
}

export function rankContextualMoments(input: readonly Moment[], count: number): Moment[] {
  const sorted = [...input].sort((a, b) => (a.sourceEvidence?.review.length ?? 0) - (b.sourceEvidence?.review.length ?? 0) || b.score - a.score || a.start - b.start);
  const selected: Moment[] = [];
  for (const moment of sorted) {
    const duplicate = selected.some((other) => {
      const overlap = Math.max(0, Math.min(moment.end, other.end) - Math.max(moment.start, other.start));
      return overlap / Math.max(0.001, Math.min(moment.end - moment.start, other.end - other.start)) > 0.5;
    });
    if (duplicate) continue;
    selected.push(moment);
    if (selected.length >= Math.min(600, Math.max(1, count))) break;
  }
  return selected.map((moment, i) => ({ ...moment, rank: i + 1 }));
}

/** All sentence starts are explored, not only a heuristic top-N. Candidate memory is bounded. */
export function findContextualMoments(words: readonly Word[], duration: number, opts: MomentOptions): Moment[] {
  const index = buildTranscriptIndex(words, duration);
  const limit = CLIP_LENGTHS[opts.length];
  let pool: Moment[] = [];
  for (let a = 0; a < index.sentences.length; a++) {
    const first = index.sentences[a]!.first;
    for (let b = a; b < index.sentences.length; b++) {
      const last = index.sentences[b]!.last;
      const seconds = index.words[last]!.end - index.words[first]!.start;
      if (seconds > limit.max) break;
      if (seconds < limit.min) continue;
      const moment = groundedMoment(index, first, last, opts);
      if (moment) pool.push(moment);
    }
    // Retain temporal diversity across the whole recording rather than a prefix-only cap.
    if (pool.length > 600) pool = rankContextualMoments(pool, 200);
  }
  // The old finder remains an explicit UI baseline; do not allocate its all-pairs pool on this bounded path.
  return rankContextualMoments(pool, Math.min(MAX_MOMENTS, opts.count));
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
  return next ? { ...next, rank: moment.rank, title: moment.userTitle ? moment.title : next.title, userTitle: moment.userTitle, reasons: ['bordas ajustadas manualmente por frase; confira o contexto', ...next.reasons] } : moment;
}
