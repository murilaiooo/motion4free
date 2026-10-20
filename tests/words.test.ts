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
});
