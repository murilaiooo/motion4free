import type { TimeRange } from '../core/types';

export interface SilenceOptions {
  /** Abaixo deste nível (dBFS) o quadro conta como silêncio. 'auto' calcula pelo ruído de fundo da gravação. */
  thresholdDb: number | 'auto';
  /** Silêncios menores que isto são pausas naturais e ficam. */
  minSilenceSec: number;
  /** Tamanho do quadro de análise. */
  frameSec: number;
}

export const DEFAULT_SILENCE: SilenceOptions = { thresholdDb: 'auto', minSilenceSec: 0.45, frameSec: 0.02 };

/** Energia RMS por quadro, em dBFS (silêncio digital = -100). */
export function rmsDb(samples: Float32Array, sampleRate: number, frameSec: number): Float32Array {
  const frameLen = Math.max(1, Math.round(sampleRate * frameSec));
  const frames = Math.ceil(samples.length / frameLen);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * frameLen;
    const end = Math.min(samples.length, start + frameLen);
    for (let i = start; i < end; i++) {
      const v = samples[i]!;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - start));
    out[f] = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
  }
  return out;
}

/**
 * Limiar adaptativo: fica 30% acima do ruído de fundo (percentil 10) em direção ao nível da fala (percentil 90).
 * Gravações com ruído ou música de fundo nunca chegam a -40 dBFS nas pausas; o limiar fixo não achava nada.
 */
export function adaptiveThresholdDb(db: Float32Array): number {
  if (db.length === 0) return -40;
  const sorted = Array.from(db).sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]!;
  const floor = pct(0.1);
  const speech = pct(0.9);
  return Math.min(-25, Math.max(-50, floor + 0.3 * (speech - floor)));
}

export function findSilences(samples: Float32Array, sampleRate: number, opts: SilenceOptions = DEFAULT_SILENCE): TimeRange[] {
  const db = rmsDb(samples, sampleRate, opts.frameSec);
  const threshold = opts.thresholdDb === 'auto' ? adaptiveThresholdDb(db) : opts.thresholdDb;
  const frameLen = Math.max(1, Math.round(sampleRate * opts.frameSec));
  const totalSec = samples.length / sampleRate;
  const result: TimeRange[] = [];
  let runStart = -1;
  for (let f = 0; f <= db.length; f++) {
    const silent = f < db.length && db[f]! < threshold;
    if (silent && runStart < 0) runStart = f;
    if (!silent && runStart >= 0) {
      const start = (runStart * frameLen) / sampleRate;
      const end = Math.min(totalSec, (f * frameLen) / sampleRate);
      if (end - start >= opts.minSilenceSec) result.push({ start, end });
      runStart = -1;
    }
  }
  return result;
}
