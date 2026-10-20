import { describe, expect, it } from 'vitest';
import { buildCaptions } from '../src/editorial/captions';

const w = (id: string, text: string, start: number, end: number) => ({ id, text, start, end });

describe('buildCaptions', () => {
  it('agrupa palavras e quebra no ponto final', () => {
    const words = [w('1', 'Hoje', 0, 0.3), w('2', 'eu', 0.3, 0.4), w('3', 'acordei.', 0.4, 0.9), w('4', 'Depois', 1.0, 1.3)];
    const caps = buildCaptions(words, [{ srcStart: 0, srcEnd: 2 }]);
    expect(caps.map((c) => c.text)).toEqual(['Hoje eu acordei.', 'Depois']);
  });

  it('respeita o limite de caracteres', () => {
    const words = [w('1', 'paralelepípedo', 0, 0.5), w('2', 'extraordinário', 0.5, 1)];
    const caps = buildCaptions(words, [{ srcStart: 0, srcEnd: 2 }]);
    expect(caps).toHaveLength(2);
  });

  it('desloca para o tempo editado e descarta palavras cortadas', () => {
    const words = [w('1', 'antes', 0, 0.5), w('2', 'cortada', 1.2, 1.6), w('3', 'depois', 2.1, 2.5)];
    const caps = buildCaptions(words, [
      { srcStart: 0, srcEnd: 1 },
      { srcStart: 2, srcEnd: 3 },
    ]);
    expect(caps.flatMap((c) => c.wordIds)).toEqual(['1', '3']);
    expect(caps[1]!.start).toBeCloseTo(1.1, 5);
  });
});
