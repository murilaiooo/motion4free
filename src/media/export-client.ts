import { AppError, describeError } from '../core/errors';
import type { EditPlan } from '../core/types';
import type { FaceTrack } from '../render/framing';
import { exportPlan, outputAudio, type ExportResult, type OutputAudio } from './export';
import type { FromExportWorker, ToExportWorker } from './export-protocol';
import type { ClipSource } from './sources';
import type { ClipAudio } from './splice';

export interface BackgroundExport extends ExportResult {
  /** Onde rodou: 'worker' (normal) ou 'main' (reserva quando o Worker não funciona neste navegador). */
  where: 'worker' | 'main';
}

/** O que a exportação precisa de cada clipe: o arquivo (Worker) e o vídeo já aberto (reserva na tela). */
export interface ExportClip {
  id: string;
  file: Blob;
  source: ClipSource;
}

/**
 * Exporta num Worker para a tela não travar. Se o Worker não iniciar ou falhar,
 * tenta de novo na tela principal (mais lento para a interface, mesmo resultado).
 * O áudio é emendado aqui (só o do vídeo final vai para o Worker, não o de todos os clipes).
 */
export async function exportInBackground(clips: ExportClip[], tracks: Record<string, FaceTrack | null>, audio: ClipAudio | null, plan: EditPlan, onProgress: (f: number) => void): Promise<BackgroundExport> {
  const used = clips.filter((c) => plan.clips.some((p) => p.id === c.id));
  try {
    return { ...(await runWorker(used, tracks, outputAudio(audio, plan), plan, onProgress)), where: 'worker' };
  } catch (workerErr) {
    if (workerErr instanceof AppError && workerErr.key === 'EXPORTACAO_CLIPE') throw workerErr;
    console.warn('Exportação no Worker falhou; tentando na tela principal.', workerErr);
    const byId = new Map(used.map((c) => [c.id, c.source]));
    const open = async (id: string) => {
      const s = byId.get(id);
      if (!s) throw new AppError('EXPORTACAO_CLIPE', `clipe ${id} sem arquivo`);
      return s;
    };
    return { ...(await exportPlan({ open, tracks }, outputAudio(audio, plan), plan, { onProgress })), where: 'main' };
  }
}

function runWorker(clips: ExportClip[], tracks: Record<string, FaceTrack | null>, audio: OutputAudio | null, plan: EditPlan, onProgress: (f: number) => void): Promise<ExportResult> {
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
    // o áudio do vídeo final é transferido (não copiado): foi feito só para esta exportação
    const msg: ToExportWorker = { type: 'export', clips: clips.map((c) => ({ id: c.id, file: c.file })), tracks, plan, audio };
    worker.postMessage(msg, audio ? audio.channels.map((c) => c.buffer) : []);
  });
}
