import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { parseEditPlan } from '../src/core/schema';
import type { Segment } from '../src/core/types';
import { autoEdit } from '../src/editorial/auto-edit';
import { buildCaptions } from '../src/editorial/captions';
import { listElements, resolvePlan, srcToOut } from '../src/editorial/elements';
import { addElement, copyElement, pasteElement, splitAt, trimSegment } from '../src/editorial/manual';
import { adjustCut, listCuts, restoreCut, withSegments, type EditContext } from '../src/editorial/ops';
import { deleteOutRange, duplicateSegment, insertSegments, moveSegment, segmentOffsets } from '../src/editorial/sequence';
import { isSourceOrdered, outputDuration, placeSpan, rangeOut, sourceToOutput, sourceToOutputClamped } from '../src/engine/timeline';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

/**
 * Linha do tempo Edição (v0.17): pedaços fora da ordem da gravação e colados duas vezes. O que já
 * funcionava com os pedaços em ordem tem que dar exatamente o mesmo resultado de antes.
 */
const words = wordsFrom(SAMPLE_TEXT, 0.2);
const dur = words.at(-1)!.end + 1;
const ctx: EditContext = { durationSec: dur, words };
const base = autoEdit(dur, [], words);

function code(fn: () => unknown): string {
  try {
    fn();
    return 'ok';
  } catch (err) {
    return err instanceof AppError ? err.code : String(err);
  }
}

/** Três pedaços de 2 s, com cortes entre eles. */
const three: Segment[] = [
  { srcStart: 0, srcEnd: 2 },
  { srcStart: 3, srcEnd: 5 },
  { srcStart: 6, srcEnd: 8 },
];
const withThree = withSegments(base, ctx, three);

describe('mapeamento do tempo com pedaços fora de ordem', () => {
  it('em ordem: placeSpan dá o mesmo que sourceToOutput no início e no fim', () => {
    for (const w of words) {
      const a = sourceToOutput(three, w.start);
      const b = sourceToOutput(three, Math.max(w.start, w.end - 1e-3));
      const got = placeSpan(three, w.start, Math.max(w.start, w.end - 1e-3));
      if (a === null || b === null) expect(got).toEqual([]);
      else expect(got).toEqual([{ start: a, end: b }]);
    }
  });

  it('pedaço colado duas vezes: a fala dele aparece duas vezes', () => {
    const segs: Segment[] = [three[0]!, three[1]!, three[0]!];
    expect(placeSpan(segs, 0.5, 0.7)).toEqual([
      { start: 0.5, end: 0.7 },
      { start: 4.5, end: 4.7 },
    ]);
    expect(isSourceOrdered(segs)).toBe(false);
    expect(isSourceOrdered(three)).toBe(true);
  });

  it('trocados de lugar: cada instante vai para onde o pedaço dele está', () => {
    const swapped: Segment[] = [three[1]!, three[0]!];
    expect(sourceToOutput(swapped, 3.5)).toBeCloseTo(0.5);
    expect(sourceToOutput(swapped, 0.5)).toBeCloseTo(2.5);
    // instante cortado vai para o próximo pedaço da gravação, onde quer que ele esteja
    expect(sourceToOutputClamped(swapped, 2.5)).toBeCloseTo(0);
    expect(sourceToOutput(swapped, 1)).toBe(3);
    expect(sourceToOutput(swapped, 1.5)).toBe(3.5);
    expect(rangeOut(swapped, { srcStart: 1, srcEnd: 4 })).toEqual({ start: 0, end: 4 });
  });

  it('legendas acompanham a ordem nova e não se misturam', () => {
    const swapped = moveSegment(withThree, ctx, 2, 0);
    expect(swapped.segments[0]).toEqual(three[2]);
    const caps = buildCaptions(words, swapped.segments);
    for (let i = 1; i < caps.length; i++) expect(caps[i]!.start).toBeGreaterThanOrEqual(caps[i - 1]!.end - 1e-6);
    // a primeira legenda agora é a fala do pedaço que veio da posição 3
    const first = words.find((w) => w.id === caps[0]!.wordIds[0])!;
    expect(first.start).toBeGreaterThanOrEqual(6);
    expect(parseEditPlan(swapped).ok).toBe(true);
  });
});

