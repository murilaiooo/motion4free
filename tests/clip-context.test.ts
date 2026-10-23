import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { buildTranscriptIndex, contextAround, partitionContextWindows } from '../src/editorial/clip-context';

const reference = (words: readonly Word[], start: number, end: number) => ({
  before: words.filter(w => w.end <= start && w.start >= start - 12).map(w => w.text.trim()).join(' '),
  after: words.filter(w => w.start >= end && w.end <= end + 12).map(w => w.text.trim()).join(' '),
});

describe('clip context previews, issue #102', () => {
  it('keeps original PT-BR/English words and matches the full scan at arbitrary bounds', () => {
    const words: Word[] = [
      { id: 'a', text: 'Isso', start: 0, end: 0.4 },
      { id: 'b', text: 'foi', start: 0.5, end: 0.8 },
      { id: 'c', text: 'resolvido.', start: 1, end: 2 },
      { id: 'd', text: 'Now', start: 12.5, end: 12.9 },
      { id: 'e', text: 'the', start: 13, end: 13.2 },
      { id: 'f', text: 'answer.', start: 14, end: 14.4 },
      { id: 'g', text: 'Later.', start: 40, end: 40.4 },
    ];
    const index = buildTranscriptIndex(words, 50);
    for (const [start, end] of [[0, 0.4], [1.5, 12], [12.5, 13], [38, 42]]) {
      expect(contextAround(index, start, end)).toEqual(reference(words, start, end));
    }
  });

  it('keeps exact semantics even when ASR word ends overlap and are not monotone', () => {
    const words: Word[] = [
      { id: 'w0', text: 'long', start: 0, end: 12.4 },
      { id: 'w1', text: 'short', start: 0.2, end: 0.5 },
      { id: 'w2', text: 'middle', start: 10, end: 10.1 },
      { id: 'w3', text: 'after', start: 12.1, end: 12.5 },
      { id: 'w4', text: 'later', start: 18, end: 19 },
    ];
    const index = buildTranscriptIndex(words, 20);
    expect(contextAround(index, 12, 12.1)).toEqual(reference(words, 12, 12.1));
  });

  it('matches the reference at the beginning, middle and end of a long recording', () => {
    const words: Word[] = Array.from({ length: 40_000 }, (_, i) => ({
      id: `w-${i}`, text: `palavra${i}`, start: i * 0.12, end: i * 0.12 + 0.1,
    }));
    const index = buildTranscriptIndex(words, words.at(-1)!.end + 1);
    for (const [start, end] of [[0, 4], [120, 129], [2395.5, 2420.6], [4780, 4797]]) {
      expect(contextAround(index, start, end)).toEqual(reference(words, start, end));
    }
  });

  it('covers the final transcript window, even when the recording spans many windows', () => {
    const words: Word[] = Array.from({ length: 1200 }, (_, i) => ({
      id: `w-${i}`, text: i % 6 === 5 ? 'resposta.' : 'explicação',
      start: i * 0.5, end: i * 0.5 + 0.3,
    }));
    const index = buildTranscriptIndex(words, 601);
    const windows = partitionContextWindows(index, 2500);
    expect(windows.length).toBeGreaterThan(2);
    expect(windows.at(-1)!.lastWord).toBe(words.length - 1);
    const visited = new Set<number>();
    for (const window of windows) {
      for (let i = window.firstWord; i <= window.lastWord; i++) visited.add(i);
    }
    expect(visited.size).toBe(words.length);
  });
});
