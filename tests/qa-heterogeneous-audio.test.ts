import { describe, expect, it } from 'vitest';
import { combineAudios } from '../src/media/multi';
import type { ClipRef } from '../src/core/types';

const clips: ClipRef[] = [
  { id: 'c1', name: 'stereo-44100', duration: 1.1, framing: null },
  { id: 'c2', name: 'mono-48000', duration: 0.9, framing: null },
  { id: 'c3', name: 'stereo-32000', duration: 0.7, framing: null },
];
const sine = (samples: number, rate: number, hz: number, amp: number) =>
  Float32Array.from({ length: samples }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x*x, 0) / a.length);

describe('QA ainda não coberto: concatenação com áudio heterogêneo realista', () => {
  it('três sample rates e combinação mono/estéreo não invertem nem deslocam canais', () => {
    const a = { sampleRate: 44100, channels: [sine(48510, 44100, 440, .6), sine(48510, 44100, 660, .3)] };
    const b = { sampleRate: 48000, channels: [sine(43200, 48000, 880, .45)] };
    const c = { sampleRate: 32000, channels: [sine(22400, 32000, 220, .4), sine(22400, 32000, 330, .2)] };
    const result = combineAudios(clips, { c1:a, c2:b, c3:c });
    expect(result?.sampleRate).toBe(44100);
    expect(result?.channels).toHaveLength(2);
    expect(result!.channels[0]!.length).toBe(Math.ceil(2.7 * 44100));
    const region = (ch: number, from: number, to: number) =>
      result!.channels[ch]!.subarray(Math.floor(from * 44100), Math.floor(to * 44100));
    expect(rms(region(0, .2, .7))).toBeGreaterThan(.37);
    expect(rms(region(1, .2, .7))).toBeLessThan(.25);
    expect(rms(region(0, 1.25, 1.75))).toBeCloseTo(rms(region(1, 1.25, 1.75)), 4); // mono replicado
    expect(rms(region(0, 2.2, 2.6))).toBeGreaterThan(rms(region(1, 2.2, 2.6)) * 1.7);
    for (const channel of result!.channels) expect(channel.every(Number.isFinite)).toBe(true);
  });

  it('um áudio mais curto que sua referência gera silêncio na sobra sem vazar amostras do próximo', () => {
    const refs: ClipRef[] = [
      { id: 'a', name:'a', duration:2, framing:null },
      { id: 'b', name:'b', duration:1, framing:null },
    ];
    const actual = combineAudios(refs, {
      a: { sampleRate:1000, channels:[new Float32Array(600).fill(.8)] },
      b: { sampleRate:1000, channels:[new Float32Array(1000).fill(-.5)] },
    });
    expect(actual?.channels[0]!.length).toBe(3000);
    expect(actual!.channels[0]![500]).toBeCloseTo(.8);
    expect(actual!.channels[0]![700]).toBe(0);
    expect(actual!.channels[0]![1999]).toBe(0);
    expect(actual!.channels[0]![2000]).toBe(-.5);
  });
});
