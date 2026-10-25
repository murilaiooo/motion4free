import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { reorderClipPlan } from '../src/editorial/clip-ops';
import { placeWords } from '../src/engine/clips';
import { outputDuration } from '../src/engine/timeline';
import { addElement } from '../src/editorial/manual';
import { AppError } from '../src/core/errors';
import { addSemanticWord, scheduledPlanCues } from '../src/editorial/semantic-word-edits';

const a = { id: 'c1', name: 'a.webm', duration: 4, framing: null };
const b = { id: 'c2', name: 'b.webm', duration: 3, framing: null };
const byClip = {
  c1: [{ id: 'c1:w1', text: 'primeira', start: 0.4, end: 0.8 }],
  c2: [{ id: 'c2:w1', text: 'segunda', start: 0.5, end: 1.0 }],
};
const begin = () => autoEdit(7, [], placeWords([a, b], byClip), undefined, { clips: [a, b] });

describe('integridade da timeline ao reorganizar clipes', () => {
  it('refaz as legendas no tempo certo sem perder correções do texto', () => {
    const original = begin();
    const amended = { ...original, captions: original.captions.map(c =>
      c.wordIds.includes('c2:w1') ? { ...c, text: 'EDITADO' } : c) };
    const next = reorderClipPlan(amended, [b, a], byClip);
    expect(next.clips.map(c => c.id)).toEqual(['c2', 'c1']);
    expect(next.captions[0]!.wordIds).toContain('c2:w1');
    expect(next.captions[0]!.start).toBeCloseTo(0.5);
    expect(next.captions[0]!.text).toBe('EDITADO');
    expect(next.captions.at(-1)!.start).toBeCloseTo(3.4);
    expect(outputDuration(next.segments)).toBeCloseTo(outputDuration(original.segments));
  });

  it('mantém a identidade e os tempos dos elementos manuais e permite desfazer', () => {
    const original = begin();
    const added = addElement(original, { durationSec: 7, words: placeWords([a,b], byClip) }, { kind: 'text', text: 'Meu texto' }, 1);
    const shifted = reorderClipPlan(added.plan, [b, a], byClip);
    expect(shifted.edits.added).toHaveLength(1);
    expect(shifted.edits.added[0]!.srcStart).toBeCloseTo(4, 1); // origem a mudou +3
    expect(reorderClipPlan(shifted, [a, b], byClip).edits.added[0]!.srcStart).toBeCloseTo(1, 1);
  });

  it('remove o primeiro clipe e conserva o conteúdo do segundo', () => {
    const original = begin();
    const next = reorderClipPlan(original, [b], byClip);
    expect(next.clips).toHaveLength(1);
    expect(next.captions.every(c => !c.wordIds.includes('c1:w1'))).toBe(true);
    expect(next.captions.some(c => c.wordIds.includes('c2:w1'))).toBe(true);
    expect(outputDuration(next.segments)).toBeCloseTo(3);
  });

  it('destaque de fala acompanha o arquivo após reordenar, e some apenas se o clipe for excluído', () => {
    const source = addSemanticWord(begin(), { ...byClip.c2[0]!, start: 4.5, end: 5 });
    expect(scheduledPlanCues(source)[0]?.startFrame).toBe(135);
    const swapped = reorderClipPlan(source, [b,a], byClip);
    expect(swapped.semanticCues?.[0]).toMatchObject({ wordId: 'c2:w1', source: { start: 0.5, end: 1 } });
    expect(scheduledPlanCues(swapped)[0]?.startFrame).toBe(15);
    expect(reorderClipPlan(swapped, [a,b], byClip).semanticCues?.[0]?.source.start).toBe(4.5);
    expect(reorderClipPlan(source, [a], byClip).semanticCues).toEqual([]);
  });

  it('recusa elemento atravessando junção ao invés de mover para vídeo errado', () => {
    const original = begin();
    const illegal = { ...original, edits: { ...original.edits, zooms: [{ srcStart: 3.5, srcEnd: 4.5, scale: 1.2 }] } };
    expect(() => reorderClipPlan(illegal, [b, a], byClip)).toThrow(AppError);
    expect(original.clips[0]!.id).toBe('c1');
  });
});
