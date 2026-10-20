import { describe, expect, it } from 'vitest';
import { cleanTranscript, collapseLoops, groupPieces, looksDegenerate, mergeWindows, removeHallucinations, snapToSpeech, type RawWord } from '../src/analysis/asr-merge';
import type { AsrWindow } from '../src/analysis/asr-windows';

const W = (text: string, start: number, end: number): RawWord => ({ text, start, end });
const texts = (ws: RawWord[]) => ws.map((w) => w.text);
const win = (ownStart: number, ownEnd: number, feedStart: number, feedEnd: number): AsrWindow => ({
  own: { start: ownStart, end: ownEnd },
  feed: { start: feedStart, end: feedEnd },
  skip: false,
});

describe('junção das janelas', () => {
  it('soma o início do áudio ouvido (feed) ao tempo de cada palavra', () => {
    const merged = mergeWindows(
      [
        { window: win(0, 10, 0, 11), chunks: [{ text: ' Olá', timestamp: [1, 1.4] }] },
        { window: win(10, 20, 9, 20), chunks: [{ text: ' mundo', timestamp: [3, 3.5] }] },
      ],
      20,
    );
    expect(merged).toEqual([W('Olá', 1, 1.4), W('mundo', 12, 12.5)]);
  });

  it('palavra na folga entra uma vez só (fica com a janela onde está o meio dela)', () => {
    // A palavra "junção" (9,8 a 10,4; meio em 10,1) foi ouvida pelas duas janelas.
    const merged = mergeWindows(
      [
        {
          window: win(0, 10, 0, 11),
          chunks: [
            { text: ' antes', timestamp: [9.2, 9.7] },
            { text: ' junção', timestamp: [9.8, 10.4] },
            { text: ' depois', timestamp: [10.5, 10.9] },
          ],
        },
        {
          window: win(10, 20, 9, 20),
          chunks: [
            { text: ' antes', timestamp: [0.2, 0.7] },
            { text: ' junção', timestamp: [0.8, 1.4] },
            { text: ' depois', timestamp: [1.5, 1.9] },
            { text: ' fim', timestamp: [5, 5.3] },
          ],
        },
      ],
      20,
    );
    expect(texts(merged)).toEqual(['antes', 'junção', 'depois', 'fim']);
    expect(merged[1]).toEqual(W('junção', 9.8, 10.4));
  });

  it('se os tempos das duas janelas discordam e a palavra aparece dos dois lados, a repetida sai', () => {
    const merged = mergeWindows(
      [
        { window: win(0, 10, 0, 11), chunks: [{ text: ' casa.', timestamp: [9.5, 9.95] }] },
        { window: win(10, 20, 9, 20), chunks: [{ text: ' Casa', timestamp: [0.9, 1.3] }, { text: ' nova', timestamp: [1.4, 1.8] }] },
      ],
      20,
    );
    expect(texts(merged)).toEqual(['casa.', 'nova']);
  });

  it('palavra repetida de verdade, longe da junção, fica', () => {
    const merged = mergeWindows([{ window: win(0, 10, 0, 10), chunks: [{ text: ' muito', timestamp: [1, 1.3] }, { text: ' muito', timestamp: [1.35, 1.7] }] }], 10);
    expect(texts(merged)).toEqual(['muito', 'muito']);
  });

  it('primeiro pedaço da janela é palavra nova; pedaços sem espaço colam na palavra', () => {
    expect(groupPieces([{ text: 'cada', timestamp: [0, 0.3] }, { text: ' j', timestamp: [0.3, 0.4] }, { text: 'anela', timestamp: [0.4, 0.8] }])).toEqual([
      W('cada', 0, 0.3),
      W('janela', 0.3, 0.8),
    ]);
  });

  it('fim ausente vira 0,3 s e nada passa do fim do vídeo', () => {
    const merged = mergeWindows([{ window: win(0, 10, 0, 10), chunks: [{ text: ' fim', timestamp: [9.9, null] }] }], 10);
    expect(merged[0]!.end).toBe(10);
  });
});

