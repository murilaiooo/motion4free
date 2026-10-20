import { onBox } from '../core/color';
import type { EditPlan } from '../core/types';
import type { Ctx2D } from './ctx';
import { clamp01, progress } from './easing';
import { alphaOf, applyCase, captionFrac, clearShadow, fillBox, setFont, setShadow, TICKER_H, withAlpha, type Frame } from './kit';
import { easeOutExpo } from './motion';

/**
 * Acabamento do quadro (v0.9, ADR-0014): véu de cor, vinheta, faixas de cinema, linhas de TV, selo no
 * canto e faixa de manchetes. Tudo lê `style.decor` e é função pura de (quadro, t): nada guarda estado.
 */

const a3 = (x: number) => Math.round(clamp01(x) * 1000) / 1000;

/** Véu de cor sobre o vídeo (gradação simples: só uma camada translúcida, sem filtro). */
export function drawTint(ctx: Ctx2D, f: Frame): void {
  const c = f.style.decor.tint;
  if (alphaOf(c) === 0) return;
  ctx.fillStyle = withAlpha(c, 1);
  ctx.fillRect(0, 0, f.w, f.h);
}

/**
 * Bordas escurecidas (o olho vai para o centro). Quatro faixas com degradê linear nas bordas em vez de um
 * degradê radial na tela inteira: parecido no olho e bem mais barato sem GPU (medido na galeria).
 */
export function drawVignette(ctx: Ctx2D, f: Frame): void {
  const k = f.style.decor.vignette;
  if (k <= 0) return;
  const dark = `rgba(0, 0, 0, ${a3(0.7 * k)})`;
  const clear = 'rgba(0, 0, 0, 0)';
  const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, dark);
    g.addColorStop(1, clear);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  const sw = Math.round(f.w * 0.2);
  const th = Math.round(f.h * 0.14);
  band(0, 0, sw, 0, 0, 0, sw, f.h);
  band(f.w, 0, f.w - sw, 0, f.w - sw, 0, sw, f.h);
  band(0, 0, 0, th, 0, 0, f.w, th);
  band(0, f.h, 0, f.h - th, 0, f.h - th, f.w, th);
}

/** Altura (px) de cada faixa de cinema. */
export const letterboxH = (f: Pick<Frame, 'h' | 'style'>) => Math.round(f.h * f.style.decor.letterbox);

/** Faixas pretas de cinema em cima e embaixo. */
export function drawLetterbox(ctx: Ctx2D, f: Frame): void {
  const bh = letterboxH(f);
  if (bh <= 0) return;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, f.w, bh);
  ctx.fillRect(0, f.h - bh, f.w, bh);
}

/** Linhas de TV antiga e uma faixa clara que desce devagar (fita). Um só preenchimento para todas as linhas. */
export function drawScanlines(ctx: Ctx2D, f: Frame, t: number): void {
  const k = f.style.decor.scanlines;
  if (k <= 0) return;
  const step = Math.max(2, Math.round(4 * f.u));
  const th = Math.max(1, Math.round(step / 2));
  ctx.save();
  clearShadow(ctx);
  ctx.fillStyle = `rgba(0, 0, 0, ${a3(0.24 * k)})`;
  ctx.beginPath();
  for (let y = 0; y < f.h; y += step) ctx.rect(0, y, f.w, th);
  ctx.fill();
  const bandH = 160 * f.u;
  const y = ((t * 0.16) % 1) * (f.h + bandH) - bandH;
  const g = ctx.createLinearGradient(0, y, 0, y + bandH);
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(0.5, `rgba(255, 255, 255, ${a3(0.08 * k)})`);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, f.w, bandH);
  ctx.restore();
}

