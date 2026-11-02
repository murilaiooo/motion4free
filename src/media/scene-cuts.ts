import { CanvasSink } from 'mediabunny';
import { cutsFromDiffs, frameHistogram, histogramDiff } from '../editorial/scene-cuts';
import { openMedia } from './input';
import { decodeSize } from './sources';

/**
 * Acha trocas de cena perto do começo e do fim de um clipe (v0.39, ADR-0040). Lê só ~100 quadros minúsculos
 * (64 px, 10 por segundo, 2,5 s para cada lado de cada borda), neste aparelho. Nada é enviado.
 */
const FPS = 10;
const SPAN = 2.5;
const SIDE = 64;

export async function sceneCutsNear(file: Blob, borders: readonly number[], duration: number): Promise<number[]> {
  const media = await openMedia(file, { maxSec: Math.max(duration, 1) + 60 });
  try {
    const sink = new CanvasSink(media.video, { ...decodeSize(media.width, media.height, SIDE), fit: 'fill', poolSize: 1 });
    const cuts: number[] = [];
    for (const border of borders) {
      const a = Math.max(0, border - SPAN);
      const b = Math.min(media.durationSec - 0.05, border + SPAN);
      if (!(b > a)) continue;
      const times = Array.from({ length: Math.floor((b - a) * FPS) + 1 }, (_, i) => a + i / FPS);
      const hists: Float32Array[] = [];
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        const canvas = wrapped?.canvas;
        const ctx = canvas ? (canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null) : null;
        hists.push(ctx && canvas ? frameHistogram(ctx.getImageData(0, 0, canvas.width, canvas.height).data) : new Float32Array(80));
      }
      const used = times.slice(0, hists.length);
      const diffs = hists.map((h, i) => (i ? histogramDiff(hists[i - 1]!, h) : 0));
      cuts.push(...cutsFromDiffs(used, diffs));
    }
    return cuts.sort((x, y) => x - y);
  } finally {
    media.input.dispose();
  }
}
