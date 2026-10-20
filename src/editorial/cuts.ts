import type { Segment, TimeRange, Word } from '../core/types';

export interface CutOptions {
  /** Margem preservada em volta da fala, para não comer consoantes. */
  padSec: number;
  /** Trechos de fala menores que isto, isolados, são descartados. */
  minKeepSec: number;
}

export const DEFAULT_CUTS: CutOptions = { padSec: 0.12, minKeepSec: 0.2 };

/**
 * Remove silêncios longos sem nunca cortar dentro de uma palavra.
 * Regra de proteção: se um silêncio detectado se sobrepõe a uma palavra
 * (transcrição diz que há fala ali), o silêncio é encolhido para fora da palavra.
 */
export function planKeepSegments(durationSec: number, silences: TimeRange[], words: Word[], opts: CutOptions = DEFAULT_CUTS): Segment[] {
  const cuts: TimeRange[] = [];
  for (const s of silences) {
    let start = s.start + opts.padSec;
    let end = s.end - opts.padSec;
    for (const w of words) {
      if (w.end <= start || w.start >= end) continue;
      // palavra dentro do silêncio: preserva a palavra e corta só o que sobra antes ou depois
      if (w.start - start >= end - w.end) end = Math.min(end, w.start - opts.padSec);
      else start = Math.max(start, w.end + opts.padSec);
    }
    if (end - start > 0.05) cuts.push({ start, end });
  }

  const keep: Segment[] = [];
  let cursor = 0;
  for (const c of cuts.sort((a, b) => a.start - b.start)) {
    if (c.start > cursor) keep.push({ srcStart: cursor, srcEnd: c.start });
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < durationSec) keep.push({ srcStart: cursor, srcEnd: durationSec });
  return keep.filter((s) => s.srcEnd - s.srcStart >= opts.minKeepSec).map(round);
}

function round(s: Segment): Segment {
  return { srcStart: Math.round(s.srcStart * 1000) / 1000, srcEnd: Math.round(s.srcEnd * 1000) / 1000 };
}
