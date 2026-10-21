import type { Caption, Segment, Word } from '../core/types';
import type { StyleDNA } from '../core/style';
import { placeSpan } from '../engine/timeline';

export interface CaptionOptions {
  maxChars: number;
  maxDurationSec: number;
  maxWords: number;
}

export const DEFAULT_CAPTIONS: CaptionOptions = { maxChars: 22, maxDurationSec: 1.6, maxWords: 8 };

/** Cada estilo tem seu tamanho de legenda (Pop: 3 palavras; Documental: frases maiores). */
export function captionOptionsFor(style: StyleDNA): CaptionOptions {
  return { maxChars: style.captions.maxChars, maxWords: style.captions.maxWords, maxDurationSec: Math.max(1.2, style.captions.maxWords * 0.45) };
}

/** Agrupa palavras em legendas curtas (estilo Reels) já no tempo do vídeo editado. */
export function buildCaptions(words: Word[], segments: Segment[], opts: CaptionOptions = DEFAULT_CAPTIONS): Caption[] {
  // cada vez que a palavra aparece no vídeo editado (um pedaço colado de novo repete a fala dele)
  const placed = words
    .flatMap((w) => placeSpan(segments, w.start, Math.max(w.start, w.end - 1e-3)).map((o) => ({ ...w, start: o.start, end: o.end + 1e-3 })))
    .sort((a, b) => a.start - b.start);

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
      wordStarts: group.map((g) => g.start),
    });
    group = [];
  };

  placed.forEach((w, k) => {
    const text = [...group, w].map((g) => g.text.trim()).join(' ');
    // a última palavra da frase (ou da fala) não fica sozinha numa legenda: cabe uma a mais
    const closes = /[.!?]$/.test(w.text.trim()) || k === placed.length - 1;
    const orphanSaved = closes && group.length === opts.maxWords && text.length <= opts.maxChars + 8;
    const tooLong = !orphanSaved && (text.length > opts.maxChars || group.length >= opts.maxWords);
    const tooSlow = group.length > 0 && w.end - group[0]!.start > opts.maxDurationSec;
    const gap = group.length > 0 && w.start - group[group.length - 1]!.end > 0.6;
    if (group.length > 0 && (tooLong || tooSlow || gap)) flush();
    group.push(w);
    if (/[.!?]$/.test(w.text.trim())) flush();
  });
  flush();
  return captions;
}
