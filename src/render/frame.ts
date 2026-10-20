import type { EditPlan, SceneInstance } from '../core/types';
import { normalizeToken } from '../editorial/detect';
import { styleAt } from '../editorial/ranges';
import type { StyleDNA } from '../core/style';
import { outputDuration } from '../engine/timeline';
import { drawCaption } from './captions';
import { drawEmoji } from './emoji';
import type { Ctx2D } from './ctx';
import { clamp01, progress } from './easing';
import type { Rect } from './layout';
import { easeInOutQuint, easeOutExpo, springIn, wiggle } from './motion';
import { alphaOf, composition, makeFrame, withAlpha, type Frame } from './kit';
import { drawOverlay, drawProgress } from './scenes';
import { framingFor, placeSource, type Focus } from './framing';
import { drawLetterbox, drawScanlines, drawTag, drawTicker, drawTint, drawVignette, tickerText } from './decor';

export function activeAt<T extends { start: number; end: number }>(items: T[], t: number): T[] {
  return items.filter((i) => t >= i.start && t < i.end);
}

/** Câmera virtual sobre o vídeo de fundo em `t`: escala total e deslocamento (tremor). */
export interface Camera {
  zoom: number;
  dx: number;
  dy: number;
}

/** Início (tempo de saída) do trecho mantido que contém `t`, e quanto dele já passou. */
export function segmentClock(plan: EditPlan, t: number): { start: number; elapsed: number; len: number } {
  let acc = 0;
  for (const s of plan.segments) {
    const len = s.srcEnd - s.srcStart;
    if (t < acc + len || s === plan.segments[plan.segments.length - 1]) return { start: acc, elapsed: Math.max(0, t - acc), len };
    acc += len;
  }
  return { start: 0, elapsed: Math.max(0, t), len: 0 };
}

/** Ken Burns só em trechos longos (a imagem parada é o que cansa), depois do primeiro segundo e pouco. */
export const KB_MIN_SEGMENT = 3;
export const KB_DELAY = 1.2;

/**
 * "Ken Burns": aproximação lenta e contínua nos trechos mantidos longos (≥ 3 s), começando depois de
 * 1,2 s sem corte (a imagem não fica parada), reiniciando em cada corte. Desligada sem zoom no estilo ("sem zoom"/"sem efeitos") e nos trechos
 * pedidos "sem animação aqui". Velocidade e teto crescem com o zoom e a intensidade do estilo.
 */
export function kenBurns(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): number {
  const amount = S.zoomScale - 1;
  if (amount <= 0.001 || S.motion.intensity <= 0.02) return 1;
  for (const r of plan.ranges) if (r.quiet && t >= r.out.start && t < r.out.end) return 1;
  const clock = segmentClock(plan, t);
  if (clock.len < KB_MIN_SEGMENT || clock.elapsed <= KB_DELAY) return 1;
  const elapsed = clock.elapsed - KB_DELAY;
  const k = 0.35 + 0.65 * S.motion.intensity;
  const rate = amount * 0.11 * k; // por segundo
  const cap = amount * 0.55 * k;
  // começa suave (sem tranco logo depois do corte) e cresce em linha reta até o teto
  const ramp = Math.min(elapsed, 0.6);
  const lin = elapsed <= 0.6 ? (ramp * ramp) / 1.2 : elapsed - 0.3;
  return 1 + Math.min(cap, rate * lin);
}

/** Escala do vídeo de fundo em `t`: zoom de ênfase + "soco" de zoom logo depois de um corte + Ken Burns. */
export function cameraAt(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): Camera {
  let z = kenBurns(plan, t, S);
  let dx = 0;
  let dy = 0;
  for (const s of activeAt(plan.scenes, t)) {
    if (s.kind === 'emphasis-zoom') {
      const len = s.end - s.start;
      const outDur = Math.min(0.35, len * 0.3);
      const leave = easeInOutQuint(progress(t, s.end - outDur, outDur));
      let k: number;
      if (S.motion.ease === 'snappy') {
        // soco: chega no zoom em ~0,15 s com mola e assenta
        k = springIn(progress(t, s.start, Math.min(0.45, len * 0.4)), { freq: 1.5, zeta: 0.5 });
        // tremor curto no impacto, só em estilos bem intensos
        const d = 1 - progress(t, s.start, 0.32);
        if (S.motion.intensity >= 0.6 && d > 0) {
          const amp = 9 * (Math.min(plan.output.width, plan.output.height) / 1080) * S.motion.intensity * d * d;
          dx = wiggle(t - s.start, 13, 1) * amp;
          dy = wiggle(t - s.start, 11, 2) * amp * 0.7;
        }
      } else {
        const inDur = Math.min(S.motion.inSec * 1.6, len * 0.45);
        k = easeOutExpo(progress(t, s.start, inDur));
      }
      z *= 1 + (s.scale - 1) * k * (1 - leave);
    }
    if (s.kind === 'cut-transition' && t >= s.at && (S.transition === 'zoom' || S.transition === 'flash')) {
      const amount = S.transition === 'zoom' ? 0.07 : 0.09;
      z *= 1 + amount * (1 - easeOutExpo(progress(t, s.at, Math.max(0.12, (s.end - s.at) * 1.6))));
    }
  }
  return { zoom: z, dx, dy };
}

