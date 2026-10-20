import { AppError } from '../core/errors';
import type { TimeRange, Word } from '../core/types';
import type { FromWorker } from './protocol';
import { chunksToWords, type AsrChunk } from './words';

export interface Transcriber {
  transcribe(audio16k: Float32Array, durationSec: number, windows: TimeRange[], onProgress: (label: string, fraction: number) => void): Promise<Word[]>;
}

export class WhisperTranscriber implements Transcriber {
  transcribe(audio16k: Float32Array, durationSec: number, windows: TimeRange[], onProgress: (label: string, fraction: number) => void): Promise<Word[]> {
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data;
        if (m.type === 'progress') onProgress(m.stage === 'download' ? 'Baixando o modelo de transcrição (só na primeira vez)' : 'Transcrevendo a fala', m.fraction);
        if (m.type === 'done') {
          worker.terminate();
          resolve(chunksToWords(m.chunks, durationSec));
        }
        if (m.type === 'error') {
          worker.terminate();
          reject(new AppError(m.key, m.detail));
        }
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(new AppError('WORKER_FALHOU', `${e.message || 'sem mensagem'} ${e.filename ?? ''}:${e.lineno ?? ''}`));
      };
      worker.postMessage({ type: 'transcribe', audio: audio16k, language: 'portuguese', windows }, [audio16k.buffer]);
    });
  }
}

/** Fala mais longa para as capturas de tela da interface (`?asr=demo`, só no build de teste). */
export const FAKE_DEMO_CHUNKS: AsrChunk[] = (() => {
  const a = 'Três dicas rápidas para gravar melhor com o celular hoje mesmo'.split(' ');
  const cut = 'éé tipo assim né'.split(' ');
  const b = 'Primeira dica: luz de janela sempre na frente do rosto'.split(' ');
  const spread = (words: string[], from: number, to: number) => words.map((w, i) => ({ text: ` ${w}`, timestamp: [from + ((to - from) * i) / words.length, from + ((to - from) * (i + 1)) / words.length] as [number, number] }));
  return [...spread(a, 0.1, 1.35), ...spread(cut, 1.6, 2.8), ...spread(b, 3.05, 4.25)];
})();

/** Usado só nos testes automáticos (VITE_FAKE_ASR=1): palavras fixas, sem baixar modelo. `fail` simula falha de rede. */
export class FakeTranscriber implements Transcriber {
  constructor(
    private chunks: AsrChunk[],
    private fail = false,
  ) {}
  async transcribe(_audio: Float32Array, durationSec: number): Promise<Word[]> {
    if (this.fail) throw new AppError('MODELO_REDE', 'servidor huggingface.co: TypeError: Failed to fetch (simulado)');
    return chunksToWords(this.chunks, durationSec);
  }
}

export const FAKE_CHUNKS: AsrChunk[] = [
  { text: ' Três', timestamp: [0.1, 0.5] },
  { text: ' dicas', timestamp: [0.5, 0.9] },
  { text: ' rápidas.', timestamp: [0.9, 1.4] },
  { text: ' Primeira', timestamp: [3.1, 3.6] },
  { text: ' dica.', timestamp: [3.6, 4.2] },
];
