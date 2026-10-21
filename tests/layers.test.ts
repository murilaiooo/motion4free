import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';
import { autoEdit } from '../src/editorial/auto-edit';
import { resolvePlan } from '../src/editorial/elements';
import { addElement, copyElement, pasteElement, setElementTrack } from '../src/editorial/manual';
import type { EditContext } from '../src/editorial/ops';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

/** Camadas (v0.18): elemento numa camada mais alta é desenhado por cima, e a camada vai junto ao copiar. */
const words = wordsFrom(SAMPLE_TEXT, 0.2);
const dur = words.at(-1)!.end + 1;
const ctx: EditContext = { durationSec: dur, words };
const base = autoEdit(dur, [], words);

describe('camadas de elementos', () => {
  it('camada mais alta desenha por cima, mesmo adicionada antes', () => {
    const a = addElement(base, ctx, { kind: 'text', text: 'Fundo' }, 1, 2);
    const b = addElement(a.plan, ctx, { kind: 'emoji' }, 1, 2);
    expect(resolvePlan(b.plan).added.map((x) => x.el.id)).toEqual([a.id, b.id]);
    const up = setElementTrack(b.plan, a.id, 2);
    expect(resolvePlan(up).added.map((x) => x.el.id)).toEqual([b.id, a.id]);
    expect(parseEditPlan(up).ok).toBe(true);
  });

  it('mesma camada não muda nada; camada fora do limite é ajustada', () => {
    const a = addElement(base, ctx, { kind: 'text', text: 'Oi' }, 1, 2);
    expect(setElementTrack(a.plan, a.id, 0)).toBe(a.plan);
    const far = setElementTrack(a.plan, a.id, 99);
    expect(far.edits.added[0]!.track).toBe(9);
  });

  it('copiar e colar mantém a camada', () => {
    const a = addElement(base, ctx, { kind: 'text', text: 'Oi' }, 1, 2);
    const up = setElementTrack(a.plan, a.id, 3);
    const p = pasteElement(up, ctx, copyElement(up, { type: 'added', id: a.id }), 5);
    expect(p.plan.edits.added.find((x) => x.id === p.id)!.track).toBe(3);
  });
});