/** Só a escala da câmera (compatível com a v0.6). */
export function sourceZoom(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): number {
  return cameraAt(plan, t, S).zoom;
}

/** Opacidade do flash (branco) ou do mergulho (preto) da transição de corte em `t`. */
export function transitionVeil(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): { color: string; alpha: number } | null {
  const kind = S.transition;
  if (kind !== 'flash' && kind !== 'dip') return null;
  let alpha = 0;
  for (const s of activeAt(plan.scenes, t)) {
    if (s.kind !== 'cut-transition') continue;
    const before = Math.max(0.01, s.at - s.start);
    const after = Math.max(0.01, s.end - s.at);
    const d = t < s.at ? 1 - (s.at - t) / before : 1 - (t - s.at) / after;
    alpha = Math.max(alpha, (kind === 'flash' ? 0.85 : 0.75) * Math.pow(clamp01(d), kind === 'flash' ? 2 : 1));
  }
  return alpha > 0 ? { color: kind === 'flash' ? '#FFFFFF' : '#000000', alpha } : null;
}

const CENTRAL: ReadonlySet<SceneInstance['kind']> = new Set(['kinetic-title', 'big-number', 'list', 'quote', 'end-cta']);

/** A frase do título é (quase) a mesma da legenda: mostrar as duas seria repetir. */
export function sameWords(a: string, b: string): boolean {
  const wa = a.split(/\s+/).map(normalizeToken).filter(Boolean);
  const wb = new Set(b.split(/\s+/).map(normalizeToken).filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return false;
  const common = wa.filter((w) => wb.has(w)).length;
  return common / Math.min(wa.length, wb.size) >= 0.6;
}

/**
 * Quadro de um clipe no tamanho de origem (v0.14), com o que o enquadramento precisa: proporção real,
 * de qual clipe ele é (enquadramento próprio), o foco do rosto naquele instante e uma cópia minúscula
 * para o fundo desfocado do modo "ajustar". Quem decodifica (player/exportação) monta isto; o desenho é puro.
 */
export interface SourceFrame {
  kind: 'clip';
  image: CanvasImageSource;
  width: number;
  height: number;
  clipId: string;
  focus: Focus | null;
  /** cópia bem pequena do mesmo quadro: esticada, vira o fundo desfocado */
  backdrop: CanvasImageSource | null;
}

export function isSourceFrame(x: unknown): x is SourceFrame {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'clip';
}

/** Desenha o vídeo de fundo: legado (já no tamanho da saída) ou clipe com enquadramento. */
function drawSource(ctx: Ctx2D, plan: EditPlan, source: CanvasImageSource | SourceFrame, w: number, h: number, style: StyleDNA): void {
  if (!isSourceFrame(source)) {
    ctx.drawImage(source, 0, 0, w, h);
    return;
  }
  const framing = framingFor(plan, source.clipId);
  const p = placeSource(source.width, source.height, w, h, framing, source.focus);
  if (p.needsBackdrop) {
    if (framing.fill === 'blur' && source.backdrop) {
      // fundo: o mesmo quadro esticado (cobrindo a tela) a partir de uma cópia minúscula = desfoque barato
      const cover = placeSource(source.width, source.height, w, h, { mode: 'fill', fill: 'blur', zoom: 1.08, x: 0, y: 0 }, null);
      const k = 1 / source.width;
      const bw = (source.backdrop as { width?: number }).width ?? 1;
      const bh = (source.backdrop as { height?: number }).height ?? 1;
      ctx.drawImage(source.backdrop, cover.src.x * k * bw, (cover.src.y / source.height) * bh, cover.src.w * k * bw, (cover.src.h / source.height) * bh, 0, 0, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = style.palette.panel.slice(0, 7);
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.drawImage(source.image, p.src.x, p.src.y, p.src.w, p.src.h, p.dst.x, p.dst.y, p.dst.w, p.dst.h);
}

const OVERLAY_ORDER: SceneInstance['kind'][] = ['lower-third', 'kinetic-title', 'big-number', 'list', 'quote', 'end-cta'];

/**
 * Desenha um quadro do vídeo final no instante `t` (tempo de saída).
 * `source`: quadro já no tamanho da saída (galeria, testes) ou `SourceFrame` de um clipe (enquadrado aqui).
 * A mesma função serve para a prévia e para a exportação: é isso que garante prévia = MP4.
 * Depende só de (plano, t, quadro de origem): desenhar em qualquer ordem dá o mesmo resultado.
 */
export function drawFrame(ctx: Ctx2D, plan: EditPlan, t: number, source: CanvasImageSource | SourceFrame | null): void {
  const { width: w, height: h } = plan.output;
  // trecho com estilo próprio (pedido do trecho ou trava) desenha com o estilo dele
  const style = styleAt(plan, t);
  const f = makeFrame(w, h, style);
  const active = activeAt(plan.scenes, t);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (source) {
    const cam = cameraAt(plan, t, style);
    const z = cam.zoom;
    ctx.save();
    if (z !== 1 || cam.dx !== 0 || cam.dy !== 0) {
      // centro do zoom um pouco acima do meio, onde costuma estar o rosto; o tremor nunca mostra borda
      const ox = w / 2;
      const oy = h * 0.42;
      const zz = cam.dx !== 0 || cam.dy !== 0 ? Math.max(z, 1 + (2 * Math.max(Math.abs(cam.dx) / w, Math.abs(cam.dy) / h))) : z;
      ctx.translate(ox + cam.dx, oy + cam.dy);
      ctx.scale(zz, zz);
      ctx.translate(-ox, -oy);
    }
    drawSource(ctx, plan, source, w, h, style);
    ctx.restore();
  }
  // acabamento do modelo (v0.9): véu de cor e vinheta sobre o vídeo, antes de qualquer texto
  drawTint(ctx, f);
  drawVignette(ctx, f);
  drawScrim(ctx, f);
  const veil = transitionVeil(plan, t, style);
  if (veil) {
    ctx.fillStyle = withAlpha(veil.color, veil.alpha);
    ctx.fillRect(0, 0, w, h);
  }
  drawLetterbox(ctx, f);
  drawProgress(ctx, f, t, active.some((s) => s.kind === 'progress-bar') ? outputDuration(plan.segments) : 0);
  // só tipografia (sem caixa): uma faixa escura suave atrás da cena central, para ler sobre qualquer fundo
  if (composition(style) === 'type') for (const s of active) if (CENTRAL.has(s.kind)) drawBand(ctx, f, s.start, s.end, t);

  for (const kind of OVERLAY_ORDER) for (const s of active) if (s.kind === kind) drawOverlay(ctx, f, s, t);
  if (style.decor.ticker) drawTicker(ctx, f, t, tickerText(plan));
  drawTag(ctx, f, t);

  // a citação já mostra a frase falada, e o título com a mesma frase também: a legenda some
  const caption = activeAt(plan.captions, t)[0];
  let capRect: Rect | null = null;
  if (caption && !active.some((s) => s.kind === 'quote' || (s.kind === 'kinetic-title' && sameWords(s.text, caption.text)))) {
    const keywords = new Set(active.filter((s) => s.kind === 'highlight-word').map((s) => normalizeToken((s as { text: string }).text)));
    const next = plan.captions.find((c) => c.start >= caption.end - 1e-6 && c !== caption);
    capRect = drawCaption(ctx, f, caption, t, keywords, { exit: !next || next.start - caption.end >= 0.2 });
  }
  // emojis por cima de tudo, perto da legenda sem cobrir nem ela nem as cenas
  const busy = active.some((s) => CENTRAL.has(s.kind));
  for (const s of active) if (s.kind === 'emoji') drawEmoji(ctx, f, s, t, { caption: capRect, busy });
  // linhas de TV por cima de tudo (fita antiga)
  drawScanlines(ctx, f, t);
  ctx.restore();
}

/** Faixa escura que aparece e some com a cena central (legibilidade do texto sem caixa). */
export function bandAlpha(start: number, end: number, t: number): number {
  return easeOutExpo(progress(t, start, 0.35)) * (1 - easeInOutQuint(progress(t, end - 0.35, 0.35)));
}
function drawBand(ctx: Ctx2D, f: Frame, start: number, end: number, t: number): void {
  const k = bandAlpha(start, end, t);
  const color = f.style.palette.scrim;
  if (k <= 0 || alphaOf(color) === 0) return;
  const cy = f.safe.y + f.safe.h * f.overlayY;
  const half = f.h * 0.26;
  const g = ctx.createLinearGradient(0, cy - half, 0, cy + half);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.5, withAlpha(color, 0.55 * k));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, cy - half, f.w, 2 * half);
}

/** Gradiente escuro fixo na parte de baixo (legibilidade das legendas), se o estilo pedir. */
function drawScrim(ctx: Ctx2D, f: Frame): void {
  const color = f.style.palette.scrim;
  if (alphaOf(color) === 0) return;
  const top = f.h * 0.5;
  const g = ctx.createLinearGradient(0, top, 0, f.h);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.55, withAlpha(color, 0.6));
  g.addColorStop(1, withAlpha(color, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, f.w, f.h - top);
}
