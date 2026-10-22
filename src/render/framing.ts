import { DEFAULT_FRAMING, type EditPlan, type Framing } from '../core/types';
import type { Rect } from './layout';

/**
 * Enquadramento (v0.14): como um quadro de origem de qualquer proporção entra no formato de saída.
 * Puro (sem navegador) e testado em tests/framing.test.ts. A prévia e a exportação chamam a mesma conta
 * dentro de `drawFrame`, então o recorte é igual nas duas.
 */

/** Ponto de foco no quadro de origem, em fração (0–1) da largura e da altura. */
export interface Focus {
  x: number;
  y: number;
}

/** Onde desenhar a imagem: recorte da origem (`src`, px da origem) e destino (`dst`, px da saída). */
export interface Placement {
  src: Rect;
  dst: Rect;
  /** a imagem não cobre a saída inteira: precisa de fundo (desfocado ou de cor) */
  needsBackdrop: boolean;
}

/** Altura (fração do recorte) em que o rosto fica: um pouco acima do meio, com espaço sobre a cabeça. */
export const FACE_ROW = 0.4;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function faceTrackFor(plan: Pick<EditPlan, 'clips'>, clipId: string, tracks: Readonly<Record<string, FaceTrack | null | undefined>>): FaceTrack | null {
  const selected = plan.clips.find(clip => clip.id === clipId)?.faceTrackId;
  return selected === null ? null : tracks[selected === undefined ? clipId : selected] ?? null;
}

/** Keep analyses referenced by undo, redo and named versions, including legacy clip-keyed tracks. */
export function faceTracksForPlans(tracks: Readonly<Record<string, FaceTrack>>, plans: readonly Pick<EditPlan, 'clips'>[]): Record<string, FaceTrack> {
  const ids = new Set(plans.flatMap(plan => plan.clips.flatMap(clip => clip.faceTrackId === null ? [] : [clip.faceTrackId ?? clip.id])));
  return Object.fromEntries(Object.entries(tracks).filter(([id]) => ids.has(id)));
}

export function framingFor(plan: Pick<EditPlan, 'framing' | 'clips'>, clipId: string | null | undefined): Framing {
  const clip = clipId ? plan.clips.find((c) => c.id === clipId) : undefined;
  return clip?.framing ?? plan.framing ?? DEFAULT_FRAMING;
}

/**
 * Recorte e destino para um quadro `srcW`×`srcH` numa saída `outW`×`outH`.
 * - fill/smart: recorte da proporção da saída (dividido pelo zoom), centrado no foco (smart) ou no meio,
 *   deslocado por x/y dentro da folga e sempre dentro do quadro (nunca mostra borda);
 * - fit: quadro inteiro contido na saída (vezes o zoom), deslocado por x/y na folga.
 */
export function placeSource(srcW: number, srcH: number, outW: number, outH: number, framing: Framing, focus: Focus | null = null): Placement {
  const zoom = clamp(framing.zoom, 1, 3);
  if (framing.mode === 'fit') {
    const k = Math.min(outW / srcW, outH / srcH) * zoom;
    const w = srcW * k;
    const h = srcH * k;
    // folga: quanto a imagem pode andar (para os dois lados) sem sair do centro da tela
    const slackX = Math.abs(outW - w) / 2;
    const slackY = Math.abs(outH - h) / 2;
    const x = (outW - w) / 2 + clamp(framing.x, -1, 1) * slackX;
    const y = (outH - h) / 2 + clamp(framing.y, -1, 1) * slackY;
    const dst = { x, y, w, h };
    const covers = dst.x <= 0.5 && dst.y <= 0.5 && dst.x + dst.w >= outW - 0.5 && dst.y + dst.h >= outH - 0.5;
    return { src: { x: 0, y: 0, w: srcW, h: srcH }, dst, needsBackdrop: !covers };
  }
  const outRatio = outW / outH;
  let cw = srcW;
  let ch = srcW / outRatio;
  if (ch > srcH) {
    ch = srcH;
    cw = srcH * outRatio;
  }
  cw /= zoom;
  ch /= zoom;
  const f = framing.mode === 'smart' && focus ? focus : null;
  // centro: rosto (smart) com o rosto um pouco acima do meio do recorte; senão o meio do quadro
  let cx = f ? f.x * srcW : srcW / 2;
  let cy = f ? f.y * srcH + (0.5 - FACE_ROW) * ch : srcH / 2;
  cx += clamp(framing.x, -1, 1) * ((srcW - cw) / 2);
  cy += clamp(framing.y, -1, 1) * ((srcH - ch) / 2);
  const x = clamp(cx - cw / 2, 0, srcW - cw);
  const y = clamp(cy - ch / 2, 0, srcH - ch);
  return { src: { x, y, w: cw, h: ch }, dst: { x: 0, y: 0, w: outW, h: outH }, needsBackdrop: false };
}

/** Uma detecção de rosto num instante do clipe (tempo local), centro em fração do quadro. */
export interface FaceSample {
  t: number;
  x: number;
  y: number;
  /** tamanho do rosto (fração da largura), opcional */
  size?: number;
}

