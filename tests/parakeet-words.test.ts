import { describe, expect, it } from 'vitest';
import { groupPieces, mergeWindows } from '../src/analysis/asr-merge';
import { parakeetWordsToChunks } from '../src/analysis/parakeet-words';

describe('palavras do Parakeet viram o mesmo formato do Whisper', () => {
  it('cada palavra vira um pedaço com espaço na frente e o tempo dela', () => {
    const chunks = parakeetWordsToChunks([
      { text: 'Olá,', start_time: 0.32, end_time: 0.7 },
      { text: 'pessoal!', start_time: 0.78, end_time: 1.3, confidence: 0.98 },
    ]);
    expect(chunks).toEqual([
      { text: ' Olá,', timestamp: [0.32, 0.7] },
      { text: ' pessoal!', timestamp: [0.78, 1.3] },
    ]);
    // nada é colado: duas palavras continuam duas palavras
    expect(groupPieces(chunks).map((w) => w.text)).toEqual(['Olá,', 'pessoal!']);
  });

  it('palavra vazia sai; tempo inválido vira um intervalo curto e válido', () => {
    const chunks = parakeetWordsToChunks([
      { text: '  ', start_time: 0, end_time: 0.2 },
      { text: 'oi', start_time: 1, end_time: 1.4 },
      { text: 'tudo', start_time: Number.NaN, end_time: Number.NaN },
      { text: 'bem', start_time: 2, end_time: 1.5 },
    ]);
    expect(chunks.map((c) => c.text)).toEqual([' oi', ' tudo', ' bem']);
    expect(chunks[1]!.timestamp).toEqual([1.4, 1.4 + 0.3]);
    expect(chunks[2]!.timestamp[1]).toBeGreaterThan(chunks[2]!.timestamp[0]);
  });

  it('entra na junção de janelas como o Whisper (tempos relativos ao trecho ouvido)', () => {
    const window = { own: { start: 10, end: 20 }, feed: { start: 9, end: 21 }, skip: false };
    const chunks = parakeetWordsToChunks([
      { text: 'antes', start_time: 0.2, end_time: 0.6 }, // 9,2 s: é da janela anterior
      { text: 'agora', start_time: 2, end_time: 2.5 }, // 11 s
    ]);
    const words = mergeWindows([{ window, chunks }], 30);
    expect(words.map((w) => w.text)).toEqual(['agora']);
    expect(words[0]!.start).toBeCloseTo(11);
  });
});
