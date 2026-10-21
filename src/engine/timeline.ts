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
 * Onde um intervalo do original [srcStart, srcEnd) aparece no vídeo editado (do primeiro ao último
 * pedaço que usa parte dele). Com os pedaços na ordem do original, a parte mantida é sempre contínua.
 * null = nada dele ficou.
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
      start = Math.min(start ?? Infinity, offset + (a - s.srcStart));
      end = Math.max(end ?? -Infinity, offset + (b - s.srcStart));
    }
    offset += len;
  }
  return start === null || end === null ? null : { start, end };
}

/**
 * Pedaços na ordem do original e sem repetir nada? (v0.17: na linha do tempo Edição dá para mudar a
 * ordem e colar cópias; aí o mesmo instante do original pode aparecer duas vezes.)
 */
export function isSourceOrdered(segments: Segment[]): boolean {
  for (let i = 1; i < segments.length; i++) if (segments[i]!.srcStart < segments[i - 1]!.srcEnd - 1e-6) return false;
  return true;
}

/**
 * Como sourceToOutput, mas um instante cortado vai para a emenda do próximo pedaço do original (para
 * arrastar na linha do tempo). Instante repetido (pedaço colado duas vezes) = a primeira vez.
 */
export function sourceToOutputClamped(segments: Segment[], src: number): number {
  const hit = sourceToOutput(segments, src);
  if (hit !== null) return hit;
  let offset = 0;
  let best: { srcStart: number; out: number } | null = null;
  for (const s of segments) {
    if (s.srcStart >= src && (!best || s.srcStart < best.srcStart)) best = { srcStart: s.srcStart, out: offset };
    offset += s.srcEnd - s.srcStart;
  }
  return best ? best.out : offset;
}

/** Fim de um intervalo do original no vídeo editado: o fim exato de um pedaço conta como dentro dele. */
export function sourceEndToOutputClamped(segments: Segment[], src: number): number {
  let offset = 0;
  for (const s of segments) {
    if (src > s.srcStart && src <= s.srcEnd + 1e-9) return offset + (Math.min(src, s.srcEnd) - s.srcStart);
    offset += s.srcEnd - s.srcStart;
  }
  return sourceToOutputClamped(segments, src);
}

/**
 * Todas as vezes que um trecho do original [start, end) aparece no vídeo editado: começa dentro de um
 * pedaço e termina nele ou num pedaço depois. Com os pedaços na ordem do original é no máximo uma
 * (o mesmo que sourceToOutput no início e no fim); um pedaço colado de novo repete as palavras dele.
 */
export function placeSpan(segments: Segment[], start: number, end: number): TimeRange[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const s of segments) {
    offsets.push(acc);
    acc += s.srcEnd - s.srcStart;
  }
  const out: TimeRange[] = [];
  segments.forEach((s, i) => {
    if (!(start >= s.srcStart && start < s.srcEnd)) return;
    const a = offsets[i]! + (start - s.srcStart);
    for (let j = i; j < segments.length; j++) {
      const t = segments[j]!;
      if (end >= t.srcStart && end < t.srcEnd) {
        out.push({ start: a, end: offsets[j]! + (end - t.srcStart) });
        return;
      }
    }
  });
  return out;
}
