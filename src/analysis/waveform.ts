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
