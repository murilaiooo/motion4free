/// <reference lib="webworker" />
import { toAppError } from '../core/errors';
import { exportPlan } from './export';
import type { FromExportWorker, ToExportWorker } from './export-protocol';
import { openMedia } from './input';

/** Exportação fora da tela principal: o Worker abre o vídeo e gera o MP4 sem travar a interface. */
const post = (m: FromExportWorker, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

self.onmessage = async (e: MessageEvent<ToExportWorker>) => {
  try {
    const { file, plan, audio, music } = e.data;
    const media = await openMedia(file);
    const out = await exportPlan(media, audio, plan, { music, onProgress: (fraction) => post({ type: 'progress', fraction }) });
    const buffer = await out.blob.arrayBuffer();
    post({ type: 'done', buffer, degraded: out.degraded, codec: out.codec, fontWarning: out.fontWarning, emojiWarning: out.emojiWarning }, [buffer]);
  } catch (err) {
    const app = toAppError(err, 'EXPORTACAO_FALHOU');
    post({ type: 'error', key: app.key, detail: app.detail });
  }
};
