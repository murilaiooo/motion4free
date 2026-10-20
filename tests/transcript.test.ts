import { describe, expect, it } from 'vitest';
import type { Caption, Word } from '../src/core/types';
import { activeToken, buildTranscript, pageOfCaption, paginate } from '../src/editorial/transcript';

const words: Word[] = [
  { id: 'w1', text: 'Três', start: 0.1, end: 0.5 },
  { id: 'w2', text: 'dicas', start: 0.5, end: 0.9 },
  { id: 'w3', text: 'éé', start: 1.6, end: 2.4 }, // cortada
  { id: 'w4', text: 'hum', start: 2.5, end: 2.8 }, // cortada
  { id: 'w5', text: 'Primeira', start: 3.1, end: 3.6 },
  { id: 'w6', text: 'dica.', start: 3.6, end: 4.2 },
];
// mantém 0–1.4 e 3.0–4.3 (saída: 0–1.4 e 1.4–2.7)
const segments = [
  { srcStart: 0, srcEnd: 1.4 },
  { srcStart: 3.0, srcEnd: 4.3 },
];
const captions: Caption[] = [
  { id: 'c1', text: 'Três dicas', start: 0.1, end: 0.9, wordIds: ['w1', 'w2'], wordStarts: [0.1, 0.5] },
  { id: 'c2', text: 'Primeira dica.', start: 1.5, end: 2.6, wordIds: ['w5', 'w6'], wordStarts: [1.5, 2.0] },
];

describe('transcrição em parágrafo', () => {
  it('agrupa por legenda, na ordem da fala, e mostra as palavras cortadas entre elas', () => {
    const blocks = buildTranscript(words, captions, segments);
    expect(blocks.map((b) => b.kind)).toEqual(['caption', 'cut', 'caption']);
    const [a, cut, b] = blocks;
    expect(a).toMatchObject({ kind: 'caption', id: 'c1', edited: false });
    if (a?.kind !== 'caption' || cut?.kind !== 'cut' || b?.kind !== 'caption') throw new Error('tipos');
    expect(a.tokens.map((t) => t.text)).toEqual(['Três', 'dicas']);
    expect(a.tokens.map((t) => t.start)).toEqual([0.1, 0.5]);
    expect(cut.words).toEqual(['éé', 'hum']);
    expect(cut.srcStart).toBe(1.6);
    expect(cut.srcEnd).toBe(2.8);
    expect(b.tokens.map((t) => t.text)).toEqual(['Primeira', 'dica.']);
  });

  it('legenda corrigida: usa o texto novo e distribui o tempo pelo tamanho das palavras', () => {
    const edited = [captions[0]!, { ...captions[1]!, text: 'Primeira dica de ouro!' }];
    const blocks = buildTranscript(words, edited, segments);
    const b = blocks.at(-1)!;
    if (b.kind !== 'caption') throw new Error('tipo');
    expect(b.edited).toBe(true);
    expect(b.tokens.map((t) => t.text)).toEqual(['Primeira', 'dica', 'de', 'ouro!']);
    expect(b.tokens[0]!.start).toBeCloseTo(1.5, 5);
    for (let i = 1; i < b.tokens.length; i++) expect(b.tokens[i]!.start).toBeGreaterThan(b.tokens[i - 1]!.start);
    expect(b.tokens.at(-1)!.start).toBeLessThan(2.6);
  });

  it('sem transcrição não há blocos', () => {
    expect(buildTranscript([], [], segments)).toEqual([]);
  });

  it('palavra mantida que não está em nenhuma legenda não aparece como cortada', () => {
    const extra: Word[] = [...words, { id: 'w7', text: 'solta', start: 4.25, end: 4.29 }];
    const blocks = buildTranscript(extra, captions, segments);
    expect(blocks.filter((b) => b.kind === 'cut').flatMap((b) => (b.kind === 'cut' ? b.words : []))).toEqual(['éé', 'hum']);
  });

  it('palavra falada agora: legenda e índice da palavra', () => {
    const blocks = buildTranscript(words, captions, segments);
    expect(activeToken(blocks, 0.05)).toBeNull();
    expect(activeToken(blocks, 0.2)).toEqual({ captionId: 'c1', index: 0 });
    expect(activeToken(blocks, 0.6)).toEqual({ captionId: 'c1', index: 1 });
    expect(activeToken(blocks, 1.0)).toBeNull();
    expect(activeToken(blocks, 2.1)).toEqual({ captionId: 'c2', index: 1 });
  });

  it('pagina vídeos longos por quantidade de legendas, sem separar a parte cortada da legenda seguinte', () => {
    const blocks = buildTranscript(words, captions, segments);
    const pages = paginate(blocks, 1);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.map((b) => b.kind)).toEqual(['caption']);
    expect(pages[1]!.map((b) => b.kind)).toEqual(['cut', 'caption']);
    expect(paginate(blocks, 100)).toHaveLength(1);
    expect(paginate([], 10)).toEqual([[]]);
    expect(pageOfCaption(pages, 'c2')).toBe(1);
    expect(pageOfCaption(pages, 'nada')).toBe(-1);
  });
});
