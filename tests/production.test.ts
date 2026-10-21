import { describe, expect, it } from 'vitest';
import { creativeSetupSchema, DEFAULT_SETUP } from '../src/core/production';
import { makeProject, parseProject } from '../src/core/project';
import { parseEditPlan } from '../src/core/schema';
import { createHistory, pushHistory, undo } from '../src/engine/history';
import { outputDuration } from '../src/engine/timeline';
import { autoEdit } from '../src/editorial/auto-edit';
import { compileCreativeBrief, evaluateDraft, produceFirstDraft, reviseCreativeDirection } from '../src/editorial/production';
import { addElement, deleteElement, setElementText } from '../src/editorial/manual';
import { applyBrief, applyRange } from '../src/editorial/ops';
import { resolvePlan, sceneText } from '../src/editorial/elements';
import { interpretPrompt } from '../src/editorial/interpret';
import { interpretRangePrompt } from '../src/editorial/range-interpret';

const words = [
  { id: 'a', text: 'Primeira', start: 0.3, end: 0.8 },
  { id: 'b', text: 'ideia.', start: 1, end: 2 },
  { id: 'c', text: 'Segunda', start: 6, end: 7 },
  { id: 'd', text: 'ideia.', start: 8, end: 12 },
  { id: 'e', text: 'Preserve', start: 17, end: 18 },
  { id: 'f', text: 'esta', start: 19, end: 20 },
  { id: 'g', text: 'frase.', start: 23, end: 25 },
];
const ctx = { durationSec: 28, words };
const silences = [{ start: 2.1, end: 5.8 }];
const base = autoEdit(28, silences, words);

