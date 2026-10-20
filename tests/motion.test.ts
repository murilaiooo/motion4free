import { describe, expect, it } from 'vitest';
import { cubicBezier, easeInOutQuint, easeOutBackBy, easeOutExpo, spring, springIn, springPeak, stagger, wiggle } from '../src/render/motion';

describe('sistema de movimento (v0.7)', () => {
  it('mola subamortecida passa do ponto e volta para 1', () => {
    const s = { freq: 2.5, zeta: 0.4 };
    expect(spring(0, s)).toBe(0);
    expect(spring(-1, s)).toBe(0);
    const samples = Array.from({ length: 200 }, (_, i) => spring(i / 100, s));
    const peak = Math.max(...samples);
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeCloseTo(springPeak(s), 2);
    expect(spring(2, s)).toBeCloseTo(1, 2);
  });

  it('mola crítica nunca passa de 1 e é monotônica', () => {
    const s = { freq: 2, zeta: 1 };
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = spring(i / 50, s);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('mola numa janela começa em 0 e termina exatamente em 1', () => {
    const s = { freq: 1.6, zeta: 0.45 };
    expect(springIn(0, s)).toBe(0);
    expect(springIn(1, s)).toBeCloseTo(1, 10);
    expect(springIn(2, s)).toBeCloseTo(1, 10);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => springIn(i / 100, s)))).toBeGreaterThan(1.05);
  });

  it('cubic-bezier igual ao CSS nos extremos e no linear', () => {
    const lin = cubicBezier(0, 0, 1, 1);
    for (const x of [0, 0.25, 0.5, 0.9, 1]) expect(lin(x)).toBeCloseTo(x, 4);
    const ease = cubicBezier(0.25, 0.1, 0.25, 1); // "ease" do CSS
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it('curvas prontas: limites e forma', () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(0.3)).toBeGreaterThan(0.85);
    expect(easeInOutQuint(0.5)).toBeCloseTo(0.5, 6);
    const back = Array.from({ length: 101 }, (_, i) => easeOutBackBy(i / 100, 0.2));
    expect(Math.max(...back)).toBeGreaterThan(1.12);
    expect(back[100]).toBeCloseTo(1, 6);
  });

  it('sequência com teto: muitos itens não passam do total', () => {
    expect(stagger(2, 0.05)).toBeCloseTo(0.1, 6);
    expect(stagger(9, 0.2, 0.6, 10)).toBeCloseTo(0.6, 6);
  });

  it('tremor é determinístico e limitado', () => {
    expect(wiggle(1.234, 9, 3)).toBe(wiggle(1.234, 9, 3));
    for (let i = 0; i < 200; i++) expect(Math.abs(wiggle(i * 0.013, 11, 1))).toBeLessThanOrEqual(1);
    expect(wiggle(0.5, 9, 1)).not.toBe(wiggle(0.5, 9, 2));
  });
});
