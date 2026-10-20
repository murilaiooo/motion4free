import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { parseEditPlan } from '../src/core/schema';
import type { Word } from '../src/core/types';
import { autoEdit } from '../src/editorial/auto-edit';
import { adjustCut, applyStyle, editCaptionText, listCuts, restoreCut, segmentsFromCuts, withSegments, type EditContext } from '../src/editorial/ops';
import { outputDuration } from '../src/engine/timeline';

const words: Word[] = [
  { id: 'w1', text: 'Três', start: 0.1, end: 0.5 },
  { id: 'w2', text: 'dicas', start: 0.5, end: 0.9 },
  { id: 'w3', text: 'rápidas.', start: 0.9, end: 1.4 },
  { id: 'w4', text: 'Primeira', start: 3.1, end: 3.6 },
  { id: 'w5', text: 'dica.', start: 3.6, end: 4.2 },
];
const ctx: EditContext = { durationSec: 6, words };
const plan = autoEdit(6, [{ start: 1.4, end: 3.1 }, { start: 4.2, end: 6 }], words);

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
  return 'sem erro';
}

describe('cortes derivados dos trechos', () => {
  it('lista cortes do início, do meio e do fim', () => {
    const segs = [
      { srcStart: 0.5, srcEnd: 2 },
      { srcStart: 3, srcEnd: 5 },
    ];
    expect(listCuts(segs, 6)).toEqual([
      { start: 0, end: 0.5 },
      { start: 2, end: 3 },
      { start: 5, end: 6 },
    ]);
    expect(segmentsFromCuts(listCuts(segs, 6), 6)).toEqual(segs);
  });

  it('plano automático do vídeo de teste tem corte no meio e no fim', () => {
    expect(listCuts(plan.segments, 6)).toEqual([
      { start: 1.52, end: 2.98 },
      { start: 4.32, end: 6 },
    ]);
  });
});

describe('restaurar e ajustar corte', () => {
  it('restaurar o corte do meio junta os trechos e reposiciona as legendas', () => {
    const next = restoreCut(plan, ctx, 0);
    expect(next.segments).toEqual([{ srcStart: 0, srcEnd: 4.32 }]);
    expect(next.captions[1]!.start).toBeCloseTo(3.1, 3);
    expect(parseEditPlan(next).ok).toBe(true);
    expect(plan.segments).toHaveLength(2); // original intocado
  });

  it('restaurar o corte do fim estende o último trecho até o fim do vídeo', () => {
    expect(restoreCut(plan, ctx, 1).segments.at(-1)).toEqual({ srcStart: 2.98, srcEnd: 6 });
  });

  it('índice inexistente não muda nada', () => {
    expect(restoreCut(plan, ctx, 9)).toBe(plan);
  });

  it('ajusta início e fim do corte', () => {
    const next = adjustCut(plan, ctx, 0, { start: 1.6, end: 2.8 });
    expect(next.segments).toEqual([
      { srcStart: 0, srcEnd: 1.6 },
      { srcStart: 2.8, srcEnd: 4.32 },
    ]);
    expect(outputDuration(next.segments)).toBeCloseTo(3.12, 3);
  });

  it('não deixa o corte engolir o trecho vizinho', () => {
    const next = adjustCut(plan, ctx, 1, { start: 0.5, end: 6 });
    expect(next.segments.at(-1)).toEqual({ srcStart: 2.98, srcEnd: 3.08 });
  });

  it('corte com tamanho zero é restaurado', () => {
    expect(adjustCut(plan, ctx, 0, { start: 2, end: 2 }).segments).toEqual([{ srcStart: 0, srcEnd: 4.32 }]);
  });

  it('cortar o vídeo inteiro é recusado com M4F-503', () => {
    const p = withSegments(plan, ctx, [{ srcStart: 2, srcEnd: 6 }]);
    expect(code(() => adjustCut(p, ctx, 0, { start: 0, end: 6 }))).toBe('M4F-503');
  });

  it('cenas são recalculadas e não passam do fim do vídeo editado', () => {
    const p = withSegments(plan, ctx, [{ srcStart: 0, srcEnd: 1 }]);
    expect(p.scenes.length).toBeGreaterThan(0);
    for (const s of p.scenes) expect(s.end).toBeLessThanOrEqual(1);
  });

  it('sem palavras, as cenas existentes são mantidas e recortadas', () => {
    const p = withSegments(plan, { durationSec: 6, words: [] }, [{ srcStart: 0, srcEnd: 1 }]);
    expect(p.scenes.map((s) => s.kind)).toEqual(plan.scenes.filter((s) => s.start < 1).map((s) => s.kind));
  });
});

describe('editar legenda', () => {
  it('troca o texto e remove espaços das pontas', () => {
    const next = editCaptionText(plan, 'c2', '  Primeira dica!  ');
    expect(next.captions[1]!.text).toBe('Primeira dica!');
    expect(plan.captions[1]!.text).toBe('Primeira dica.');
  });

  it('mesmo texto ou legenda inexistente não muda nada', () => {
    expect(editCaptionText(plan, 'c2', 'Primeira dica.')).toBe(plan);
    expect(editCaptionText(plan, 'nada', 'x')).toBe(plan);
  });

  it('texto vazio é M4F-501 e longo demais é M4F-502', () => {
    expect(code(() => editCaptionText(plan, 'c1', '   '))).toBe('M4F-501');
    expect(code(() => editCaptionText(plan, 'c1', 'a'.repeat(121)))).toBe('M4F-502');
  });

  it('texto editado sobrevive a restaurar um corte quando as palavras da legenda continuam as mesmas', () => {
    const edited = editCaptionText(plan, 'c2', 'Primeira dica!');
    const next = restoreCut(edited, ctx, 0);
    expect(next.captions.find((c) => c.wordIds.join() === 'w4,w5')!.text).toBe('Primeira dica!');
  });
});

describe('trocar estilo', () => {
  it('troca o estilo, reagrupa legendas e propõe cenas no ritmo do novo estilo', () => {
    const next = applyStyle(plan, ctx, 'documental');
    expect(next.style.id).toBe('documental');
    expect(next.segments).toBe(plan.segments);
    expect(next.scenes.some((s) => s.kind === 'progress-bar')).toBe(false);
    expect(parseEditPlan(next).ok).toBe(true);
  });

  it('mesmo estilo não muda nada (sem entrada vazia no histórico)', () => {
    expect(applyStyle(plan, ctx, plan.style.id)).toBe(plan);
  });

  it('estilo desconhecido é M4F-802', () => {
    expect(code(() => applyStyle(plan, ctx, 'eval'))).toBe('M4F-802');
  });

  it('texto corrigido sobrevive à troca de estilo quando o grupo de palavras não muda', () => {
    const edited = editCaptionText(plan, 'c2', 'Primeira dica!');
    const next = applyStyle(edited, ctx, 'editorial');
    expect(next.captions.find((c) => c.wordIds.join() === 'w4,w5')!.text).toBe('Primeira dica!');
    expect(applyStyle(next, ctx, 'pop').captions.find((c) => c.wordIds.join() === 'w4,w5')!.text).toBe('Primeira dica!');
  });
});
