import { describe, expect, it } from 'vitest';
import { planKeepSegments } from '../src/editorial/cuts';

const w = (id: string, start: number, end: number) => ({ id, text: id, start, end });

describe('planKeepSegments', () => {
  it('corta o silêncio do meio mantendo margens', () => {
    const segs = planKeepSegments(3, [{ start: 1, end: 2 }], []);
    expect(segs).toEqual([
      { srcStart: 0, srcEnd: 1.12 },
      { srcStart: 1.88, srcEnd: 3 },
    ]);
  });

  it('nunca corta dentro de uma palavra baixa que caiu no "silêncio"', () => {
    // o "não" foi falado baixinho em 1.7–1.9 e o detector achou que era silêncio
    const segs = planKeepSegments(3, [{ start: 1, end: 2.5 }], [w('não', 1.7, 1.9)]);
    const keepsNao = segs.some((s) => s.srcStart <= 1.7 && s.srcEnd >= 1.9);
    expect(keepsNao).toBe(true);
  });

  it('sem silêncios devolve o vídeo inteiro', () => {
    expect(planKeepSegments(5, [], [])).toEqual([{ srcStart: 0, srcEnd: 5 }]);
  });
});
