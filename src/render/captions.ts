import type { StyleDNA } from '../core/style';
import type { Caption } from '../core/types';
import { normalizeToken } from '../editorial/detect';
import type { Ctx2D } from './ctx';
import { clamp01, easeOutBack, easeOutBounce, easeOutCubic, progress } from './easing';
import type { Rect } from './layout';
import { onBox } from '../core/color';
import { alphaOf, applyCase, clearShadow, fillBox, setFont, setShadow, type Frame } from './kit';

/** Início de cada palavra: os tempos reais quando batem com o texto, senão proporcional ao tamanho das palavras. */
export function wordTimings(caption: Pick<Caption, 'start' | 'end' | 'wordStarts'>, tokens: string[]): number[] {
  if (caption.wordStarts.length === tokens.length && tokens.length > 0) return caption.wordStarts;
  const lens = tokens.map((t) => t.length + 1);
  const sum = lens.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, caption.end - caption.start);
  let acc = 0;
  return lens.map((l) => {
    const s = caption.start + (acc / sum) * span;
    acc += l;
    return s;
  });
}

/** Índice da palavra sendo falada em `t` (-1 antes da primeira). */
export function activeWord(starts: number[], t: number): number {
  let idx = -1;
  starts.forEach((s, i) => {
    if (t >= s) idx = i;
  });
  return idx;
}

/** Quebra palavras (pelas larguras) em linhas que cabem em maxW; `perLine` > 0 limita as palavras por linha. */
export function layoutLines(widths: number[], space: number, maxW: number, perLine = 0): number[][] {
  const lines: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  widths.forEach((w, i) => {
    const next = cur.length ? curW + space + w : w;
    if (cur.length && (next > maxW || (perLine > 0 && cur.length >= perLine))) {
      lines.push(cur);
      cur = [i];
      curW = w;
    } else {
      cur.push(i);
      curW = next;
    }
  });
  if (cur.length) lines.push(cur);
  return lines;
}

/** Linhas com larguras parecidas (evita uma palavra sozinha na última linha), mesmo número de linhas. */
export function balanceLines(widths: number[], space: number, maxW: number, lines: number[][]): number[][] {
  if (lines.length < 2) return lines;
  let lo = Math.max(...widths);
  let hi = maxW;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (layoutLines(widths, space, mid).length <= lines.length) hi = mid;
    else lo = mid;
  }
  const best = layoutLines(widths, space, hi);
  return best.length === lines.length ? best : lines;
}

/** Cores da legenda: as próprias (pedido) ou as do estilo. */
export function captionColors(style: StyleDNA): { text: string; highlight: string; keyword: string; stroke: string; box: string } {
  const P = style.palette;
  const C = style.captions.colors;
  return {
    text: C.text ?? P.text,
    highlight: C.highlight ?? P.accent,
    keyword: C.highlight ?? P.accent2,
    stroke: C.stroke ?? (alphaOf(P.shadow) > 0 ? P.shadow : '#000000'),
    box: C.box ?? P.panel,
  };
}

/** Topo do bloco da legenda para a posição pedida (sempre dentro da área segura). */
export function captionTop(style: StyleDNA, safe: Rect, blockH: number): number {
  const C = style.captions;
  const at = (frac: number) => safe.y + safe.h * frac - blockH / 2;
  let top: number;
  switch (C.position) {
    case 'bottom':
      return safe.y + safe.h - blockH;
    case 'middle':
      return at(0.7);
    case 'center':
      top = at(0.5);
      break;
    case 'top':
      top = safe.y + safe.h * 0.04;
      break;
    case 'custom':
      top = at(C.y);
      break;
  }
  return Math.min(safe.y + safe.h - blockH, Math.max(safe.y, top));
}

/** Centro vertical aproximado da legenda, em fração da área segura (para os emojis ficarem longe dela). */
export function captionCenterFrac(style: StyleDNA): number {
  const C = style.captions;
  return { bottom: 0.92, middle: 0.7, center: 0.5, top: 0.1, custom: C.y }[C.position];
}

type Enter = 'none' | 'fade' | 'pop' | 'rise' | 'slide' | 'bounce' | 'typewriter';
/** Entrada efetiva: 'auto' segue a entrada do estilo (pop cresce, rise sobe, wipe só aparece). */
export function captionEnter(style: StyleDNA): Enter {
  const e = style.captions.enter;
  if (e !== 'auto') return e;
  return style.motion.enter === 'pop' ? 'pop' : style.motion.enter === 'rise' ? 'rise' : 'none';
}

/**
 * Legenda no estilo Reels: grande, em negrito, com a palavra falada em destaque (caixa, cor,
 * sublinhado ou "revelação") e palavras-chave na fonte/cor de ênfase.
 */
