import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { applyJury, juryMessages, juryRank, parseJury } from '../src/editorial/clip-jury';
import type { Moment } from '../src/editorial/highlights';
import { cutsFromDiffs, frameHistogram, histogramDiff, snapToCuts, SNAP_MARGIN } from '../src/editorial/scene-cuts';
import { findSoundMoments } from '../src/editorial/sound-moments';

const word = (text: string, start: number, end: number): Word => ({ id: `w${start}`, text, start, end });
const moment = (id: string, score: number, extra: Partial<Moment> = {}): Moment => ({ id, rank: 0, start: 0, end: 20, title: id, text: 'texto', score, reasons: ['regra'], wordCount: 1, ...extra });

describe('#176: júri só julga o que consegue ler', () => {
  it('cena sem fala não vai para o júri e fica com a nota do app', async () => {
    const list = [moment('a', 60), moment('mudo', 55, { text: '' }), moment('b', 50), moment('c', 40)];
    let sent = '';
    const ai = { source: 'ia-local', complete: async (m: { user: string }) => { sent = m.user; return '{"notas":[{"n":1,"gancho":2,"historia":2,"sozinho":2,"valor":2},{"n":2,"gancho":9,"historia":9,"sozinho":9,"valor":9},{"n":3,"gancho":5,"historia":5,"sozinho":5,"valor":5}]}'; } } as any;
    const r = await juryRank(list, ai, new AbortController().signal);
    expect(sent).not.toContain('sem fala');
    expect(sent.match(/^\d+: /gm)).toHaveLength(3);
    expect(r.judged).toBe(3);
    const mudo = r.moments.find((m) => m.id === 'mudo')!;
    expect(mudo.jury).toBeUndefined();
    expect(mudo.score).toBe(55);
    // a nota 9 foi para "b" (2º trecho com fala), não para a cena muda
    expect(r.moments.find((m) => m.id === 'b')!.jury!.gancho).toBe(9);
  });

  it('menos de dois trechos com fala: sem júri; mensagem recusa trecho sem fala', async () => {
    const ai = { source: 'ia-local', complete: async () => { throw new Error('não deveria chamar'); } } as any;
    const r = await juryRank([moment('a', 60), moment('mudo', 55, { text: '' })], ai, new AbortController().signal);
    expect(r.judged).toBe(0);
    expect(() => juryMessages([moment('mudo', 1, { text: '' })], 300)).toThrow();
    expect(juryMessages([moment('a', 1)], 300).system).toContain('não vê a imagem');
  });
});

describe('v0.39: júri da IA', () => {
  it('lê notas em formatos diferentes e ignora números fora da lista', () => {
    const notes = parseJury('<think>…</think>```json\n{"notas":[{"n":1,"gancho":"9","historia":8,"sozinho":7,"valor":8},{"n":7,"hook":1,"story":1,"standalone":1,"value":1}]}\n```', 2)!;
    expect(notes.size).toBe(1);
    expect(notes.get(0)!.score).toBe(80);
    expect(parseJury('[{"trecho":2,"hook":2,"story":3,"standalone":4,"value":5}]', 2)!.get(1)!.score).toBe(35);
    expect(parseJury('não sei avaliar', 2)).toBeNull();
  });

  it('nota da IA mistura com a do app e muda a ordem; trecho com revisão continua depois', () => {
    const list = [moment('a', 70), moment('b', 60), moment('c', 90, { sourceEvidence: { firstWordId: 'w0', lastWordId: 'w1', review: ['negação'], source: 'local-context' } })];
    const ranked = applyJury(list, new Map([[1, { gancho: 10, historia: 10, sozinho: 10, valor: 10, score: 100 }], [0, { gancho: 2, historia: 2, sozinho: 2, valor: 2, score: 20 }]]));
    expect(ranked.map((m) => m.id)).toEqual(['b', 'a', 'c']);
    expect(ranked[0]!.score).toBe(80);
    expect(ranked[0]!.reasons[0]).toMatch(/IA deu 100\/100/);
  });
});

describe('v0.39: corte na troca de cena', () => {
  it('histogramas iguais têm distância 0; imagens opostas, perto de 1', () => {
    const dark = frameHistogram(new Uint8ClampedArray(64 * 4).fill(10));
    const light = frameHistogram(new Uint8ClampedArray(64 * 4).fill(240));
    expect(histogramDiff(dark, dark)).toBe(0);
    expect(histogramDiff(dark, light)).toBeGreaterThan(0.9);
  });

  it('acha a troca que se destaca, mesmo com câmera tremendo', () => {
    const times = Array.from({ length: 20 }, (_, i) => i / 10);
    const diffs = times.map((_, i) => (i === 12 ? 0.8 : 0.08));
    expect(cutsFromDiffs(times, diffs)).toEqual([1.15]);
    expect(cutsFromDiffs(times, times.map(() => 0.1))).toEqual([]);
  });

  it('move a borda até a troca de cena sem cortar fala', () => {
    const words = [word('oi', 10.2, 10.6), word('tchau', 29, 29.5)];
    const snapped = snapToCuts(10, 30, [9.1, 30.9], words);
    expect(snapped.start).toBeCloseTo(9.1 + SNAP_MARGIN);
    expect(snapped.end).toBeCloseTo(30.9 - SNAP_MARGIN);
    // troca depois do começo da fala: mover cortaria "oi"
    expect(snapToCuts(10, 30, [10.5], words).snappedStart).toBe(false);
    // troca longe demais: fica como está
    expect(snapToCuts(10, 30, [5], words).start).toBe(10);
  });
});

describe('v0.39: cenas sem fala', () => {
  const limit = { min: 15, max: 30, ideal: 22 };
  it('música/ação alta sem fala vira sugestão com nota modesta', () => {
    const step = 0.5;
    const energy = Array.from({ length: 1200 }, (_, i) => (i >= 600 && i < 660 ? -8 : -26));
    const words = [word('antes', 100, 290), word('depois', 345, 600)];
    const found = findSoundMoments(words, 600, energy, step, limit);
    expect(found).toHaveLength(1);
    expect(found[0]!.start).toBeGreaterThanOrEqual(291);
    expect(found[0]!.end).toBeLessThanOrEqual(344);
    expect(found[0]!.score).toBeLessThanOrEqual(70);
    expect(found[0]!.title).toMatch(/^Cena sem fala em (4:5|5:0)/);
  });

  it('silêncio sem fala não vira sugestão', () => {
    const energy = Array.from({ length: 1200 }, (_, i) => (i >= 600 && i < 660 ? -60 : -26));
    expect(findSoundMoments([word('a', 100, 290), word('b', 345, 600)], 600, energy, 0.5, limit)).toEqual([]);
  });
});
