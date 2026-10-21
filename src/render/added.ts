import { resolveFont, type AddedElement, type ElementEnter } from '../core/edits';
import { EMOJI_FONT_FAMILY } from '../core/emoji';
import type { FontSpec, StyleDNA } from '../core/style';
import { onBox } from '../core/color';
import type { Ctx2D } from './ctx';
import { clamp01, easeInCubic, easeOutBounce, progress } from './easing';
import { applyCase, clearShadow, fillBox, setFont, setShadow, type Frame } from './kit';
import { wrapText } from './layout';
import { easeOutExpo, springIn } from './motion';
import { keyedPose } from './keyframes';

/**
 * Elementos adicionados à mão (v0.13): texto, título, emoji e forma (seta, círculo, retângulo).
 * Posição absoluta (centro normalizado), tamanho e giro da própria edição; entrada e saída escolhidas.
 * Função pura de (elemento, t, estilo), igual na prévia e no MP4.
 */

/** Entrada 'auto' segue o movimento do estilo do vídeo. */
export function enterOf(style: StyleDNA, e: ElementEnter | undefined, kind: AddedElement['kind']): Exclude<ElementEnter, 'auto'> {
  if (e && e !== 'auto') return e;
  if (kind === 'emoji') return 'pop';
  const map: Record<StyleDNA['motion']['enter'], Exclude<ElementEnter, 'auto'>> = { pop: 'pop', rise: 'rise', wipe: 'fade', slide: 'slide', drop: 'bounce', zoom: 'fade', type: 'typewriter' };
  return map[style.motion.enter];
}

export interface AddedPose {
  alpha: number;
  scale: number;
  dx: number;
  dy: number;
  rotate: number;
  /** fração do texto revelada (digitando) */
  reveal: number;
}

/** Entrada/saída do elemento no instante `t` (deslocamentos em px de 1080). */
export function addedPose(style: StyleDNA, el: AddedElement, start: number, end: number, t: number): AddedPose {
  const enter = enterOf(style, el.look.enter, el.kind);
  const k = el.look.intensity ?? style.motion.intensity;
  const exit = el.look.exit ?? 'auto';
  const len = Math.max(0.05, end - start);
  const inSec = Math.min(0.45, len * 0.4);
  const p = progress(t, start, inSec);
  const outSec = Math.min(0.25, len * 0.3);
  const out = exit === 'none' ? 0 : easeInCubic(progress(t, end - outSec, outSec));
  const pose: AddedPose = { alpha: 1, scale: 1, dx: 0, dy: 0, rotate: 0, reveal: 1 };
  switch (enter) {
    case 'none':
      break;
    case 'fade':
      pose.alpha = p;
      break;
    case 'pop': {
      const sp = springIn(progress(t, start, Math.min(0.5, len * 0.45)), { freq: 1.5, zeta: 0.42 });
      pose.scale = Math.max(0, 0.4 + 0.6 * sp);
      pose.rotate = (1 - sp) * -0.25 * k;
      pose.alpha = clamp01(p * 4);
      break;
    }
    case 'rise':
      pose.dy = (1 - easeOutExpo(p)) * (40 + 80 * k);
      pose.alpha = clamp01(p * 2.5);
      break;
    case 'slide':
      pose.dx = -(1 - easeOutExpo(p)) * (90 + 160 * k);
      pose.alpha = clamp01(p * 2.5);
      break;
    case 'bounce':
      pose.dy = -(1 - easeOutBounce(progress(t, start, Math.min(0.6, len * 0.5)))) * (80 + 140 * k);
      pose.alpha = clamp01(p * 4);
      break;
    case 'typewriter':
      pose.reveal = clamp01((t - start) / Math.max(0.3, Math.min(1.2, len * 0.5)));
      break;
  }
  if (out > 0) {
    pose.alpha *= 1 - out;
    if (exit === 'shrink') pose.scale *= 1 - 0.6 * out;
  }
  return pose;
}

/** Fonte do texto adicionado: título usa a fonte dos títulos do modelo, texto a da legenda; a escolha vale mais. */
export function addedFont(style: StyleDNA, el: AddedElement): FontSpec {
  const base = el.preset === 'title' ? style.type.display : style.type.text;
  const L = el.look;
  let spec = base;
  if (L.font || L.weight !== undefined || L.italic !== undefined) {
    const f = resolveFont(L.font ?? base.family, L.weight ?? base.weight, L.italic ?? base.style === 'italic');
    spec = { ...spec, family: f.family, weight: f.weight, style: f.style };
  }
  if (L.case) spec = { ...spec, case: L.case };
  return spec;
}

/** Tamanho base da letra (px num quadro de 1080), antes da escala da edição. */
export const addedBaseSize = (style: StyleDNA, el: AddedElement) => (el.preset === 'title' ? 96 * style.type.scale : 64);

