import type { VideoMask } from '../core/edits';
import type { Ctx2D } from './ctx';

/**
 * Máscara do vídeo (v0.26): monta o contorno da forma no quadro (w × h px). Puro: o mesmo caminho
 * recorta o vídeo na prévia e no MP4. Coração, estrela e losango são feitos de retas e arcos.
 */
export function maskSize(m: VideoMask, w: number): { mw: number; mh: number } {
  const mw = m.size * w;
  return { mw, mh: mw * m.aspect };
}

export function maskPath(ctx: Ctx2D, m: VideoMask, w: number, h: number): void {
  const cx = m.x * w;
  const cy = m.y * h;
  const { mw, mh } = maskSize(m, w);
  ctx.beginPath();
  if (m.shape === 'rect') {
    ctx.roundRect(cx - mw / 2, cy - mh / 2, mw, mh, m.radius * Math.min(mw, mh));
    return;
  }
  // as outras formas são desenhadas num quadrado de lado 1 e esticadas para mw × mh
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(mw, mh);
  if (m.shape === 'circle') ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
  else if (m.shape === 'diamond') {
    ctx.moveTo(0, -0.5);
    ctx.lineTo(0.5, 0);
    ctx.lineTo(0, 0.5);
    ctx.lineTo(-0.5, 0);
    ctx.closePath();
  } else if (m.shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.5 : 0.2;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
  } else {
    // coração: ponta embaixo, dois arcos em cima
    const r = 0.25;
    const top = -0.22;
    ctx.moveTo(0, 0.5);
    ctx.lineTo(-0.25 + r * Math.cos((5 * Math.PI) / 6), top + r * Math.sin((5 * Math.PI) / 6));
    ctx.arc(-0.25, top, r, (5 * Math.PI) / 6, Math.PI * 2);
    ctx.arc(0.25, top, r, Math.PI, Math.PI * 2 + Math.PI / 6);
    ctx.closePath();
  }
  ctx.restore();
}
