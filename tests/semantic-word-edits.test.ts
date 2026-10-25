import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory, undo, redo } from '../src/engine/history';
import { commitEdit } from '../src/editorial/commands';
import { duplicateSegment, moveSegment } from '../src/editorial/sequence';
import { cutSourceRange, trimSegment } from '../src/editorial/manual';
import { parseEditPlan } from '../src/core/schema';
import { makeProject, parseProject } from '../src/core/project';
import { addSemanticWord, removeSemanticWord, reanchorSemanticWord, scheduledPlanCues, activeSemanticWords } from '../src/editorial/semantic-word-edits';

const words = [
  { id: 'w-a', text: 'primeiro', start: 0.5, end: 0.9 },
  { id: 'w-b', text: 'importante', start: 1.25, end: 1.6 },
  { id: 'w-c', text: 'agora', start: 2.5, end: 2.85 },
];
const ctx = { durationSec: 4, words };
const base = autoEdit(4, [], words);

describe('seam #117: edição semântica em EditPlan, undo, save e render determinístico', () => {
  it('cria âncora validada e agenda frames exatos 24/30/60 fps, sem mudar o original', () => {
    for (const fps of [24, 30, 60]) {
      const plan = addSemanticWord({ ...base, output: { ...base.output, fps } }, words[1]!);
      expect(plan.semanticCues).toHaveLength(1);
      expect(base.semanticCues ?? []).toHaveLength(0);
      const events = scheduledPlanCues(plan);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        startFrame: Math.round(1.25 * fps), wordId: 'w-b', segmentIndex: 0, text: 'importante',
      });
      expect(activeSemanticWords(plan, (events[0]!.startFrame + 0.5) / fps)).toContain('importante');
      expect(activeSemanticWords(plan, events[0]!.endFrameExclusive / fps)).not.toContain('importante');
      expect(parseEditPlan(plan).ok).toBe(true);
    }
  });

  it('duplica e reordena ocorrência com o trecho; corte/trim remove palavra parcial ou inteira', () => {
    let plan = addSemanticWord(base, words[1]!);
    plan = duplicateSegment(plan, ctx, 0).plan;
    expect(scheduledPlanCues(plan).map(e => e.startFrame)).toEqual([38, 158]);
    plan = moveSegment(plan, ctx, 1, 0);
    expect(scheduledPlanCues(plan)).toHaveLength(2);
    const cut = cutSourceRange(addSemanticWord(base, words[1]!), ctx, { start: 1.25, end: 1.65 });
    expect(scheduledPlanCues(cut)).toEqual([]);
    const cutPartial = trimSegment(addSemanticWord(base, words[1]!), ctx, 0, 'start', 1.4);
    expect(scheduledPlanCues(cutPartial)).toEqual([]);
  });

  it('mover âncora e apagar respeitam históricos; projetos antigos abrem sem cues', () => {
    const initial = createHistory(base);
    const once = commitEdit(initial, addSemanticWord(base, words[1]!));
    const moved = commitEdit(once, reanchorSemanticWord(once.present, once.present.semanticCues![0]!.id, words[2]!));
    expect(scheduledPlanCues(moved.present)[0]!.wordId).toBe('w-c');
    expect(scheduledPlanCues(undo(moved).present)[0]!.wordId).toBe('w-b');
    expect(redo(undo(moved)).present).toEqual(moved.present);
    const gone = removeSemanticWord(moved.present, moved.present.semanticCues![0]!.id);
    expect(scheduledPlanCues(gone)).toEqual([]);

    const project = makeProject({ video: { name: 'demo.webm', durationSec: 4, size: 100 }, words, warnings: [], silences: [], history: moved, appVersion: '0.30.0', savedAt: 'today' });
    const roundtrip = parseProject(JSON.parse(JSON.stringify(project)));
    expect(roundtrip.ok).toBe(true);
    if (roundtrip.ok) expect(roundtrip.project.history.present.semanticCues?.[0]?.wordId).toBe('w-c');
    expect(parseEditPlan(base).ok).toBe(true);
  });

  it('modo quieto e trecho travado têm precedência sobre os destaques automáticos', () => {
    const cue = addSemanticWord(base, words[1]!);
    const t = 1.3;
    expect(activeSemanticWords(cue, t)).toEqual(['importante']);
    const quiet = { ...cue, ranges: [{ id: 'r1', srcStart: 1.1, srcEnd: 1.8, out: { start: 1.1, end: 1.8 }, quiet: true, locked: null }] } as unknown as typeof cue;
    expect(activeSemanticWords(quiet, t)).toEqual([]);
    const locked = { ...cue, ranges: [{ id: 'r1', srcStart: 1.1, srcEnd: 1.8, out: { start: 1.1, end: 1.8 }, quiet: false, locked: {} }] } as unknown as typeof cue;
    expect(activeSemanticWords(locked, t)).toEqual([]);
  });

  it('não permite palavra de fora, duplicação, cue com ID inválido nem violar limite', () => {
    expect(() => addSemanticWord(base, { id: 'fake', text: 'não existe', start: 99, end: 100 })).toThrow();
    const once = addSemanticWord(base, words[1]!);
    expect(addSemanticWord(once, words[1]!)).toBe(once);
    expect(parseEditPlan({ ...once, semanticCues: [{ ...once.semanticCues![0], id: '../../bad' }] }).ok).toBe(false);
    expect(parseEditPlan({ ...once, semanticCues: [{ ...once.semanticCues![0], offsetFrames: 99999 }] }).ok).toBe(false);
  });
});