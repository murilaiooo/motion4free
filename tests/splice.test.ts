import { describe, expect, it } from 'vitest';
import { spliceAudio } from '../src/media/splice';

describe('spliceAudio', () => {
  it('concatena só os trechos mantidos', () => {
    const ch = Float32Array.from({ length: 10 }, (_, i) => i);
    const [out] = spliceAudio([ch], 10, [{ srcStart: 0, srcEnd: 0.3 }, { srcStart: 0.6, srcEnd: 0.8 }], 0);
    expect(Array.from(out!)).toEqual([0, 1, 2, 6, 7]);
  });

  it('aplica fade nas emendas', () => {
    const ch = new Float32Array(100).fill(1);
    const [out] = spliceAudio([ch], 100, [{ srcStart: 0, srcEnd: 0.5 }, { srcStart: 0.5, srcEnd: 1 }], 0.05);
    expect(out![0]).toBe(0);
    expect(out![49]).toBe(0);
    expect(out![25]).toBe(1);
  });
});
