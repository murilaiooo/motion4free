import { describe, expect, it } from 'vitest';
import { clipGains, MAX_GAIN_DB, peakOf, speechLevelDb } from '../src/analysis/loudness';
import { spliceAudio, splicePlan } from '../src/media/splice';

const SR = 1000;
const tone = (sec: number, amp: number, freq = 50) => Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / SR));

describe('volume igual entre clipes', () => {
  it('nível da fala ignora os silêncios', () => {
    const s = tone(2, 0.5);
    s.fill(0, 1000); // segundo metade muda
    const withSilence = speechLevelDb(s, SR, [{ start: 1, end: 2 }])!;
    const loud = speechLevelDb(tone(1, 0.5), SR, [])!;
    expect(withSilence).toBeCloseTo(loud, 1);
    expect(speechLevelDb(new Float32Array(100), SR, [])).toBeNull();
  });

  it('clipe baixo sobe, clipe alto desce, até a mediana', () => {
    const levels = [-30, -20, -24];
    const g = clipGains(levels, [0.1, 0.4, 0.2]);
    const db = g.map((x) => 20 * Math.log10(x));
    expect(db[0]).toBeCloseTo(6, 1);
    expect(db[1]).toBeCloseTo(-4, 1);
    expect(db[2]).toBeCloseTo(0, 1);
  });

  it('teto de ±9 dB e nunca estoura o pico; clipe sem fala e projeto com um clipe ficam como estão', () => {
    const g = clipGains([-50, -20, -20], [0.05, 0.5, 0.5]);
    expect(20 * Math.log10(g[0]!)).toBeCloseTo(MAX_GAIN_DB, 1);
    const p = clipGains([-30, -10, -10], [0.9, 0.5, 0.5]);
    expect(p[0]! * 0.9).toBeLessThanOrEqual(0.97 + 1e-4);
    expect(clipGains([null, -20, -26], [0, 0.5, 0.5])[0]).toBe(1);
    expect(clipGains([-20], [0.5])).toEqual([1]);
    expect(peakOf(Float32Array.from([0.1, -0.7, 0.3]))).toBeCloseTo(0.7, 6);
  });
});

describe('áudio contínuo nas trocas de clipe', () => {
  it('sem mistura, a emenda entre clipes diferentes pula de valor; com mistura, passa suave', () => {
    // clipe A: 0–1 s em 0,8; clipe B: 1–2 s em −0,8 (pior caso: degrau)
    const ch = new Float32Array(2 * SR);
    ch.fill(0.8, 0, SR);
    ch.fill(-0.8, SR);
    const segs = [
      { srcStart: 0.2, srcEnd: 0.8 },
      { srcStart: 1.2, srcEnd: 1.8 },
    ];
    const [hard] = spliceAudio([ch], SR, segs, 0);
    const jump = (x: Float32Array) => Math.max(...Array.from(x).slice(1).map((v, i) => Math.abs(v - x[i]!)));
    expect(jump(hard!)).toBeCloseTo(1.6, 6);
    const [soft] = spliceAudio([ch], SR, segs, 0, { crossfadeSec: 0.04, clips: [{ start: 0, end: 1 }, { start: 1, end: 2 }] });
    expect(soft!.length).toBe(hard!.length); // a duração não muda
    expect(jump(soft!)).toBeLessThan(0.1);
    // longe da emenda, igual
    expect(soft![100]).toBe(hard![100]);
    expect(soft![1100]).toBe(hard![1100]);
  });

  it('a mistura nunca lê material do outro clipe (borda do arquivo só some suave)', () => {
    const ch = new Float32Array(2 * SR);
    ch.fill(0.5, 0, SR);
    ch.fill(0.5, SR);
    // trechos encostados na emenda: não há material além do fim de A nem antes do começo de B
    const [out] = spliceAudio([ch], SR, [{ srcStart: 0, srcEnd: 1 }, { srcStart: 1, srcEnd: 2 }], 0, { crossfadeSec: 0.04, clips: [{ start: 0, end: 1 }, { start: 1, end: 2 }] });
    expect(out![SR - 1]!).toBeLessThan(0.5);
    expect(Math.max(...Array.from(out!))).toBeLessThanOrEqual(0.5 + 1e-6);
  });

  it('splicePlan: emendas dentro do mesmo clipe continuam com o fade curto de antes', () => {
    const ch = new Float32Array(2 * SR).fill(1);
    const plan = { clips: [{ id: 'c1', name: '', duration: 2, framing: null }], segments: [{ srcStart: 0, srcEnd: 0.5 }, { srcStart: 1, srcEnd: 2 }] };
    expect(Array.from(splicePlan([ch], SR, plan)[0]!)).toEqual(Array.from(spliceAudio([ch], SR, plan.segments)[0]!));
  });
});
