import type { Word } from '../core/types';
import type { FromWorker } from './protocol';
import { chunksToWords, type AsrChunk } from './words';

export interface Transcriber {
  transcribe(audio16k: Float32Array, durationSec: number, onProgress: (label: string, fraction: number) => void): Promise<Word[]>;
}

export class WhisperTranscriber implements Transcriber {
  transcribe(audio16k: Float32Array, durationSec: number, onProgress: (label: string, fraction: number) => void): Promise<Word[]> {
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
          reject(new Error(m.message));
        }
      };
      worker.postMessage({ type: 'transcribe', audio: audio16k, language: 'portuguese' }, [audio16k.buffer]);
    });
  }
}

/** Usado só nos testes automáticos (VITE_FAKE_ASR=1): palavras fixas, sem baixar modelo. */
export class FakeTranscriber implements Transcriber {
  constructor(private chunks: AsrChunk[]) {}
  async transcribe(_audio: Float32Array, durationSec: number): Promise<Word[]> {
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
