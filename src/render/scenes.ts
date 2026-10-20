import type { FontSpec } from '../core/style';
import type { ListItem, SceneInstance } from '../core/types';
import type { Ctx2D } from './ctx';
import { clamp01, progress } from './easing';
import { applyCase, applyMotion, clearShadow, composition, ease, fillBox, fitSize, hairline, phase, setFont, setShadow, withAlpha, type Frame } from './kit';
import type { Rect } from './layout';
import { wrapText } from './layout';
import { easeOutExpo } from './motion';
import { onBox } from '../core/color';

/**
 * Cenas de sobreposição. Cada uma é função pura de (cena, t, estilo): nada guarda estado entre quadros.
 * O layout sai de três composições derivadas do StyleDNA (só tipografia, adesivo, cartão).
 */

type Align = 'center' | 'left';

function anchor(f: Frame): { x: number; align: Align } {
  return f.style.layout.align === 'left' ? { x: f.safe.x + 24 * f.u, align: 'left' } : { x: f.w / 2, align: 'center' };
}

const centerY = (f: Frame) => f.safe.y + f.safe.h * f.overlayY;

/** Quebra e reduz o texto até caber em maxLines linhas de largura maxW. */
function fitLines(ctx: Ctx2D, spec: FontSpec, text: string, size: number, maxW: number, maxLines: number): { lines: string[]; size: number } {
  let s = size;
  let lines: string[] = [text];
  for (let i = 0; i < 10; i++) {
    setFont(ctx, spec, s);
    lines = wrapText(text, maxW, (x) => ctx.measureText(x).width);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && widest <= maxW) break;
    s *= 0.9;
  }
  return { lines, size: s };
}

function lineBox(x: number, align: Align, y: number, w: number, h: number, padX: number): Rect {
  const left = align === 'center' ? x - w / 2 - padX : x - padX;
  return { x: left, y: y - h / 2, w: w + 2 * padX, h };
}

/** Bloco de linhas de texto com a entrada do estilo em cada linha (título, citação, chamada final). */
function drawLines(ctx: Ctx2D, f: Frame, lines: string[], spec: FontSpec, size: number, cy: number, start: number, end: number, t: number, colors: { text: string; box: string }, opts: { boxed: boolean; lineGap?: number; tilt?: number; alt?: { text: string; box: string } } = { boxed: false }): Rect {
  const { x, align } = anchor(f);
  const lineH = size * (opts.lineGap ?? 1.12);
  const top = cy - (lines.length * lineH) / 2;
  setFont(ctx, spec, size);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const widest = Math.max(0, ...widths);
  const block = { x: align === 'center' ? x - widest / 2 : x, y: top, w: widest, h: lines.length * lineH };
  ctx.save();
  if (opts.tilt) {
    const bx = block.x + block.w / 2;
    const by = block.y + block.h / 2;
    ctx.translate(bx, by);
    ctx.rotate(opts.tilt);
    ctx.translate(-bx, -by);
  }
  lines.forEach((line, i) => {
    const y = top + lineH * (i + 0.5);
    const ph = phase(f.style, t, start, end, i * f.style.motion.staggerSec * 2);
    const box = lineBox(x, align, y, widths[i]!, size * 1.12, opts.boxed ? size * 0.3 : 0);
    ctx.save();
    applyMotion(ctx, f, ph, box);
    setFont(ctx, spec, size);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    // duas cores alternadas por linha (ganchos em adesivo): a segunda linha "responde" à primeira
    const c = opts.alt && i % 2 === 1 ? opts.alt : colors;
    if (opts.boxed) {
      setShadow(ctx, f);
      fillBox(ctx, box, f.style.shape.radius * box.h, c.box);
      clearShadow(ctx);
    } else {
      setShadow(ctx, f);
    }
    ctx.fillStyle = c.text;
    ctx.fillText(line, x, y + size * 0.04);
    ctx.restore();
  });
  ctx.restore();
  return block;
}

/** Painel do cartão (Documental): caixa escura + barra de destaque à esquerda, revelada com a cena. */
function drawCard(ctx: Ctx2D, f: Frame, box: Rect, t: number, start: number, end: number): void {
  const ph = phase(f.style, t, start, end);
  ctx.save();
  applyMotion(ctx, f, ph, box);
  clearShadow(ctx);
  fillBox(ctx, box, f.style.shape.radius * Math.min(box.h, 200 * f.u), f.style.palette.panel);
  ctx.fillStyle = f.style.palette.accent;
  ctx.fillRect(box.x, box.y, 8 * f.u, box.h);
  ctx.restore();
}

