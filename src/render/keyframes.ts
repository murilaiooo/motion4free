import type { AddedElement, Keyframe, Placement } from '../core/edits';

/**
 * Pontos de animação (keyframes, v0.26). Puro: a prévia, o MP4 e a seleção na prévia usam a mesma conta.
 * Antes do primeiro ponto o elemento fica como no primeiro; depois do último, como no último.
 */

export interface KeyedPose {
  placement: Placement;
  opacity: number;
}

const smooth = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Posição e opacidade do elemento `local` segundos depois que ele aparece. */
export function keyedPose(el: Pick<AddedElement, 'placement' | 'keys'>, local: number): KeyedPose {
  const keys = el.keys;
  if (!keys || keys.length === 0) return { placement: el.placement, opacity: 1 };
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (local <= first.at) return poseOf(first);
  if (local >= last.at) return poseOf(last);
  let i = 1;
  while (i < keys.length - 1 && keys[i]!.at < local) i++;
  const a = keys[i - 1]!;
  const b = keys[i]!;
  const raw = (local - a.at) / Math.max(1e-6, b.at - a.at);
  const p = b.ease === 'smooth' ? smooth(raw) : raw;
  return {
    placement: { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), scale: mix(a.scale, b.scale, p), rotate: mix(a.rotate, b.rotate, p) },
    opacity: mix(a.opacity, b.opacity, p),
  };
}

function poseOf(k: Keyframe): KeyedPose {
  return { placement: { x: k.x, y: k.y, scale: k.scale, rotate: k.rotate }, opacity: k.opacity };
}

/** Índice do ponto que está em `local` (com folga de meio quadro a 30 fps), ou -1. */
export function keyAt(keys: readonly Keyframe[] | undefined, local: number, tol = 1 / 60): number {
  if (!keys) return -1;
  return keys.findIndex((k) => Math.abs(k.at - local) <= tol);
}
