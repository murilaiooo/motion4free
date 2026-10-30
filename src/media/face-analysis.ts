import { CanvasSink } from 'mediabunny';
import { AppError } from '../core/errors';
import { smoothTrack, type FaceSample, type FaceTrack } from '../render/framing';
import type { FaceBox, FromFaceWorker, ToFaceWorker } from './face-protocol';
import { decodeSize, type ClipSource } from './sources';

export type FaceTracks = Record<string, FaceTrack>;
export interface FaceAnalysis { tracks: FaceTracks; withoutFaces: string[]; frames: number; elapsedMs: number }
const SAMPLE_SEC = 0.5;
const MAX_FRAMES = 12_000;

/** Local-only, one decoded 640px frame in flight, inference in a disposable worker. */
export async function analyzeFaces(sources: ReadonlyMap<string, ClipSource>, durations: ReadonlyMap<string, number>, signal: AbortSignal, progress: (fraction: number) => void): Promise<FaceAnalysis> {
  if (signal.aborted) throw new AppError('ROSTOS_CANCELADO');
  const count = [...sources.keys()].reduce((sum, id) => sum + Math.ceil((durations.get(id) ?? 0) / SAMPLE_SEC), 0);
  if (!count || count > MAX_FRAMES) throw new AppError('ROSTOS_LIMITE');
  const worker = new Worker(new URL('./face.worker.ts', import.meta.url), { type: 'module' });
  const started = performance.now();
  const tracks: FaceTracks = {};
  const withoutFaces: string[] = [];
  let frames = 0;
  const detect = (image: ImageBitmap) => new Promise<FaceBox[]>((resolve, reject) => {
    if (signal.aborted) { image.close(); reject(new AppError('ROSTOS_CANCELADO')); return; }
    const finish = (faces?: FaceBox[], error?: AppError) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.onmessage = null;
      worker.onerror = null;
      if (error) reject(error); else resolve(faces ?? []);
    };
    const abort = () => finish(undefined, new AppError('ROSTOS_CANCELADO'));
    const timer = setTimeout(() => finish(undefined, new AppError('ROSTOS_FALHOU')), 45_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<FromFaceWorker>) => event.data.type === 'faces'
      ? finish(event.data.faces) : finish(undefined, new AppError('ROSTOS_FALHOU'));
    worker.onerror = () => finish(undefined, new AppError('ROSTOS_FALHOU'));
    try { worker.postMessage({ type: 'detect', image } satisfies ToFaceWorker, [image]); }
    catch { image.close(); finish(undefined, new AppError('ROSTOS_FALHOU')); }
  });
  try {
    for (const [id, source] of sources) {
      const duration = durations.get(id) ?? 0;
      if (!Number.isFinite(duration) || duration <= 0) throw new AppError('ROSTOS_FALHOU');
      const sink = new CanvasSink(source.video, { ...decodeSize(source.width, source.height, 640), fit: 'fill', poolSize: 1 });
      const times = Array.from({ length: Math.ceil(duration / SAMPLE_SEC) }, (_, i) => i * SAMPLE_SEC);
      const samples: FaceSample[] = [];
      let previous: FaceBox | null = null;
      let index = 0;
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        if (signal.aborted) throw new AppError('ROSTOS_CANCELADO');
        if (!wrapped?.canvas) throw new AppError('ROSTOS_FALHOU');
        const faces = (await detect(await createImageBitmap(wrapped.canvas)))
          .filter((f) => [f.x, f.y, f.size, f.score].every(Number.isFinite) && f.size > 0 && f.x >= 0 && f.x <= 1 && f.y >= 0 && f.y <= 1);
        // Prefer continuity over switching to the largest face every sample; not speaker identification.
        const chosen = [...faces].sort((a, b) => {
          const rank = (face: FaceBox) => previous && times[index]! - (samples.at(-1)?.t ?? -Infinity) < 1.5
            ? Math.hypot(face.x - previous.x, face.y - previous.y) - face.size * 0.2
            : -face.size * face.score;
          return rank(a) - rank(b);
        })[0];
        if (chosen) {
          samples.push({ t: times[index]!, x: chosen.x, y: chosen.y, size: chosen.size });
          previous = chosen;
        }
        frames++; index++;
        progress(Math.min(1, frames / count));
      }
      if (index !== times.length) throw new AppError('ROSTOS_FALHOU');
      if (samples.length) tracks[id] = smoothTrack(samples, duration);
      else withoutFaces.push(id);
    }
    return { tracks, withoutFaces, frames, elapsedMs: Math.round(performance.now() - started) };
  } finally { worker.terminate(); }
}
