import { cssFont, type FontSpec, type StyleDNA } from '../core/style';
import type { Ctx2D } from './ctx';
import { clamp01, easeInCubic, progress } from './easing';
import { reelsSafeArea, type Rect } from './layout';

/** Ferramentas de desenho compartilhadas pelas cenas. Tudo puro: depende só dos argumentos. */

export interface Frame {
  w: number;
  h: number;
  /** unidade: 1 px num quadro de 1080 de largura */
  u: number;
  safe: Rect;
  style: StyleDNA;
}

export function makeFrame(w: number, h: number, style: StyleDNA): Frame {
  return { w, h, u: w / 1080, safe: reelsSafeArea(w, h), style };
}

/** Cor #RRGGBB(AA) com a opacidade multiplicada por `a`. */
export function withAlpha(hex: string, a: number): string {
  const n = hex.replace('#', '');
  const base = n.length === 8 ? parseInt(n.slice(6, 8), 16) / 255 : 1;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(clamp01(base * a) * 1000) / 1000})`;
}

export const alphaOf = (hex: string) => (hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1);

/** Curvas por personalidade: suave (entra e sai devagar), "snappy" (com sobra elástica), "gentle" (desacelera longo). */
export function ease(style: StyleDNA, x: number): number {
  const t = clamp01(x);
  switch (style.motion.ease) {
    case 'smooth':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'gentle':
      return 1 - Math.pow(1 - t, 5);
    case 'snappy': {
      const c1 = 1.2 + 1.4 * style.motion.intensity;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
  }
}

export interface Phase {
  /** entrada com curva do estilo (pode passar de 1 no "snappy") */
  p: number;
  /** entrada linear 0..1 */
  inRaw: number;
  /** saída 0..1 (0 = ainda inteiro) */
  out: number;
  alpha: number;
}

/** Fase de entrada/saída de um elemento que vive em [start, end], com atraso opcional. */
export function phase(style: StyleDNA, t: number, start: number, end: number, delay = 0): Phase {
  const len = Math.max(0.01, end - start);
  const inSec = Math.min(style.motion.inSec, len * 0.45);
  const outSec = Math.min(style.motion.outSec, len * 0.35);
  const inRaw = progress(t, start + delay, inSec);
  const out = easeInCubic(progress(t, end - outSec, outSec));
  const fade = style.motion.enter === 'pop' ? clamp01(inRaw * 3) : style.motion.enter === 'wipe' ? clamp01(inRaw * 4) : inRaw;
  return { p: ease(style, inRaw), inRaw, out, alpha: fade * (1 - out) };
}

/**
 * Aplica a entrada/saída do estilo num elemento com caixa `box` (já com ctx.save feito pelo chamador):
 * rise = sobe e aparece; pop = cresce com sobra elástica e leve giro; wipe = cortina da esquerda para a direita.
 */
export function applyMotion(ctx: Ctx2D, f: Frame, ph: Phase, box: Rect): void {
  const m = f.style.motion;
  ctx.globalAlpha *= ph.alpha;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (m.enter === 'rise') {
    const dist = (40 + 80 * m.intensity) * f.u;
    ctx.translate(0, (1 - ph.p) * dist - ph.out * dist * 0.4);
  } else if (m.enter === 'pop') {
    const s = (0.55 + 0.45 * ph.p) * (1 - 0.12 * ph.out);
    const rot = (1 - clamp01(ph.p)) * -0.08 * m.intensity;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  } else {
    const pad = 40 * f.u;
    const from = box.x - pad;
    const width = box.w + 2 * pad;
    const left = from + width * ph.out;
    const right = from + width * clamp01(ph.p);
    ctx.beginPath();
    ctx.rect(left, box.y - pad, Math.max(0, right - left), box.h + 2 * pad);
    ctx.clip();
  }
}

export function setFont(ctx: Ctx2D, spec: Pick<FontSpec, 'family' | 'weight' | 'style' | 'tracking'>, size: number): void {
  ctx.font = cssFont(spec, size);
  ctx.letterSpacing = `${Math.round(spec.tracking * size * 100) / 100}px`;
}

export const applyCase = (spec: Pick<FontSpec, 'case'>, text: string) => (spec.case === 'upper' ? text.toLocaleUpperCase('pt-BR') : text);

/** Sombra do estilo: suave (desfocada) ou dura (deslocada, estilo adesivo). */
export function setShadow(ctx: Ctx2D, f: Frame, kind: StyleDNA['shape']['shadow'] = f.style.shape.shadow, strength = 1): void {
  const color = f.style.palette.shadow;
  if (kind === 'none' || alphaOf(color) === 0) {
    clearShadow(ctx);
    return;
  }
  ctx.shadowColor = withAlpha(color, strength);
  if (kind === 'soft') {
    ctx.shadowBlur = 28 * f.u;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4 * f.u;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 7 * f.u;
    ctx.shadowOffsetY = 9 * f.u;
  }
}

export function clearShadow(ctx: Ctx2D): void {
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function fillBox(ctx: Ctx2D, r: Rect, radius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, Math.max(0, Math.min(radius, r.h / 2, r.w / 2)));
  ctx.fill();
}

/** Composição derivada dos parâmetros: só tipografia, "adesivo" (caixas centralizadas) ou "cartão" (painel à esquerda). */
export type Composition = 'type' | 'sticker' | 'card';
export function composition(style: StyleDNA): Composition {
  if (style.shape.panel === 'none') return 'type';
  return style.layout.align === 'left' ? 'card' : 'sticker';
}

/** Reduz o tamanho da fonte até o texto mais largo caber em maxW. */
export function fitSize(ctx: Ctx2D, spec: FontSpec, text: string, size: number, maxW: number, minSize = size * 0.4): number {
  let s = size;
  for (let i = 0; i < 12 && s > minSize; i++) {
    setFont(ctx, spec, s);
    if (ctx.measureText(text).width <= maxW) return s;
    s *= 0.9;
  }
  return Math.max(minSize, s);
}

/** Linha fina que se desenha da esquerda para a direita (p 0..1). */
export function hairline(ctx: Ctx2D, x: number, y: number, w: number, thickness: number, color: string, p: number, align: 'center' | 'left' = 'center'): void {
  const len = w * clamp01(p);
  ctx.fillStyle = color;
  ctx.fillRect(align === 'center' ? x - len / 2 : x, y - thickness / 2, len, thickness);
}
