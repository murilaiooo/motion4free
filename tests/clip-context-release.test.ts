import { describe, expect, it, vi } from 'vitest';
import type { Word } from '../src/core/types';
import { buildTranscriptIndex, escapedUtf8Bytes, partitionContextWindows } from '../src/editorial/clip-context';
import { findContextualMoments, nudgeContextMoment } from '../src/editorial/clip-candidates';
import { originalOutputSpans } from '../src/editorial/clip-source-map';
import { discoverContextualMoments } from '../src/editorial/clip-discovery';

const transcript = (count: number, secondsPerWord = 0.5): Word[] =>
  Array.from({ length: count }, (_, i) => ({
    id: 'w' + i,
    text: i % 6 === 5 ? 'conclusão.' : i % 6 === 0 ? 'Questão' : 'resposta',
    start: i * secondsPerWord,
    end: i * secondsPerWord + secondsPerWord * 0.8,
  }));
const options = { length: 'curto' as const, count: 5 };

describe('issue #102 QA: long source context, bounded calls, manual edits and source mapping', () => {
  it('respects escaped UTF-8 bytes, advances, and includes the final minute and word', () => {
    const words = transcript(2400);
    words[650]!.text = '<não>';
    words[651]!.text = 'ação';
    const index = buildTranscriptIndex(words, 1201);
    const windows = partitionContextWindows(index, 2500, undefined, 30);
    expect(windows.length).toBeGreaterThan(3);
    expect(windows.at(-1)!.lastWord).toBe(words.length - 1);
    const covered = new Set<number>();
    for (const window of windows) {
      expect(escapedUtf8Bytes(window.body)).toBeLessThanOrEqual(2500);
      for (let i = window.firstWord; i <= window.lastWord; i++) covered.add(i);
    }
    expect(covered.size).toBe(words.length);
  });

  it('never performs an unbounded number of paid AI calls on a long recording', async () => {
    const words = transcript(10000);
    const ai = { source: 'provedor', complete: vi.fn(async () => '{"spans":[]}') };
    const progress = vi.fn();
    const result = await discoverContextualMoments(words, 5001, options, ai as any, new AbortController().signal, progress);
    expect(ai.complete.mock.calls.length).toBeLessThanOrEqual(32);
    expect(result.total).toBeGreaterThanOrEqual(result.covered);
    expect(result.moments.length).toBeGreaterThan(0);
    expect(progress).toHaveBeenCalled();
    if (result.total > 32) expect(result.warning).not.toBeNull();
  });

  it('rejects invented word IDs, stops provider requests and keeps local suggestions', async () => {
    const words = transcript(110);
    const ai = { source: 'provedor', complete: vi.fn(async () => JSON.stringify({
      spans: [{ firstWordId: 'invented', lastWordId: 'w90',
        titleFirstWordId: 'w30', titleLastWordId: 'w32', setupWordIds: ['w30'], payoffWordIds: ['w90'] }],
    })) };
    const result = await discoverContextualMoments(words, 56, options, ai as any, new AbortController().signal, () => {});
    expect(ai.complete).toHaveBeenCalledTimes(1);
    expect(result.warning?.key).toBe('CLIPES_IA_CONTEXTO');
    expect(result.moments.length).toBeGreaterThan(0);
  });

  it('a no-op boundary nudge keeps existing object identity', () => {
    const words = transcript(70);
    const items = findContextualMoments(words, 36, options);
    const first = items.find(item => item.start < 1);
    if (!first) return;
    expect(nudgeContextMoment(first, words, 36, 'start', -1)).toBe(first);
  });

  it('clips provenance to actual requested end, omitting encoder padding', () => {
    const plan = { clips: [{ id: 'c1', duration: 12 }], segments: [{ srcStart: 0, srcEnd: 12 }] };
    const spans = originalOutputSpans(plan as any, { c1: { version: 1, sourceId: 'a'.repeat(64),
      sourceOffset: 40, sourceEnd: 49.5, sourceDuration: 100, derivedDuration: 12 } });
    expect(spans).toEqual([{ sourceId: 'a'.repeat(64), sourceStart: 40,
      sourceEnd: 49.5, outputStart: 0, outputEnd: 9.5 }]);
  });
});
