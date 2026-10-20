import type { TimeRange } from '../core/types';

/**
 * Volume igual entre clipes (v0.14). Cada clipe é gravado num lugar e distância diferentes; sem acerto,
 * um clipe soa bem mais alto que o outro. Mede o nível da fala de cada clipe (energia média só fora dos
 * silêncios) e calcula um ganho por clipe até a mediana dos clipes, com teto de ±9 dB e sem estourar o pico.
 * Puro e testado (tests/loudness.test.ts).
 */

export const MAX_GAIN_DB = 9;
export const PEAK_CEILING = 0.97;

/** Nível da fala (dBFS, energia média dos quadros fora dos silêncios). null = sem fala para medir. */
export function speechLevelDb(samples: Float32Array, sampleRate: number, silences: readonly TimeRange[], frameSec = 0.02): number | null {
  const frameLen = Math.max(1, Math.round(sampleRate * frameSec));
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  let sum = 0;
  let count = 0;
  let k = 0;
  for (let start = 0; start + frameLen <= samples.length; start += frameLen) {
    const t = (start + frameLen / 2) / sampleRate;
    while (k < sorted.length && sorted[k]!.end <= t) k++;
    if (k < sorted.length && sorted[k]!.start <= t) continue;
    let e = 0;
    for (let i = start; i < start + frameLen; i++) e += samples[i]! * samples[i]!;
    sum += e / frameLen;
    count++;
  }
  if (count === 0 || sum <= 0) return null;
  return 10 * Math.log10(sum / count);
}

/** Maior valor absoluto (pico) de um sinal. */
export function peakOf(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]!);
    if (v > p) p = v;
  }
  return p;
}

/**
 * Ganho linear de cada clipe para todos falarem no mesmo nível (a mediana).
 * Clipe sem fala (null) fica como está. Ganho limitado a ±9 dB e ao pico (nada passa de 0,97).
 */
export function clipGains(levels: readonly (number | null)[], peaks: readonly number[]): number[] {
  const known = levels.filter((l): l is number => l !== null).sort((a, b) => a - b);
  if (known.length < 2) return levels.map(() => 1);
  const mid = known.length / 2;
  const target = known.length % 2 ? known[Math.floor(mid)]! : (known[mid - 1]! + known[mid]!) / 2;
  return levels.map((l, i) => {
    if (l === null) return 1;
    const db = Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, target - l));
    let g = Math.pow(10, db / 20);
    const peak = peaks[i] ?? 0;
    if (peak > 0 && g * peak > PEAK_CEILING) g = Math.max(Math.min(1, g), PEAK_CEILING / peak);
    return Math.round(g * 10000) / 10000;
  });
}