describe('operações de pedaço', () => {
  it('mover para a mesma posição não muda nada (não cria desfazer vazio)', () => {
    expect(moveSegment(withThree, ctx, 1, 1)).toBe(withThree);
  });

  it('duplicar põe a cópia logo depois e o vídeo fica mais longo', () => {
    const r = duplicateSegment(withThree, ctx, 0);
    expect(r.index).toBe(1);
    expect(r.plan.segments.slice(0, 2)).toEqual([three[0], three[0]]);
    expect(outputDuration(r.plan.segments)).toBeCloseTo(8);
    // as legendas da fala repetida aparecem duas vezes, com chaves diferentes
    const keys = resolvePlan(r.plan).captions.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('colar no meio de um pedaço divide ali e encaixa a cópia', () => {
    const r = insertSegments(withThree, ctx, [three[2]!], 1);
    expect(r.plan.segments.map((s) => [s.srcStart, s.srcEnd])).toEqual([
      [0, 1],
      [6, 8],
      [1, 2],
      [3, 5],
      [6, 8],
    ]);
    expect(r.index).toBe(1);
    expect(r.count).toBe(1);
  });

  it('colar perto da ponta não cria pedaço minúsculo; colar no fim acrescenta', () => {
    expect(insertSegments(withThree, ctx, [three[0]!], 2.05).plan.segments.map((s) => s.srcStart)).toEqual([0, 0, 3, 6]);
    expect(insertSegments(withThree, ctx, [three[0]!], 99).plan.segments.at(-1)).toEqual(three[0]);
    expect(code(() => insertSegments(withThree, ctx, [], 1))).toBe('M4F-520');
  });

  it('apagar um trecho do vídeo editado tira só aquela vez, mesmo com a cópia', () => {
    const dup = duplicateSegment(withThree, ctx, 0).plan;
    const out = deleteOutRange(dup, ctx, { start: 2.5, end: 3.5 });
    expect(out.segments.map((s) => [s.srcStart, s.srcEnd])).toEqual([
      [0, 2],
      [0, 0.5],
      [1.5, 2],
      [3, 5],
      [6, 8],
    ]);
    expect(code(() => deleteOutRange(withThree, ctx, { start: 0, end: 6 }))).toBe('M4F-503');
    expect(deleteOutRange(withThree, ctx, { start: 1, end: 1 })).toBe(withThree);
  });

  it('início de cada pedaço no vídeo editado', () => {
    expect(segmentOffsets(three)).toEqual([0, 2, 4]);
  });
});

describe('cortes e pontas com ordem própria', () => {
  const swapped = moveSegment(withThree, ctx, 0, 2);

  it('cortes continuam sendo o que nenhum pedaço usa', () => {
    expect(listCuts(swapped.segments, dur)).toEqual(listCuts(three, dur));
  });

  it('restaurar um corte devolve o trecho ao lado do pedaço vizinho sem desfazer a ordem', () => {
    const r = restoreCut(swapped, ctx, 0); // corte 2..3: volta depois do pedaço que termina em 2
    expect(r.segments.map((s) => [s.srcStart, s.srcEnd])).toEqual([
      [3, 5],
      [6, 8],
      [0, 2],
      [2, 3],
    ]);
  });

  it('ajustar a ponta do corte pelos campos é recusado com código próprio (não refaz a ordem)', () => {
    expect(code(() => adjustCut(swapped, ctx, 0, { start: 2.2, end: 3 }))).toBe('M4F-518');
  });

  it('puxar a ponta de um pedaço fora de ordem pode reaproveitar imagem de outro pedaço', () => {
    const r = trimSegment(swapped, ctx, 2, 'end', 3.5); // [0,2] puxado até 3.5 (passa por cima de 3..5)
    expect(r.segments[2]).toEqual({ srcStart: 0, srcEnd: 3.5 });
  });

  it('em ordem, a ponta continua parando no vizinho como antes', () => {
    const r = trimSegment(withThree, ctx, 0, 'end', 4);
    expect(r.segments[0]).toEqual({ srcStart: 0, srcEnd: 3 });
  });
});

describe('copiar e colar elementos', () => {
  it('texto adicionado: cola uma cópia igual na agulha, com a mesma duração', () => {
    const a = addElement(base, ctx, { kind: 'text', text: 'Oferta' }, 1, 2);
    const clip = copyElement(a.plan, { type: 'added', id: a.id });
    expect(clip.seconds).toBeCloseTo(2);
    const p = pasteElement(a.plan, ctx, clip, 5);
    const pasted = resolvePlan(p.plan).added.find((x) => x.el.id === p.id)!;
    expect(pasted.el.text).toBe('Oferta');
    expect(pasted.start).toBeCloseTo(5, 1);
    expect(pasted.end - pasted.start).toBeCloseTo(2, 1);
    expect(parseEditPlan(p.plan).ok).toBe(true);
  });

  it('legenda não copia sozinha (M4F-519)', () => {
    const c = resolvePlan(base).captions[0]!;
    expect(code(() => copyElement(base, { type: 'caption', key: c.key }))).toBe('M4F-519');
  });

  it('título gerado vira um texto colável', () => {
    const scene = listElements(base).find((e) => e.ref.type === 'scene' && e.kind === 'kinetic-title');
    if (!scene) return; // o modelo padrão pode não ter título neste texto de exemplo
    const clip = copyElement(base, scene.ref);
    expect(clip.template.kind).toBe('text');
    expect(clip.template.text.length).toBeGreaterThan(0);
  });

  it('elemento num pedaço que trocou de lugar não some nem estica', () => {
    const a = addElement(withThree, ctx, { kind: 'emoji' }, 1.5, 1); // 1,5 s a 2,5 s: atravessa a emenda
    const moved = moveSegment(a.plan, ctx, 0, 2);
    const el = moved.edits.added.find((x) => x.id === a.id)!;
    const out = srcToOut(moved, el.srcStart, el.srcEnd);
    expect(out.end).toBeGreaterThan(out.start);
    expect(out.end - out.start).toBeLessThanOrEqual(el.srcEnd - el.srcStart + 1e-3);
  });

  it('dividir continua funcionando depois de mudar a ordem', () => {
    const swapped = moveSegment(withThree, ctx, 0, 2);
    const s = splitAt(swapped, ctx, 1);
    expect(s.segments).toHaveLength(4);
  });
});
