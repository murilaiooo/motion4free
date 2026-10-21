import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { reorderClipPlan } from '../src/editorial/clip-ops';
import { clipLayout, clipSpans, placeWords, totalDuration, unplaceWords, unplaceRanges, placeRanges } from '../src/engine/clips';
import { outputDuration } from '../src/engine/timeline';
import { editPlanSchema } from '../src/core/schema';
import { combineAudios, openClips } from '../src/media/multi';
import type { ClipRef, TimeRange, Word } from '../src/core/types';

const rnd = (seed: number) => () => {
  seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const multiset = (pieces: { clipId: string; localStart: number; localEnd: number }[]) =>
  pieces.map(s => `${s.clipId}:${r3(s.localStart)}:${r3(s.localEnd)}`).sort();

describe('QA de propriedades, 100 timelines com fontes diferentes', () => {
  for (let seed = 1; seed <= 100; seed++) {
    it(`seed ${seed}: fontes, durações, legenda e schema corretos após reordenação e remoção`, () => {
      const rand = rnd(seed);
      const clips: ClipRef[] = Array.from({ length: 2 + Math.floor(rand() * 5) }, (_, i) => ({
        id: `c${i + 1}`, name: `original-${i}.mp4`, duration: 2 + Math.floor(rand() * 9), framing: null,
      }));
      const refs = clipLayout(clips);
      const segments = refs.flatMap(l => {
        const a = r3(l.start + 0.1 + rand() * 0.4);
        const b = r3(l.end - 0.1 - rand() * 0.4);
        return b > a ? [{ srcStart: a, srcEnd: b }] : [];
      });
      const byClip: Record<string, Word[]> = Object.fromEntries(clips.map(c => [c.id, [{
        id: `${c.id}:w`, text: `clip ${c.id}`, start: 0.8, end: 1.2,
      }]]));
      const plan = { ...autoEdit(totalDuration(clips), [], placeWords(clips, byClip), undefined, { clips }), segments };
      const originalSpans = multiset(clipSpans(segments, clips));
      const order = clips.map(c => ({ c, order: rand() })).sort((a, b) => a.order - b.order).map(x => x.c);
      const moved = reorderClipPlan(plan, order, byClip);
      expect(multiset(clipSpans(moved.segments, moved.clips))).toEqual(originalSpans);
      expect(outputDuration(moved.segments)).toBeCloseTo(outputDuration(segments), 3);
      expect(editPlanSchema.safeParse(moved).success).toBe(true);
      for (const c of order) {
        expect(moved.captions.some(cap => cap.wordIds.includes(`${c.id}:w`))).toBe(true);
      }
      const roundtrip = reorderClipPlan(moved, clips, byClip);
      expect(multiset(clipSpans(roundtrip.segments, roundtrip.clips))).toEqual(originalSpans);
      expect(editPlanSchema.safeParse(roundtrip).success).toBe(true);

      const kept = order.filter((_, i) => i % 2 === 0);
      const shortened = reorderClipPlan(moved, kept, byClip);
      expect(new Set(clipSpans(shortened.segments, kept).map(s => s.clipId))).toEqual(new Set(kept.map(c => c.id)));
      expect(shortened.captions.every(c => c.wordIds.every(id => kept.some(clip => id.startsWith(`${clip.id}:`))))).toBe(true);
      expect(editPlanSchema.safeParse(shortened).success).toBe(true);
    });
  }

  it('salvar/desfazer/reordenar: conversão dos horários de palavras e silêncios volta aos tempos locais', () => {
    const clips: ClipRef[] = [
      { id: 'c1', name: 'a', duration: 4, framing: null },
      { id: 'c2', name: 'b', duration: 3, framing: null },
    ];
    const words: Record<string, Word[]> = {
      c1: [{ id: 'c1:a', text: 'a', start: 0.5, end: 0.8 }],
      c2: [{ id: 'c2:b', text: 'b', start: 1, end: 1.4 }],
    };
    const ranges: Record<string, TimeRange[]> = {
      c1: [{ start: 0.2, end: 0.5 }],
      c2: [{ start: 0.8, end: 1.1 }],
    };
    expect(unplaceWords(clips, placeWords(clips, words))).toEqual(words);
    expect(unplaceRanges(clips, placeRanges(clips, ranges))).toEqual(ranges);
    expect(unplaceWords([...clips].reverse(), placeWords([...clips].reverse(), words))).toEqual(words);
  });

  it('limites de importação têm erro claro, sem tentar decodificar 31 arquivos', async () => {
    const tooMany = Array.from({ length: 31 }, (_, i) =>
      new File(['invalid'], `a${i}.mp4`, { type: 'video/mp4' }));
    await expect(openClips(tooMany)).rejects.toMatchObject({ key: 'CLIPES_DEMAIS' });
    await expect(openClips([])).rejects.toMatchObject({ key: 'SEM_VIDEO' });
    await expect(openClips([new File(['bad'], 'corrompido.mp4', { type: 'video/mp4' })]))
      .rejects.toMatchObject({ key: 'NENHUM_CLIPE' });
  });

  it('áudio sem faixa em um clipe não desloca o som dos arquivos seguintes', () => {
    const clips: ClipRef[] = [
      { id: 'c1', name: 'silencioso', duration: 1, framing: null },
      { id: 'c2', name: 'tom', duration: 1, framing: null },
    ];
    const combined = combineAudios(clips, { c1: null, c2: { sampleRate: 1000, channels: [new Float32Array(1000).fill(0.5)] } });
    expect(combined?.channels[0]?.length).toBe(2000);
    expect(combined!.channels[0]![100]).toBe(0);
    expect(combined!.channels[0]![1100]).toBeCloseTo(0.5);
  });
});
