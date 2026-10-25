import { describe, expect, it } from 'vitest';
import { EMPTY_EDITS } from '../src/core/edits';
import { EMPTY_BRIEF } from '../src/core/brief';
import { POP } from '../src/core/presets';
import type { EditPlan } from '../src/core/types';
import { drawFrame } from '../src/render/frame';
import { addSemanticWord, activeSemanticWords, scheduledPlanCues, setSemanticWordEffect } from '../src/editorial/semantic-word-edits';
import { RecordingContext } from './helpers/recording-ctx';

const word = { id: 'w2', text: 'segredo', start: 1, end: 1.35 };
const plan = (): EditPlan => ({
  version: 6,
  clips: [{ id: 'c1', name: 'synthetic.webm', duration: 3, framing: null }],
  framing: { mode: 'fill', fill: 'blur', zoom: 1, x: 0, y: 0 },
  ranges: [], reference: null, edits: EMPTY_EDITS, brief: EMPTY_BRIEF,
  output: { width: 1080, height: 1920, fps: 30 }, style: POP,
  segments: [{ srcStart: 0, srcEnd: 3 }],
  captions: [{ id: 'c1', text: 'um segredo valioso', start: .5, end: 2,
    wordIds: ['w1', 'w2', 'w3'], wordStarts: [.5, 1, 1.5] }],
  scenes: [],
});
function render(p: EditPlan, t: number) {
  const rc = new RecordingContext();
  drawFrame(rc.asCtx(), p, t, { width: 1080, height: 1920 } as unknown as CanvasImageSource);
  return rc;
}
function keywordScale(p: EditPlan, t: number) {
  const call = render(p, t).calls.find(x => x.op === 'fillText' && String(x.args[0]).toLowerCase() === 'segredo');
  expect(call).toBeDefined();
  return call!.m[0]!;
}