/** Tempo do vídeo como numa câmera: 00:00:12. */
export function timecode(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** Centro vertical do selo do canto. */
export const tagY = (f: Pick<Frame, 'safe' | 'u'>) => f.safe.y + 26 * f.u;

/** Selo no canto de cima (rótulo, "ao vivo" ou gravação). Some quando a legenda foi pedida em cima. */
export function drawTag(ctx: Ctx2D, f: Frame, t: number): void {
  const D = f.style.decor;
  if (D.tag === 'none' || captionFrac(f.style) < 0.2) return;
  const P = f.style.palette;
  const lab = f.style.type.label;
  // letras pequenas por natureza (VT323) ganham um pouco de tamanho, como os títulos
  const size = 34 * f.u * Math.min(1.4, Math.max(1, f.style.type.scale));
  const text = applyCase(lab, D.tagText || (D.tag === 'rec' ? 'REC' : ''));
  const x = f.safe.x + 4 * f.u;
  const y = tagY(f);
  const enter = easeOutExpo(progress(t, 0, 0.5));
  ctx.save();
  ctx.globalAlpha *= enter;
  ctx.translate(-(1 - enter) * 30 * f.u, 0);
  setFont(ctx, lab, size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const tw = text ? ctx.measureText(text).width : 0;
  const dotR = size * 0.26;
  // ponto vermelho que pisca uma vez por segundo (função do tempo)
  const blink = Math.floor(t * 2) % 2 === 0 ? 1 : 0.25;
  if (D.tag === 'label') {
    const padX = size * 0.55;
    const h = size * 1.6;
    fillBox(ctx, { x, y: y - h / 2, w: tw + 2 * padX, h }, f.style.shape.radius * h, P.accent);
    ctx.fillStyle = onBox(P.accent, P.onPanel);
    ctx.fillText(text, x + padX, y + size * 0.04);
  } else if (D.tag === 'live') {
    const padX = size * 0.5;
    const h = size * 1.6;
    const w = padX + dotR * 2 + size * 0.4 + tw + padX;
    fillBox(ctx, { x, y: y - h / 2, w, h }, f.style.shape.radius * h, withAlpha(P.panel, 1));
    ctx.fillStyle = withAlpha('#FF2D2D', blink);
    ctx.beginPath();
    ctx.arc(x + padX + dotR, y, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = onBox(P.panel.slice(0, 7), P.onPanel);
    ctx.fillText(text, x + padX + dotR * 2 + size * 0.4, y + size * 0.04);
  } else {
    setShadow(ctx, f, 'soft', 0.8);
    ctx.fillStyle = withAlpha('#FF2D2D', blink);
    ctx.beginPath();
    ctx.arc(x + dotR, y, dotR * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.text;
    ctx.fillText(text, x + dotR * 2 + size * 0.45, y + size * 0.04);
    ctx.textAlign = 'right';
    ctx.fillText(timecode(t), f.safe.x + f.safe.w - 4 * f.u, y + size * 0.04);
    clearShadow(ctx);
  }
  ctx.restore();
}

/**
 * Frases da faixa de manchetes: as do próprio vídeo (título, citação, número, lista, nome), na ordem.
 * Sem cenas, usa as primeiras legendas. Nunca inventa texto.
 */
export function tickerText(plan: Pick<EditPlan, 'scenes' | 'captions'>): string {
  const parts: string[] = [];
  for (const s of plan.scenes) {
    if (s.kind === 'kinetic-title' || s.kind === 'quote') parts.push(s.text);
    else if (s.kind === 'big-number') parts.push(`${s.value} ${s.label}`);
    else if (s.kind === 'list') parts.push(...s.items.map((i) => i.text));
    else if (s.kind === 'lower-third') parts.push(s.title);
  }
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts.map((x) => x.trim())) {
    const k = p.toLowerCase();
    if (p && !seen.has(k)) {
      seen.add(k);
      uniq.push(p);
    }
  }
  const list = uniq.length ? uniq : plan.captions.slice(0, 6).map((c) => c.text);
  return list.join('   •   ');
}

/** Rótulo fixo da faixa de manchetes. */
export const TICKER_LABEL = 'Destaques';
/** Velocidade da faixa, em px (quadro de 1080) por segundo. */
export const TICKER_SPEED = 150;

/** Faixa de manchetes correndo da direita para a esquerda, logo abaixo da área segura reduzida. */
export function drawTicker(ctx: Ctx2D, f: Frame, t: number, text: string): void {
  if (!f.style.decor.ticker || !text) return;
  const P = f.style.palette;
  const lab = f.style.type.label;
  const h = TICKER_H * f.u;
  const y = f.safe.y + f.safe.h + 18 * f.u;
  const enter = easeOutExpo(progress(t, 0, 0.6));
  const panel = P.panel.slice(0, 7);
  ctx.save();
  clearShadow(ctx);
  ctx.globalAlpha *= enter;
  ctx.fillStyle = panel;
  ctx.fillRect(0, y, f.w, h);
  const size = 30 * f.u;
  setFont(ctx, lab, size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const label = applyCase(lab, TICKER_LABEL);
  const capW = f.safe.x + ctx.measureText(label).width + 30 * f.u;
  // texto correndo, recortado à direita do rótulo, repetido para não ter buraco
  const body = applyCase(lab, text);
  const gap = 120 * f.u;
  const tw = ctx.measureText(body).width + gap;
  const off = (((t * TICKER_SPEED * f.u) % tw) + tw) % tw;
  ctx.save();
  ctx.beginPath();
  ctx.rect(capW, y, f.w - capW, h);
  ctx.clip();
  ctx.fillStyle = onBox(panel, P.onPanel);
  for (let x = capW + 24 * f.u - off; x < f.w; x += tw) ctx.fillText(body, x, y + h / 2 + size * 0.04);
  ctx.restore();
  ctx.fillStyle = P.accent;
  ctx.fillRect(0, y, capW, h);
  ctx.fillStyle = onBox(P.accent, P.onPanel);
  ctx.fillText(label, f.safe.x, y + h / 2 + size * 0.04);
  ctx.restore();
}

/** Separação de cores (vermelho/ciano) atrás de um texto, antes do preenchimento normal. */
export function chromaBehind(ctx: Ctx2D, f: Frame, text: string, x: number, y: number, amount = f.style.decor.chroma): void {
  if (amount <= 0) return;
  const d = (2 + 5 * amount) * f.u;
  const a = ctx.globalAlpha;
  const fill = ctx.fillStyle;
  ctx.globalAlpha = a * 0.85;
  ctx.fillStyle = '#FF1E56';
  ctx.fillText(text, x + d, y);
  ctx.fillStyle = '#00E5FF';
  ctx.fillText(text, x - d, y);
  ctx.globalAlpha = a;
  ctx.fillStyle = fill;
}

/**
 * @ da pessoa (v0.12): pequeno, no canto de cima à direita da área segura, sempre visível (marca-d'água de texto).
 * Com a legenda em cima, desce para logo acima da área dos botões, à esquerda, para não brigar com ela.
 */
export function drawHandle(ctx: Ctx2D, f: Frame): void {
  const handle = f.style.brand?.handle;
  if (!handle) return;
  const size = 30 * f.u;
  const top = captionFrac(f.style) < 0.3;
  ctx.save();
  setFont(ctx, f.style.type.label, size);
  ctx.textBaseline = 'middle';
  ctx.textAlign = top ? 'left' : 'right';
  setShadow(ctx, f, 'soft', 0.9);
  ctx.fillStyle = withAlpha('#FFFFFF', 0.82);
  const x = top ? f.safe.x + 4 * f.u : f.safe.x + f.safe.w - 4 * f.u;
  const y = top ? f.safe.y + f.safe.h - size * 0.6 : tagY(f);
  ctx.fillText(handle, x, y);
  clearShadow(ctx);
  ctx.restore();
}
