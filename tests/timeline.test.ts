import { describe, expect, it } from 'vitest';
import { outputDuration, outputToSource, sourceToOutput } from '../src/engine/timeline';

const segs = [
  { srcStart: 1, srcEnd: 3 },
  { srcStart: 5, srcEnd: 6 },
];

describe('timeline', () => {
  it('soma a duração dos trechos', () => {
    expect(outputDuration(segs)).toBe(3);
  });

  it('mapeia saída -> original atravessando o corte', () => {
    expect(outputToSource(segs, 0)).toBe(1);
    expect(outputToSource(segs, 1.5)).toBe(2.5);
    expect(outputToSource(segs, 2)).toBe(5);
    expect(outputToSource(segs, 2.5)).toBe(5.5);
    expect(outputToSource(segs, 3)).toBeNull();
    expect(outputToSource(segs, -1)).toBeNull();
  });

  it('mapeia original -> saída e devolve null no trecho cortado', () => {
    expect(sourceToOutput(segs, 2)).toBe(1);
    expect(sourceToOutput(segs, 4)).toBeNull();
    expect(sourceToOutput(segs, 5.5)).toBe(2.5);
  });
});
