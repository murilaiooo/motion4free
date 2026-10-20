import { describe, expect, it } from 'vitest';
import { planAsrWindows } from '../src/analysis/asr-windows';

describe('janelas da transcrição', () => {
  it('áudio curto vira uma janela só', () => {
    expect(planAsrWindows([], 20)).toEqual([{ start: 0, end: 20 }]);
  });

  it('corta no meio do último silêncio antes do limite', () => {
    const silences = [
      { start: 10, end: 10.6 },
      { start: 24, end: 25 },
      { start: 40, end: 41 },
    ];
    expect(planAsrWindows(silences, 60, 28)).toEqual([
      { start: 0, end: 24.5 },
      { start: 24.5, end: 40.5 },
      { start: 40.5, end: 60 },
    ]);
  });

  it('sem silêncio, corta no limite e cobre o áudio inteiro', () => {
    const w = planAsrWindows([], 70, 28);
    expect(w).toEqual([
      { start: 0, end: 28 },
      { start: 28, end: 56 },
      { start: 56, end: 70 },
    ]);
  });

  it('nenhuma janela passa do limite', () => {
    const silences = Array.from({ length: 30 }, (_, i) => ({ start: i * 4.7, end: i * 4.7 + 0.5 }));
    for (const w of planAsrWindows(silences, 146, 28)) expect(w.end - w.start).toBeLessThanOrEqual(28);
  });
});
