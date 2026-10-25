import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { scheduleSemanticCues, type SemanticCue } from '../src/editorial/semantic-cues';

const words: Word[] = [
  { id: 'a', text: 'Primeiro', start: 0, end: 0.4 },
  { id: 'b', text: 'ponto', start: 1, end: 1.3 },
  { id: 'c', text: 'Agora', start: 3, end: 3.4 },
];

const cue = (wordId: string, override: Partial<SemanticCue> = {}): SemanticCue => ({
  id: 'reveal', wordId, edge: 'start', offsetFrames: 0, durationFrames: 5, ...override,
});

describe('scheduleSemanticCues', () => {
  it('liga a ocorrência ao início exato da palavra e usa fim exclusivo', () => {
    const result = scheduleSemanticCues(words, [{ srcStart: 0, srcEnd: 2 }], [cue('b')], 10);
    expect(result).toEqual([{
      id: 'reveal@segment-0', cueId: 'reveal', wordId: 'b',
      segmentIndex: 0, startFrame: 10, endFrameExclusive: 15,
    }]);
  });

  it('acompanha uma edição que remove o começo do vídeo', () => {
    const result = scheduleSemanticCues(words, [{ srcStart: 0.9, srcEnd: 2 }], [cue('b')], 10);
    expect(result.map(({ startFrame, endFrameExclusive }) => [startFrame, endFrameExclusive])).toEqual([[1, 6]]);
  });

  it('acompanha reordenação de segmentos sem procurar o texto da palavra', () => {
    const result = scheduleSemanticCues(words, [
      { srcStart: 3, srcEnd: 4 }, { srcStart: 0, srcEnd: 2 },
    ], [cue('a', { id: 'a' }), cue('c', { id: 'c' })], 10);
    expect(result.map(({ cueId, startFrame, segmentIndex }) => [cueId, startFrame, segmentIndex]))
      .toEqual([['c', 0, 0], ['a', 10, 1]]);
  });

  it('gera instâncias separadas se o mesmo segmento aparece duas vezes', () => {
    const result = scheduleSemanticCues(words, [
      { srcStart: 0, srcEnd: 2 }, { srcStart: 0, srcEnd: 2 },
    ], [cue('a')], 10);
    expect(result.map(({ id, startFrame }) => [id, startFrame]))
      .toEqual([['reveal@segment-0', 0], ['reveal@segment-1', 20]]);
  });

  it('não agenda palavra parcial, palavra removida ou referência ausente', () => {
    expect(scheduleSemanticCues(words, [{ srcStart: 0.1, srcEnd: 0.3 }], [cue('a')], 10)).toEqual([]);
    expect(scheduleSemanticCues(words, [{ srcStart: 3, srcEnd: 4 }], [cue('a')], 10)).toEqual([]);
    expect(scheduleSemanticCues(words, [{ srcStart: 0, srcEnd: 2 }], [cue('inexistente')], 10)).toEqual([]);
  });

  it('permite eventos antes da palavra mas restringe a janela ao trecho correspondente', () => {
    const result = scheduleSemanticCues(words, [{ srcStart: 0, srcEnd: 2 }],
      [cue('a', { offsetFrames: -2, durationFrames: 4 })], 10);
    expect(result.map(({ startFrame, endFrameExclusive }) => [startFrame, endFrameExclusive]))
      .toEqual([[0, 2]]);
  });

  it('permite o fim da palavra como âncora e recorta na borda do segmento', () => {
    const result = scheduleSemanticCues(words, [{ srcStart: 0, srcEnd: 1.5 }],
      [cue('b', { edge: 'end', offsetFrames: -1, durationFrames: 10 })], 10);
    expect(result.map(({ startFrame, endFrameExclusive }) => [startFrame, endFrameExclusive]))
      .toEqual([[12, 15]]);
  });

  it('é determinístico e mantém entrada sem mutações', () => {
    const segments = [{ srcStart: 0, srcEnd: 2 }];
    const events = [cue('b', { id: 'b' }), cue('a', { id: 'a' })];
    const snapshot = JSON.stringify({ words, segments, events });
    expect(scheduleSemanticCues(words, segments, events, 30))
      .toEqual(scheduleSemanticCues(words, segments, events, 30));
    expect(JSON.stringify({ words, segments, events })).toBe(snapshot);
  });

  it('rejeita fps, tempos, eventos e IDs inválidos', () => {
    const segment = [{ srcStart: 0, srcEnd: 2 }];
    expect(() => scheduleSemanticCues(words, segment, [cue('a')], 0)).toThrow(RangeError);
    expect(() => scheduleSemanticCues([...words, words[0]!], segment, [cue('a')], 30)).toThrow(RangeError);
    expect(() => scheduleSemanticCues(words, [{ srcStart: 2, srcEnd: 1 }], [cue('a')], 30)).toThrow(RangeError);
    expect(() => scheduleSemanticCues(words, segment, [cue('a', { durationFrames: 0 })], 30)).toThrow(RangeError);
    expect(() => scheduleSemanticCues(words, segment,
      [cue('a'), cue('b', { id: 'reveal' })], 30)).toThrow(RangeError);
  });
});