function cardAround(f: Frame, block: Rect, padX: number, padY: number): Rect {
  return { x: block.x - padX, y: block.y - padY, w: block.w + 2 * padX + 8 * f.u, h: block.h + 2 * padY };
}

export function drawKineticTitle(ctx: Ctx2D, f: Frame, scene: Extract<SceneInstance, { kind: 'kinetic-title' }>, t: number): void {
  const S = f.style;
  const comp = composition(S);
  const spec = S.type.display;
  const { lines, size } = fitLines(ctx, spec, applyCase(spec, scene.text), 128 * f.u * S.type.scale, f.safe.w * (comp === 'card' ? 0.78 : 0.9), 3);
  const cy = centerY(f);
  if (comp === 'card') {
    setFont(ctx, spec, size);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lineH = size * 1.12;
    const { x } = anchor(f);
    const block = { x: x + 28 * f.u, y: cy - (lines.length * lineH) / 2, w: widest, h: lines.length * lineH };
    drawCard(ctx, f, cardAround(f, block, 40 * f.u, 32 * f.u), t, scene.start, scene.end);
    ctx.save();
    ctx.translate(28 * f.u, 0);
    drawLines(ctx, f, lines, spec, size, cy, scene.start + 0.1, scene.end, t, { text: S.palette.onPanel, box: S.palette.panel });
    ctx.restore();
    return;
  }
  if (comp === 'sticker') {
    const altBox = S.palette.text;
    drawLines(ctx, f, lines, spec, size, cy, scene.start, scene.end, t, { text: S.palette.onPanel, box: S.palette.panel }, { boxed: true, lineGap: 1.3, tilt: -0.035 * S.motion.intensity, alt: lines.length > 1 ? { box: altBox, text: onBox(altBox, S.palette.onPanel) } : undefined });
    return;
  }
  const block = drawLines(ctx, f, lines, spec, size, cy, scene.start, scene.end, t, { text: S.palette.text, box: '' }, { boxed: false, lineGap: 1.02 });
  const ph = phase(S, t, scene.start + 0.25, scene.end);
  ctx.save();
  ctx.globalAlpha *= 1 - ph.out;
  hairline(ctx, f.w / 2, block.y + block.h + 34 * f.u, Math.min(block.w * 0.5, 260 * f.u), Math.max(1, S.shape.stroke * f.u), S.palette.accent, ph.p);
  ctx.restore();
}