/** Caminho do recorte já suavizado, amostrado em passos fixos a partir de 0. */
export interface FaceTrack {
  step: number;
  xs: number[];
  ys: number[];
}

export interface TrackOptions {
  /** passo da amostragem (s) */
  step: number;
  /** quanto tempo uma detecção vale para os lados quando há buracos (s) */
  holdSec: number;
  /** o recorte só se mexe quando o rosto sai desta folga (fração do quadro) */
  deadZone: number;
  /** janela da média móvel (s), aplicada para frente e para trás (sem atraso) */
  smoothSec: number;
  /** velocidade máxima do recorte (fração do quadro por segundo) */
  maxSpeed: number;
}

export const DEFAULT_TRACK: TrackOptions = { step: 0.2, holdSec: 1.5, deadZone: 0.04, smoothSec: 1.2, maxSpeed: 0.18 };

/** Centro usado quando não há rosto: meio na horizontal e um pouco acima do meio na vertical. */
export const NO_FACE: Focus = { x: 0.5, y: 0.42 };

/**
 * Caminho suave do recorte a partir das detecções de rosto (que tremem e falham).
 * 1. amostra em passos fixos: detecção mais próxima dentro de `holdSec`, senão segura a anterior
 *    (sem nenhuma detecção = centro);
 * 2. zona morta: o alvo só anda quando o rosto sai da folga (cabeça balançando não mexe o recorte);
 * 3. média móvel para frente e para trás (sem atraso em relação à fala);
 * 4. limite de velocidade (nenhum chicote quando o rosto troca de lugar).
 * Determinístico: as mesmas detecções dão sempre o mesmo caminho.
 */
export function smoothTrack(samples: readonly FaceSample[], durationSec: number, opts: TrackOptions = DEFAULT_TRACK): FaceTrack {
  const n = Math.max(1, Math.floor(durationSec / opts.step) + 1);
  const sorted = [...samples].filter((s) => Number.isFinite(s.t) && s.t >= 0 && s.t <= durationSec && Number.isFinite(s.x) && Number.isFinite(s.y)).sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return { step: opts.step, xs: Array(n).fill(NO_FACE.x), ys: Array(n).fill(NO_FACE.y) };
  // 1. amostragem com retenção
  const raw: Focus[] = [];
  let j = 0;
  let last: Focus = NO_FACE;
  for (let i = 0; i < n; i++) {
    const t = i * opts.step;
    while (j + 1 < sorted.length && Math.abs(sorted[j + 1]!.t - t) <= Math.abs(sorted[j]!.t - t)) j++;
    const s = sorted[j]!;
    if (Math.abs(s.t - t) <= opts.holdSec) last = { x: clamp(s.x, 0, 1), y: clamp(s.y, 0, 1) };
    else last = NO_FACE;
    raw.push(last);
  }
  // 2. zona morta
  const held: Focus[] = [];
  let anchor = raw[0]!;
  for (const p of raw) {
    if (Math.abs(p.x - anchor.x) > opts.deadZone || Math.abs(p.y - anchor.y) > opts.deadZone) anchor = p;
    held.push(anchor);
  }
  // 3. média móvel ida e volta
  const half = Math.max(1, Math.round(opts.smoothSec / opts.step / 2));
  const avg = (arr: number[]) => arr.map((_, i) => {
    let sum = 0;
    let c = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(arr.length - 1, i + half); k++) {
      sum += arr[k]!;
      c++;
    }
    return sum / c;
  });
  let xs = avg(avg(held.map((p) => p.x)));
  let ys = avg(avg(held.map((p) => p.y)));
  // 4. limite de velocidade (nos dois sentidos, para não atrasar nem adiantar)
  const maxStep = opts.maxSpeed * opts.step;
  const limit = (arr: number[]) => {
    const fwd = [...arr];
    for (let i = 1; i < fwd.length; i++) fwd[i] = clamp(fwd[i]!, fwd[i - 1]! - maxStep, fwd[i - 1]! + maxStep);
    const back = [...arr];
    for (let i = back.length - 2; i >= 0; i--) back[i] = clamp(back[i]!, back[i + 1]! - maxStep, back[i + 1]! + maxStep);
    return fwd.map((v, i) => (v + back[i]!) / 2);
  };
  xs = limit(xs).map(r4);
  ys = limit(ys).map(r4);
  return { step: opts.step, xs, ys };
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** Foco no instante `t` (tempo local do clipe), interpolado entre as amostras. */
export function trackAt(track: FaceTrack | null | undefined, t: number): Focus {
  if (!track || track.xs.length === 0) return NO_FACE;
  if (!(track.step > 0) || track.xs.length !== track.ys.length) return NO_FACE;
  const f = Math.min(track.xs.length - 1, Math.max(0, (Number.isFinite(t) ? t : 0) / track.step));
  const i = Math.min(track.xs.length - 1, Math.floor(f));
  const k = Math.min(track.xs.length - 1, i + 1);
  const a = f - i;
  return { x: track.xs[i]! + (track.xs[k]! - track.xs[i]!) * a, y: track.ys[i]! + (track.ys[k]! - track.ys[i]!) * a };
}
