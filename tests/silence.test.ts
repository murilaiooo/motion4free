import { describe, expect, it } from 'vitest';
import { findSilences } from '../src/analysis/silence';

const SR = 16000;

/** Gera tom de 220 Hz nos trechos "on" e silêncio no resto. */
function synth(totalSec: number, on: Array<[number, number]>): Float32Array {
  const s = new Float32Array(Math.round(totalSec * SR));
  for (const [a, b] of on) {
    for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR);
  }
  return s;
}

describe('findSilences', () => {
  it('encontra o silêncio longo entre duas falas', () => {
    const r = findSilences(synth(3, [[0, 1], [2, 3]]), SR);
    expect(r).toHaveLength(1);
    expect(r[0]!.start).toBeCloseTo(1, 1);
    expect(r[0]!.end).toBeCloseTo(2, 1);
  });

  it('ignora pausa curta (respiração natural)', () => {
    expect(findSilences(synth(2.3, [[0, 1], [1.3, 2.3]]), SR)).toHaveLength(0);
  });

  it('detecta silêncio no início e no fim', () => {
    const r = findSilences(synth(3, [[1, 2]]), SR);
    expect(r.map((x) => [Math.round(x.start), Math.round(x.end)])).toEqual([[0, 1], [2, 3]]);
  });
});
