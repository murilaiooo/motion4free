import type { SceneInstance } from '../core/types';
import { easeInCubic, easeOutBack, progress } from './easing';
import { reelsSafeArea, wrapText } from './layout';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const IN = 0.35;
const OUT = 0.25;

/** Cena "título cinético": palavras sobem com overshoot, fundo em faixa, saída rápida. Função pura do tempo. */
export function drawKineticTitle(ctx: Ctx, scene: SceneInstance, t: number, w: number, h: number): void {
  const pIn = easeOutBack(progress(t, scene.start, IN));
  const pOut = easeInCubic(progress(t, scene.end - OUT, OUT));
  const alpha = Math.min(1, progress(t, scene.start, IN * 0.6)) * (1 - pOut);
  if (alpha <= 0) return;

  const safe = reelsSafeArea(w, h);
  const fontSize = Math.round(w * 0.085);
  ctx.save();
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(scene.text.toUpperCase(), safe.w * 0.9, (s) => ctx.measureText(s).width);
  const lineH = fontSize * 1.1;
  const blockH = lines.length * lineH;
  const cy = safe.y + safe.h * 0.22;
  const rise = (1 - pIn) * fontSize * 0.8;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFD400';
  const barW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fontSize * 0.8;
  ctx.fillRect(w / 2 - (barW * pIn) / 2, cy - blockH / 2 - fontSize * 0.25 + rise, barW * pIn, blockH + fontSize * 0.5);

  ctx.fillStyle = '#111111';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, cy - blockH / 2 + lineH * (i + 0.5) + rise);
  });
  ctx.restore();
}
