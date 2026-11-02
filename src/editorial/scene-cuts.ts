import type { Word } from '../core/types';

/**
 * Corte na troca de cena (v0.39, ADR-0040). Séries, filmes e vídeos editados mudam de plano o tempo todo; um
 * clipe que começa 4 quadros antes de uma troca de plano parece erro de edição. Aqui só há contas puras:
 * comparar histogramas de quadros pequenos (técnica clássica de detecção de corte, como no PySceneDetect,
 * BSD-3, reimplementada sem copiar código) e decidir se vale mover o começo/fim do clipe até a troca mais
 * próxima. Nunca se move a borda por cima de uma palavra falada: fala inteira vale mais que corte bonito.
 */

/** Distância entre dois histogramas (0 = iguais, 1 = nada em comum). */
export function histogramDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) sa += a[i]!;
  for (let i = 0; i < b.length; i++) sb += b[i]!;
  if (!(sa > 0 && sb > 0) || a.length !== b.length) return 0;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i]! / sa - b[i]! / sb);
  return d / 2;
}

/** Histograma de luz (16 faixas) + cor grossa (4×4×4) de pixels RGBA. */
export function frameHistogram(rgba: ArrayLike<number>): Float32Array {
  const h = new Float32Array(16 + 64);
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    h[Math.min(15, y >> 4)]! += 1;
    h[16 + ((r >> 6) << 4) + ((g >> 6) << 2) + (b >> 6)]! += 1;
  }
  return h;
}

/**
 * Trocas de cena a partir das diferenças entre quadros seguidos. `times[i]` é o momento do quadro i;
 * `diffs[i]` compara o quadro i com o i-1 (diffs[0] é ignorado). A troca fica no meio dos dois quadros.
 */
export function cutsFromDiffs(times: readonly number[], diffs: readonly number[], threshold = 0.35): number[] {
  const sorted = diffs.slice(1).filter(Number.isFinite).sort((x, y) => x - y);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
  // Câmera tremendo ou luz piscando sobe todas as diferenças: a troca precisa se destacar do resto.
  const limit = Math.max(threshold, median * 3);
  const cuts: number[] = [];
  for (let i = 1; i < diffs.length; i++) {
    const d = diffs[i]!;
    if (!(d >= limit)) continue;
    if (d < (diffs[i - 1] ?? 0) || d < (diffs[i + 1] ?? 0)) continue;
    const t = (times[i - 1]! + times[i]!) / 2;
    if (cuts.length && t - cuts.at(-1)! < 0.3) continue;
    cuts.push(t);
  }
  return cuts;
}

const crossesSpeech = (words: readonly Word[], a: number, b: number): boolean => {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return words.some((w) => w.end > lo + 0.02 && w.start < hi - 0.02);
};

/** Metade do intervalo de amostragem (10 quadros/s) mais um pouco. */
export const SNAP_MARGIN = 0.06;

export interface SnapResult { start: number; end: number; snappedStart: boolean; snappedEnd: boolean }

/**
 * Leva começo e fim do clipe à troca de cena mais próxima, se houver uma perto e sem fala no caminho.
 * Começo: até 1,5 s antes ou 0,8 s depois. Fim: até 0,8 s antes ou 1,5 s depois (deixa o plano terminar).
 */
export function snapToCuts(start: number, end: number, cuts: readonly number[], words: readonly Word[], duration = Infinity): SnapResult {
  const pick = (t: number, before: number, after: number, other: number, isStart: boolean) => {
    let best: number | null = null;
    for (const c of cuts) {
      if (c < t - before || c > t + after || c < 0 || c > duration) continue;
      if (isStart ? c >= other - 3 : c <= other + 3) continue;
      if (crossesSpeech(words, t, c)) continue;
      if (best === null || Math.abs(c - t) < Math.abs(best - t)) best = c;
    }
    return best;
  };
  const s = pick(start, 1.5, 0.8, end, true);
  const e = pick(end, 0.8, 1.5, s ?? start, false);
  // A troca foi medida entre dois quadros amostrados: uma folga pequena evita 1 quadro do plano vizinho.
  return { start: s !== null ? Math.min(s + SNAP_MARGIN, end) : start, end: e !== null ? Math.max(e - SNAP_MARGIN, start) : end, snappedStart: s !== null, snappedEnd: e !== null };
}
