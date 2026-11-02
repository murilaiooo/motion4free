import { AppError } from '../core/errors';
import type { LanguageCode } from '../core/languages';
import type { TranslationFromWorker, TranslationToWorker } from './protocol';

/**
 * Tradução inteiramente local em um Worker; nenhum áudio ou texto é enviado para APIs de IA.
 * `onDownload`: bytes do modelo baixados até agora (só na primeira vez; depois vem do cache do navegador).
 */
export function translateTexts(
  texts: readonly string[],
  from: LanguageCode,
  to: LanguageCode,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
  onDownload: (loaded: number, total: number) => void = () => undefined,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new AppError('TRADUCAO_FALHOU', 'Tradução cancelada')); return; }
    const worker = new Worker(new URL('./translate.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new AppError('TRADUCAO_FALHOU', 'Tradução cancelada')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => { finish(); reject(new AppError('TRADUCAO_FALHOU', event.message || 'Falha no tradutor local')); };
    worker.onmessage = (event: MessageEvent<TranslationFromWorker>) => {
      const result = event.data;
      if (result.type === 'progress') onProgress(result.done, result.total);
      else if (result.type === 'download') onDownload(result.loaded, result.total);
      else if (result.type === 'done') { finish(); resolve(result.texts); }
      else { finish(); reject(new AppError(result.code, result.message)); }
    };
    const message: TranslationToWorker = { texts: [...texts], from, to };
    worker.postMessage(message);
  });
}