describe('seam #117: a mesma drawFrame usada por player e MP4', () => {
  it('o destaque aparece somente nos quadros da palavra correta e altera o desenho, sem mudar o original', () => {
    const before = plan();
    const after = addSemanticWord(before, word);
    const active = 1.2;
    expect(activeSemanticWords(after, active)).toEqual(['segredo']);
    expect(keywordScale(after, active)).toBeGreaterThan(keywordScale(before, active) + 0.05);
    expect(activeSemanticWords(after, 1.7)).toEqual([]);
    expect(keywordScale(after, 1.7)).toBeCloseTo(keywordScale(before, 1.7), 6);
    expect(before.semanticCues).toBeUndefined();
  });

  it('sublinhado animado desenha um traço apenas na palavra e quadros selecionados', () => {
    const original = plan();
    const once = addSemanticWord(original, word);
    const underlined = setSemanticWordEffect(once, once.semanticCues![0]!.id, 'underline');
    const rects = (p: EditPlan, t: number) => render(p, t).calls.filter(c => c.op === 'fillRect' && c.fillStyle === p.style.palette.accent2);
    expect(rects(underlined, 1.15).length).toBeGreaterThan(rects(original, 1.15).length);
    expect(rects(underlined, 1.8)).toEqual(rects(original, 1.8));
    expect(underlined.captions).toBe(original.captions);
  });

  it('pulso aumenta escala somente durante a fala e retorna ao tamanho normal ao terminar', () => {
    const original = plan();
    const once = addSemanticWord(original, word);
    const pulsed = setSemanticWordEffect(once, once.semanticCues![0]!.id, 'pulse');
    expect(keywordScale(pulsed, 1.15)).toBeGreaterThan(keywordScale(once, 1.15) + 0.07);
    expect(keywordScale(pulsed, 1.15)).toBeLessThan(keywordScale(once, 1.15) + 0.5);
    expect(keywordScale(pulsed, 1.8)).toBeCloseTo(keywordScale(original, 1.8), 6);
  });

  it('pulso começa e termina na escala normal, sem salto na fronteira dos quadros 24/30/60 fps', () => {
    for (const fps of [24,30,60]) {
      const original = { ...plan(), output: { ...plan().output, fps } };
      const once = addSemanticWord(original, word);
      const pulsed = setSemanticWordEffect(once, once.semanticCues![0]!.id, 'pulse');
      const { startFrame, endFrameExclusive } = scheduledPlanCues(pulsed)[0]!;
      const first = (startFrame + .01) / fps;
      const last = (endFrameExclusive - 1 + .01) / fps;
      const middle = (startFrame + Math.floor((endFrameExclusive-startFrame-1)/2) + .01) / fps;
      expect(keywordScale(pulsed, first)).toBeCloseTo(keywordScale(original, first), 4);
      expect(keywordScale(pulsed, last)).toBeCloseTo(keywordScale(original, last), 4);
      expect(keywordScale(pulsed, middle)).toBeGreaterThan(keywordScale(original, middle) + .09);
    }
  });

  it('mesmo texto repetido: só a palavra com wordId escolhido recebe a ênfase', () => {
    const baseline = plan();
    const repeated = { ...baseline, captions: [{ ...baseline.captions[0]!, text: 'segredo segredo', wordIds: ['w2', 'w3'], wordStarts: [1, 1.5] }] };
    const p = addSemanticWord(repeated, word);
    const calls = render(p, 1.2).calls.filter(x => x.op === 'fillText' && String(x.args[0]).toLowerCase() === 'segredo');
    const flat = render(repeated, 1.2).calls.filter(x => x.op === 'fillText' && String(x.args[0]).toLowerCase() === 'segredo');
    expect(calls).toHaveLength(2);
    expect(calls[0]!.m[0]).toBeGreaterThan(flat[0]!.m[0]! + 0.05);
    expect(calls[1]!.m[0]).toBeCloseTo(flat[1]!.m[0]!, 6);
  });

  it('correção manual da legenda com igual número de palavras não destaca texto diferente da âncora', () => {
    const original = plan();
    const cue = addSemanticWord(original, word);
    const corrected = { ...original, captions: original.captions.map(c =>
      ({ ...c, text: 'um alterado valioso' })) };
    const correctedWithCue = { ...cue, captions: corrected.captions };
    const drawWordScale = (p: EditPlan) => {
      const call = render(p, 1.15).calls.find(c => c.op === 'fillText' && String(c.args[0]).toLowerCase() === 'alterado');
      expect(call).toBeDefined();
      return call!.m[0]!;
    };
    expect(drawWordScale(correctedWithCue)).toBeCloseTo(drawWordScale(corrected), 6);
    const underlined = setSemanticWordEffect(correctedWithCue, cue.semanticCues![0]!.id, 'underline');
    const colorRects = (p: EditPlan) => render(p, 1.15).calls.filter(c => c.op === 'fillRect' && c.fillStyle === p.style.palette.accent2);
    expect(colorRects(underlined)).toEqual(colorRects(corrected));
  });

  it('palavra cortada não muda os quadros; ao duplicar o pedaço a ênfase reaparece na segunda ocorrência', async () => {
    const after = addSemanticWord(plan(), word);
    const { cutSourceRange } = await import('../src/editorial/manual');
    const { duplicateSegment } = await import('../src/editorial/sequence');
    const ctx = { durationSec: 3, words: [{ id: 'w1', text: 'um', start: .5, end: .8 }, word, { id: 'w3', text: 'valioso', start: 1.5, end: 1.9 }] };
    // With this single caption timeline, cutting the specific word removes its cue.
    const cut = cutSourceRange(after, ctx, { start: 1, end: 1.4 });
    expect(activeSemanticWords(cut, 1.2)).toEqual([]);
    const duplicate = duplicateSegment(after, ctx, 0).plan;
    expect(activeSemanticWords(duplicate, 1.2)).toEqual(['segredo']);
    expect(activeSemanticWords(duplicate, 4.2)).toEqual(['segredo']);
  });
});