import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { DEFAULT_STYLE } from '../src/core/presets';
import { applyFramingView, framingView } from '../src/editorial/framing-view';
import { framingFor, placeSource } from '../src/render/framing';
import type { ClipRef } from '../src/core/types';

const clips: ClipRef[] = [
  { id: 'c1', name: 'deitado.mp4', duration: 2, framing: null },
  { id: 'c2', name: 'em-pe.mp4', duration: 2, framing: null },
];

describe('painel de enquadramento', () => {
  it('um vídeo só: "mostrar inteiro" grava a moldura manual e volta igual', () => {
    const plan = autoEdit(3, [], []);
    expect(framingView(plan, false, null)).toEqual({ whole: false, zoom: 1, x: 0, y: 0 });
    const next = applyFramingView(plan, false, null, { whole: true, zoom: 1.2, x: -0.5, y: 0 });
    expect(next.edits.video).toEqual({ fit: 'fit', scale: 1.2, x: -0.5, y: 0 });
    expect(framingView(next, false, null)).toEqual({ whole: true, zoom: 1.2, x: -0.5, y: 0 });
  });

  it('vários clipes: muda todos ou só um clipe, sem mexer no outro', () => {
    const plan = autoEdit(4, [], [], DEFAULT_STYLE, { clips });
    const all = applyFramingView(plan, true, null, { whole: true, zoom: 1, x: 0, y: 0 });
    expect(framingFor(all, 'c1').mode).toBe('fit');
    expect(framingFor(all, 'c2').mode).toBe('fit');
    const one = applyFramingView(all, true, 'c2', { whole: false, zoom: 1.5, x: 0.4, y: 0 });
    expect(framingFor(one, 'c1').mode).toBe('fit');
    expect(framingFor(one, 'c2')).toMatchObject({ mode: 'fill', zoom: 1.5, x: 0.4 });
  });

  it('valores fora do limite são presos (zoom 1–3, posição −1 a 1)', () => {
    const plan = autoEdit(4, [], [], DEFAULT_STYLE, { clips });
    const next = applyFramingView(plan, true, null, { whole: false, zoom: 9, x: -4, y: Number.NaN });
    expect(framingFor(next, 'c1')).toMatchObject({ zoom: 3, x: -1, y: 0 });
  });

  it('vídeo deitado no 9:16: mover para a direita escolhe outra parte do quadro', () => {
    const plan = autoEdit(4, [], [], DEFAULT_STYLE, { clips });
    const left = applyFramingView(plan, true, null, { whole: false, zoom: 1, x: -1, y: 0 });
    const right = applyFramingView(plan, true, null, { whole: false, zoom: 1, x: 1, y: 0 });
    const a = placeSource(1920, 1080, 1080, 1920, framingFor(left, 'c1'));
    const b = placeSource(1920, 1080, 1080, 1920, framingFor(right, 'c1'));
    expect(a.src.x).toBe(0);
    expect(b.src.x + b.src.w).toBeCloseTo(1920, 3);
  });
});
