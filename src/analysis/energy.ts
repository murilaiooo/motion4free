/**
 * Energia da fala ao longo do vídeo (v0.22, ADR-0023): um valor em dB a cada `stepSec`. Serve para o
 * criador de clipes notar trechos mais animados (voz mais alta, risadas) em relação ao resto do vídeo.
 */

export const ENERGY_STEP_SEC = 0.5;
/** abaixo disso é silêncio: não entra na mediana nem puxa a média de um trecho para baixo demais */
export const ENERGY_FLOOR_DB = -60;

export function energyEnvelope(samples: Float32Array, sampleRate: number, stepSec = ENERGY_STEP_SEC): Float32Array {
  const len = Math.max(1, Math.round(sampleRate * stepSec));
  const out = new Float32Array(Math.ceil(samples.length / len));
  for (let k = 0; k < out.length; k++) {
    const a = k * len;
    const b = Math.min(samples.length, a + len);
    let e = 0;
    for (let i = a; i < b; i++) e += samples[i]! * samples[i]!;
    const mean = b > a ? e / (b - a) : 0;
    out[k] = mean > 0 ? Math.max(ENERGY_FLOOR_DB, 10 * Math.log10(mean)) : ENERGY_FLOOR_DB;
  }
  return out;
}

/** Mediana dos passos com som (acima do piso); null se tudo é silêncio. */
export function speechMedianDb(env: ArrayLike<number>): number | null {
  const xs: number[] = [];
  for (let i = 0; i < env.length; i++) if (env[i]! > ENERGY_FLOOR_DB + 1) xs.push(env[i]!);
  if (xs.length === 0) return null;
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)]!;
}

/** Média dos passos com som entre `start` e `end` (s); null se o trecho não tem som. */
export function meanDbBetween(env: ArrayLike<number>, start: number, end: number, stepSec = ENERGY_STEP_SEC): number | null {
  const a = Math.max(0, Math.floor(start / stepSec));
  const b = Math.min(env.length, Math.ceil(end / stepSec));
  let sum = 0;
  let n = 0;
  for (let i = a; i < b; i++) {
    if (env[i]! <= ENERGY_FLOOR_DB + 1) continue;
    sum += env[i]!;
    n++;
  }
  return n > 0 ? sum / n : null;
}