/** Número que conta até o valor final durante a entrada (estilos com movimento). */
export function countUp(value: string, k: number): string {
  const m = /^(R\$ )?(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?(.*)$/.exec(value);
  if (!m || k >= 1) return value;
  const n = Number(m[2]!.replace(/\./g, ''));
  const cur = Math.round(n * clamp01(k));
  const digits = m[2]!.includes('.') ? String(cur).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(cur);
  return `${m[1] ?? ''}${digits}${m[4] ?? ''}`;
}

export function drawBigNumber(ctx: Ctx2D, f: Frame, scene: Extract<SceneInstance, { kind: 'big-number' }>, t: number): void {
  const S = f.style;
  const P = S.palette;
  const comp = composition(S);
  const spec = S.type.display;
  const lab = S.type.label;
  const a = anchor(f);
  const align = a.align;
  const x = a.x + (comp === 'card' ? 28 * f.u : 0);
  const cy = centerY(f);
  const size = fitSize(ctx, spec, scene.value, 330 * f.u * S.type.scale, f.safe.w * (comp === 'card' ? 0.75 : 0.9));
  const labelSize = 44 * f.u;
  const label = applyCase(lab, scene.label);
  const counting = S.motion.intensity >= 0.2 ? easeOutExpo(progress(t, scene.start, Math.max(0.7, S.motion.inSec * 2.4))) : 1;
  const shown = countUp(scene.value, counting);
  setFont(ctx, spec, size);
  const numW = ctx.measureText(scene.value).width;
  setFont(ctx, lab, labelSize);
  const labelW = label ? Math.min(ctx.measureText(label).width, f.safe.w * 0.9) : 0;
  const numH = size * 0.86;
  const gap = label ? 44 * f.u : 0;
  const total = numH + gap + (label ? labelSize * 1.4 : 0);
  const numY = cy - total / 2 + numH / 2;
  const labelY = numY + numH / 2 + gap + labelSize * 0.7;
  const ph = phase(S, t, scene.start, scene.end);
  const phLabel = phase(S, t, scene.start, scene.end, S.motion.staggerSec * 3);
  const numBox = lineBox(x, align, numY, numW, numH, 0);

  if (comp === 'card') {
    const block = { x, y: numY - numH / 2, w: Math.max(numW, labelW), h: total };
    drawCard(ctx, f, cardAround(f, block, 40 * f.u, 36 * f.u), t, scene.start, scene.end);
  }

  ctx.save();
  applyMotion(ctx, f, ph, numBox);
  setFont(ctx, spec, size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (comp !== 'card') setShadow(ctx, f);
  ctx.fillStyle = P.accent;
  ctx.fillText(shown, x, numY + size * 0.03);
  ctx.restore();

  if (comp === 'type') {
    ctx.save();
    ctx.globalAlpha *= 1 - ph.out;
    hairline(ctx, x, numY + numH / 2 + gap / 2, Math.min(220 * f.u, Math.max(labelW, 120 * f.u)), Math.max(1, S.shape.stroke * f.u), withAlpha(P.text, 0.7), phLabel.p);
    ctx.restore();
  }
  if (!label) return;
  ctx.save();
  const lbox = lineBox(x, align, labelY, labelW, labelSize * 1.5, comp === 'sticker' ? labelSize * 0.5 : 0);
  applyMotion(ctx, f, phLabel, lbox);
  setFont(ctx, lab, labelSize);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (comp === 'sticker') {
    fillBox(ctx, lbox, S.shape.radius * lbox.h, P.shadow);
    ctx.fillStyle = P.text;
  } else if (comp === 'card') {
    ctx.fillStyle = withAlpha(P.onPanel, 0.8);
  } else {
    setShadow(ctx, f);
    ctx.fillStyle = P.text;
  }
  ctx.fillText(label, x, labelY);
  ctx.restore();
}

export function drawList(ctx: Ctx2D, f: Frame, scene: Extract<SceneInstance, { kind: 'list' }>, t: number): void {
  const S = f.style;
  const P = S.palette;
  const comp = composition(S);
  const items: ListItem[] = scene.items;
  const textSpec = S.type.text;
  const numSpec = S.type.display;
  const firstOrd = 1;
  const base = 66 * f.u;
  const numSize = base * 1.25;
  setFont(ctx, numSpec, numSize);
  const nums = items.map((_, i) => String(firstOrd + i).padStart(2, '0'));
  const numW = Math.max(...nums.map((n) => ctx.measureText(n).width));
  const gap = 28 * f.u;
  const pad = comp === 'type' ? 0 : 30 * f.u;
  const maxText = f.safe.w * 0.9 - numW - gap - 2 * pad - (comp === 'card' ? 36 * f.u : 0);
  const texts = items.map((it) => applyCase(textSpec, it.text));
  let size = base;
  for (const tx of texts) size = Math.min(size, fitSize(ctx, textSpec, tx, base, maxText));
  setFont(ctx, textSpec, size);
  const textW = texts.map((tx) => ctx.measureText(tx).width);
  const rowH = Math.max(size, numSize) * (comp === 'sticker' ? 1.75 : 1.6);
  const blockW = numW + gap + Math.max(...textW) + 2 * pad;
  const blockH = items.length * rowH;
  const { x: ax, align } = anchor(f);
  const left = align === 'center' ? ax - blockW / 2 : ax + (comp === 'card' ? 28 * f.u : 0);
  const top = centerY(f) - blockH / 2;
  const visible = items.filter((it) => t >= it.at - 0.1);

  if (comp === 'card' && visible.length) {
    const grow = visible.reduce((acc, it, k) => acc + (k === 0 ? 1 : ease(S, progress(t, it.at - 0.1, S.motion.inSec))), 0);
    const box = { x: left - 36 * f.u, y: top - 24 * f.u, w: blockW + 44 * f.u, h: rowH * grow + 48 * f.u };
    drawCard(ctx, f, box, t, scene.start, scene.end);
  }

  items.forEach((it, i) => {
    if (t < it.at - 0.1) return;
    const ph = phase(S, t, it.at - 0.1, scene.end);
    const next = items[i + 1];
    const dim = next ? 1 - 0.5 * progress(t, next.at - 0.1, 0.3) : 1;
    const current = !next || t < next.at - 0.1;
    const y = top + rowH * (i + 0.5);
    const rowBox = { x: left, y: y - rowH * 0.42, w: numW + gap + textW[i]! + 2 * pad, h: rowH * 0.84 };
    ctx.save();
    applyMotion(ctx, f, { ...ph, alpha: ph.alpha * (comp === 'sticker' ? 1 : dim) }, rowBox);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let textColor = comp === 'card' ? P.onPanel : P.text;
    let numColor = P.accent;
    if (comp === 'sticker') {
      setShadow(ctx, f);
      fillBox(ctx, rowBox, S.shape.radius * rowBox.h, current ? P.panel : withAlpha(P.shadow, 0.78));
      clearShadow(ctx);
      textColor = current ? P.onPanel : P.text;
      numColor = current ? P.onPanel : P.accent;
    } else if (comp === 'type') {
      setShadow(ctx, f);
    }
    setFont(ctx, numSpec, numSize);
    ctx.fillStyle = numColor;
    ctx.fillText(nums[i]!, left + pad, y + numSize * 0.03);
    setFont(ctx, textSpec, size);
    ctx.fillStyle = textColor;
    ctx.fillText(texts[i]!, left + pad + numW + gap, y + size * 0.03);
    ctx.restore();
  });
}

export function drawQuote(ctx: Ctx2D, f: Frame, scene: Extract<SceneInstance, { kind: 'quote' }>, t: number): void {
  const S = f.style;
  const P = S.palette;
  const comp = composition(S);
  const spec = S.type.display;
  const { lines, size } = fitLines(ctx, spec, applyCase(spec, scene.text), (comp === 'type' ? 96 : 82) * f.u * S.type.scale, f.safe.w * (comp === 'card' ? 0.78 : 0.88), 4);
  const cy = centerY(f);
  const { x, align } = anchor(f);
  const lineH = size * 1.14;
  const blockH = lines.length * lineH;
  if (comp === 'card') {
    setFont(ctx, spec, size);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const labelSize = 34 * f.u;
    const block = { x: x + 28 * f.u, y: cy - blockH / 2 - labelSize * 2, w: widest, h: blockH + labelSize * 2 };
    drawCard(ctx, f, cardAround(f, block, 40 * f.u, 34 * f.u), t, scene.start, scene.end);
    const ph = phase(S, t, scene.start + 0.1, scene.end);
    ctx.save();
    ctx.globalAlpha *= ph.alpha;
    setFont(ctx, S.type.label, labelSize);
    ctx.fillStyle = P.accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(applyCase(S.type.label, scene.text.trim().endsWith('?') ? 'Pergunta' : 'Citação'), x + 28 * f.u, cy - blockH / 2 - labelSize);
    ctx.restore();
    ctx.save();
    ctx.translate(28 * f.u, 0);
    drawLines(ctx, f, lines, spec, size, cy + labelSize * 0.3, scene.start + 0.15, scene.end, t, { text: P.onPanel, box: '' }, { boxed: false, lineGap: 1.14 });
    ctx.restore();
    return;
  }
  // aspas grandes na cor de destaque
  const markSize = 230 * f.u * S.type.scale;
  const ph = phase(S, t, scene.start, scene.end);
  ctx.save();
  const markY = cy - blockH / 2 - markSize * 0.28;
  applyMotion(ctx, f, ph, { x: x - markSize / 2, y: markY - markSize / 2, w: markSize, h: markSize });
  setFont(ctx, S.type.emphasis, markSize);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  setShadow(ctx, f);
  ctx.fillStyle = P.accent;
  ctx.fillText('“', x, markY + markSize * 0.2);
  ctx.restore();
  if (comp === 'sticker') {
    drawLines(ctx, f, lines, spec, size, cy + size * 0.2, scene.start + 0.08, scene.end, t, { text: P.onPanel, box: P.text }, { boxed: true, lineGap: 1.3, tilt: 0.02 * S.motion.intensity });
  } else {
    drawLines(ctx, f, lines, spec, size, cy + size * 0.1, scene.start + 0.08, scene.end, t, { text: P.text, box: '' }, { boxed: false, lineGap: 1.14 });
  }
}

export function drawLowerThird(ctx: Ctx2D, f: Frame, scene: Extract<SceneInstance, { kind: 'lower-third' }>, t: number): void {
  const S = f.style;
  const P = S.palette;
  const comp = composition(S);
  const spec = S.type.display;
  const lab = S.type.label;
  const y = f.safe.y + f.safe.h * (S.captions.position === 'bottom' ? 0.64 : 0.9);
  const x = f.safe.x + 12 * f.u + (comp === 'card' ? 28 * f.u : 0);
  const size = fitSize(ctx, spec, applyCase(spec, scene.title), (comp === 'type' ? 92 : 72) * f.u * Math.min(1.1, S.type.scale), f.safe.w * 0.75);
  const title = applyCase(spec, scene.title);
  const sub = scene.subtitle ? applyCase(lab, scene.subtitle) : '';
  const subSize = 32 * f.u;
  setFont(ctx, spec, size);
  const titleW = ctx.measureText(title).width;
  setFont(ctx, lab, subSize);
  const subW = sub ? ctx.measureText(sub).width : 0;
  const h = size * 1.15 + (sub ? subSize * 1.8 : 0);
  const ph = phase(S, t, scene.start, scene.end);
  const phSub = phase(S, t, scene.start, scene.end, S.motion.staggerSec * 2);
  const titleY = y - h / 2 + size * 0.58;
  const subY = titleY + size * 0.58 + subSize * (comp === 'sticker' ? 1.5 : 1.0);
  if (comp === 'card') {
    drawCard(ctx, f, { x: x - 40 * f.u, y: y - h / 2 - 24 * f.u, w: Math.max(titleW, subW) + 80 * f.u, h: h + 48 * f.u }, t, scene.start, scene.end);
  }
  ctx.save();
  if (comp === 'sticker') {
    ctx.translate(x, titleY);
    ctx.rotate(-0.03 * S.motion.intensity);
    ctx.translate(-x, -titleY);
  }
  const titleBox = { x: x - (comp === 'sticker' ? size * 0.3 : 0), y: titleY - size * 0.58, w: titleW + (comp === 'sticker' ? size * 0.6 : 0), h: size * 1.16 };
  ctx.save();
  applyMotion(ctx, f, ph, titleBox);
  setFont(ctx, spec, size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let color = comp === 'card' ? P.onPanel : P.text;
  if (comp === 'sticker') {
    setShadow(ctx, f);
    fillBox(ctx, titleBox, S.shape.radius * titleBox.h, P.panel);
    clearShadow(ctx);
    color = P.onPanel;
  } else if (comp === 'type') {
    setShadow(ctx, f);
  }
  ctx.fillStyle = color;
  ctx.fillText(title, x, titleY + size * 0.04);
  ctx.restore();
  if (comp === 'type') {
    ctx.save();
    ctx.globalAlpha *= 1 - ph.out;
    hairline(ctx, x, titleY - size * 0.72, Math.max(titleW * 0.35, 90 * f.u), Math.max(1, S.shape.stroke * f.u), P.accent, phSub.p, 'left');
    ctx.restore();
  }
  if (sub) {
    ctx.save();
    applyMotion(ctx, f, phSub, { x, y: subY - subSize, w: subW, h: subSize * 2 });
    setFont(ctx, lab, subSize);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (comp === 'sticker') {
      const pad = subSize * 0.45;
      fillBox(ctx, { x: x - pad, y: subY - subSize * 0.8, w: subW + 2 * pad, h: subSize * 1.6 }, S.shape.radius * subSize * 1.6, P.shadow);
      ctx.fillStyle = P.text;
    } else {
      ctx.fillStyle = comp === 'card' ? P.accent : P.text;
      if (comp === 'type') setShadow(ctx, f);
    }
    ctx.fillText(sub, x, subY);
    ctx.restore();
  }
  ctx.restore();
}

export function drawEndCta(ctx: Ctx2D, f: Frame, scene: Extract<SceneInstance, { kind: 'end-cta' }>, t: number): void {
  const S = f.style;
  const P = S.palette;
  const comp = composition(S);
  const spec = S.type.display;
  const { lines, size } = fitLines(ctx, spec, applyCase(spec, scene.text), 104 * f.u * S.type.scale, f.safe.w * (comp === 'card' ? 0.78 : 0.86), 2);
  const cy = centerY(f);
  if (comp === 'card') {
    setFont(ctx, spec, size);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lineH = size * 1.12;
    const { x } = anchor(f);
    const block = { x: x + 28 * f.u, y: cy - (lines.length * lineH) / 2, w: widest, h: lines.length * lineH };
    drawCard(ctx, f, cardAround(f, block, 40 * f.u, 32 * f.u), t, scene.start, scene.end);
    ctx.save();
    ctx.translate(28 * f.u, 0);
    drawLines(ctx, f, lines, spec, size, cy, scene.start + 0.1, scene.end, t, { text: P.onPanel, box: '' });
    ctx.restore();
    return;
  }
  ctx.save();
  if (comp === 'sticker') {
    // pulsa de leve depois de entrar (função do tempo, sem estado)
    const settle = progress(t, scene.start + S.motion.inSec, 0.2);
    const s = 1 + 0.035 * S.motion.intensity * Math.sin((t - scene.start) * Math.PI * 2 * 1.4) * settle;
    ctx.translate(f.w / 2, cy);
    ctx.scale(s, s);
    ctx.translate(-f.w / 2, -cy);
    drawLines(ctx, f, lines, spec, size, cy, scene.start, scene.end, t, { text: P.onPanel, box: P.panel }, { boxed: true, lineGap: 1.3, tilt: -0.03 * S.motion.intensity });
  } else {
    const block = drawLines(ctx, f, lines, spec, size, cy, scene.start, scene.end, t, { text: P.text, box: '' }, { boxed: false, lineGap: 1.05 });
    const ph = phase(S, t, scene.start + 0.3, scene.end);
    ctx.globalAlpha *= 1 - ph.out;
    hairline(ctx, f.w / 2, block.y + block.h + 30 * f.u, block.w * 0.9, Math.max(1, S.shape.stroke * f.u), P.accent, ph.p);
  }
  ctx.restore();
}

export function drawProgress(ctx: Ctx2D, f: Frame, t: number, total: number): void {
  const S = f.style;
  if (S.progress === 'none' || total <= 0) return;
  const k = clamp01(t / total);
  const y = f.h * 0.07;
  const x = f.safe.x;
  const w = f.safe.w;
  ctx.save();
  clearShadow(ctx);
  if (S.progress === 'line') {
    const th = Math.max(2, 4 * f.u);
    ctx.fillStyle = withAlpha(S.palette.text, 0.22);
    ctx.fillRect(x, y, w, th);
    ctx.fillStyle = S.palette.text;
    ctx.fillRect(x, y, w * k, th);
  } else {
    const th = 16 * f.u;
    fillBox(ctx, { x, y, w, h: th }, th / 2, withAlpha('#000000', 0.4));
    if (k > 0) {
      const head = x + Math.max(th, w * k);
      fillBox(ctx, { x, y, w: head - x, h: th }, th / 2, S.palette.accent);
      // ponta com brilho: o olho acompanha o avanço
      ctx.shadowColor = withAlpha(S.palette.accent, 0.9);
      ctx.shadowBlur = 18 * f.u;
      ctx.fillStyle = S.palette.accent;
      ctx.beginPath();
      ctx.arc(head - th / 2, y + th / 2, th * 0.72, 0, Math.PI * 2);
      ctx.fill();
      clearShadow(ctx);
    }
  }
  ctx.restore();
}

/** Desenha a cena de sobreposição; zoom, transição e destaque de palavra são aplicados pelo compositor. */
export function drawOverlay(ctx: Ctx2D, f: Frame, scene: SceneInstance, t: number): void {
  switch (scene.kind) {
    case 'kinetic-title':
      return drawKineticTitle(ctx, f, scene, t);
    case 'big-number':
      return drawBigNumber(ctx, f, scene, t);
    case 'list':
      return drawList(ctx, f, scene, t);
    case 'quote':
      return drawQuote(ctx, f, scene, t);
    case 'lower-third':
      return drawLowerThird(ctx, f, scene, t);
    case 'end-cta':
      return drawEndCta(ctx, f, scene, t);
    default:
      return;
  }
}
