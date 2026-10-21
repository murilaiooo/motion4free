import { formatBytes } from './bytes';

/**
 * Progresso detalhado (v0.23, ADR-0024): o que está acontecendo, quanto já foi, há quanto tempo,
 * quanto falta e, em downloads, a velocidade e o tamanho. Um formato só para todas as etapas demoradas
 * (baixar modelos, abrir vídeo, ler áudio, transcrever, analisar, gerar MP4, salvar cópia).
 * Puro: o relógio vem de fora, para os testes.
 */

export interface ByteProgress {
  loaded: number;
  /** null quando o servidor não diz o tamanho */
  total: number | null;
}

export interface Progress {
  /** o que está fazendo agora, em palavras simples */
  label: string;
  /** 0..1; null quando não dá para saber o total (aí só o tempo passado aparece) */
  fraction: number | null;
  /** etapa: quando muda, a estimativa de tempo recomeça. Padrão: o texto sem os números. */
  phase?: string;
  /** detalhe curto ("trecho 3 de 20", "clipe 2 de 5") */
  detail?: string;
  /** bytes baixados ou gravados: dão a velocidade e o "120 MB de 1,4 GB" */
  bytes?: ByteProgress;
  /** duração esperada da etapa (s), usada como "falta" até haver medida real */
  expectedSec?: number;
}

/** Callback único das etapas demoradas. */
export type OnProgress = (p: Progress) => void;

export interface ProgressSnapshot {
  progress: Progress;
  /** fração limitada a 0..1, ou null (indeterminado) */
  fraction: number | null;
  /** tempo desde o começo da tarefa inteira */
  elapsedSec: number;
  /** tempo desde o começo da etapa atual */
  phaseElapsedSec: number;
  /** quanto falta nesta etapa; null = ainda calculando ou sem total */
  etaSec: number | null;
  /** a estimativa vem só da previsão (expectedSec), ainda não da medida */
  etaGuess: boolean;
  /** bytes por segundo nos últimos segundos; null sem bytes */
  bytesPerSec: number | null;
  /** segundos sem nenhuma atualização (mostra "sem resposta há…" quando passa de STALL_SEC) */
  idleSec: number;
}

const FRACTION_WINDOW_MS = 30_000;
const SPEED_WINDOW_MS = 5_000;
const MIN_ETA_MS = 1_500;
const MIN_ETA_GAIN = 0.005;
/** a partir daqui a tela avisa que a etapa está sem dar sinal */
export const STALL_SEC = 45;

export function phaseOf(p: Progress): string {
  return p.phase ?? p.label.replace(/\d+([.,]\d+)?/g, '#');
}

export function clampFraction(f: number | null | undefined): number | null {
  if (f === null || f === undefined || !Number.isFinite(f)) return null;
  return Math.min(1, Math.max(0, f));
}

interface Sample {
  t: number;
  v: number;
}

/** Guarda as amostras de uma tarefa e calcula tempo passado, tempo restante e velocidade. */
export class ProgressClock {
  private readonly started: number;
  private phase: string | null = null;
  private phaseStart = 0;
  private fractions: Sample[] = [];
  private bytes: Sample[] = [];
  private eta: { at: number; sec: number } | null = null;
  private lastAt = 0;
  private last: Progress | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {
    this.started = now();
  }

  update(p: Progress): void {
    const t = this.now();
    const phase = phaseOf(p);
    if (phase !== this.phase) {
      this.phase = phase;
      this.phaseStart = t;
      this.fractions = [];
      this.bytes = [];
      this.eta = null;
    }
    const f = clampFraction(p.fraction);
    if (f === null) {
      this.fractions = [];
      this.eta = null;
    } else {
      const prev = this.fractions[this.fractions.length - 1];
      // a fração voltou (outro arquivo, nova tentativa): a medida antiga não vale mais
      if (prev && f < prev.v) {
        this.fractions = [];
        this.eta = null;
      }
      this.fractions.push({ t, v: f });
      while (this.fractions.length > 2 && t - this.fractions[0]!.t > FRACTION_WINDOW_MS) this.fractions.shift();
      const first = this.fractions[0]!;
      const dt = t - first.t;
      const df = f - first.v;
      if (f >= 1) this.eta = { at: t, sec: 0 };
      else if (dt >= MIN_ETA_MS && df >= MIN_ETA_GAIN) {
        const raw = (dt * (1 - f)) / df / 1000;
        const before = this.eta ? Math.max(0, this.eta.sec - (t - this.eta.at) / 1000) : null;
        // suaviza: o número não pula a cada atualização
        this.eta = { at: t, sec: before === null ? raw : before * 0.6 + raw * 0.4 };
      }
    }
    if (p.bytes) {
      this.bytes.push({ t, v: p.bytes.loaded });
      while (this.bytes.length > 2 && t - this.bytes[0]!.t > SPEED_WINDOW_MS) this.bytes.shift();
    }
    this.last = p;
    this.lastAt = t;
  }