describe('validated production direction', () => {
  it('rejects invalid saved setup before it can reach the timeline', () => {
    for (const patch of [{ motion: NaN }, { durationSec: -1 }, { preset: 'invented' }, { accent: 'red' }, { version: 2 }]) {
      expect(creativeSetupSchema.safeParse({ ...DEFAULT_SETUP, ...patch }).success).toBe(false);
    }
  });

  it('turns format, style, captions, CTA and explicit prohibitions into real rendered state', () => {
    const result = produceFirstDraft(base, ctx, silences, {
      ...DEFAULT_SETUP, format: 'horizontal', preset: 'documental', motion: 0,
      transition: 'none', captionStyle: 'minimal', accent: '#11AAEE', cta: 'Salve esta ideia', prompt: 'sem emojis, sem zoom',
    });
    expect(result.plan.output).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(result.plan.style.id).toBe('documental');
    expect(result.plan.style.transition).toBe('none');
    expect(result.plan.style.motion.intensity).toBe(0);
    expect(result.plan.style.captions.colors.highlight).toBe('#11AAEE');
    expect(result.plan.style.captions.activeScale).toBe(1);
    expect(result.plan.style.cta).toBe('Salve esta ideia');
    expect(result.plan.scenes.some(scene => scene.kind === 'emoji' || scene.kind === 'emphasis-zoom')).toBe(false);
    expect(result.plan.captions.length).toBeGreaterThan(0);
    expect(parseEditPlan(result.plan).ok).toBe(true);
  });

  it('preserve policy restores the original sequence and never cuts recognized words', () => {
    const result = produceFirstDraft(base, ctx, silences, { ...DEFAULT_SETUP, cutPolicy: 'preserve' });
    expect(result.plan.segments).toEqual([{ srcStart: 0, srcEnd: 28 }]);
    expect(outputDuration(result.plan.segments)).toBe(28);
    expect(result.editorial.decisions.some(decision => decision.kind === 'cuts')).toBe(true);
  });

  it('ends at a complete sentence near the target and never inside the next sentence', () => {
    const result = produceFirstDraft(base, ctx, silences, { ...DEFAULT_SETUP, cutPolicy: 'preserve', durationSec: 15 });
    const last = result.plan.segments.at(-1)!;
    expect(last.srcEnd).toBeCloseTo(12.12);
    expect(result.plan.captions.flatMap(caption => caption.wordIds)).not.toContain('e');
    expect(result.editorial.warnings.length).toBeGreaterThan(0);
  });

  it('keeps usable footage without speech or when the audio is entirely silent', () => {
    const silent = autoEdit(28, [{ start: 0, end: 28 }], []);
    const result = produceFirstDraft(silent, { durationSec: 28, words: [] }, [{ start: 0, end: 28 }], { ...DEFAULT_SETUP, durationSec: 15 });
    expect(outputDuration(result.plan.segments)).toBe(28);
    expect(result.plan.captions).toEqual([]);
    expect(result.editorial.warnings.some(warning => warning.includes('fala'))).toBe(true);
    expect(result.editorial.warnings.some(warning => warning.includes('Música'))).toBe(true);
  });

  it('validates the compiled document, rejecting a poisoned base atomically', () => {
    expect(() => produceFirstDraft({ ...base, output: { width: NaN, height: 0, fps: 0 } }, ctx, silences, DEFAULT_SETUP)).toThrow();
    expect(base.output.width).toBe(1080);
  });

  it('revises direction without discarding manual elements, corrected captions or timeline edits', () => {
    const first = produceFirstDraft(base, ctx, silences, DEFAULT_SETUP).plan;
    const withText = addElement(first, ctx, { kind: 'text', text: 'Meu texto' }, 0, 1).plan;
    const manual = { ...withText, captions: withText.captions.map((caption, index) => index === 0 ? { ...caption, text: 'Correção manual' } : caption) };
    const revised = reviseCreativeDirection(manual, ctx, { ...DEFAULT_SETUP, preset: 'cinema', cutPolicy: 'preserve', durationSec: 15 });
    expect(revised.segments).toEqual(manual.segments);
    expect(revised.edits).toEqual(manual.edits);
    expect(revised.captions.some(caption => caption.text === 'Correção manual')).toBe(true);
    const history = pushHistory(createHistory(manual), revised);
    expect(undo(history).present).toEqual(manual);
  });

  it('roundtrips production preferences in project history and opens old briefs without them', () => {
    const plan = produceFirstDraft(base, ctx, silences, DEFAULT_SETUP).plan;
    const project = makeProject({ savedAt: '2026-10-21', appVersion: 'test', video: { name: 'test.webm', size: 1, durationSec: 28 }, words, silences, warnings: [], history: createHistory(plan) });
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.project.history.present.brief.production).toEqual(DEFAULT_SETUP);
    expect(parseEditPlan(base).ok).toBe(true);
  });

  it('uses tone for motion timing and exposes unsupported avoidance instructions', () => {
    const calm = produceFirstDraft(base, ctx, silences, { ...DEFAULT_SETUP, tone: 'calmo' }).plan;
    const energetic = produceFirstDraft(base, ctx, silences, { ...DEFAULT_SETUP, tone: 'energetico' }).plan;
    expect(calm.style.motion.inSec).toBeGreaterThan(energetic.style.motion.inSec);
    expect(compileCreativeBrief({ ...DEFAULT_SETUP, avoid: 'trocar o fundo da sala' }).unsupported.length).toBeGreaterThan(0);
  });

  it('reports actual timing after a visual revision instead of claiming pauses were restored', () => {
    const next = reviseCreativeDirection(base, ctx, { ...DEFAULT_SETUP, cutPolicy: 'preserve' });
    expect(evaluateDraft(next, ctx).decisions.find(decision => decision.kind === 'cuts')?.description).not.toContain('sem cortes');
  });

  it('removes the earlier opening hook when the user switches it off in direction revision', () => {
    const first = produceFirstDraft(base, ctx, silences, { ...DEFAULT_SETUP, hook: true }).plan;
    expect(first.brief.hook).not.toBeNull();
    const revised = reviseCreativeDirection(first, ctx, { ...DEFAULT_SETUP, hook: false });
    expect(revised.brief.hook).toBeNull();
    expect(revised.scenes.some(scene => scene.kind === 'kinetic-title')).toBe(false);
  });

  it('recalculates the style of an adjusted range while preserving its request and timing', () => {
    const first = produceFirstDraft(base, ctx, silences, DEFAULT_SETUP).plan;
    const request = interpretRangePrompt('mais calmo');
    const ranged = applyRange(first, ctx, { start: 0, end: 3 }, request).plan;
    const revised = reviseCreativeDirection(ranged, ctx, { ...DEFAULT_SETUP, preset: 'cinema', accent: '#11AAEE' });
    expect(revised.ranges[0]!.style?.id).toBe('cinema');
    expect(revised.ranges[0]!.style?.palette.accent).toBe('#11AAEE');
    expect(revised.ranges[0]!.prompt).toBe(ranged.ranges[0]!.prompt);
    expect(revised.ranges[0]!.out).toEqual(ranged.ranges[0]!.out);
  });

  it('preserves the rendered content and deletion of manually edited generated scenes', () => {
    const first = produceFirstDraft(base, ctx, silences, { ...DEFAULT_SETUP, preset: 'pop', pace: 'rapido', cta: 'CTA original' }).plan;
    const cta = resolvePlan(first).scenes.find(item => item.scene.kind === 'end-cta')!;
    const manual = setElementText(first, { type: 'scene', key: cta.key }, 'Minha chamada manual');
    const revised = reviseCreativeDirection(manual, ctx, { ...DEFAULT_SETUP, preset: 'minimal', pace: 'lento' });
    expect(resolvePlan(revised).scenes.filter(item => item.scene.kind === 'end-cta').map(item => sceneText(item.scene))).toEqual(['Minha chamada manual']);
    const afterRequest = applyBrief(revised, ctx, interpretPrompt('sem emojis').brief);
    expect(resolvePlan(afterRequest).scenes.filter(item => item.scene.kind === 'end-cta').map(item => sceneText(item.scene))).toEqual(['Minha chamada manual']);
    const hidden = deleteElement(first, { type: 'scene', key: cta.key });
    const hiddenRevision = reviseCreativeDirection(hidden, ctx, { ...DEFAULT_SETUP, preset: 'minimal', pace: 'lento' });
    expect(resolvePlan(hiddenRevision).scenes.some(item => item.scene.kind === 'end-cta')).toBe(false);
    expect(resolvePlan(applyBrief(hiddenRevision, ctx, interpretPrompt('sem emojis').brief)).scenes.some(item => item.scene.kind === 'end-cta')).toBe(false);
  });

  it('keeps production context and its controls reachable after normal text editing', () => {
    const first = produceFirstDraft(base, ctx, silences, DEFAULT_SETUP).plan;
    const revised = applyBrief(first, ctx, interpretPrompt('sem emojis').brief);
    expect(revised.brief.production).toEqual(DEFAULT_SETUP);
    expect(revised.brief.forbid).toContain('emojis');
  });
});
