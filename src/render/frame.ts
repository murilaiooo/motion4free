import type { EditPlan } from '../core/types';
import { reelsSafeArea, wrapText } from './layout';
import { drawKineticTitle } from './scenes';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function activeAt<T extends { start: number; end: number }>(items: T[], t: number): T[] {
  return items.filter((i) => t >= i.start && t < i.end);
}

/**
 * Desenha um quadro do vídeo final no instante `t` (tempo de saída).
 * `source` já vem recortado/escalado para o tamanho de saída.
 * A mesma função serve para a prévia e para a exportação: é isso que garante prévia = MP4.
 */
export function drawFrame(ctx: Ctx, plan: EditPlan, t: number, source: CanvasImageSource | null): void {
  const { width: w, height: h } = plan.output;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (source) ctx.drawImage(source, 0, 0, w, h);

  for (const scene of activeAt(plan.scenes, t)) drawKineticTitle(ctx, scene, t, w, h);

  const caption = activeAt(plan.captions, t)[0];
  if (caption) drawCaption(ctx, caption.text, w, h);
}

function drawCaption(ctx: Ctx, text: string, w: number, h: number): void {
  const safe = reelsSafeArea(w, h);
  const fontSize = Math.round(w * 0.062);
  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const lines = wrapText(text, safe.w, (s) => ctx.measureText(s).width);
  const lineH = fontSize * 1.2;
  const baseY = safe.y + safe.h - lines.length * lineH;
  lines.forEach((line, i) => {
    const y = baseY + lineH * (i + 0.5);
    ctx.lineWidth = fontSize * 0.18;
    ctx.strokeStyle = '#000';
    ctx.strokeText(line, w / 2, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, w / 2, y);
  });
  ctx.restore();
}
