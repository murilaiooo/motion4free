import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from '../src/core/brief';
import { DEFAULT_STYLE, DOCUMENTAL } from '../src/core/presets';
import { migratePlan, parseEditPlan } from '../src/core/schema';
import { EMPTY_EDITS } from '../src/core/edits';
import type { StyleDNA } from '../src/core/style';

/** Estilo e pedido no formato antigo (v1), como estavam salvos até a v0.5. */
function styleV1(s: StyleDNA) {
  const { emoji: _e, ...rest } = s;
  const { y: _y, enter: _en, wordsPerLine: _w, colors: _c, ...captions } = s.captions;
  return { ...rest, version: 1, captions };
}
const { look: _l, hookStyle: _h, unsupported: _u, summary: _s, ...briefRest } = EMPTY_BRIEF;
const BRIEF_V1 = { ...briefRest, version: 1 };

const v1 = {
  version: 1,
  output: { width: 1080, height: 1920, fps: 30 },
  segments: [{ srcStart: 0, srcEnd: 2.5 }],
  captions: [{ id: 'c1', text: 'Olá', start: 0, end: 1, wordIds: ['w1'] }],
  scenes: [{ id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 1.5 }],
};

const valid5 = {
  version: 5 as const,
  output: { width: 1080, height: 1920, fps: 30 },
  style: DEFAULT_STYLE,
  brief: EMPTY_BRIEF,
  segments: [{ srcStart: 0, srcEnd: 2.5 }],
  captions: [{ id: 'c1', text: 'Olá', start: 0, end: 1, wordIds: ['w1'], wordStarts: [0] }],
  scenes: [
    { id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 1.5 },
    { id: 's2', kind: 'big-number', value: '3', label: 'dicas', start: 1, end: 2 },
    { id: 's3', kind: 'list', items: [{ text: 'Beba água', at: 1 }], start: 1, end: 2 },
    { id: 's4', kind: 'cut-transition', at: 1.2, start: 1.1, end: 1.3 },
    { id: 's5', kind: 'progress-bar', start: 0, end: 2.5 },
  ],
  ranges: [],
  reference: null,
};

const valid = {
  ...valid5,
  version: 6 as const,
  clips: [{ id: 'c1', name: '', duration: 2.5, framing: null as any }],
  framing: { mode: 'smart' as const, fill: 'blur' as const, zoom: 1, x: 0, y: 0 },
  edits: EMPTY_EDITS,
};

const v5 = { ...valid5, version: 5 as const };
const v4 = { ...valid5, version: 4 as const, style: styleV1(DEFAULT_STYLE), brief: BRIEF_V1 };
const { ranges: _r, reference: _ref, ...v3body } = v4;
const v3 = { ...v3body, version: 3 as const };

