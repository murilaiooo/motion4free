import { describe, expect, it } from 'vitest';
import { ASR_OVERLAP_SEC, planAsr, planAsrWindows, silentFraction, withOverlap } from '../src/analysis/asr-windows';

describe('folga entre janelas e janelas mudas', () => {
  it('cada janela ouve 1 s a mais de cada lado, sem passar de 30 s nem sair do vídeo', () => {
    const silences = Array.from({ length: 30 }, (_, i) => ({ start: i * 4.7, end: i * 4.7 + 0.5 }));
    const plan = planAsr(silences, 146);
    expect(plan[0]!.feed.start).toBe(0);
    expect(plan.at(-1)!.feed.end).toBe(146);
    for (const [i, w] of plan.entries()) {
      expect(w.feed.end - w.feed.start).toBeLessThanOrEqual(30);
      if (i > 0) expect(w.feed.start).toBeCloseTo(w.own.start - ASR_OVERLAP_SEC);
      if (i > 0) expect(w.own.start).toBe(plan[i - 1]!.own.end); // os pedaços próprios se encostam, sem buraco
    }
  });

  it('janela quase toda em silêncio não vai ao Whisper', () => {
    const plan = withOverlap(
      [
        { start: 0, end: 20 },
        { start: 20, end: 30 },
      ],
      [{ start: 19.8, end: 30 }],
      30,
    );
    expect(plan.map((w) => w.skip)).toEqual([false, true]);
  });

  it('fração de silêncio', () => {
    expect(
      silentFraction({ start: 0, end: 10 }, [
        { start: 2, end: 4 },
        { start: 9, end: 12 },
      ]),
    ).toBeCloseTo(0.3);
  });
});

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
