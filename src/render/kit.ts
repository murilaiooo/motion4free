import { cssFont, type FontSpec, type StyleDNA } from '../core/style';
import type { Ctx2D } from './ctx';
import { clamp01, easeInCubic, easeOutBounce, progress } from './easing';
import { safeAreaFor, unitFor, type Rect } from './layout';
import { cubicBezier, easeOutExpo, springIn, type SpringSpec } from './motion';

/** Ferramentas de desenho compartilhadas pelas cenas. Tudo puro: depende só dos argumentos. */

export interface Frame {
  w: number;
  h: number;
  /** unidade: 1 px num quadro cujo lado curto tem 1080 px (v0.14: igual em todo formato) */
  u: number;
  safe: Rect;
  style: StyleDNA;
  /** centro vertical das cenas (fração da área segura), já afastado da legenda */
  overlayY: number;
}

/** Altura da faixa de manchetes (decor.ticker), em px de um quadro de 1080. */
export const TICKER_H = 66;

export function makeFrame(w: number, h: number, style: StyleDNA): Frame {
  const safe = safeAreaFor(w, h);
  const u = unitFor(w, h);
  // a faixa de manchetes ocupa o pé da área segura: legenda e cenas ficam acima dela
  if (style.decor.ticker) safe.h -= (TICKER_H + 18) * u;
  return { w, h, u, safe, style, overlayY: overlayYFor(style) };
}

/** Centro vertical aproximado da legenda, em fração da área segura. */
export function captionFrac(style: StyleDNA): number {
  const C = style.captions;
  return { bottom: 0.92, middle: 0.7, center: 0.5, top: 0.1, custom: C.y }[C.position];
}

/**
 * Centro das cenas (título, número, lista…) longe da legenda: se a legenda foi pedida em cima ou no meio
 * e cairia em cima da cena, a cena desce (ou sobe) para o outro lado da tela (v0.7).
 */
export function overlayYFor(style: StyleDNA): number {
  const o = style.layout.overlayY;
  const c = captionFrac(style);
  if (Math.abs(o - c) >= 0.36) return o;
  return c < 0.5 ? Math.min(0.78, c + 0.5) : Math.max(0.22, c - 0.45);
}

const SMOOTH = cubicBezier(0.76, 0, 0.24, 1);
/** Mola da personalidade "snappy": quanto mais intenso, mais sobra. */
export function snappySpring(style: StyleDNA): SpringSpec {
  return { freq: 1.25, zeta: 0.55 - 0.15 * style.motion.intensity };
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
      // in-out forte (cortina de documentário): sai devagar, cruza rápido, pousa devagar
      return SMOOTH(t);
    case 'gentle':
      // exponencial: arranca e pousa longo (revista)
      return easeOutExpo(t);
    case 'snappy':
      // mola de verdade: passa do ponto e volta, termina exatamente em 1
      return springIn(t, snappySpring(style));
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
  const e = style.motion.enter;
  const fade = e === 'pop' || e === 'wipe' || e === 'drop' ? clamp01(inRaw * 4) : e === 'type' ? (inRaw > 0 ? 1 : 0) : e === 'zoom' ? clamp01(inRaw * 1.6) : clamp01(inRaw * 2.5);
  // a queda quica no chão (curva própria); o resto segue a personalidade do estilo
  const p = e === 'drop' ? easeOutBounce(inRaw) : ease(style, inRaw);
  return { p, inRaw, out, alpha: fade * (1 - out) };
}

/** Passos da entrada "digitando" (type): a largura revelada anda em degraus, como letras surgindo. */
export const TYPE_STEPS = 22;

/**
 * Aplica a entrada/saída do estilo num elemento com caixa `box` (já com ctx.save feito pelo chamador):
 * rise = sobe e aparece; pop = cresce com sobra elástica e leve giro; wipe = cortina da esquerda para a direita;
 * slide = desliza da esquerda e sai pela direita; drop = cai de cima e quica; zoom = assenta de um pouco
 * maior (cinema); type = revela em degraus da esquerda para a direita, como digitando.
 */
export function applyMotion(ctx: Ctx2D, f: Frame, ph: Phase, box: Rect): void {
  const m = f.style.motion;
  ctx.globalAlpha *= ph.alpha;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (m.enter === 'rise') {
    // revelação por máscara: o texto sobe de trás de uma linha invisível e sai subindo (tipografia cinética)
    const padX = 80 * f.u;
    const padY = box.h * 0.32;
    ctx.beginPath();
    ctx.rect(box.x - padX, box.y - padY, box.w + 2 * padX, box.h + 2 * padY);
    ctx.clip();
    const travel = box.h * (0.85 + 0.25 * m.intensity);
    ctx.translate(0, (1 - ph.p) * travel - ph.out * travel * 0.7);
  } else if (m.enter === 'pop') {
    const s = (0.5 + 0.5 * ph.p) * (1 - 0.18 * ph.out);
    const rot = (1 - ph.p) * -0.1 * m.intensity;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  } else if (m.enter === 'slide') {
    const travel = (90 + 140 * m.intensity) * f.u;
    ctx.translate(-(1 - ph.p) * travel + ph.out * travel * 0.8, 0);
  } else if (m.enter === 'drop') {
    const travel = box.h * (1.1 + 0.6 * m.intensity) + 60 * f.u;
    ctx.translate(0, -(1 - ph.p) * travel + ph.out * 40 * f.u);
  } else if (m.enter === 'zoom') {
    const s = 1 + (1 - clamp01(ph.p)) * (0.1 + 0.12 * m.intensity) + ph.out * 0.04;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  } else if (m.enter === 'type') {
    const pad = 40 * f.u;
    const k = ph.inRaw >= 1 ? 1 : Math.floor(ph.inRaw * TYPE_STEPS) / TYPE_STEPS;
    ctx.beginPath();
    ctx.rect(box.x - pad, box.y - pad, pad + box.w * k, box.h + 2 * pad);
    ctx.clip();
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

export const applyCase = (spec: Pick<FontSpec, 'case'>, text: string) => (spec.case === 'upper' ? text.toLocaleUpperCase('pt-BR') : spec.case === 'lower' ? text.toLocaleLowerCase('pt-BR') : text);

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
