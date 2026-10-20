import { describe, expect, it } from 'vitest';
import { DOCUMENTAL, NEON, POP } from '../src/core/presets';
import { buildCaptions, captionOptionsFor } from '../src/editorial/captions';

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

describe('legendas por estilo e tempo de cada palavra', () => {
  const words = [w('1', 'Isso', 0, 0.3), w('2', 'muda', 0.3, 0.6), w('3', 'tudo', 0.6, 0.9), w('4', 'na', 0.9, 1.0), w('5', 'sua', 1.0, 1.2), w('6', 'vida', 1.2, 1.5)];
  it('guarda o início de cada palavra no tempo editado', () => {
    const caps = buildCaptions(words.slice(0, 3), [{ srcStart: 0, srcEnd: 2 }]);
    expect(caps[0]!.wordStarts).toEqual([0, 0.3, 0.6]);
  });
  it('limite de palavras por legenda vem do estilo', () => {
    const caps = buildCaptions(words, [{ srcStart: 0, srcEnd: 2 }], captionOptionsFor(POP));
    expect(caps.map((c) => c.text)).toEqual(['Isso muda tudo', 'na sua vida']);
    const long = buildCaptions(words, [{ srcStart: 0, srcEnd: 2 }], captionOptionsFor(DOCUMENTAL));
    expect(long.map((c) => c.text)).toEqual(['Isso muda tudo na sua vida']);
  });
  it('não deixa uma palavra sozinha no fim da frase (v0.7)', () => {
    const ws = [w('1', 'Três', 0, 0.3), w('2', 'dicas', 0.3, 0.6), w('3', 'rápidas.', 0.6, 1.0), w('4', 'Primeira', 1.2, 1.5), w('5', 'dica', 1.5, 1.8), w('6', 'aqui', 1.8, 2.0), w('7', 'agora', 2.0, 2.2), w('8', 'mesmo', 2.2, 2.4)];
    const caps = buildCaptions(ws, [{ srcStart: 0, srcEnd: 3 }], captionOptionsFor(NEON));
    expect(caps.map((c) => c.text)).toEqual(['Três dicas rápidas.', 'Primeira dica', 'aqui agora mesmo']);
  });
});
