import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '../src/core/presets';
import { migratePlan, parseEditPlan } from '../src/core/schema';

const v1 = {
  version: 1,
  output: { width: 1080, height: 1920, fps: 30 },
  segments: [{ srcStart: 0, srcEnd: 2.5 }],
  captions: [{ id: 'c1', text: 'Olá', start: 0, end: 1, wordIds: ['w1'] }],
  scenes: [{ id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 1.5 }],
};

const valid = {
  version: 2,
  output: { width: 1080, height: 1920, fps: 30 },
  style: DEFAULT_STYLE,
  segments: [{ srcStart: 0, srcEnd: 2.5 }],
  captions: [{ id: 'c1', text: 'Olá', start: 0, end: 1, wordIds: ['w1'], wordStarts: [0] }],
  scenes: [
    { id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 1.5 },
    { id: 's2', kind: 'big-number', value: '3', label: 'dicas', start: 1, end: 2 },
    { id: 's3', kind: 'list', items: [{ text: 'Beba água', at: 1 }], start: 1, end: 2 },
    { id: 's4', kind: 'cut-transition', at: 1.2, start: 1.1, end: 1.3 },
    { id: 's5', kind: 'progress-bar', start: 0, end: 2.5 },
  ],
};

describe('parseEditPlan', () => {
  it('aceita um plano v2 válido', () => {
    expect(parseEditPlan(valid)).toEqual({ ok: true, plan: valid });
  });

  it('rejeita segmento invertido', () => {
    const r = parseEditPlan({ ...valid, segments: [{ srcStart: 3, srcEnd: 1 }] });
    expect(r.ok).toBe(false);
  });

  it('rejeita tipo de cena desconhecido (nada de código livre)', () => {
    const r = parseEditPlan({ ...valid, scenes: [{ ...valid.scenes[0], kind: 'eval' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('scenes.0');
  });

  it('rejeita cena sem os parâmetros do seu tipo', () => {
    const r = parseEditPlan({ ...valid, scenes: [{ id: 'x', kind: 'big-number', start: 0, end: 1 }] });
    expect(r.ok).toBe(false);
  });

  it('rejeita estilo com fonte que o app não tem', () => {
    const style = { ...DEFAULT_STYLE, type: { ...DEFAULT_STYLE.type, text: { ...DEFAULT_STYLE.type.text, family: 'Comic Sans' } } };
    expect(parseEditPlan({ ...valid, style }).ok).toBe(false);
  });
});

describe('migração v1 → v2', () => {
  it('plano da Fase 2 abre como v2 com estilo padrão e o mesmo conteúdo', () => {
    const r = parseEditPlan(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.version).toBe(2);
    expect(r.plan.style.id).toBe(DEFAULT_STYLE.id);
    expect(r.plan.segments).toEqual(v1.segments);
    expect(r.plan.captions[0]).toEqual({ ...v1.captions[0], wordStarts: [] });
    expect(r.plan.scenes).toEqual(v1.scenes);
  });

  it('v1 inválido continua inválido', () => {
    expect(parseEditPlan({ ...v1, segments: [] }).ok).toBe(false);
  });

  it('não mexe em plano que já é v2', () => {
    expect(migratePlan(valid)).toBe(valid);
  });
});

describe('plano de demonstração da galeria', () => {
  it('é válido em todos os estilos', async () => {
    const { PRESETS } = await import('../src/core/presets');
    const { galleryPlan } = await import('../src/editorial/sample');
    for (const s of PRESETS) expect(parseEditPlan(galleryPlan(s)).ok, s.id).toBe(true);
  });
});
