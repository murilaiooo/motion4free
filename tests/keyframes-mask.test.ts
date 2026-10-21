import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { DEFAULT_MASK, MAX_KEYS, type VideoMask } from '../src/core/edits';
import { parseEditPlan } from '../src/core/schema';
import type { EditPlan } from '../src/core/types';
import { autoEdit } from '../src/editorial/auto-edit';
import { findElement } from '../src/editorial/elements';
import { addElement, addKeyframe, clearKeyframes, deleteMany, patchKeyframe, removeKeyframe, setElementPlacement, splitAt } from '../src/editorial/manual';
import type { EditContext } from '../src/editorial/ops';
import { outputDuration } from '../src/engine/timeline';
import { drawFrame } from '../src/render/frame';
import { keyAt, keyedPose } from '../src/render/keyframes';
import { maskSize } from '../src/render/mask';
import { RecordingContext } from './helpers/recording-ctx';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT, 0.2);
const dur = words.at(-1)!.end + 1;
const ctx: EditContext = { durationSec: dur, words };
const base = autoEdit(dur, [], words);
const added = addElement(base, ctx, { kind: 'text', text: 'Olá mundo' }, 2);
const id = added.id;
const el = (p: EditPlan) => p.edits.added.find((a) => a.id === id)!;
const valid = (p: EditPlan) => {
  const r = parseEditPlan(p);
  return r.ok ? 'ok' : r.errors.join('\n');
};
function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
  return 'sem erro';
}

describe('pontos de animação (keyframes)', () => {
  it('sem pontos, o elemento fica na posição dele e opaco', () => {
    const e = el(added.plan);
    expect(keyedPose(e, 1)).toEqual({ placement: e.placement, opacity: 1 });
  });

  it('interpola entre dois pontos e fica parado antes do primeiro e depois do último', () => {
    const keys = [
      { at: 0.5, x: 0.2, y: 0.5, scale: 1, rotate: 0, opacity: 0, ease: 'linear' as const },
      { at: 1.5, x: 0.8, y: 0.5, scale: 2, rotate: 90, opacity: 1, ease: 'linear' as const },
    ];
    const e = { placement: { x: 0.5, y: 0.5, scale: 1, rotate: 0 }, keys };
    expect(keyedPose(e, 0).placement.x).toBeCloseTo(0.2, 6);
    expect(keyedPose(e, 1).placement.x).toBeCloseTo(0.5, 6);
    expect(keyedPose(e, 1).placement.scale).toBeCloseTo(1.5, 6);
    expect(keyedPose(e, 1).opacity).toBeCloseTo(0.5, 6);
    expect(keyedPose(e, 9).placement.rotate).toBe(90);
    // curva suave: no meio é igual, perto das pontas anda menos que a reta
    const soft = { ...e, keys: [keys[0]!, { ...keys[1]!, ease: 'smooth' as const }] };
    expect(keyedPose(soft, 1).placement.x).toBeCloseTo(0.5, 6);
    expect(keyedPose(soft, 0.6).placement.x).toBeLessThan(keyedPose(e, 0.6).placement.x);
    expect(keyAt(keys, 1.505)).toBe(1);
    expect(keyAt(keys, 1)).toBe(-1);
  });

  it('criar ponto na agulha e arrastar em outro instante cria o segundo ponto', () => {
    const start = resolveStart(added.plan);
    const p1 = addKeyframe(added.plan, id, start + 0.2);
    expect(el(p1).keys).toHaveLength(1);
    expect(el(p1).keys![0]!.at).toBeCloseTo(0.2, 3);
    const p2 = setElementPlacement(p1, { type: 'added', id }, { x: 0.8, y: 0.3, scale: 1.4, rotate: 0 }, 'all', start + 2);
    expect(el(p2).keys).toHaveLength(2);
    expect(el(p2).keys![1]!.x).toBeCloseTo(0.8, 4);
    // arrastar de novo no mesmo instante troca o ponto, não cria outro
    const p3 = setElementPlacement(p2, { type: 'added', id }, { x: 0.7, y: 0.3, scale: 1.4, rotate: 0 }, 'all', start + 2.005);
    expect(el(p3).keys).toHaveLength(2);
    expect(el(p3).keys![1]!.x).toBeCloseTo(0.7, 4);
    expect(valid(p3)).toBe('ok');
    // sem pontos, arrastar só move o elemento (como antes)
    const plain = setElementPlacement(added.plan, { type: 'added', id }, { x: 0.3, y: 0.3, scale: 1, rotate: 0 }, 'all', start + 1);
    expect(el(plain).keys).toBeUndefined();
    expect(el(plain).placement.x).toBeCloseTo(0.3, 4);
  });

  it('muda opacidade/curva, apaga ponto e tira a animação', () => {
    const start = resolveStart(added.plan);
    let p = addKeyframe(added.plan, id, start);
    p = setElementPlacement(p, { type: 'added', id }, { x: 0.9, y: 0.5, scale: 1, rotate: 0 }, 'all', start + 2);
    p = patchKeyframe(p, id, 0, { opacity: 0, ease: 'linear' });
    expect(el(p).keys![0]!.opacity).toBe(0);
    expect(el(p).keys![0]!.ease).toBe('linear');
    const one = removeKeyframe(p, id, 1);
    expect(el(one).keys).toHaveLength(1);
    const none = removeKeyframe(one, id, 0);
    expect(el(none).keys).toBeUndefined();
    const cleared = clearKeyframes(p, id, start + 2);
    expect(el(cleared).keys).toBeUndefined();
    expect(el(cleared).placement.x).toBeCloseTo(0.9, 3);
    expect(valid(cleared)).toBe('ok');
  });

  it(`limite de ${MAX_KEYS} pontos (M4F-524)`, () => {
    let p = added.plan;
    const start = resolveStart(p);
    for (let i = 0; i < MAX_KEYS; i++) p = addKeyframe(p, id, start + i * 0.1);
    expect(el(p).keys).toHaveLength(MAX_KEYS);
    expect(code(() => addKeyframe(p, id, start + MAX_KEYS * 0.1))).toBe('M4F-524');
  });
});

