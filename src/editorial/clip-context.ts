import { AppError } from '../core/errors';
import type { Word } from '../core/types';

export interface ContextSentence { id: string; first: number; last: number; text: string; complete: boolean; question: boolean }
export interface TranscriptIndex {
  version: 1; words: readonly Word[]; sentences: ContextSentence[];
  positions: ReadonlyMap<string, number>; sentenceAt: readonly number[]; duration: number;
}
export interface ContextWindow { id: string; firstSentence: number; lastSentence: number; firstWord: number; lastWord: number; body: string; insufficientOverlap?: boolean }
const textOf = (words: readonly Word[]) => words.map((word) => word.text.trim()).join(' ');
const terminal = (text: string) => /[.!?…]["”')]*$/.test(text.trim());
const backReference = /^(?:isso|isto|esse|essa|esses|essas|ele|ela|eles|elas|aquilo|portanto|então|como (?:eu )?falei|this|that|it|he|she|they|as i said)\b/iu;
const hanging = /\b(?:se|porque|mas|porém|embora|que|e|ou|if|because|but|although|and|or)\s*[,.!?…]*$/iu;

/** Stable source IDs; no sorting, rewriting or inferred speaker/confidence labels. */
export function buildTranscriptIndex(words: readonly Word[], duration: number): TranscriptIndex {
  if (!Number.isFinite(duration) || duration <= 0 || words.length > 200_000) throw new AppError('CLIPES_CONTEXTO_INVALIDO');
  const positions = new Map<string, number>();
  let previousStart = -1;
  for (const [i, word] of words.entries()) {
    if (!word.id || word.id.length > 200 || positions.has(word.id) || !word.text.trim() || word.text.length > 1000 || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < previousStart || word.start < 0 || word.end <= word.start || word.end > duration + 0.1) throw new AppError('CLIPES_CONTEXTO_INVALIDO');
    positions.set(word.id, i); previousStart = word.start;
  }
  const sentences: ContextSentence[] = [];
  const sentenceAt: number[] = [];
  let first = 0;
  let chars = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    chars += word.id.length + word.text.length + 10;
    const next = words[i + 1];
    const complete = terminal(word.text);
    if (complete || !next || next.start - word.end >= 0.8 || chars >= 1800) {
      const text = textOf(words.slice(first, i + 1));
      const sentence = { id: `s-${words[first]!.id}-${word.id}`, first, last: i, text, complete, question: /\?["”')]*$/.test(word.text.trim()) };
      for (let j = first; j <= i; j++) sentenceAt[j] = sentences.length;
      sentences.push(sentence); first = i + 1; chars = 0;
    }
  }
  return { version: 1, words, sentences, positions, sentenceAt, duration };
}

/** UTF-8 upper bound after the transcript delimiter escaping used by AI requests. */
export function escapedUtf8Bytes(text: string): number {
  let bytes = 0;
  for (const c of text) {
    const code = c.codePointAt(0)!;
    bytes += c === '<' || c === '>' ? 3 : code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Bounded payloads, with a full possible clip of temporal overlap whenever the byte budget allows. */
export function partitionContextWindows(index: TranscriptIndex, maxBytes = 5000, signal?: AbortSignal, overlapSeconds = 0): ContextWindow[] {
  if (!Number.isFinite(maxBytes) || maxBytes < 512 || maxBytes > 32_000 || !Number.isFinite(overlapSeconds) || overlapSeconds < 0) throw new AppError('CLIPES_CONTEXTO_INVALIDO');
  const lines = index.sentences.map(sentence => JSON.stringify({ sentence: sentence.id, boundary: sentence.complete ? 'punctuation' : 'uncertain',
    start: index.words[sentence.first]!.start, end: index.words[sentence.last]!.end,
    words: index.words.slice(sentence.first, sentence.last + 1).map(word => [word.id, word.text]) }));
  const costs = lines.map(escapedUtf8Bytes);
  const out: ContextWindow[] = [];
  let first = 0;
  while (first < index.sentences.length) {
    if (signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
    if (out.length >= 2048) throw new AppError('CLIPES_CONTEXTO_INVALIDO', 'O limite de janelas foi atingido; preservei candidatos locais.');
    let last = first, bytes = 0;
    const start = index.words[index.sentences[first]!.first]!.start;
    while (last < index.sentences.length) {
      if (costs[last]! > maxBytes) throw new AppError('CLIPES_CONTEXTO_INVALIDO', 'Uma frase excede o contexto disponível; preservei candidatos locais.');
      const end = index.words[index.sentences[last]!.last]!.end;
      if (last > first && (bytes + costs[last]! + 1 > maxBytes || (overlapSeconds > 0 && end - start > overlapSeconds * 2 + 24))) break;
      bytes += costs[last]! + (last > first ? 1 : 0); last++;
    }
    const end = last - 1, endTime = index.words[index.sentences[end]!.last]!.end;
    let next = end > first ? end : last;
    if (overlapSeconds > 0 && last < index.sentences.length) {
      next = first + 1;
      while (next < end && index.words[index.sentences[next]!.first]!.start < endTime - overlapSeconds) next++;
    }
    const overlap = next < last ? endTime - index.words[index.sentences[next]!.first]!.start : 0;
    out.push({ id: `window-${first}-${end}`, firstSentence: first, lastSentence: end,
      firstWord: index.sentences[first]!.first, lastWord: index.sentences[end]!.last, body: lines.slice(first, last).join('\n'),
      insufficientOverlap: overlapSeconds > 0 && last < index.sentences.length && overlap < overlapSeconds });
    if (last >= index.sentences.length) break;
    first = next;
  }
  return out;
}

export function sentenceBounds(index: TranscriptIndex, first: number, last: number, maxSeconds: number): { first: number; last: number; flags: string[] } {
  let a = index.sentenceAt[first];
  let b = index.sentenceAt[last];
  if (a === undefined || b === undefined || a > b) throw new AppError('CLIPES_CONTEXTO_INVALIDO');
  for (let attempts = 0; attempts < 2 && a > 0 && backReference.test(index.sentences[a]!.text); attempts++) {
    const previous = index.sentences[a - 1]!;
    if (index.words[index.sentences[b]!.last]!.end - index.words[previous.first]!.start > maxSeconds) break;
    a--;
  }
  if (index.sentences[b]!.question && b + 1 < index.sentences.length && index.words[index.sentences[b + 1]!.last]!.end - index.words[index.sentences[a]!.first]!.start <= maxSeconds) b++;
  const start = index.sentences[a]!;
  const end = index.sentences[b]!;
  const flags: string[] = [];
  if (backReference.test(start.text)) flags.push('A abertura pode precisar de antecedente: ouça a frase anterior.');
  if (a > 0 && !index.sentences[a - 1]!.complete) flags.push('O início foi separado por pausa/limite, sem pontuação confiável.');
  if (!end.complete || hanging.test(end.text)) flags.push('O final pode interromper uma frase ou condição.');
  if (end.question) flags.push('Termina em pergunta sem resposta no trecho.');
  return { first: start.first, last: end.last, flags };
}

export function contextAround(index: TranscriptIndex, start: number, end: number): { before: string; after: string } {
  const words = index.words;
  const firstStartingAt = (time: number): number => {
    let lo = 0;
    let hi = words.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (words[mid]!.start < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const before: Word[] = [];
  for (let i = firstStartingAt(start - 12); i < words.length && words[i]!.start <= start; i++) {
    if (words[i]!.end <= start) before.push(words[i]!);
  }
  const after: Word[] = [];
  for (let i = firstStartingAt(end); i < words.length && words[i]!.start <= end + 12; i++) {
    if (words[i]!.end <= end + 12) after.push(words[i]!);
  }
  return { before: textOf(before), after: textOf(after) };
}