/** Desenha o elemento; o chamador já fez save/translate para o centro dele (e restaura depois). */
export function drawAddedContent(ctx: Ctx2D, f: Frame, el: AddedElement, pose: AddedPose): void {
  const S = f.style;
  const P = S.palette;
  const L = el.look;
  const u = f.u;
  if (el.kind === 'emoji') {
    const size = 0.16 * f.w;
    ctx.font = `${Math.round(size * 100) / 100}px "${EMOJI_FONT_FAMILY}"`;
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    if (L.shadow !== false) setShadow(ctx, f, 'soft', 0.5);
    ctx.fillText(el.emoji ?? '', 0, 0);
    clearShadow(ctx);
    return;
  }
  if (el.kind === 'shape') {
    const color = L.text ?? P.accent;
    const fill = L.box && L.box !== 'none' ? L.box : null;
    const lw = Math.max(2, (L.strokeWidth ?? 14) * u);
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (L.shadow !== false) setShadow(ctx, f, 'soft', 0.6);
    const k = pose.reveal;
    if (el.shape === 'arrow') {
      const len = 320 * u * k;
      const th = Math.max(8, 30 * u);
      const head = 90 * u;
      const x0 = -160 * u;
      ctx.beginPath();
      ctx.moveTo(x0, -th / 2);
      ctx.lineTo(x0 + Math.max(0, len - head), -th / 2);
      ctx.lineTo(x0 + Math.max(0, len - head), -head * 0.62);
      ctx.lineTo(x0 + len, 0);
      ctx.lineTo(x0 + Math.max(0, len - head), head * 0.62);
      ctx.lineTo(x0 + Math.max(0, len - head), th / 2);
      ctx.lineTo(x0, th / 2);
      ctx.closePath();
      ctx.fill();
    } else if (el.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, 150 * u, 0, Math.PI * 2 * k);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.stroke();
    } else {
      const w = 380 * u;
      const h = 230 * u;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 26 * u);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.stroke();
    }
    clearShadow(ctx);
    return;
  }
  // texto ou título
  const spec = addedFont(S, el);
  const size = addedBaseSize(S, el) * u;
  const maxW = (L.maxWidth ?? 0.8) * f.w;
  const raw = applyCase(spec, el.text);
  setFont(ctx, spec, size);
  const lines = raw.split('\n').flatMap((l) => wrapText(l, maxW, (s) => ctx.measureText(s).width));
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.max(0, ...widths);
  const lineH = size * 1.18;
  const top = -(lines.length * lineH) / 2;
  const align = L.align ?? 'center';
  const titleBox = el.preset === 'title' && S.shape.panel === 'box';
  const box = L.box === 'none' ? null : (L.box ?? (titleBox ? P.panel : null));
  const color = L.text ?? (box ? onBox(box, P.onPanel) : P.text);
  const strokeW = (L.strokeWidth ?? (box ? 0 : el.preset === 'title' ? 0 : 6)) * u;
  const strokeColor = L.stroke ?? '#000000';
  const total = raw.replace(/\s/g, '').length;
  let budget = Math.ceil(total * pose.reveal);
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  const x = align === 'left' ? -blockW / 2 : align === 'right' ? blockW / 2 : 0;
  lines.forEach((line, i) => {
    if (budget <= 0) return;
    const shown = line.length <= budget ? line : line.slice(0, budget);
    budget -= line.replace(/\s/g, '').length;
    const y = top + lineH * (i + 0.5);
    const w = widths[i]!;
    const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    if (box) {
      const padX = size * 0.32;
      const padY = size * 0.1;
      setShadow(ctx, f);
      fillBox(ctx, { x: left - padX, y: y - lineH / 2 - padY / 2 + 2, w: w + 2 * padX, h: lineH + padY - 4 }, S.shape.radius * lineH, box);
      clearShadow(ctx);
    }
    setFont(ctx, spec, size);
    if (strokeW > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = strokeColor;
      if (L.shadow !== false) setShadow(ctx, f, 'soft', 0.7);
      ctx.strokeText(shown, x, y + size * 0.04);
      clearShadow(ctx);
    } else if (!box && L.shadow !== false) setShadow(ctx, f, 'soft', 0.9);
    ctx.fillStyle = color;
    ctx.fillText(shown, x, y + size * 0.04);
    clearShadow(ctx);
  });
}

/** Desenha um elemento adicionado inteiro no instante `t` (posição, tamanho, giro, entrada e saída). */
export function drawAdded(ctx: Ctx2D, f: Frame, el: AddedElement, start: number, end: number, t: number, mark?: { begin(): void; end(): void }): void {
  const pose = addedPose(f.style, el, start, end, t);
  // pontos de animação (v0.26): posição, tamanho, giro e opacidade mudam com o tempo
  const keyed = keyedPose(el, t - start);
  if (pose.alpha * keyed.opacity <= 0.001 || pose.scale <= 0.001) return;
  const P = keyed.placement;
  ctx.save();
  ctx.translate(P.x * f.w, P.y * f.h);
  if (P.rotate) ctx.rotate((P.rotate * Math.PI) / 180);
  if (P.scale !== 1) ctx.scale(P.scale, P.scale);
  mark?.begin();
  ctx.globalAlpha *= pose.alpha * keyed.opacity;
  if (pose.dx || pose.dy) ctx.translate(pose.dx * f.u, pose.dy * f.u);
  if (pose.rotate) ctx.rotate(pose.rotate);
  if (pose.scale !== 1) ctx.scale(pose.scale, pose.scale);
  drawAddedContent(ctx, f, el, pose);
  mark?.end();
  ctx.restore();
}
