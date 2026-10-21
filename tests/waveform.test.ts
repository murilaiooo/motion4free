import { describe, expect, it } from 'vitest';
import { waveformPeaks } from '../src/analysis/waveform';

describe('waveformPeaks', () => {
  it('pega o maior valor absoluto de cada coluna', () => {
    const s = new Float32Array([0.1, -0.5, 0.2, 0.0, 0.9, -0.3, 0, 0]);
    expect(Array.from(waveformPeaks(s, 4)).map((x) => Math.round(x * 10) / 10)).toEqual([0.5, 0.2, 0.9, 0]);
  });

  it('normaliza pelo pico do áudio inteiro', () => {
    const s = new Float32Array([0.25, 0.5, 0.1, 0.05]);
    const p = waveformPeaks(s, 2, true);
    expect(p[0]).toBe(1);
    expect(p[1]).toBeCloseTo(0.2, 5);
  });

  it('áudio vazio ou silencioso não divide por zero', () => {
    expect(Array.from(waveformPeaks(new Float32Array(0), 3))).toEqual([0, 0, 0]);
    expect(Array.from(waveformPeaks(new Float32Array(10), 2, true))).toEqual([0, 0]);
  });

  it('mais colunas que amostras funciona', () => {
    expect(waveformPeaks(new Float32Array([1, -1]), 5)).toHaveLength(5);
  });
});

describe('onda real (índice de picos)', () => {
  it('acha o pico exato em qualquer janela, curta ou longa, e normaliza pelo maior pico', async () => {
    const { buildPeakIndex, peakBetween } = await import('../src/analysis/waveform');
    const sr = 1000;
    const s = new Float32Array(5000);
    s[1234] = -0.5;
    s[4000] = 0.25;
    const idx = buildPeakIndex(s, sr, 256);
    expect(peakBetween(idx, 1.2, 1.3)).toBeCloseTo(1);
    expect(peakBetween(idx, 0, 5)).toBeCloseTo(1);
    expect(peakBetween(idx, 3.9, 4.1)).toBeCloseTo(0.5);
    expect(peakBetween(idx, 2, 3.5)).toBe(0);
    expect(peakBetween(idx, 1.234, 1.2345)).toBeCloseTo(1);
    expect(peakBetween(idx, 9, 10)).toBe(0);
  });
});
