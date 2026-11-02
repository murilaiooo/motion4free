/** Tradução inteiramente local em um Worker; nenhum áudio ou texto é enviado para APIs de IA. */
export function translateEnglishToPortuguese(
  texts: readonly string[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Tradução cancelada')); return; }
    const worker = new Worker(new URL('./en-pt.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new Error('Tradução cancelada')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => { finish(); reject(new Error(event.message || 'Falha no tradutor local')); };
    worker.onmessage = (event: MessageEvent<{ type: 'progress' | 'done' | 'error'; done?: number; total?: number; texts?: string[]; message?: string }>) => {
      const result = event.data;
      if (result.type === 'progress') onProgress(result.done ?? 0, result.total ?? texts.length);
      if (result.type === 'done') { finish(); resolve(result.texts ?? []); }
      if (result.type === 'error') { finish(); reject(new Error(result.message || 'Falha ao traduzir legendas')); }
    };
    worker.postMessage({ texts });
  });
}
