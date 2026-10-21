import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '../src/core/presets';
import { REELS_PROFILE } from '../src/core/types';
import { clipFileName, clipPlan, sliceForClip } from '../src/editorial/clip-plan';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

describe('clipe do vídeo longo vira projeto comum', () => {
  const words = wordsFrom(SAMPLE_TEXT, 600);
  const silences = [{ start: 590, end: 600 }, { start: 605, end: 606 }];

  it('palavras dentro do trecho, no tempo do clipe; silêncios cortados nas bordas', () => {
    const s = sliceForClip({ start: 600, end: 620 }, 20, words, silences);
    expect(s.words.length).toBeGreaterThan(0);
    expect(s.words[0]!.start).toBeCloseTo(0, 3);
    for (const w of s.words) expect(w.end).toBeLessThanOrEqual(20);
    expect(s.silences).toEqual([{ start: 5, end: 6 }]);
    expect(words.filter((w) => w.start >= 600 && w.end <= 620).length).toBe(s.words.length);
  });

  it('o plano sai do autoEdit com o estilo e o formato escolhidos', () => {
    const s = sliceForClip({ start: 600, end: 620 }, 20, words, silences);
    const plan = clipPlan(s, DEFAULT_STYLE, { width: 1080, height: 1350, fps: 30 });
    expect(plan.output.height).toBe(1350);
    expect(plan.style.id).toBe(DEFAULT_STYLE.id);
    expect(plan.captions.length).toBeGreaterThan(0);
    for (const seg of plan.segments) expect(seg.srcEnd).toBeLessThanOrEqual(20 + 1e-6);
    expect(clipPlan(s, DEFAULT_STYLE, REELS_PROFILE).output).toEqual(REELS_PROFILE);
  });

  it('nome de arquivo seguro', () => {
    expect(clipFileName('Meu Podcast #12.mp4', 3, 'O erro de 90% no 1º emprego!')).toBe('meu-podcast-12-clipe-03-o-erro-de-90-no-1-emprego.mp4');
    expect(clipFileName('???.mov', 1, '')).toBe('video-clipe-01.mp4');
  });
});
