import { AppError, describeError } from '../core/errors';
import type { EditPlan } from '../core/types';
import type { DecodedAudio } from './audio';
import { exportPlan, type ExportResult } from './export';
import type { FromExportWorker, ToExportWorker } from './export-protocol';
import type { OpenedMedia } from './input';

export interface BackgroundExport extends ExportResult {
  /** Onde rodou: 'worker' (normal) ou 'main' (reserva quando o Worker não funciona neste navegador). */
  where: 'worker' | 'main';
}

/**
 * Exporta num Worker para a tela não travar. Se o Worker não iniciar ou falhar,
 * tenta de novo na tela principal (mais lento para a interface, mesmo resultado).
 */
export async function exportInBackground(file: Blob, media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, onProgress: (f: number) => void, music: DecodedAudio | null = null, faceTracks: import('./face-analysis').FaceTracks = {}): Promise<BackgroundExport> {
  try {
    return { ...(await runWorker(file, audio, plan, onProgress, music, faceTracks)), where: 'worker' };
  } catch (workerErr) {
    console.warn('Exportação no Worker falhou; tentando na tela principal.', workerErr);
    return { ...(await exportPlan(media, audio, plan, { onProgress, music, faceTracks })), where: 'main' };
  }
}

function runWorker(file: Blob, audio: DecodedAudio | null, plan: EditPlan, onProgress: (f: number) => void, music: DecodedAudio | null, faceTracks: import('./face-analysis').FaceTracks): Promise<ExportResult> {
  const worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<FromExportWorker>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.fraction);
      if (m.type === 'done') {
        worker.terminate();
        resolve({ blob: new Blob([m.buffer], { type: 'video/mp4' }), degraded: m.degraded, codec: m.codec, fontWarning: m.fontWarning, emojiWarning: m.emojiWarning });
      }
      if (m.type === 'error') {
        worker.terminate();
        reject(new AppError(m.key, m.detail));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new AppError('EXPORTACAO_FALHOU', `worker: ${e.message || describeError(e)}`));
    };
    // cópia do áudio: o original continua com a tela principal (player)
    const copyOf = (a: DecodedAudio | null) => (a ? { channels: a.channels.map((c) => c.slice()), sampleRate: a.sampleRate } : null);
    const copy = copyOf(audio);
    const musicCopy = plan.music ? copyOf(music) : null;
    const msg: ToExportWorker = { type: 'export', file, plan, audio: copy, music: musicCopy, faceTracks };
    worker.postMessage(msg, [copy, musicCopy].flatMap((a) => (a ? a.channels.map((c) => c.buffer) : [])));
  });
}
