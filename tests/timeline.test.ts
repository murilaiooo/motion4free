import { describe, expect, it } from 'vitest';
import { outputDuration, outputToSource, sourceToOutput, outputToSourceEnd, rangeOut } from '../src/engine/timeline';

const segs = [
  { srcStart: 1, srcEnd: 3 },
  { srcStart: 5, srcEnd: 6 },
];

describe('timeline', () => {
  it('soma a duração dos trechos', () => {
    expect(outputDuration(segs)).toBe(3);
  });

  it('mapeia saída -> original atravessando o corte', () => {
    expect(outputToSource(segs, 0)).toBe(1);
    expect(outputToSource(segs, 1.5)).toBe(2.5);
    expect(outputToSource(segs, 2)).toBe(5);
    expect(outputToSource(segs, 2.5)).toBe(5.5);
    expect(outputToSource(segs, 3)).toBeNull();
    expect(outputToSource(segs, -1)).toBeNull();
  });

  it('mapeia original -> saída e devolve null no trecho cortado', () => {
    expect(sourceToOutput(segs, 2)).toBe(1);
    expect(sourceToOutput(segs, 4)).toBeNull();
    expect(sourceToOutput(segs, 5.5)).toBe(2.5);
  });
});

describe('trechos: ida e volta entre vídeo editado e original', () => {
  const segs = [
    { srcStart: 0, srcEnd: 2 },
    { srcStart: 3, srcEnd: 5 },
    { srcStart: 8, srcEnd: 10 },
  ];
  it('fim de intervalo numa emenda fica no trecho anterior', () => {
    expect(outputToSource(segs, 2)).toBe(3);
    expect(outputToSourceEnd(segs, 2)).toBe(2);
    expect(outputToSourceEnd(segs, 6)).toBe(10);
    expect(outputToSourceEnd(segs, 6.5)).toBeNull();
    expect(outputToSourceEnd(segs, 0)).toBeNull();
  });
  it('rangeOut devolve a parte mantida, contínua, no vídeo editado', () => {
    expect(rangeOut(segs, { srcStart: 1, srcEnd: 4 })).toEqual({ start: 1, end: 3 });
    expect(rangeOut(segs, { srcStart: 2, srcEnd: 3 })).toBeNull();
    expect(rangeOut(segs, { srcStart: 0, srcEnd: 10 })).toEqual({ start: 0, end: 6 });
    expect(rangeOut(segs, { srcStart: 5.5, srcEnd: 9 })).toEqual({ start: 4, end: 5 });
  });
  it('selecionar no vídeo editado e voltar dá o mesmo intervalo', () => {
    for (const [a, b] of [[0.5, 2], [1, 4.5], [2, 6], [0, 6]] as const) {
      const r = { srcStart: outputToSource(segs, a)!, srcEnd: outputToSourceEnd(segs, b)! };
      const out = rangeOut(segs, r)!;
      expect(out.start).toBeCloseTo(a, 9);
      expect(out.end).toBeCloseTo(b, 9);
    }
  });
});
