import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { diffPlans } from '../src/editorial/diff';
import { addElement } from '../src/editorial/manual';
import { applyRange, applyReferencePalette, applyStyle, editCaptionText, type EditContext } from '../src/editorial/ops';
import { interpretRangePrompt } from '../src/editorial/range-interpret';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT);
const durationSec = words.at(-1)!.end + 0.5;
const ctx: EditContext = { durationSec, words };
const base = autoEdit(durationSec, [], words);

describe('diffPlans', () => {
  it('planos iguais: nenhuma mudança', () => {
    expect(diffPlans(base, base)).toEqual({ changes: [], span: null });
  });

  it('pedido de trecho: lista o trecho novo e só cenas de dentro dele', () => {
    const next = applyRange(base, ctx, { start: 12, end: 18 }, interpretRangePrompt('sem animação aqui')).plan;
    const d = diffPlans(base, next);
    expect(d.changes[0]!.text).toContain('Trecho novo de 12,0 s a 18,0 s');
    const scenes = d.changes.filter((c) => c.kind === 'removed' || c.kind === 'added');
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((c) => c.kind === 'removed' && c.at! >= 12 && c.at! < 18)).toBe(true);
    expect(d.span!.start).toBeGreaterThanOrEqual(12);
    expect(d.span!.end).toBeLessThanOrEqual(18);
    expect(d.changes.some((c) => c.kind === 'caption')).toBe(false);
  });

  it('troca de estilo sem imagem não diz "cores de volta" e não lista a mesma cena como tirada e posta (v0.7)', () => {
    const restyled = applyStyle(base, ctx, 'neon');
    const texts = diffPlans(base, restyled).changes.map((c) => c.text);
    expect(texts.join(' | ')).not.toContain('Cores do estilo de volta');
    const minus = texts.filter((t) => t.startsWith('− ')).map((t) => t.slice(2));
    const plus = texts.filter((t) => t.startsWith('+ ')).map((t) => t.slice(2));
    for (const m of minus) expect(plus, m).not.toContain(m);
    // e tirar a imagem continua dizendo que as cores voltaram
    const colored = applyReferencePalette(base, ctx, { colors: ['#C81E28'] });
    const back = applyReferencePalette(colored, ctx, null);
    expect(diffPlans(colored, back).changes.map((c) => c.text)).toContain('Cores do estilo de volta (sem imagem)');
  });

  it('troca de estilo, legenda corrigida e cores aparecem', () => {
    const restyled = applyStyle(base, ctx, 'editorial');
    expect(diffPlans(base, restyled).changes[0]!.text).toBe('Estilo: Pop → Editorial');
    const fixed = editCaptionText(base, 'c2', 'Texto novo');
    const d = diffPlans(base, fixed);
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0]!.text).toMatch(/Legenda em .*→ “Texto novo”/);
    const colored = applyReferencePalette(base, ctx, { colors: ['#C81E28'] });
    expect(diffPlans(base, colored).changes.map((c) => c.text)).toContain('Cores tiradas da sua imagem');
  });

  it('mostra título criado, restauração que remove o título e ajustes de composição', () => {
    const withTitle = addElement(base, ctx, { kind: 'text', preset: 'title', text: 'Título novo' }, 1).plan;
    const added = diffPlans(base, withTitle);
    expect(added.changes.map((c) => c.text)).toContainEqual(expect.stringContaining('+ título “Título novo”'));
    expect(added.span?.start).toBeCloseTo(1, 2);
    expect(diffPlans(withTitle, base).changes.map((c) => c.text)).toContainEqual(expect.stringContaining('− título “Título novo”'));

    const adjusted = { ...withTitle, edits: { ...withTitle.edits, video: { ...withTitle.edits.video, x: 0.2 } } };
    expect(diffPlans(withTitle, adjusted).changes.map((c) => c.text)).toContainEqual(expect.stringContaining('enquadramento manual'));
    expect(diffPlans(adjusted, adjusted).changes).toHaveLength(0);
  });

  it('travar aparece como mudança do trecho', () => {
    const a = applyRange(base, ctx, { start: 5, end: 9 }, interpretRangePrompt('mais calmo aqui')).plan;
    const b = applyRange(a, ctx, { id: 'r1' }, interpretRangePrompt('trava')).plan;
    expect(diffPlans(a, b).changes.map((c) => c.text)).toEqual([expect.stringContaining('travado')]);
  });
});
