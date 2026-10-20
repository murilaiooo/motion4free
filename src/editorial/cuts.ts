import type { CutLevel } from '../core/look';
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

/** Pausa entre palavras que o corte "agressivo" tira (s) e margem mantida em volta da fala. */
export const AGGRESSIVE_GAP_SEC = 0.3;
export const AGGRESSIVE_PAD_SEC = 0.06;
/** Cortes menores que isto voltam no modo "suave". */
export const GENTLE_MIN_CUT_SEC = 0.8;

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Subtrai intervalos de uma lista de trechos mantidos. */
function subtract(keep: Segment[], cuts: TimeRange[]): Segment[] {
  let out = keep;
  for (const c of cuts) {
    const next: Segment[] = [];
    for (const s of out) {
      if (c.end <= s.srcStart || c.start >= s.srcEnd) {
        next.push(s);
        continue;
      }
      if (c.start > s.srcStart) next.push({ srcStart: s.srcStart, srcEnd: c.start });
      if (c.end < s.srcEnd) next.push({ srcStart: c.end, srcEnd: s.srcEnd });
    }
    out = next;
  }
  return out;
}

/**
 * Ritmo dos cortes pedido por texto (v0.6). Puro e determinístico.
 * - "agressivo": além dos cortes atuais, tira pausas entre palavras ≥ 0,3 s (fica 0,06 s de margem
 *   em volta da fala) e o silêncio antes da primeira e depois da última palavra;
 * - "suave": devolve os cortes menores que 0,8 s (pausas curtas voltam);
 * - "normal": não muda nada.
 * Nunca corta dentro de uma palavra, nunca mexe dentro de `protectedSpans` (trechos travados) e nunca
 * devolve uma lista vazia (se tudo sumiria, fica como estava).
 */
export function retimeCuts(segments: Segment[], words: Word[], durationSec: number, level: CutLevel, protectedSpans: TimeRange[] = []): Segment[] {
  if (level === 'normal') return segments;
  const touches = (r: TimeRange) => protectedSpans.some((p) => r.start < p.end && r.end > p.start);
  let next: Segment[];
  if (level === 'agressivo') {
    const ws = words.filter((w) => w.text.trim()).sort((a, b) => a.start - b.start);
    if (ws.length === 0) return segments;
    const cuts: TimeRange[] = [];
    const first = ws[0]!;
    if (first.start - AGGRESSIVE_PAD_SEC * 2 > 0.15) cuts.push({ start: 0, end: first.start - AGGRESSIVE_PAD_SEC * 2 });
    for (let i = 0; i + 1 < ws.length; i++) {
      const a = Math.max(...ws.slice(0, i + 1).map((w) => w.end));
      const b = ws[i + 1]!.start;
      if (b - a >= AGGRESSIVE_GAP_SEC) cuts.push({ start: a + AGGRESSIVE_PAD_SEC, end: b - AGGRESSIVE_PAD_SEC });
    }
    const lastEnd = Math.max(...ws.map((w) => w.end));
    if (durationSec - lastEnd > 0.35) cuts.push({ start: lastEnd + 0.15, end: durationSec });
    next = subtract(segments, cuts.filter((c) => c.end - c.start > 0.05 && !touches(c)));
  } else {
    // cortes atuais (o que fica entre os trechos mantidos, incluindo começo e fim)
    const sorted = [...segments].sort((a, b) => a.srcStart - b.srcStart);
    const gaps: TimeRange[] = [];
    let cursor = 0;
    for (const s of sorted) {
      if (s.srcStart - cursor > 1e-4) gaps.push({ start: cursor, end: s.srcStart });
      cursor = Math.max(cursor, s.srcEnd);
    }
    if (durationSec - cursor > 1e-4) gaps.push({ start: cursor, end: durationSec });
    const restore = gaps.filter((g) => g.end - g.start < GENTLE_MIN_CUT_SEC && !touches(g));
    const all = [...sorted.map((s) => ({ start: s.srcStart, end: s.srcEnd })), ...restore].sort((a, b) => a.start - b.start);
    next = [];
    for (const r of all) {
      const last = next.at(-1);
      if (last && r.start <= last.srcEnd + 1e-4) last.srcEnd = Math.max(last.srcEnd, r.end);
      else next.push({ srcStart: r.start, srcEnd: r.end });
    }
  }
  const clean = next.filter((s) => s.srcEnd - s.srcStart >= 0.1).map((s) => ({ srcStart: r3(s.srcStart), srcEnd: r3(s.srcEnd) }));
  return clean.length ? clean : segments;
}
