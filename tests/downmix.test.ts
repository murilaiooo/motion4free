import { describe, expect, it } from 'vitest';
import { Mono16kWriter } from '../src/analysis/downmix';
import { energyEnvelope, meanDbBetween, speechMedianDb, ENERGY_FLOOR_DB } from '../src/analysis/energy';

describe('Mono16kWriter (áudio longo em mono 16 kHz)', () => {
  it('48 kHz estéreo: média dos canais e de cada 3 amostras', () => {
    const w = new Mono16kWriter(48000, 1);
    const left = new Float32Array(48000).fill(0.5);
    const right = new Float32Array(48000).fill(-0.1);
    w.write([left, right], 0);
    const out = w.finish();
    expect(out.length).toBe(16000);
    for (const i of [0, 1, 8000, 15999]) expect(out[i]).toBeCloseTo(0.2, 5);
  });

  it('pedaços em qualquer posição dão o mesmo resultado que um pedaço só', () => {
    const sr = 44100;
    const sig = Float32Array.from({ length: sr }, (_, i) => Math.sin(i / 20));
    const whole = new Mono16kWriter(sr, 1);
    whole.write([sig], 0);
    const parts = new Mono16kWriter(sr, 1);
    for (let a = 0; a < sr; a += 1234) parts.write([sig.subarray(a, Math.min(sr, a + 1234))], a);
    expect(Array.from(parts.finish())).toEqual(Array.from(whole.finish()));
  });

  it('pedaço com início negativo ou além do fim não estoura', () => {
    const w = new Mono16kWriter(16000, 0.5);
    w.write([new Float32Array(100).fill(1)], -50);
    w.write([new Float32Array(100).fill(1)], 7990);
    const out = w.finish();
    expect(out.length).toBe(8000);
    expect(out[0]).toBe(1);
    expect(out[7999]).toBe(1);
  });

  it('taxa menor que 16 kHz repete a amostra anterior', () => {
    const w = new Mono16kWriter(8000, 1);
    w.write([new Float32Array(8000).fill(0.3)], 0);
    const out = w.finish();
    expect(out[1]).toBeCloseTo(0.3, 5);
    expect(out[15999]).toBeCloseTo(0.3, 5);
  });
});

describe('energia do áudio', () => {
  const sr = 16000;
  const loud = (sec: number, amp: number) => new Float32Array(sec * sr).fill(amp);

  it('um valor por meio segundo, em dB, com piso para o silêncio', () => {
    const sig = new Float32Array(2 * sr);
    sig.set(loud(1, 0.1), sr);
    const env = energyEnvelope(sig, sr);
    expect(env.length).toBe(4);
    expect(env[0]).toBe(ENERGY_FLOOR_DB);
    expect(env[2]).toBeCloseTo(-20, 1);
  });

  it('mediana ignora o silêncio; média de um trecho', () => {
    const env = Float32Array.from([ENERGY_FLOOR_DB, -30, -20, -10, ENERGY_FLOOR_DB]);
    expect(speechMedianDb(env)).toBe(-20);
    expect(meanDbBetween(env, 0.5, 2)).toBeCloseTo(-20, 5);
    expect(meanDbBetween(env, 0, 0.5)).toBeNull();
    expect(speechMedianDb(Float32Array.from([ENERGY_FLOOR_DB]))).toBeNull();
  });
});
