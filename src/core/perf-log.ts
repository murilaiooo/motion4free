/**
 * Medições reais de desempenho neste aparelho (#170, #173). Cada transcrição e cada resposta da IA local
 * que acontece de verdade grava quanto tempo levou; nada é estimado nem enviado. A pessoa copia o relatório
 * (Configurações › Transcrição) e manda junto do teste. Camada pura: guardar fica em `app/perf-store.ts`.
 */

export interface AsrPerfEntry {
  kind: 'asr';
  /** quando terminou (ISO) */
  at: string;
  /** id do modelo que fez o trabalho (ASR_CANDIDATES) */
  model: string;
  /** 'webgpu' ou 'wasm', como o Worker informou */
  device: string;
  /** segunda passada da conferência dupla */
  check: boolean;
  /** idioma pedido (auto/pt/en/es/ru) */
  language: string;
  /** segundos de fala ouvidos (as janelas só de silêncio não contam); 0 se não chegou a transcrever */
  speechSec: number;
  /** do início até o modelo começar a ouvir: download (se houver) + montar o modelo */
  loadSec: number;
  /** só a parte de ouvir a fala */
  inferSec: number;
  /** o modelo já estava guardado neste aparelho */
  cached: boolean | null;
  /** modelos que falharam antes deste */
  fallbacks: number;
  /** código M4F quando falhou */
  error?: string;
}

export interface LlmPerfEntry {
  kind: 'llm';
  at: string;
  /** chave do modelo (LLM_MODELS) */
  model: string;
  /** carregar o modelo (só na primeira resposta depois de abrir), em segundos */
  loadSec: number | null;
  promptTokens: number | null;
  replyTokens: number | null;
  /** fichas por segundo lendo o pedido e escrevendo a resposta, como o WebLLM mede */
  prefillPerSec: number | null;
  decodePerSec: number | null;
  totalSec: number;
  error?: string;
}

export type PerfEntry = AsrPerfEntry | LlmPerfEntry;

export interface PerfDevice {
  app: string;
  browser: string;
  gpu: string;
  webgpu: boolean;
  f16: boolean;
  /** RAM informada pelo navegador (navigator.deviceMemory, limitada a 8): não é a memória da placa */
  memoryGB: number | null;
}

export const PERF_MAX_ENTRIES = 40;

/** Junta uma medição nova (as mais novas primeiro) e descarta as antigas. */
export function addPerfEntry(list: readonly PerfEntry[], entry: PerfEntry, max = PERF_MAX_ENTRIES): PerfEntry[] {
  return [entry, ...list].slice(0, max);
}

/** Quantas vezes mais rápido que o tempo real (1 min de fala em 15 s = 4×). null sem dados. */
export function speedVsRealTime(e: AsrPerfEntry): number | null {
  if (e.error || e.speechSec <= 0 || e.inferSec <= 0) return null;
  return e.speechSec / e.inferSec;
}

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const num = (n: number | null, d = 1) => (n === null || !Number.isFinite(n) ? '-' : String(round(n, d)));

/** Lê o que veio guardado; descarta o que não tem o formato. Nunca lança. */
export function parsePerfEntries(raw: unknown): PerfEntry[] {
  if (!Array.isArray(raw)) return [];
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const numOrNull = (v: unknown) => v === null || finite(v);
  return raw.filter((e): e is PerfEntry => {
    if (!e || typeof e !== 'object') return false;
    const o = e as Record<string, unknown>;
    if (typeof o.at !== 'string' || typeof o.model !== 'string') return false;
    if (o.error !== undefined && typeof o.error !== 'string') return false;
    if (o.kind === 'asr') return typeof o.device === 'string' && typeof o.check === 'boolean' && typeof o.language === 'string' && finite(o.speechSec) && finite(o.loadSec) && finite(o.inferSec) && (o.cached === null || typeof o.cached === 'boolean') && finite(o.fallbacks);
    if (o.kind === 'llm') return numOrNull(o.loadSec) && numOrNull(o.promptTokens) && numOrNull(o.replyTokens) && numOrNull(o.prefillPerSec) && numOrNull(o.decodePerSec) && finite(o.totalSec);
    return false;
  }).slice(0, PERF_MAX_ENTRIES);
}