export function drawCaption(ctx: Ctx2D, f: Frame, caption: Caption, t: number, keywords: ReadonlySet<string>): void {
  const { style, u, safe } = f;
  const C = style.captions;
  const K = captionColors(style);
  const enterKind = captionEnter(style);
  const spec = style.type.text;
  const em = style.type.emphasis;
  const tokens = caption.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return;
  const shown = tokens.map((tk) => applyCase(spec, tk));
  const starts = wordTimings(caption, tokens);
  const active = activeWord(starts, t);
  const isKw = tokens.map((tk) => keywords.has(normalizeToken(tk)));
  const emScale = em.family !== spec.family ? 1.16 : 1;
  const maxW = safe.w * 0.94;

  let size = C.size * f.w;
  let widths: number[] = [];
  let lines: number[][] = [];
  let space = 0;
  const perLine = C.wordsPerLine;
  const maxLines = perLine > 0 ? Math.min(6, Math.max(C.maxLines, Math.ceil(tokens.length / perLine))) : C.maxLines;
  for (let attempt = 0; attempt < 6; attempt++) {
    setFont(ctx, spec, size);
    // com caixa na palavra falada, o espaço precisa caber o respiro da caixa
    space = ctx.measureText(' ').width + size * (C.highlight === 'box' ? 0.18 : 0.06);
    widths = shown.map((s, i) => {
      if (isKw[i]) setFont(ctx, em, size * emScale);
      else setFont(ctx, spec, size);
      return ctx.measureText(s).width;
    });
    lines = layoutLines(widths, space, maxW, perLine);
    if (lines.length <= maxLines && Math.max(...widths) <= maxW) break;
    size *= 0.88;
  }
  if (perLine === 0) lines = balanceLines(widths, space, maxW, lines);

  const lineH = size * 1.2;
  const blockH = lines.length * lineH;
  const top = captionTop(style, safe, blockH);
  const cx = f.w / 2;

  ctx.save();
  // entrada do bloco: pop cresce, rise sobe, fade aparece, slide desliza, bounce cai quicando
  const enter = progress(t, caption.start, enterKind === 'pop' || enterKind === 'rise' ? 0.16 : enterKind === 'bounce' ? 0.4 : 0.22);
  if (enterKind === 'pop') {
    const s = 0.82 + 0.18 * easeOutBack(enter);
    ctx.translate(cx, top + blockH / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -(top + blockH / 2));
  } else if (enterKind === 'rise') {
    ctx.translate(0, (1 - easeOutCubic(enter)) * 16 * u);
    ctx.globalAlpha *= clamp01(enter * 1.5);
  } else if (enterKind === 'fade') {
    ctx.globalAlpha *= enter;
  } else if (enterKind === 'slide') {
    ctx.translate(-(1 - easeOutCubic(enter)) * 70 * u, 0);
    ctx.globalAlpha *= clamp01(enter * 2);
  } else if (enterKind === 'bounce') {
    ctx.translate(0, -(1 - easeOutBounce(enter)) * 70 * u);
    ctx.globalAlpha *= clamp01(enter * 4);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';

  lines.forEach((line, li) => {
    const y = top + lineH * (li + 0.5);
    const lineW = line.reduce((acc, i) => acc + widths[i]!, 0) + space * (line.length - 1);
    let x = cx - lineW / 2;
    if (C.box === 'line') {
      const padX = size * 0.34;
      const padY = size * 0.14;
      const boxH = lineH - 2 + padY;
      clearShadow(ctx);
      fillBox(ctx, { x: x - padX, y: y - boxH / 2, w: lineW + 2 * padX, h: boxH }, style.shape.radius * boxH, K.box);
    }
    for (const i of line) {
      const w = widths[i]!;
      const wx = x + w / 2;
      x += w + space;
      const isActive = i === active;
      const spoken = i <= active;
      const font = isKw[i] ? em : spec;
      const fsize = isKw[i] ? size * emScale : size;
      let color = isKw[i] ? K.keyword : K.text;
      let alpha = 1;
      if (C.highlight === 'reveal' && !spoken) alpha = C.upcomingAlpha;
      // "como digitando": a palavra só aparece quando é falada
      if (enterKind === 'typewriter' && !spoken) continue;
      if (C.highlight === 'color' && isActive && !isKw[i]) color = K.highlight;
      const pop = isActive ? easeOutBack(progress(t, starts[i]!, 0.14)) : 0;
      const scale = isActive ? 1 + (C.activeScale - 1) * pop : 1;

      ctx.save();
      ctx.globalAlpha *= alpha;
      if (scale !== 1) {
        ctx.translate(wx, y);
        ctx.scale(scale, scale);
        ctx.translate(-wx, -y);
      }
      setFont(ctx, font, fsize);
      const boxed = C.highlight === 'box' && isActive;
      if (boxed) {
        const padX = size * 0.12;
        const h = size * 1.14;
        setShadow(ctx, f, 'hard');
        fillBox(ctx, { x: wx - w / 2 - padX, y: y - h / 2, w: w + 2 * padX, h }, style.shape.radius * h, isKw[i] ? K.keyword : K.highlight);
        clearShadow(ctx);
        color = onBox(isKw[i] ? K.keyword : K.highlight, style.palette.onPanel);
      }
      if (C.highlight === 'underline' && isActive) {
        ctx.fillStyle = K.highlight;
        ctx.fillRect(wx - w / 2, y + size * 0.52, w, Math.max(2, size * 0.08));
      }
      if (C.stroke > 0 && !boxed) {
        ctx.lineWidth = C.stroke * u;
        ctx.strokeStyle = K.stroke;
        setShadow(ctx, f);
        ctx.strokeText(shown[i]!, wx, y);
        clearShadow(ctx);
      } else if (!boxed && C.box === 'none') {
        setShadow(ctx, f, 'soft', 0.9);
      }
      ctx.fillStyle = color;
      ctx.fillText(shown[i]!, wx, y);
      ctx.restore();
    }
  });
  ctx.restore();
}