describe('alucinações do Whisper', () => {
  it('remove "Legendas pela comunidade Amara.org" sempre', () => {
    const ws = [W('Oi', 0, 0.3), W('Legendas', 5, 5.3), W('pela', 5.3, 5.5), W('comunidade', 5.5, 6), W('Amara.org', 6, 6.5)];
    expect(texts(removeHallucinations(ws, []))).toEqual(['Oi']);
  });

  it('"Obrigado por assistir" só sai se cair no silêncio', () => {
    const ws = [W('Obrigado', 10, 10.4), W('por', 10.4, 10.6), W('assistir.', 10.6, 11)];
    expect(texts(removeHallucinations(ws, []))).toEqual(['Obrigado', 'por', 'assistir.']);
    expect(removeHallucinations(ws, [{ start: 9.5, end: 12 }])).toEqual([]);
  });

  it('remove marcações de som', () => {
    expect(texts(removeHallucinations([W('♪', 0, 1), W('[Música]', 1, 2), W('(risos)', 2, 3), W('bom', 3, 3.3), W('dia', 3.3, 3.6)], []))).toEqual(['bom', 'dia']);
  });

  it('laço de frase repetida fica uma vez só', () => {
    const loop: RawWord[] = [];
    for (let k = 0; k < 5; k++) loop.push(W('e', k, k + 0.2), W('aí', k + 0.2, k + 0.5));
    expect(texts(collapseLoops([W('então', -1, -0.5), ...loop, W('pessoal', 6, 6.5)]))).toEqual(['então', 'e', 'aí', 'pessoal']);
  });

  it('repetição normal da fala fica', () => {
    const ws = [W('não,', 0, 0.2), W('não,', 0.2, 0.4), W('não.', 0.4, 0.6), W('é', 1, 1.1), W('isso', 1.1, 1.4), W('é', 1.5, 1.6), W('isso', 1.6, 1.9)];
    expect(collapseLoops(ws)).toEqual(ws);
  });

  it('detecta janela com cara de laço', () => {
    const loop: RawWord[] = [];
    for (let k = 0; k < 12; k++) loop.push(W('vamos', k, k + 0.3), W('lá', k + 0.3, k + 0.6));
    expect(looksDegenerate(loop, 12)).toBe(true);
    const normal = 'hoje eu vou mostrar três dicas para você gravar melhor'.split(' ').map((t, i) => W(t, i * 0.4, i * 0.4 + 0.35));
    expect(looksDegenerate(normal, 4)).toBe(false);
  });
});

describe('tempo das palavras (legenda junto com a voz)', () => {
  it('última palavra antes da pausa não fica esticada até o fim da pausa', () => {
    const out = snapToSpeech([W('país.', 10.2, 13.5)], [{ start: 10.9, end: 13.5 }]);
    expect(out[0]!.start).toBe(10.2);
    expect(out[0]!.end).toBeCloseTo(10.98);
  });

  it('primeira palavra depois da pausa não começa cedo demais', () => {
    const out = snapToSpeech([W('Então', 1.0, 3.4)], [{ start: 0, end: 3.0 }]);
    expect(out[0]!.start).toBeCloseTo(2.92);
    expect(out[0]!.end).toBe(3.4);
  });

  it('palavra que atravessa uma pausa fica do lado maior', () => {
    const out = snapToSpeech([W('agora', 5, 7)], [{ start: 5.6, end: 6.8 }]);
    expect(out[0]).toEqual(W('agora', 5, 5.68));
  });

  it('palavra toda dentro de um "silêncio" (fala baixa) não muda', () => {
    expect(snapToSpeech([W('psiu', 2.1, 2.4)], [{ start: 2, end: 3 }])).toEqual([W('psiu', 2.1, 2.4)]);
  });

  it('palavras ficam em ordem e sem sobreposição', () => {
    const out = snapToSpeech([W('a', 0, 0.5), W('b', 0.4, 0.8)], []);
    expect(out[0]!.end).toBeLessThanOrEqual(out[1]!.start);
  });

  it('limpeza completa mantém palavras boas com o mesmo tempo', () => {
    const ws = [W('Três', 0.1, 0.5), W('dicas', 0.5, 0.9), W('rápidas.', 0.9, 1.4), W('Primeira', 3.1, 3.6), W('dica.', 3.6, 4.2)];
    expect(cleanTranscript(ws, [{ start: 1.5, end: 3.0 }])).toEqual(ws);
  });
});
