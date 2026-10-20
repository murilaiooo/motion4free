import { CanvasSink } from 'mediabunny';
import type { EditPlan } from '../core/types';
import { outputDuration, outputToSource } from '../engine/timeline';
import type { Ctx2D } from '../render/ctx';
import { drawFrame } from '../render/frame';
import { ensureFonts } from './fonts';
import type { OpenedMedia } from './input';

const W = 216;
const H = 384;

/**
 * Miniatura do projeto para "Meus projetos": um quadro do vídeo editado, desenhado com a mesma `drawFrame`
 * do player e do MP4 (legenda e estilo aparecem), em JPEG pequeno (~15–30 KB). Só fica no aparelho.
 */
export async function makeThumbnail(media: OpenedMedia, plan: EditPlan): Promise<Blob | null> {
  const t = Math.min(1.5, outputDuration(plan.segments) / 3);
  const src = outputToSource(plan.segments, t) ?? 0;
  const sink = new CanvasSink(media.video, { width: W, height: H, fit: 'cover' });
  const frame = await sink.getCanvas(src);
  await ensureFonts(plan.style).catch(() => undefined);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;
  const scale = W / plan.output.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawFrame(ctx as unknown as Ctx2D, plan, t, frame?.canvas ?? null);
  if (canvas instanceof HTMLCanvasElement) return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.78));
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.78 });
}
