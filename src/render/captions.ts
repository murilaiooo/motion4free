import type { Caption } from '../core/types';
import { normalizeToken } from '../editorial/detect';
import type { Ctx2D } from './ctx';
import { clamp01, easeOutBack, easeOutCubic, progress } from './easing';
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

/** Quebra palavras (pelas larguras) em linhas que cabem em maxW. */
export function layoutLines(widths: number[], space: number, maxW: number): number[][] {
  const lines: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  widths.forEach((w, i) => {
    const next = cur.length ? curW + space + w : w;
    if (cur.length && next > maxW) {
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

/**
 * Legenda no estilo Reels: grande, em negrito, com a palavra falada em destaque (caixa, cor,
 * sublinhado ou "revelação") e palavras-chave na fonte/cor de ênfase.
 */
export function drawCaption(ctx: Ctx2D, f: Frame, caption: Caption, t: number, keywords: ReadonlySet<string>): void {
  const { style, u, safe } = f;
  const C = style.captions;
  const P = style.palette;
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
  for (let attempt = 0; attempt < 6; attempt++) {
    setFont(ctx, spec, size);
    // com caixa na palavra falada, o espaço precisa caber o respiro da caixa
    space = ctx.measureText(' ').width + size * (C.highlight === 'box' ? 0.18 : 0.06);
    widths = shown.map((s, i) => {
      if (isKw[i]) setFont(ctx, em, size * emScale);
      else setFont(ctx, spec, size);
      return ctx.measureText(s).width;
    });
    lines = layoutLines(widths, space, maxW);
    if (lines.length <= C.maxLines && Math.max(...widths) <= maxW) break;
    size *= 0.88;
  }
  lines = balanceLines(widths, space, maxW, lines);

  const lineH = size * 1.2;
  const blockH = lines.length * lineH;
  const top = C.position === 'bottom' ? safe.y + safe.h - blockH : safe.y + safe.h * 0.7 - blockH / 2;
  const cx = f.w / 2;

  ctx.save();
  // entrada do bloco: Pop cresce, Editorial sobe, Documental só aparece
  const enter = progress(t, caption.start, 0.16);
  if (style.motion.enter === 'pop') {
    const s = 0.82 + 0.18 * easeOutBack(enter);
    ctx.translate(cx, top + blockH / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -(top + blockH / 2));
  } else if (style.motion.enter === 'rise') {
    ctx.translate(0, (1 - easeOutCubic(enter)) * 16 * u);
    ctx.globalAlpha *= clamp01(enter * 1.5);
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
      fillBox(ctx, { x: x - padX, y: y - boxH / 2, w: lineW + 2 * padX, h: boxH }, style.shape.radius * boxH, P.panel);
    }
    for (const i of line) {
      const w = widths[i]!;
      const wx = x + w / 2;
      x += w + space;
      const isActive = i === active;
      const spoken = i <= active;
      const font = isKw[i] ? em : spec;
      const fsize = isKw[i] ? size * emScale : size;
      let color = isKw[i] ? P.accent2 : P.text;
      let alpha = 1;
      if (C.highlight === 'reveal' && !spoken) alpha = C.upcomingAlpha;
      if (C.highlight === 'color' && isActive && !isKw[i]) color = P.accent;
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
        fillBox(ctx, { x: wx - w / 2 - padX, y: y - h / 2, w: w + 2 * padX, h }, style.shape.radius * h, isKw[i] ? P.accent2 : P.accent);
        clearShadow(ctx);
        color = P.onPanel;
      }
      if (C.highlight === 'underline' && isActive) {
        ctx.fillStyle = P.accent;
        ctx.fillRect(wx - w / 2, y + size * 0.52, w, Math.max(2, size * 0.08));
      }
      if (C.stroke > 0 && !boxed) {
        ctx.lineWidth = C.stroke * u;
        ctx.strokeStyle = alphaOf(P.shadow) > 0 ? P.shadow : '#000000';
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
