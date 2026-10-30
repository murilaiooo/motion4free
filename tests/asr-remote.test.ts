import { describe, expect, it } from 'vitest';
import { encodeWav, parseVerboseWords, planAsrChunks, WAV_BYTES_PER_SEC, ASR_APIS } from '../src/asr/remote-plan';

const win = (start: number, end: number, skip = false) => ({ own: { start, end }, feed: { start, end }, skip });

describe('issue #127: transcrição por API', () => {
  it('só lista serviços que transcrevem com tempo por palavra', () => {
    expect(Object.keys(ASR_APIS).sort()).toEqual(['groq', 'openai']);
  });

  it('junta janelas cortadas em pausas sem passar do limite do serviço', () => {
    const windows = Array.from({ length: 100 }, (_, i) => win(i * 25, i * 25 + 25));
    const max = 300 * WAV_BYTES_PER_SEC + 2048;
    const chunks = planAsrChunks(windows, 2500, max);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect((c.end - c.start) * WAV_BYTES_PER_SEC).toBeLessThanOrEqual(max);
    expect(chunks[0]!.start).toBe(0);
    expect(chunks.at(-1)!.end).toBe(2500);
    // cortes caem em fronteiras de janela (pausas)
    for (const c of chunks) expect(c.start % 25).toBe(0);
  });

  it('pula janelas sem fala', () => {
    const chunks = planAsrChunks([win(0, 20), win(20, 40, true), win(40, 60)], 60, 24 * 1024 * 1024);
    expect(chunks).toEqual([{ start: 0, end: 60 }]);
  });

  it('WAV tem cabeçalho certo e tamanho 2 bytes por amostra', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]));
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(wav.length).toBe(44 + 8);
  });

  it('desloca os tempos para o vídeo e nunca inventa tempos', () => {
    const words = parseVerboseWords({ words: [{ word: ' Olá', start: 0.1, end: 0.4 }, { word: 'mundo', start: 0.3, end: 0.9 }, { word: '', start: 1, end: 2 }, { word: 'x', start: 'a', end: 1 }] }, { start: 100, end: 110 });
    expect(words).toEqual([{ text: 'Olá', start: 100.1, end: 100.4 }, { text: 'mundo', start: 100.3, end: expect.closeTo(100.9) }]);
    expect(parseVerboseWords({ text: 'sem palavras' }, { start: 0, end: 5 })).toBeNull();
  });
});
