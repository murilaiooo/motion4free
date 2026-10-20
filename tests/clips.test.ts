import { describe, expect, it } from 'vitest';
import { clipAt, clipJoins, clipLayout, clipSpans, outputToClip, placeRanges, placeWords, remapSegments, remapTime, splitAtClips, totalDuration, withinOneClip } from '../src/engine/clips';
import { outputDuration, outputToSource, sourceToOutput } from '../src/engine/timeline';

const A = { id: 'c1', duration: 4 };
const B = { id: 'c2', duration: 6 };
const C = { id: 'c3', duration: 2.5 };
const clips = [A, B, C];

describe('original virtual com vários clipes', () => {
  it('cada clipe começa onde o anterior termina', () => {
    expect(clipLayout(clips)).toEqual([
      { id: 'c1', start: 0, end: 4 },
      { id: 'c2', start: 4, end: 10 },
      { id: 'c3', start: 10, end: 12.5 },
    ]);
    expect(totalDuration(clips)).toBe(12.5);
  });

  it('clipAt acha o clipe e o tempo local (a emenda é do clipe seguinte; o fim do último é dele)', () => {
    expect(clipAt(clips, 0)).toEqual({ id: 'c1', index: 0, local: 0 });
    expect(clipAt(clips, 3.999)).toMatchObject({ id: 'c1' });
    expect(clipAt(clips, 4)).toEqual({ id: 'c2', index: 1, local: 0 });
    expect(clipAt(clips, 11)).toEqual({ id: 'c3', index: 2, local: 1 });
    expect(clipAt(clips, 12.5)).toEqual({ id: 'c3', index: 2, local: 2.5 });
    expect(clipAt(clips, 13)).toBeNull();
  });

  it('trecho que atravessa clipes é partido na emenda', () => {
    expect(splitAtClips([{ srcStart: 1, srcEnd: 11 }], clips)).toEqual([
      { srcStart: 1, srcEnd: 4 },
      { srcStart: 4, srcEnd: 10 },
      { srcStart: 10, srcEnd: 11 },
    ]);
    // com um clipe só nada muda (mesmo objeto)
    const one = [{ srcStart: 0, srcEnd: 3 }];
    expect(splitAtClips(one, [A])).toBe(one);
  });

  it('clipSpans: cada pedaço vem de um arquivo, com tempo local e posição na saída', () => {
    const segments = [
      { srcStart: 0.5, srcEnd: 3 },
      { srcStart: 5, srcEnd: 9 },
      { srcStart: 10.2, srcEnd: 12 },
    ];
    expect(clipSpans(segments, clips)).toEqual([
      { clipId: 'c1', clipIndex: 0, localStart: 0.5, localEnd: 3, outStart: 0 },
      { clipId: 'c2', clipIndex: 1, localStart: 1, localEnd: 5, outStart: 2.5 },
      { clipId: 'c3', clipIndex: 2, localStart: expect.closeTo(0.2, 6), localEnd: 2, outStart: 6.5 },
    ]);
    expect(clipJoins(segments, clips)).toEqual([2.5, 6.5]);
  });

  it('tempo do vídeo editado ↔ clipe e tempo local, nos dois sentidos, em toda a duração', () => {
    const segments = splitAtClips([{ srcStart: 0.5, srcEnd: 3 }, { srcStart: 3.5, srcEnd: 9 }, { srcStart: 10.2, srcEnd: 12 }], clips);
    const total = outputDuration(segments);
    for (let t = 0; t < total; t += 0.37) {
      const src = outputToSource(segments, t)!;
      const at = outputToClip(segments, clips, t)!;
      const viaClip = clipAt(clips, src)!;
      expect(at.clipId).toBe(viaClip.id);
      expect(at.local).toBeCloseTo(viaClip.local, 6);
      expect(sourceToOutput(segments, src)).toBeCloseTo(t, 6);
    }
    expect(outputToClip(segments, clips, total)).toMatchObject({ clipId: 'c3', local: 2 });
    expect(outputToClip(segments, clips, -1)).toBeNull();
    expect(outputToClip(segments, clips, total + 1)).toBeNull();
  });

  it('palavras e silêncios de cada clipe vão para o original virtual', () => {
    const words = placeWords([A, B], { c1: [{ id: 'c1w1', text: 'oi', start: 0.5, end: 0.9 }], c2: [{ id: 'c2w1', text: 'tchau', start: 1, end: 1.4 }] });
    expect(words.map((w) => [w.id, w.start, w.end])).toEqual([
      ['c1w1', 0.5, 0.9],
      ['c2w1', 5, 5.4],
    ]);
    // a ordem dos clipes manda
    expect(placeWords([B, A], { c1: [{ id: 'c1w1', text: 'oi', start: 0.5, end: 0.9 }], c2: [] })[0]!.start).toBe(6.5);
    expect(placeRanges([A, B], { c2: [{ start: 5, end: 9 }] })).toEqual([{ start: 9, end: 10 }]);
  });

  it('reordenar leva cada instante para o mesmo ponto do mesmo arquivo', () => {
    const to = [C, A, B];
    expect(remapTime(clips, to, 1)).toBe(3.5); // c1 local 1 → c1 começa em 2,5
    expect(remapTime(clips, to, 4, true)).toBe(6.5); // fim do c1
    expect(remapTime(clips, to, 4)).toBe(6.5); // começo do c2
    expect(remapTime(clips, to, 11)).toBe(1); // c3 local 1
    expect(remapTime(clips, [A, B], 11)).toBeNull(); // c3 saiu
    const segs = remapSegments([{ srcStart: 0.5, srcEnd: 3 }, { srcStart: 5, srcEnd: 9 }, { srcStart: 10.2, srcEnd: 12 }], clips, to);
    expect(segs.map((s) => [s.srcStart, s.srcEnd])).toEqual([
      [expect.closeTo(0.2, 6), 2],
      [3, 5.5],
      [7.5, 11.5],
    ]);
    // duração do vídeo editado não muda ao reordenar
    expect(outputDuration(segs)).toBeCloseTo(2.5 + 4 + 1.8, 6);
  });

  it('withinOneClip: trecho ajustado que atravessa emenda não fica num clipe só', () => {
    expect(withinOneClip(clips, { srcStart: 1, srcEnd: 3.9 })).toBe(true);
    expect(withinOneClip(clips, { srcStart: 1, srcEnd: 4 })).toBe(true);
    expect(withinOneClip(clips, { srcStart: 3, srcEnd: 5 })).toBe(false);
  });
});
