import { describe, expect, it } from 'vitest';
import { DUCK_LEVEL, duckGains, mixMusic } from '../src/engine/music-mix';

const SR = 1000;
const constant = (sec: number, v: number, sr = SR) => new Float32Array(Math.round(sec * sr)).fill(v);
const tone = (sec: number, amp: number) => Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * 50 * i) / SR));

describe('música de fundo', () => {
  it('sem fala: a música entra no volume escolhido e sai com fade no fim', () => {
    const out = mixMusic(null, SR, 4, { channels: [constant(10, 0.5)], sampleRate: SR }, { volume: 0.4, duck: false });
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(4000);
    expect(out[0]![0]).toBe(0);
    expect(out[0]![2000]).toBeCloseTo(0.2, 5);
    expect(Math.abs(out[0]![3999]!)).toBeLessThan(0.01);
  });

  it('não altera a fala de entrada e soma a música por cima', () => {
    const speech = [constant(3, 0.1)];
    const before = speech[0]!.slice();
    const out = mixMusic(speech, SR, 3, { channels: [constant(3, 0.5)], sampleRate: SR }, { volume: 0.2, duck: false });
    expect(speech[0]).toEqual(before);
    expect(out[0]![1500]).toBeCloseTo(0.2, 5);
  });

  it('música mais curta que o vídeo acaba e fica em silêncio (não repete)', () => {
    const out = mixMusic(null, SR, 5, { channels: [constant(2, 0.5)], sampleRate: SR }, { volume: 1, duck: false });
    expect(out[0]![1000]).toBeGreaterThan(0.3);
    expect(out[0]![3000]).toBe(0);
  });

  it('volume zero devolve só a fala', () => {
    const out = mixMusic([constant(1, 0.3)], SR, 1, { channels: [constant(1, 0.9)], sampleRate: SR }, { volume: 0, duck: true });
    expect(out[0]![500]).toBeCloseTo(0.3, 5);
  });

  it('taxa diferente: a música é reamostrada e dura o mesmo tempo', () => {
    const out = mixMusic(null, SR, 2, { channels: [constant(2, 0.5, 2000)], sampleRate: 2000 }, { volume: 1, duck: false });
    expect(out[0]![1000]).toBeCloseTo(0.5, 5);
  });

  it('nunca passa de 1 (sem estalo por saturação)', () => {
    const out = mixMusic([constant(2, 0.9)], SR, 2, { channels: [constant(2, 0.9)], sampleRate: SR }, { volume: 1, duck: false });
    expect(Math.max(...out[0]!)).toBeLessThanOrEqual(1);
  });

  it('abaixa durante a fala e volta depois', () => {
    const speech = new Float32Array(6000);
    speech.set(tone(2, 0.5), 2000); // fala de 2 s a 4 s
    const gains = duckGains([speech], SR, speech.length);
    const at = (sec: number) => gains[Math.floor(sec / 0.02)]!;
    expect(at(1)).toBeCloseTo(1, 2);
    expect(at(3)).toBeCloseTo(DUCK_LEVEL, 2);
    expect(at(5.5)).toBeGreaterThan(0.9);
    const out = mixMusic([speech], SR, 6, { channels: [constant(6, 0.5)], sampleRate: SR }, { volume: 1, duck: true });
    expect(out[0]![1000]).toBeCloseTo(0.5, 2);
  });

  it('música estéreo num vídeo mono sai em dois canais', () => {
    const out = mixMusic([constant(1, 0)], SR, 1, { channels: [constant(1, 0.5), constant(1, -0.5)], sampleRate: SR }, { volume: 1, duck: false });
    expect(out).toHaveLength(2);
    expect(out[0]![600]!).toBeGreaterThan(0);
    expect(out[1]![600]!).toBeLessThan(0);
  });
});
