import { describe, expect, it } from 'vitest';
import { chunksToWords } from '../src/asr/words';

describe('chunksToWords', () => {
  it('limpa espaços, numera e trata fim ausente', () => {
    const words = chunksToWords(
      [
        { text: ' Olá', timestamp: [0, 0.4] },
        { text: ' ', timestamp: [0.4, 0.5] },
        { text: ' mundo.', timestamp: [0.5, null] },
      ],
      10,
    );
    expect(words).toEqual([
      { id: 'w1', text: 'Olá', start: 0, end: 0.4 },
      { id: 'w2', text: 'mundo.', start: 0.5, end: 0.8 },
    ]);
  });

  it('cola pedaço de palavra (sem espaço) na palavra anterior', () => {
    const words = chunksToWords(
      [
        { text: ' mas', timestamp: [1, 1.2] },
        { text: ' cada', timestamp: [1.2, 1.5] },
        { text: ' j', timestamp: [1.5, 1.6] },
        { text: 'anela.', timestamp: [1.6, 2.1] },
      ],
      10,
    );
    expect(words.map((w) => w.text)).toEqual(['mas', 'cada', 'janela.']);
    expect(words[2]).toMatchObject({ start: 1.5, end: 2.1 });
  });
});