describe('parseEditPlan', () => {
  it('aceita um plano v6 válido', () => {
    expect(parseEditPlan(valid)).toEqual({ ok: true, plan: valid });
  });

  it('rejeita segmento invertido', () => {
    const r = parseEditPlan({ ...valid, segments: [{ srcStart: 3, srcEnd: 1 }] });
    expect(r.ok).toBe(false);
  });

  it('rejeita tipo de cena desconhecido (nada de código livre)', () => {
    const r = parseEditPlan({ ...valid, scenes: [{ ...valid.scenes[0], kind: 'eval' as any }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('scenes.0');
  });

  it('rejeita cena sem os parâmetros do seu tipo', () => {
    const r = parseEditPlan({ ...valid, scenes: [{ id: 'x', kind: 'big-number', start: 0, end: 1 } as any] });
    expect(r.ok).toBe(false);
  });

  it('rejeita estilo com fonte que o app não tem', () => {
    const style = { ...DEFAULT_STYLE, type: { ...DEFAULT_STYLE.type, text: { ...DEFAULT_STYLE.type.text, family: 'Comic Sans' } } } as any;
    expect(parseEditPlan({ ...valid, style }).ok).toBe(false);
  });
});

describe('migração v1 → v2 → v3 → v4 → v5 → v6', () => {
  it('plano da Fase 2 abre como v6 com estilo padrão, pedido vazio e o mesmo conteúdo', () => {
    const r = parseEditPlan(v1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.version).toBe(6);
    expect(r.plan.ranges).toEqual([]);
    expect(r.plan.reference).toBeNull();
    expect(r.plan.brief).toEqual(EMPTY_BRIEF);
    expect(r.plan.style.id).toBe(DEFAULT_STYLE.id);
    expect(r.plan.segments).toEqual(v1.segments);
    expect(r.plan.captions[0]).toEqual({ ...v1.captions[0], wordStarts: [] });
    expect(r.plan.scenes).toEqual(v1.scenes);
  });

  it('v1 inválido continua inválido', () => {
    expect(parseEditPlan({ ...v1, segments: [] }).ok).toBe(false);
  });

  it('plano da Fase 4 (v3) abre como v6 sem trechos, sem cores de referência e com o mesmo conteúdo', () => {
    const r = parseEditPlan(v3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan).toEqual(valid);
  });

  it('rejeita trecho com fim antes do início e trecho com estilo inválido', () => {
    const range = { id: 'r1', srcStart: 1, srcEnd: 2, out: { start: 1, end: 2 }, prompt: '', tone: null, intensity: null, pace: null, forbid: [], emphasize: [], quiet: false, accent: false, variant: 0, look: null, style: null, locked: null } as any;
    expect(parseEditPlan({ ...valid, ranges: [range] }).ok).toBe(true);
    expect(parseEditPlan({ ...valid, ranges: [{ ...range, srcEnd: 0.5 }] }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, ranges: [{ ...range, style: { id: 'x' } }] }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, reference: { colors: ['red'] } }).ok).toBe(false);
  });

  it('plano da Fase 3 (v2) abre como v6 com pedido vazio, estilo e cenas iguais', () => {
    const { brief: _b, ...rest } = v3 as any;
    const v2 = { ...rest, version: 2 };
    const r = parseEditPlan(v2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan).toEqual(valid);
  });

  it('v2 inválido continua inválido', () => {
    const { brief: _b, ...rest } = v3 as any;
    expect(parseEditPlan({ ...rest, version: 2, segments: [] }).ok).toBe(false);
  });

  it('plano da Fase 5 (v4) abre como v6: estilo v2 sem emojis e sem cores próprias, pedido v2 vazio, trechos sem look', () => {
    const range = { id: 'r1', srcStart: 1, srcEnd: 2, out: { start: 1, end: 2 }, prompt: 'calmo', tone: 'calmo', intensity: null, pace: null, forbid: [], emphasize: [], quiet: false, accent: false, variant: 0, style: styleV1(DOCUMENTAL), locked: null } as any;
    const r = parseEditPlan({ ...v4, ranges: [range] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.version).toBe(6);
    expect(r.plan.style).toEqual(DEFAULT_STYLE);
    expect((r.plan.style as any).emoji.mode).toBe('off');
    expect((r.plan.style as any).captions.colors).toEqual({ text: null, highlight: null, stroke: null, box: null });
    expect((r.plan.style as any).captions.enter).toBe('auto');
    expect(r.plan.brief).toEqual(EMPTY_BRIEF);
    expect(r.plan.ranges[0]!.look).toBeNull();
    expect(r.plan.ranges[0]!.style).toEqual(DOCUMENTAL);
    expect({ ...r.plan, ranges: [] }).toEqual(valid);
  });

  it('v4 com cena de emoji não existe (emoji só a partir da v5)', () => {
    expect(parseEditPlan({ ...v4, scenes: [{ id: 'e', kind: 'emoji', emoji: '🔥', start: 0, end: 1 }] as any }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, scenes: [{ id: 'e', kind: 'emoji', emoji: '🔥', start: 0, end: 1 }] as any }).ok).toBe(true);
    expect(parseEditPlan({ ...valid, scenes: [{ id: 'e', kind: 'emoji', emoji: '🦄', start: 0, end: 1 }] as any }).ok).toBe(false);
  });

  it('não mexe em plano que já é v6', () => {
    expect(migratePlan(valid)).toBe(valid);
  });

  it('plano da v0.12 (v5) abre como v6 sem edições manuais; trava ganha a posição geral vazia', () => {
    const lockedRange = { id: 'r1', srcStart: 0, srcEnd: 1, out: { start: 0, end: 1 }, prompt: '', tone: null, intensity: null, pace: null, forbid: [], emphasize: [], quiet: false, accent: false, variant: 0, look: null, style: null, locked: { outStart: 0, scenes: [], captions: [] } } as any;
    const r = parseEditPlan({ ...v5, ranges: [lockedRange] });
    expect(r.ok ? 'ok' : (r as any).errors.join('\n')).toBe('ok');
    if (!r.ok) return;
    expect(r.plan.version).toBe(6);
    expect((r.plan as any).edits).toEqual(EMPTY_EDITS);
    expect((r.plan as any).ranges[0]!.locked!.captionEdits).toEqual({ placement: null, look: {} });
    expect({ ...(r.plan as any), ranges: [] }).toEqual(valid);
  });

  it('plano v5 (um vídeo, v0.6 a v0.13) abre como v6 com um clipe e o recorte antigo', () => {
    const r = parseEditPlan(valid5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan).toEqual(valid);
  });

  it('v6: clipes com o mesmo id, sem clipes ou trecho depois do fim dos clipes são recusados', () => {
    expect(parseEditPlan({ ...valid, clips: [] }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, clips: [(valid as any).clips[0], (valid as any).clips[0]] }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, clips: [{ ...(valid as any).clips[0], duration: 1 }] }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, framing: { ...(valid as any).framing, zoom: 5 } }).ok).toBe(false);
    expect(parseEditPlan({ ...valid, framing: { ...(valid as any).framing, mode: 'stretch' } as any }).ok).toBe(false);
  });

  it('v6 com vários clipes e enquadramento por clipe é aceito', () => {
    const clips = [
      { id: 'c1', name: 'a.mp4', duration: 2, framing: null },
      { id: 'c2', name: 'b.mp4', duration: 3, framing: { mode: 'fit', fill: 'color', zoom: 1.2, x: 0.5, y: -0.2 } },
    ] as any;
    expect(parseEditPlan({ ...valid, clips, segments: [{ srcStart: 0, srcEnd: 2 }, { srcStart: 2, srcEnd: 4.5 }] }).ok).toBe(true);
  });

  it('v6 recusa edições fora dos limites (cor, tamanho, peso da fonte, elemento vazio)', () => {
    const e = (over: object) => parseEditPlan({ ...valid, edits: { ...EMPTY_EDITS, ...over } as any }).ok;
    expect(e({ captionPlacement: { x: 0.5, y: 0.2, scale: 1, rotate: 0 } })).toBe(true);
    expect(e({ captionPlacement: { x: 0.5, y: 0.2, scale: 9, rotate: 0 } })).toBe(false);
    expect(e({ captionLook: { text: 'red' } })).toBe(false);
    expect(e({ captionLook: { font: 'Anton', weight: 900 } })).toBe(false);
    expect(e({ captionLook: { font: 'Anton', weight: 400 } })).toBe(true);
    const text = { id: 'e1', kind: 'text', preset: 'text', srcStart: 0, srcEnd: 1, placement: { x: 0.5, y: 0.5, scale: 1, rotate: 0 }, text: 'Oi', emoji: null, shape: null, look: {} } as any;
    expect(e({ added: [text] })).toBe(true);
    expect(e({ added: [{ ...text, text: '  ' }] })).toBe(false);
    expect(e({ added: [{ ...text, kind: 'emoji', emoji: '🦄' as any }] })).toBe(false);
    expect(e({ added: [{ ...text, srcEnd: 0 }] })).toBe(false);
    expect(e({ video: { fit: 'fit', scale: 1.2, x: 0, y: 0.1 } })).toBe(true);
    expect(e({ video: { fit: 'stretch', scale: 1, x: 0, y: 0 } as any })).toBe(false);
  });

  it('rejeita pedido com proibição desconhecida (só IDs permitidos)', () => {
    expect(parseEditPlan({ ...valid, brief: { ...EMPTY_BRIEF, forbid: ['tudo' as any] } }).ok).toBe(false);
  });
});

describe('plano de demonstração da galeria', () => {
  it('é válido em todos os estilos', async () => {
    const { PRESETS } = await import('../src/core/presets');
    const { galleryPlan } = await import('../src/editorial/sample');
    for (const s of PRESETS) expect(parseEditPlan(galleryPlan(s)).ok, s.id).toBe(true);
  });
});
