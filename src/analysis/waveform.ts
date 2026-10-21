/**
 * Picos do áudio para desenhar a waveform da linha do tempo: uma coluna por `buckets`,
 * com o maior valor absoluto daquele pedaço. `normalize` escala para o pico ficar em 1.
 */
export function waveformPeaks(samples: Float32Array, buckets: number, normalize = false): Float32Array {
  const out = new Float32Array(buckets);
  if (samples.length === 0 || buckets <= 0) return out;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * samples.length) / buckets);
    const end = Math.max(start + 1, Math.floor(((b + 1) * samples.length) / buckets));
    let peak = 0;
    for (let i = start; i < Math.min(end, samples.length); i++) {
      const v = Math.abs(samples[i]!);
      if (v > peak) peak = v;
    }
    out[b] = peak;
  }
  if (normalize) {
    let max = 0;
    for (const v of out) if (v > max) max = v;
    if (max > 0) for (let b = 0; b < buckets; b++) out[b]! /= max;
  }
  return out;
}

/**
 * Índice de picos para desenhar a onda real em qualquer zoom (v0.18): o maior valor absoluto de cada
 * bloco de `block` amostras, mais as próprias amostras. Pedaço curto lê as amostras; pedaço longo
 * lê os blocos. Assim a onda fica nítida de perto e rápida de longe.
 */
export interface PeakIndex {
  samples: Float32Array;
  sampleRate: number;
  block: number;
  blocks: Float32Array;
  /** 1 / maior pico do áudio (onda normalizada) */
  norm: number;
}

export function buildPeakIndex(samples: Float32Array, sampleRate: number, block = 256): PeakIndex {
  const n = Math.ceil(samples.length / block);
  const blocks = new Float32Array(n);
  let max = 0;
  for (let b = 0; b < n; b++) {
    let peak = 0;
    const end = Math.min(samples.length, (b + 1) * block);
    for (let i = b * block; i < end; i++) {
      const v = Math.abs(samples[i]!);
      if (v > peak) peak = v;
    }
    blocks[b] = peak;
    if (peak > max) max = peak;
  }
  return { samples, sampleRate, block, blocks, norm: max > 0 ? 1 / max : 0 };
}

/** Maior pico (0 a 1, normalizado) entre `start` e `end` segundos do áudio. */
export function peakBetween(index: PeakIndex, start: number, end: number): number {
  const { samples, sampleRate, block, blocks, norm } = index;
  let a = Math.max(0, Math.floor(start * sampleRate));
  const b = Math.min(samples.length, Math.max(a + 1, Math.ceil(end * sampleRate)));
  if (a >= samples.length) return 0;
  let peak = 0;
  // pontas soltas amostra por amostra, o meio por blocos inteiros
  while (a < b && a % block !== 0) {
    const v = Math.abs(samples[a++]!);
    if (v > peak) peak = v;
  }
  while (a + block <= b) {
    const v = blocks[a / block]!;
    if (v > peak) peak = v;
    a += block;
  }
  while (a < b) {
    const v = Math.abs(samples[a++]!);
    if (v > peak) peak = v;
  }
  return Math.min(1, peak * norm);
}
