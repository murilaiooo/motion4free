import { describe, expect, it } from 'vitest';
import { easeOutBack, easeOutCubic, progress } from '../src/render/easing';
import { coverCrop, reelsSafeArea, wrapText } from '../src/render/layout';

describe('easing', () => {
  it('começa em 0 e termina em 1', () => {
    for (const f of [easeOutCubic, easeOutBack]) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
  });
  it('progress satura fora do intervalo', () => {
    expect(progress(-1, 0, 1)).toBe(0);
    expect(progress(0.5, 0, 1)).toBe(0.5);
    expect(progress(9, 0, 1)).toBe(1);
  });
});

describe('layout', () => {
  it('recorta vídeo horizontal 16:9 para 9:16 pelo centro', () => {
    const r = coverCrop(1920, 1080, 1080, 1920);
    expect(r.h).toBe(1080);
    expect(r.w).toBeCloseTo(607.5, 3);
    expect(r.x).toBeCloseTo((1920 - 607.5) / 2, 3);
  });
  it('vídeo já vertical não é recortado', () => {
    expect(coverCrop(1080, 1920, 1080, 1920)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });
  it('área segura fica dentro do quadro', () => {
    const a = reelsSafeArea(1080, 1920);
    expect(a.y + a.h).toBeLessThan(1920);
    expect(a.x + a.w).toBeLessThanOrEqual(1080);
  });
  it('quebra texto por largura', () => {
    expect(wrapText('um dois tres quatro', 9, (s) => s.length)).toEqual(['um dois', 'tres', 'quatro']);
  });
});