/** Uma linha curta para a lista na tela, no idioma da interface (texto montado: o dicionário não o alcança). */
export function perfLine(e: PerfEntry, locale: 'pt' | 'en' = 'pt'): string {
  const en = locale === 'en';
  if (e.kind === 'asr') {
    const speed = speedVsRealTime(e);
    const what = e.check ? (en ? 'check pass' : 'conferência') : en ? 'transcription' : 'transcrição';
    if (e.error) return `${what} · ${e.model} (${e.device}) · ${en ? 'failed' : 'falhou'} ${e.error}`;
    const load = `${en ? 'load' : 'carregar'} ${num(e.loadSec)} s`;
    const rt = speed ? ` (${num(speed)}× ${en ? 'real time' : 'o tempo real'})` : '';
    return `${what} · ${e.model} (${e.device}) · ${num(e.speechSec, 0)} s ${en ? 'of speech in' : 'de fala em'} ${num(e.inferSec)} s${rt} · ${load}`;
  }
  const who = en ? 'local AI' : 'IA local';
  if (e.error) return `${who} · ${e.model} · ${en ? 'failed' : 'falhou'} ${e.error}`;
  const load = e.loadSec !== null ? ` · ${en ? 'load' : 'carregar'} ${num(e.loadSec)} s` : '';
  return `${who} · ${e.model} · ${num(e.decodePerSec)} ${en ? 'tokens/s writing' : 'fichas/s escrevendo'} · ${en ? 'reply in' : 'resposta em'} ${num(e.totalSec)} s${load}`;
}

/**
 * Relatório em texto (inglês, para colar numa issue). Só modelo, tempos e o aparelho: nenhum nome de arquivo,
 * texto da legenda, pedido ou chave.
 */
export function perfReport(device: PerfDevice, entries: readonly PerfEntry[]): string {
  const head = [
    `Motion4Free performance report (${device.app})`,
    `Browser: ${device.browser}`,
    `GPU: ${device.gpu} · WebGPU ${device.webgpu ? 'yes' : 'no'} · shader-f16 ${device.f16 ? 'yes' : 'no'} · RAM reported by browser ${device.memoryGB === null ? 'unknown' : `${device.memoryGB} GB`} (not VRAM)`,
    '',
  ];
  if (entries.length === 0) return [...head, 'No measurements yet.'].join('\n');
  const asr = entries.filter((e): e is AsrPerfEntry => e.kind === 'asr');
  const llm = entries.filter((e): e is LlmPerfEntry => e.kind === 'llm');
  const lines = [...head];
  if (asr.length) {
    lines.push('Speech recognition: when | model | device | pass | lang | speech s | load s | infer s | x real time | cached | fallbacks | error');
    for (const e of asr) {
      lines.push([e.at, e.model, e.device, e.check ? 'check' : 'main', e.language, num(e.speechSec, 0), num(e.loadSec), num(e.inferSec), num(speedVsRealTime(e)), e.cached === null ? '-' : e.cached ? 'yes' : 'no', String(e.fallbacks), e.error ?? ''].join(' | '));
    }
    lines.push('');
  }
  if (llm.length) {
    lines.push('Local AI: when | model | load s | prompt tok | reply tok | prefill tok/s | decode tok/s | total s | error');
    for (const e of llm) {
      lines.push([e.at, e.model, num(e.loadSec), num(e.promptTokens, 0), num(e.replyTokens, 0), num(e.prefillPerSec), num(e.decodePerSec), num(e.totalSec), e.error ?? ''].join(' | '));
    }
  }
  return lines.join('\n').trimEnd();
}
