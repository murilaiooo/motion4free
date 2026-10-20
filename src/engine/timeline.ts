import type { Segment } from '../core/types';

export function outputDuration(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + (s.srcEnd - s.srcStart), 0);
}

/** Converte um instante do vídeo editado no instante correspondente do original. */
export function outputToSource(segments: Segment[], t: number): number | null {
  if (t < 0) return null;
  let offset = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (t < offset + len) return s.srcStart + (t - offset);
    offset += len;
  }
  return null;
}

/** Converte um instante do original para o vídeo editado; null se o trecho foi cortado. */
export function sourceToOutput(segments: Segment[], src: number): number | null {
  let offset = 0;
  for (const s of segments) {
    if (src >= s.srcStart && src < s.srcEnd) return offset + (src - s.srcStart);
    offset += s.srcEnd - s.srcStart;
  }
  return null;
}