  snapshot(): ProgressSnapshot | null {
    const p = this.last;
    if (!p) return null;
    const t = this.now();
    const fraction = clampFraction(p.fraction);
    const phaseElapsedSec = (t - this.phaseStart) / 1000;
    let etaSec: number | null = null;
    let etaGuess = false;
    if (fraction !== null && this.eta) etaSec = Math.max(0, this.eta.sec - (t - this.eta.at) / 1000);
    else if (p.expectedSec !== undefined && p.expectedSec > 0) {
      // passou da previsão: melhor dizer "calculando" do que um "quase pronto" que não acaba
      const left = p.expectedSec - phaseElapsedSec;
      if (left > 0) {
        etaSec = left;
        etaGuess = true;
      }
    }
    let bytesPerSec: number | null = null;
    if (p.bytes) {
      const a = this.bytes[0];
      const b = this.bytes[this.bytes.length - 1];
      if (a && b && b.t - a.t >= 500) bytesPerSec = Math.max(0, (b.v - a.v) / ((b.t - a.t) / 1000));
      // nada chegou nos últimos segundos: a velocidade real agora é zero
      if (t - this.lastAt > SPEED_WINDOW_MS) bytesPerSec = 0;
    }
    return {
      progress: p,
      fraction,
      elapsedSec: (t - this.started) / 1000,
      phaseElapsedSec,
      etaSec,
      etaGuess,
      bytesPerSec,
      idleSec: (t - this.lastAt) / 1000,
    };
  }
}

/** "8 s", "3 min 05 s", "1 h 02 min". */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
}

/** Tempo restante, sem fingir precisão: "calculando…", "quase pronto", "cerca de 40 s", "cerca de 4 min". */
export function formatEta(sec: number | null): string {
  if (sec === null) return 'calculando…';
  if (sec < 5) return 'quase pronto';
  if (sec < 60) return `cerca de ${Math.ceil(sec / 5) * 5} s`;
  if (sec < 600) {
    const half = Math.ceil(sec / 30) / 2;
    return `cerca de ${String(half).replace('.', ',')} min`;
  }
  if (sec < 3600) return `cerca de ${Math.ceil(sec / 60)} min`;
  return `cerca de ${formatDuration(Math.ceil(sec / 60) * 60)}`;
}

/** "820 KB/s", "3,4 MB/s". */
export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

/** Linhas de detalhe mostradas embaixo da barra (mesma ordem em todo o app). */
export function progressFacts(s: ProgressSnapshot): string[] {
  const out: string[] = [];
  out.push(`Passou ${formatDuration(s.elapsedSec)}`);
  if (s.fraction !== null || s.etaSec !== null) out.push(`Falta ${formatEta(s.etaSec)}${s.etaGuess ? ' (previsão)' : ''}`);
  const b = s.progress.bytes;
  if (b) {
    out.push(b.total ? `${formatBytes(b.loaded)} de ${formatBytes(b.total)}` : `${formatBytes(b.loaded)} baixados`);
    if (s.bytesPerSec !== null) out.push(formatSpeed(s.bytesPerSec));
  }
  return out;
}

/** Geração do MP4: depois dos quadros (0,95 em export.ts) vem o fechamento do arquivo. Mesma etapa: o "falta" continua. */
export function exportProgress(fraction: number, label = 'Gerando o vídeo'): Progress {
  return { label: fraction >= 0.95 && fraction < 1 ? 'Fechando o arquivo MP4' : label, phase: 'exportar', fraction };
}

/** Quanto de um clipe do criador de clipes já foi: recortar ≈ 20%, montar, gerar o MP4 ≈ 80%. */
export function clipJobFraction(p: Progress): number {
  const f = clampFraction(p.fraction) ?? 0;
  if (p.phase === 'recortar') return f * 0.2;
  if (p.phase === 'exportar') return 0.2 + f * 0.8;
  return 0.2;
}
