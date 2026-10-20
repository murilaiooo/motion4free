import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';

const valid = {
  version: 1,
  output: { width: 1080, height: 1920, fps: 30 },
  segments: [{ srcStart: 0, srcEnd: 2.5 }],
  captions: [{ id: 'c1', text: 'Olá', start: 0, end: 1, wordIds: ['w1'] }],
  scenes: [{ id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 1.5 }],
};

describe('parseEditPlan', () => {
  it('aceita um plano válido', () => {
    expect(parseEditPlan(valid)).toEqual({ ok: true, plan: valid });
  });

  it('rejeita segmento invertido', () => {
    const r = parseEditPlan({ ...valid, segments: [{ srcStart: 3, srcEnd: 1 }] });
    expect(r.ok).toBe(false);
  });

  it('rejeita tipo de cena desconhecido (nada de código livre)', () => {
    const r = parseEditPlan({ ...valid, scenes: [{ ...valid.scenes[0], kind: 'eval' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('scenes.0.kind');
  });
});
