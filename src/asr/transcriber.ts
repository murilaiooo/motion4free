import { groupPieces, mergeWindows, type RawWord } from '../analysis/asr-merge';
import type { AsrWindow } from '../analysis/asr-windows';
import { ASR_CANDIDATES, asrLadder, estimateMinutes, formatMB, type AsrCandidateId, type AsrMode } from '../core/asr-models';
import { AppError } from '../core/errors';
import { detectAsrCapability } from './capability';
import type { FromWorker } from './protocol';
import type { AsrChunk } from './words';

export interface TranscriptResult {
  /** palavras já juntadas entre janelas, ainda sem a limpeza (feita no pipeline, que conhece os silêncios) */
  words: RawWord[];
  /** nome do modelo que fez a legenda, para mostrar na tela */
  model: string;
  /** avisos que não impedem a legenda (M4F-307: caiu para um modelo mais leve) */
  notices: AppError[];
}

export interface Transcriber {
  /** `mode`: Rápida/Precisa (escada pela capacidade do aparelho) ou uma escada explícita (página ?avaliar). */
  transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: (label: string, fraction: number) => void, mode?: AsrMode | AsrCandidateId[]): Promise<TranscriptResult>;
}

const label = (id: AsrCandidateId) => ASR_CANDIDATES[id].label;

export class WhisperTranscriber implements Transcriber {
  async transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: (label: string, fraction: number) => void, mode: AsrMode | AsrCandidateId[] = 'precisa'): Promise<TranscriptResult> {
    const ladder = Array.isArray(mode) ? mode : asrLadder(mode, await detectAsrCapability());
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    const notices: AppError[] = [];
    const fallbacks: string[] = [];
    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data;
        if (m.type === 'progress' && m.stage === 'download') {
          const c = ASR_CANDIDATES[m.model];
          onProgress(`Baixando o modelo de legenda ${label(m.model)} (cerca de ${formatMB(c.downloadMB)}, só na primeira vez)`, m.fraction);
        }
        if (m.type === 'progress' && m.stage === 'transcribe') {
          onProgress(`Transcrevendo a fala com ${label(m.model)} — trecho ${m.window} de ${m.windows} (uns ${estimateMinutes(m.model, durationSec)} min no total)`, m.fraction);
        }
        if (m.type === 'fallback') {
          fallbacks.push(`${label(m.from)} falhou (${m.detail}); tentei ${label(m.to)}`);
          onProgress(`${label(m.from)} não funcionou aqui; tentando ${label(m.to)}`, 0);
        }
        if (m.type === 'done') {
          worker.terminate();
          if (fallbacks.length > 0) notices.push(new AppError('MODELO_RESERVA', `${fallbacks.join(' | ')}. Legenda feita com ${label(m.model)}.`));
          resolve({ words: mergeWindows(m.results, durationSec), model: label(m.model), notices });
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
      worker.postMessage({ type: 'transcribe', audio: audio16k, language: 'portuguese', windows, ladder }, [audio16k.buffer]);
    });
  }
}

/**
 * Usado só nos testes automáticos (VITE_FAKE_ASR=1): palavras fixas, sem baixar modelo.
 * `fail` simula falha de rede; `fallback` simula o modelo preciso falhando e o leve assumindo (M4F-307).
 */
export class FakeTranscriber implements Transcriber {
  constructor(
    private chunks: AsrChunk[],
    private fail = false,
    private fallback = false,
  ) {}
  async transcribe(_audio: Float32Array, durationSec: number): Promise<TranscriptResult> {
    if (this.fail) throw new AppError('MODELO_REDE', 'servidor huggingface.co: TypeError: Failed to fetch (simulado)');
    const words = groupPieces(this.chunks).filter((w) => w.start < durationSec);
    const notices = this.fallback
      ? [new AppError('MODELO_RESERVA', `${label('turbo-webgpu')} falhou (M4F-302 simulado); tentei ${label('small-wasm')}. Legenda feita com ${label('small-wasm')}.`)]
      : [];
    return { words, model: label(this.fallback ? 'small-wasm' : 'turbo-webgpu'), notices };
  }
}

export const FAKE_CHUNKS: AsrChunk[] = [
  { text: ' Três', timestamp: [0.1, 0.5] },
  { text: ' dicas', timestamp: [0.5, 0.9] },
  { text: ' rápidas.', timestamp: [0.9, 1.4] },
  { text: ' Primeira', timestamp: [3.1, 3.6] },
  { text: ' dica.', timestamp: [3.6, 4.2] },
];
