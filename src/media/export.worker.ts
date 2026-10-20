/// <reference lib="webworker" />
import { AppError, toAppError } from '../core/errors';
import { exportPlan } from './export';
import type { FromExportWorker, ToExportWorker } from './export-protocol';
import { openMedia } from './input';

/** Exportação fora da tela principal: o Worker abre cada clipe na sua vez e gera o MP4 sem travar a interface. */
const post = (m: FromExportWorker, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

self.onmessage = async (e: MessageEvent<ToExportWorker>) => {
  try {
    const { clips, tracks, plan, audio } = e.data;
    const files = new Map(clips.map((c) => [c.id, c.file]));
    const open = async (id: string) => {
      const file = files.get(id);
      if (!file) throw new AppError('EXPORTACAO_CLIPE', `clipe ${id} sem arquivo`);
      const media = await openMedia(file, { maxSec: Infinity });
      return { id, video: media.video, width: media.width, height: media.height, dispose: () => media.input.dispose() };
    };
    const out = await exportPlan({ open, tracks }, audio, plan, { onProgress: (fraction) => post({ type: 'progress', fraction }) });
    const buffer = await out.blob.arrayBuffer();
    post({ type: 'done', buffer, degraded: out.degraded, codec: out.codec, fontWarning: out.fontWarning, emojiWarning: out.emojiWarning }, [buffer]);
  } catch (err) {
    const app = toAppError(err, 'EXPORTACAO_FALHOU');
    post({ type: 'error', key: app.key, detail: app.detail });
  }
};
