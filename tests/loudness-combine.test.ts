import { describe, expect, it } from 'vitest';
import { clipLoudnessGains, combineAudios } from '../src/media/multi';
import { MAX_GAIN_DB, PEAK_CEILING } from '../src/analysis/loudness';
import type { ClipRef } from '../src/core/types';

/** Issue #53: o volume igualado entre clipes vale de verdade no áudio montado (prévia e MP4 usam combineAudios). */
const SR = 8000;
const tone = (sec: number, amp: number, hz = 220) =>
  Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR));
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const db = (x: number) => 20 * Math.log10(x);
const ref = (id: string, duration: number): ClipRef => ({ id, name: id, duration, framing: null });

describe('volume igual entre clipes no áudio montado', () => {
  const refs = [ref('c1', 1), ref('c2', 1), ref('c3', 1)];
  const audios = {
    c1: { sampleRate: SR, channels: [tone(1, 0.4)] },
    c2: { sampleRate: SR, channels: [tone(1, 0.1)] }, // gravado longe do microfone (−12 dB)
    c3: { sampleRate: SR, channels: [tone(1, 0.2)] },
  };

  it('clipes em volumes diferentes saem perto do mesmo nível (até ±9 dB)', () => {
    const out = combineAudios(refs, audios)!;
    const part = (i: number) => rms(out.channels[0]!.subarray(i * SR, (i + 1) * SR));
    // mediana = c3 (0,2): c1 desce 6 dB, c2 sobe 6 dB
    expect(Math.abs(db(part(0)) - db(part(2)))).toBeLessThan(0.1);
    expect(Math.abs(db(part(1)) - db(part(2)))).toBeLessThan(0.1);
  });

  it('o áudio original de cada clipe não é alterado: montar de novo (reabrir, desfazer) dá o mesmo resultado', () => {
    const before = audios.c2.channels[0]!.slice();
    const a = combineAudios(refs, audios)!;
    const b = combineAudios(refs, audios)!;
    expect(audios.c2.channels[0]).toEqual(before);
    expect(a.channels[0]).toEqual(b.channels[0]);
  });

  it('o ganho segue o clipe quando a ordem muda', () => {
    const g1 = clipLoudnessGains(refs, audios);
    const g2 = clipLoudnessGains([refs[2]!, refs[0]!, refs[1]!], audios);
    expect(g2).toEqual(g1);
    expect(g1.c2).toBeGreaterThan(1);
    expect(g1.c1).toBeLessThan(1);
  });

  it('nunca passa do pico nem do limite de 9 dB', () => {
    const loud = { c1: { sampleRate: SR, channels: [tone(1, 0.9)] }, c2: { sampleRate: SR, channels: [tone(1, 0.005)] }, c3: { sampleRate: SR, channels: [tone(1, 0.9)] } };
    const out = combineAudios(refs, loud)!;
    for (const v of out.channels[0]!) expect(Math.abs(v)).toBeLessThanOrEqual(PEAK_CEILING + 1e-6);
    const g = clipLoudnessGains(refs, loud);
    expect(db(g.c2!)).toBeLessThanOrEqual(MAX_GAIN_DB + 0.01);
  });

  it('um clipe só, ou clipe sem som, fica como está', () => {
    expect(clipLoudnessGains([ref('c1', 1)], { c1: audios.c1 })).toEqual({ c1: 1 });
    const g = clipLoudnessGains(refs, { c1: audios.c1, c2: null, c3: audios.c3 });
    expect(g.c2).toBeUndefined();
  });

  it('os silêncios não puxam a medida para baixo', () => {
    const withPause = Float32Array.from({ length: SR }, (_, i) => (i < SR / 2 ? 0 : 0.2 * Math.sin((2 * Math.PI * 220 * i) / SR)));
    const two = [ref('c1', 1), ref('c2', 1)];
    const a = { c1: { sampleRate: SR, channels: [withPause] }, c2: { sampleRate: SR, channels: [tone(1, 0.2)] } };
    const g = clipLoudnessGains(two, a, { c1: [{ start: 0, end: 0.5 }] });
    expect(Math.abs(db(g.c1!) - db(g.c2!))).toBeLessThan(0.2);
  });

  it('áudio mais longo que o clipe não invade o clipe seguinte sem som', () => {
    const two = [ref('a', 0.5), ref('b', 0.5)];
    const out = combineAudios(two, { a: { sampleRate: SR, channels: [tone(1, 0.3)] }, b: null })!;
    expect(rms(out.channels[0]!.subarray(SR / 2))).toBe(0);
  });
});
