import type { Caption, Segment, Word } from '../core/types';
import { sourceToOutput } from '../engine/timeline';

export interface CaptionOptions {
  maxChars: number;
  maxDurationSec: number;
}

export const DEFAULT_CAPTIONS: CaptionOptions = { maxChars: 22, maxDurationSec: 1.6 };

/** Agrupa palavras em legendas curtas (estilo Reels) já no tempo do vídeo editado. */
export function buildCaptions(words: Word[], segments: Segment[], opts: CaptionOptions = DEFAULT_CAPTIONS): Caption[] {
  const placed = words
    .map((w) => {
      const start = sourceToOutput(segments, w.start);
      const end = sourceToOutput(segments, Math.max(w.start, w.end - 1e-3));
      return start === null || end === null ? null : { ...w, start, end: end + 1e-3 };
    })
    .filter((w): w is Word => w !== null);

  const captions: Caption[] = [];
  let group: Word[] = [];
  const flush = () => {
    if (group.length === 0) return;
    captions.push({
      id: `c${captions.length + 1}`,
      text: group.map((g) => g.text.trim()).join(' '),
      start: group[0]!.start,
      end: group[group.length - 1]!.end,
      wordIds: group.map((g) => g.id),
    });
    group = [];
  };

  for (const w of placed) {
    const text = [...group, w].map((g) => g.text.trim()).join(' ');
    const tooLong = text.length > opts.maxChars;
    const tooSlow = group.length > 0 && w.end - group[0]!.start > opts.maxDurationSec;
    const gap = group.length > 0 && w.start - group[group.length - 1]!.end > 0.6;
    if (group.length > 0 && (tooLong || tooSlow || gap)) flush();
    group.push(w);
    if (/[.!?]$/.test(w.text.trim())) flush();
  }
  flush();
  return captions;
}
