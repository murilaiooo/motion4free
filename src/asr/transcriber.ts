import { groupPieces, mergeWindows, type RawWord } from '../analysis/asr-merge';
import type { AsrWindow } from '../analysis/asr-windows';
import { crossCheck } from '../analysis/asr-crosscheck';
import { ASR_CANDIDATES, checkLadder, estimateMinutes, modelWhereLabel, requestChecks, requestIsAuto, requestLadder, type AsrCandidateId, type AsrRequest } from '../core/asr-models';
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
  /**
   * `mode`: Rápida/Precisa (escada pela capacidade do aparelho), uma escada explícita (cardápio, página ?avaliar),
   * ou um desses com a conferência dupla ligada (`{ ladder, check: true }`).
   */
  transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress, mode?: AsrRequest): Promise<TranscriptResult>;
}

const label = (id: AsrCandidateId) => ASR_CANDIDATES[id].label;

interface LadderRun {
  words: RawWord[];
  model: AsrCandidateId;
  fallbacks: string[];
}

/**
 * Roda uma escada de modelos num Worker novo. `check`: é a segunda passada da conferência dupla, e os textos
 * de progresso dizem "Conferindo" em vez de "Transcrevendo". O áudio é transferido ao Worker (fica vazio aqui).
 */
function runLadder(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress, ladder: AsrCandidateId[], check = false): Promise<LadderRun> {
  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  const fallbacks: string[] = [];
  const tag = check ? 'conferir-' : '';
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'progress' && m.stage === 'download') {
        const c = ASR_CANDIDATES[m.model];
        const why = check ? ' para conferir a legenda' : '';
        onProgress({
          label: m.cached ? `Carregando o modelo de legenda ${label(m.model)}${why}, já guardado neste aparelho` : `Baixando o modelo de legenda ${label(m.model)}${why} (só na primeira vez)`,
          phase: `${tag}modelo-${m.model}`,
          fraction: m.fraction,
          // sem o tamanho do servidor, usa o tamanho conhecido do modelo
          bytes: { loaded: m.loaded, total: m.total > 0 ? m.total : c.downloadMB * 1024 * 1024 },
        });
      }
      if (m.type === 'progress' && m.stage === 'prepare') {
        onProgress({ label: `Preparando o modelo ${label(m.model)} para ${check ? 'conferir' : 'transcrever'} (pode levar até 1 min sem mexer a barra)`, phase: `${tag}preparar-${m.model}`, fraction: null });
      }
      if (m.type === 'progress' && m.stage === 'transcribe') {
        onProgress({
          label: check ? `Conferindo a legenda com uma segunda IA (${label(m.model)})` : `Transcrevendo a fala com ${label(m.model)}`,
          phase: `${tag}transcrever-${m.model}`,
          fraction: m.fraction,
          detail: `trecho ${m.window} de ${m.windows} · ${formatClock(m.doneSec)} de ${formatClock(m.totalSec)} de fala ouvidos`,
          expectedSec: estimateMinutes(m.model, durationSec) * 60,
        });
      }
      if (m.type === 'fallback') {
        fallbacks.push(`${label(m.from)} falhou (${m.detail}); tentei ${label(m.to)}`);
        onProgress({ label: `${label(m.from)} não funcionou aqui; tentando ${label(m.to)}`, phase: `${tag}reserva-${m.to}`, fraction: null });
      }
      if (m.type === 'done') {
        worker.terminate();
        resolve({ words: mergeWindows(m.results, durationSec), model: m.model, fallbacks });
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

export class WhisperTranscriber implements Transcriber {
  async transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress, mode: AsrRequest = 'precisa'): Promise<TranscriptResult> {
    // A placa de vídeo é detectada aqui, sem a pessoa escolher: dedicada > integrada > processador (v0.36).
    const capability = await detectAsrCapability();
    const ladder = requestLadder(mode, capability);
    const check = requestChecks(mode);
    const notices: AppError[] = [];
    if (requestIsAuto(mode) && !capability.webgpu) notices.push(new AppError('SEM_PLACA_VIDEO', 'sem WebGPU neste navegador (ou só o adaptador de software); a legenda foi feita no processador (WASM)'));
    // a segunda passada precisa do áudio de novo: o Worker fica com o original
    const again = check ? audio16k.slice() : null;
    const first = await runLadder(audio16k, durationSec, windows, onProgress, ladder);
    if (first.fallbacks.length > 0) notices.push(new AppError('MODELO_RESERVA', `${first.fallbacks.join(' | ')}. Legenda feita com ${label(first.model)}.`));
    let words = first.words;
    let model = modelWhereLabel(first.model, capability);
    if (again) {
      const second = checkLadder(first.model, capability);
      if (second.length === 0) {
        notices.push(new AppError('CONFERENCIA_FALHOU', `não há segunda IA de outra família que rode neste aparelho (legenda feita com ${label(first.model)})`));
      } else {
        try {
          const other = await runLadder(again, durationSec, windows, onProgress, second, true);
          const r = crossCheck(words, other.words);
          const pct = Math.round(r.disagreement * 100);
          if (r.ignored) {
            notices.push(new AppError('CONFERENCIA_FALHOU', `${label(other.model)} discordou de ${pct}% das palavras, sinal de que ouviu outra coisa (outro idioma ou ruído); nada foi marcado`));
          } else {
            words = r.words;
            model = `${model} · conferida com ${label(other.model).replace(/ \(.*\)$/, '')}`;
            if (r.flagged > 0) notices.push(new AppError('CONFERENCIA_REVISAR', `${r.flagged} palavra(s) em que ${label(first.model)} e ${label(other.model)} discordaram (${pct}% das palavras); veja em Legendas › Revisar palavras sinalizadas`));
          }
        } catch (err) {
          const e = err instanceof AppError ? err : new AppError('TRANSCRICAO_FALHOU');
          notices.push(new AppError('CONFERENCIA_FALHOU', `a segunda IA não rodou (${e.code}: ${e.detail ?? e.title}); a legenda ficou só com ${label(first.model)}`.slice(0, 600)));
        }
      }
    }
    return { words, model, notices };
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