describe('apagar vários de uma vez', () => {
  it('apaga pedaços e elementos juntos e o vídeo encosta', () => {
    const s = splitAt(splitAt(added.plan, ctx, 3), ctx, 6);
    const total = outputDuration(s.segments);
    const len0 = s.segments[0]!.srcEnd - s.segments[0]!.srcStart;
    const d = deleteMany(s, ctx, [0], [{ type: 'added', id }]);
    expect(d.segments).toHaveLength(2);
    expect(outputDuration(d.segments)).toBeCloseTo(total - len0, 2);
    expect(d.edits.added.find((a) => a.id === id)).toBeUndefined();
    expect(valid(d)).toBe('ok');
  });

  it('não deixa apagar todos os pedaços (M4F-525)', () => {
    const s = splitAt(base, ctx, 3);
    expect(code(() => deleteMany(s, ctx, [0, 1], []))).toBe('M4F-525');
  });
});

describe('máscara do vídeo', () => {
  const src = { width: 1080, height: 1920 } as unknown as CanvasImageSource;
  const withMask = (m: VideoMask): EditPlan => ({ ...base, edits: { ...base.edits, mask: m } });

  it('o vídeo é desenhado dentro do recorte, com a cor de fundo fora', () => {
    const rc = new RecordingContext();
    drawFrame(rc.asCtx(), withMask({ ...DEFAULT_MASK, fill: '#FF0000' }), 0.5, src);
    const img = rc.calls.find((c) => c.op === 'drawImage')!;
    expect(img.clipped).toBe(true);
    expect(rc.calls.some((c) => c.op === 'fillRect' && c.fillStyle === '#FF0000')).toBe(true);
    // depois do vídeo o recorte acaba (legendas e textos não são cortados)
    const after = rc.calls.slice(rc.calls.indexOf(img) + 1);
    expect(after.every((c) => !c.clipped)).toBe(true);
  });

  it('retângulo usa cantos arredondados e a borda é desenhada', () => {
    const rc = new RecordingContext();
    drawFrame(rc.asCtx(), withMask({ ...DEFAULT_MASK, shape: 'rect', border: 10, borderColor: '#00FF00' }), 0.5, src);
    expect(rc.calls.some((c) => c.op === 'roundRect')).toBe(true);
    expect(rc.calls.some((c) => c.op === 'stroke' && c.strokeStyle === '#00FF00')).toBe(true);
  });

  it('sem máscara nada é recortado; a máscara passa na validação', () => {
    const rc = new RecordingContext();
    drawFrame(rc.asCtx(), base, 0.5, src);
    expect(rc.calls.find((c) => c.op === 'drawImage')!.clipped).toBe(false);
    for (const shape of ['circle', 'rect', 'heart', 'star', 'diamond'] as const) expect(valid(withMask({ ...DEFAULT_MASK, shape }))).toBe('ok');
    expect(maskSize(DEFAULT_MASK, 1080).mw).toBeCloseTo(864, 6);
  });
});

function resolveStart(p: EditPlan): number {
  return findElement(p, { type: 'added', id })!.start;
}
