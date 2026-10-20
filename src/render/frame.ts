import type { EditPlan, SceneInstance } from '../core/types';
import { normalizeToken } from '../editorial/detect';
import { styleAt } from '../editorial/ranges';
import type { StyleDNA } from '../core/style';
import { outputDuration } from '../engine/timeline';
import { drawCaption } from './captions';
import { drawEmoji } from './emoji';
import type { Ctx2D } from './ctx';
import { clamp01, easeInCubic, easeOutCubic, progress } from './easing';
import { alphaOf, makeFrame, withAlpha, type Frame } from './kit';
import { drawOverlay, drawProgress } from './scenes';

export function activeAt<T extends { start: number; end: number }>(items: T[], t: number): T[] {
  return items.filter((i) => t >= i.start && t < i.end);
}

/** Escala do vídeo de fundo em `t`: zoom de ênfase + "soco" de zoom logo depois de um corte. */
export function sourceZoom(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): number {
  let z = 1;
  for (const s of activeAt(plan.scenes, t)) {
    if (s.kind === 'emphasis-zoom') {
      const inDur = Math.min(S.motion.inSec * 1.2, (s.end - s.start) * 0.4);
      const outDur = Math.min(0.35, (s.end - s.start) * 0.3);
      const k = easeOutCubic(progress(t, s.start, inDur)) * (1 - easeInCubic(progress(t, s.end - outDur, outDur)));
      z *= 1 + (s.scale - 1) * k;
    }
    if (s.kind === 'cut-transition' && t >= s.at && (S.transition === 'zoom' || S.transition === 'flash')) {
      const amount = S.transition === 'zoom' ? 0.05 : 0.09;
      z *= 1 + amount * (1 - easeOutCubic(progress(t, s.at, Math.max(0.05, s.end - s.at))));
    }
  }
  return z;
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

const OVERLAY_ORDER: SceneInstance['kind'][] = ['lower-third', 'kinetic-title', 'big-number', 'list', 'quote', 'end-cta'];

/**
 * Desenha um quadro do vídeo final no instante `t` (tempo de saída).
 * `source` já vem recortado/escalado para o tamanho de saída.
 * A mesma função serve para a prévia e para a exportação: é isso que garante prévia = MP4.
 * Depende só de (plano, t, quadro de origem): desenhar em qualquer ordem dá o mesmo resultado.
 */
export function drawFrame(ctx: Ctx2D, plan: EditPlan, t: number, source: CanvasImageSource | null): void {
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
    const z = sourceZoom(plan, t, style);
    ctx.save();
    if (z !== 1) {
      // centro do zoom um pouco acima do meio, onde costuma estar o rosto
      const ox = w / 2;
      const oy = h * 0.42;
      ctx.translate(ox, oy);
      ctx.scale(z, z);
      ctx.translate(-ox, -oy);
    }
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
  }
  drawScrim(ctx, f);
  const veil = transitionVeil(plan, t, style);
  if (veil) {
    ctx.fillStyle = withAlpha(veil.color, veil.alpha);
    ctx.fillRect(0, 0, w, h);
  }
  drawProgress(ctx, f, t, active.some((s) => s.kind === 'progress-bar') ? outputDuration(plan.segments) : 0);

  for (const kind of OVERLAY_ORDER) for (const s of active) if (s.kind === kind) drawOverlay(ctx, f, s, t);

  // a citação já mostra a frase falada: a legenda some enquanto ela está na tela
  const caption = activeAt(plan.captions, t)[0];
  if (caption && !active.some((s) => s.kind === 'quote')) {
    const keywords = new Set(active.filter((s) => s.kind === 'highlight-word').map((s) => normalizeToken((s as { text: string }).text)));
    drawCaption(ctx, f, caption, t, keywords);
  }
  // emojis por cima de tudo, longe da legenda
  for (const s of active) if (s.kind === 'emoji') drawEmoji(ctx, f, s, t);
  ctx.restore();
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
