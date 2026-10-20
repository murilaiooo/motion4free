import type { Segment, TimeRange } from '../core/types';

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

/**
 * Como outputToSource, mas para o FIM de um intervalo: no instante exato de uma emenda devolve o fim
 * do trecho anterior (e não o começo do próximo), e no fim do vídeo devolve o fim do último trecho.
 */
export function outputToSourceEnd(segments: Segment[], t: number): number | null {
  if (t <= 0) return null;
  let offset = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (t <= offset + len + 1e-9) return s.srcStart + Math.min(len, t - offset);
    offset += len;
  }
  return null;
}

/**
 * Onde um intervalo do original [srcStart, srcEnd) aparece no vídeo editado. Como os trechos estão
 * em ordem, a parte mantida é sempre contínua no vídeo editado. null = nada dele ficou.
 */
export function rangeOut(segments: Segment[], range: { srcStart: number; srcEnd: number }): TimeRange | null {
  let offset = 0;
  let start: number | null = null;
  let end: number | null = null;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    const a = Math.max(s.srcStart, range.srcStart);
    const b = Math.min(s.srcEnd, range.srcEnd);
    if (b > a) {
      if (start === null) start = offset + (a - s.srcStart);
      end = offset + (b - s.srcStart);
    }
    offset += len;
  }
  return start === null || end === null ? null : { start, end };
}
