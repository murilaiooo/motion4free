import type { EditPlan, Framing as ClipFraming } from '../core/types';
import { setFraming as setClipFraming } from './assembly';
import { setFraming as setVideoFraming } from './manual';
import { framingFor } from '../render/framing';

/**
 * Painel "Enquadramento" (v0.16): uma tela só para os dois modelos que já existiam.
 * - um vídeo só: moldura manual `edits.video` (ADR-0018: fill/fit, scale 0,5–3, x/y);
 * - vários clipes: `plan.framing` ou o enquadramento próprio do clipe (ADR-0019: fill/fit/smart, zoom 1–3, x/y).
 * Puro e testado (tests/framing-view.test.ts).
 */
export interface FramingView {
  /** mostrar o quadro inteiro (com o vídeo desfocado atrás) em vez de preencher a tela */
  whole: boolean;
  zoom: number;
  x: number;
  y: number;
}

export const FRAMING_ZOOM_MAX = 3;

export function framingView(plan: EditPlan, multi: boolean, clipId: string | null): FramingView {
  if (multi) {
    const f = framingFor(plan, clipId);
    return { whole: f.mode === 'fit', zoom: f.zoom, x: f.x, y: f.y };
  }
  const v = plan.edits.video;
  return { whole: v.fit === 'fit', zoom: v.scale, x: v.x, y: v.y };
}

export function applyFramingView(plan: EditPlan, multi: boolean, clipId: string | null, v: FramingView): EditPlan {
  if (multi) {
    const base = framingFor(plan, clipId);
    // "smart" sem rosto detectado é o mesmo que preencher no centro; a tela não promete seguir o rosto (issue #54)
    const mode: ClipFraming['mode'] = v.whole ? 'fit' : base.mode === 'fit' ? 'fill' : base.mode;
    return setClipFraming(plan, clipId, { ...base, mode, zoom: r3(clamp(v.zoom, 1, FRAMING_ZOOM_MAX)), x: r3(clamp(v.x, -1, 1)), y: r3(clamp(v.y, -1, 1)) });
  }
  return setVideoFraming(plan, { fit: v.whole ? 'fit' : 'fill', scale: v.zoom, x: v.x, y: v.y });
}


const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
