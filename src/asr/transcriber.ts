import { groupPieces, mergeWindows, type RawWord } from '../analysis/asr-merge';
import type { AsrWindow } from '../analysis/asr-windows';
import { ASR_CANDIDATES, asrLadder, estimateMinutes, type AsrCandidateId, type AsrMode } from '../core/asr-models';
import { AppError } from '../core/errors';
import { formatClock } from '../core/bytes';
import type { OnProgress } from '../core/progress';
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
  transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress, mode?: AsrMode | AsrCandidateId[]): Promise<TranscriptResult>;
}

const label = (id: AsrCandidateId) => ASR_CANDIDATES[id].label;

export class WhisperTranscriber implements Transcriber {
  async transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress, mode: AsrMode | AsrCandidateId[] = 'precisa'): Promise<TranscriptResult> {
    const ladder = Array.isArray(mode) ? mode : asrLadder(mode, await detectAsrCapability());
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    const notices: AppError[] = [];
    const fallbacks: string[] = [];
    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data;
        if (m.type === 'progress' && m.stage === 'download') {
          const c = ASR_CANDIDATES[m.model];
          onProgress({
            label: m.cached ? `Carregando o modelo de legenda ${label(m.model)}, já guardado neste aparelho` : `Baixando o modelo de legenda ${label(m.model)} (só na primeira vez)`,
            phase: `modelo-${m.model}`,
            fraction: m.fraction,
            // sem o tamanho do servidor, usa o tamanho conhecido do modelo
            bytes: { loaded: m.loaded, total: m.total > 0 ? m.total : c.downloadMB * 1024 * 1024 },
          });
        }
        if (m.type === 'progress' && m.stage === 'prepare') {
          onProgress({ label: `Preparando o modelo ${label(m.model)} para transcrever (pode levar até 1 min sem mexer a barra)`, phase: `preparar-${m.model}`, fraction: null });
        }
        if (m.type === 'progress' && m.stage === 'transcribe') {
          onProgress({
            label: `Transcrevendo a fala com ${label(m.model)}`,
            phase: `transcrever-${m.model}`,
            fraction: m.fraction,
            detail: `trecho ${m.window} de ${m.windows} · ${formatClock(m.doneSec)} de ${formatClock(m.totalSec)} de fala ouvidos`,
            expectedSec: estimateMinutes(m.model, durationSec) * 60,
          });
        }
        if (m.type === 'fallback') {
          fallbacks.push(`${label(m.from)} falhou (${m.detail}); tentei ${label(m.to)}`);
          onProgress({ label: `${label(m.from)} não funcionou aqui; tentando ${label(m.to)}`, phase: `reserva-${m.to}`, fraction: null });
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

/** Fala mais longa para as capturas de tela da interface (`?asr=demo`, só no build de teste). */
export const FAKE_DEMO_CHUNKS: AsrChunk[] = (() => {
  const a = 'Três dicas rápidas para gravar melhor com o celular hoje mesmo'.split(' ');
  const cut = 'éé tipo assim né'.split(' ');
  const b = 'Primeira dica: luz de janela sempre na frente do rosto'.split(' ');
  const spread = (words: string[], from: number, to: number) => words.map((w, i) => ({ text: ` ${w}`, timestamp: [from + ((to - from) * i) / words.length, from + ((to - from) * (i + 1)) / words.length] as [number, number] }));
  return [...spread(a, 0.1, 1.35), ...spread(cut, 1.6, 2.8), ...spread(b, 3.05, 4.25)];
})();

/** Test-only 122-second transcript for exercising complete Clip Creator navigation.
 * It is reachable exclusively through VITE_FAKE_ASR=1 and ?asr=clips.
 * Matching speech is produced by e2e/prepare-clip-qa-video.ps1.
 * This tests UI/clip pipeline integration, never real ASR accuracy.
 */
export const FAKE_CLIP_CHUNKS: AsrChunk[] = (() => {
  const passage = 'Welcome to the Motion for Free editing demonstration. Today we have a short story with a clear beginning, middle and conclusion. First, imagine that your team has a difficult problem and you need to explain it in simple words. The challenge is that every short video must contain its own context. Next, you need to show what changed and why that change makes a difference. The key result is that each video should be clear enough for a person watching it for the first time. Finally, always check the beginning and the ending before exporting your clip.';
  const spoken = passage.split(/\s+/);
  return Array.from({ length: 4 }, (_, repeat) =>
    spoken.map((text, index) => {
      const from = repeat * 30.5 + index * 30.5 / spoken.length;
      return { text: ' ' + text, timestamp: [from, from + 0.24] as [number, number] };
    })
  ).flat();
})();

/**
 * Usado só nos testes automáticos (VITE_FAKE_ASR=1): palavras fixas, sem baixar modelo.
 * `fail` simula falha de rede; `fallback` simula o modelo preciso falhando e o leve assumindo (M4F-307).
 */
export class FakeTranscriber implements Transcriber {
  constructor(
    private chunks: AsrChunk[],
    private fail = false,
    private fallback = false,
    private labelOverride: string | null = null,
  ) {}
  async transcribe(_audio: Float32Array, durationSec: number): Promise<TranscriptResult> {
    if (this.fail) throw new AppError('MODELO_REDE', 'servidor huggingface.co: TypeError: Failed to fetch (simulado)');
    const words = groupPieces(this.chunks).filter((w) => w.start < durationSec);
    const notices = this.fallback
      ? [new AppError('MODELO_RESERVA', `${label('turbo-webgpu')} falhou (M4F-302 simulado); tentei ${label('small-wasm')}. Legenda feita com ${label('small-wasm')}.`)]
      : [];
    return { words, model: this.labelOverride ?? label(this.fallback ? 'small-wasm' : 'turbo-webgpu'), notices };
  }
}

export const FAKE_CHUNKS: AsrChunk[] = [
  { text: ' Três', timestamp: [0.1, 0.5] },
  { text: ' dicas', timestamp: [0.5, 0.9] },
  { text: ' rápidas.', timestamp: [0.9, 1.4] },
  { text: ' Primeira', timestamp: [3.1, 3.6] },
  { text: ' dica.', timestamp: [3.6, 4.2] },
];
