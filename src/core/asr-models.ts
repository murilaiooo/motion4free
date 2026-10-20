/**
 * Modelos de transcrição (Whisper) e a escolha de qual usar em cada aparelho (ADR-0013).
 *
 * Todos são exportações ONNX "_timestamped" da comunidade onnx-community no Hugging Face: elas devolvem a
 * atenção cruzada do decodificador, que o Transformers.js 4.3.1 precisa para dar o tempo de cada palavra
 * (`return_timestamps: 'word'`). Licença: Whisper da OpenAI (código e pesos MIT; ver docs/licencas.md).
 *
 * A escolha é uma "escada": se um degrau não carregar ou falhar no meio, o Worker desce para o próximo
 * sem parar a transcrição (aviso M4F-307). Os tamanhos são estimativas do download na primeira vez.
 */

export type AsrMode = 'rapida' | 'precisa';
export const ASR_MODES: AsrMode[] = ['rapida', 'precisa'];

export type AsrDevice = 'webgpu' | 'wasm';
/** dtype por arquivo do modelo (nomes do Transformers.js: fp32, fp16, q8 = `_quantized`, q4 = `_q4`). */
export type AsrDtype = 'fp32' | 'fp16' | 'q8' | 'q4' | { encoder_model: 'fp32' | 'fp16' | 'q8' | 'q4'; decoder_model_merged: 'fp32' | 'fp16' | 'q8' | 'q4' };

export interface AsrCandidate {
  id: AsrCandidateId;
  /** nome para a pessoa */
  label: string;
  repo: string;
  device: AsrDevice;
  dtype: AsrDtype;
  /** download aproximado na primeira vez, em MB */
  downloadMB: number;
  /** segundos de processamento por minuto de fala, estimativa para um computador comum (ADR-0013) */
  secPerMinute: number;
}

export const ASR_REPOS = {
  turbo: 'onnx-community/whisper-large-v3-turbo_timestamped',
  small: 'onnx-community/whisper-small_timestamped',
  base: 'onnx-community/whisper-base_timestamped',
} as const;

export const ASR_CANDIDATES = {
  'turbo-webgpu': {
    id: 'turbo-webgpu',
    label: 'Whisper large-v3-turbo (placa de vídeo)',
    repo: ASR_REPOS.turbo,
    device: 'webgpu',
    // Encoder em fp16 (precisão quase igual ao fp32, metade do tamanho); decodificador q4 (é ele que roda
    // uma vez por palavra, e no turbo tem só 4 camadas). Mesma combinação da demonstração oficial do Transformers.js.
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    downloadMB: 1400,
    secPerMinute: 15,
  },
  'small-wasm': {
    id: 'small-wasm',
    label: 'Whisper small (processador)',
    repo: ASR_REPOS.small,
    device: 'wasm',
    dtype: 'q8',
    downloadMB: 250,
    secPerMinute: 60,
  },
  'base-webgpu': {
    id: 'base-webgpu',
    label: 'Whisper base (placa de vídeo)',
    repo: ASR_REPOS.base,
    device: 'webgpu',
    dtype: 'fp32',
    downloadMB: 290,
    secPerMinute: 6,
  },
  'base-wasm': {
    id: 'base-wasm',
    label: 'Whisper base (processador)',
    repo: ASR_REPOS.base,
    device: 'wasm',
    dtype: 'q8',
    downloadMB: 80,
    secPerMinute: 20,
  },
} as const satisfies Record<string, Omit<AsrCandidate, 'id'> & { id: string }>;

export type AsrCandidateId = keyof typeof ASR_CANDIDATES;

/** O que o aparelho oferece (medido em `src/asr/capability.ts`). */
export interface AsrCapability {
  /** WebGPU com um adaptador de verdade (não o de software) */
  webgpu: boolean;
  /** WebGPU com `shader-f16` (necessário para o encoder em fp16) */
  f16: boolean;
  /** `navigator.deviceMemory` em GB (o Chrome informa no máximo 8); null quando o navegador não informa */
  memoryGB: number | null;
}

export const NO_CAPABILITY: AsrCapability = { webgpu: false, f16: false, memoryGB: null };

/** O turbo pede placa com fp16 e pelo menos 8 GB de memória (ou memória não informada). */
export function canRunTurbo(c: AsrCapability): boolean {
  return c.webgpu && c.f16 && (c.memoryGB === null || c.memoryGB >= 8);
}

/** Ordem de tentativa para o modo escolhido. Sempre termina no base em WASM, que roda em qualquer navegador. */
export function asrLadder(mode: AsrMode, c: AsrCapability): AsrCandidateId[] {
  const base: AsrCandidateId[] = c.webgpu ? ['base-webgpu', 'base-wasm'] : ['base-wasm'];
  if (mode === 'rapida') return base;
  return [...(canRunTurbo(c) ? (['turbo-webgpu'] as const) : []), 'small-wasm', ...base];
}

/** Padrão: Precisa, menos em aparelho que informa pouca memória (menos de 4 GB). */
export function defaultAsrMode(c: AsrCapability): AsrMode {
  return c.memoryGB !== null && c.memoryGB < 4 ? 'rapida' : 'precisa';
}

export function formatMB(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`;
}

/** Estimativa de tempo de transcrição em minutos (arredondada para cima, mínimo 1). */
export function estimateMinutes(id: AsrCandidateId, durationSec: number): number {
  return Math.max(1, Math.ceil((ASR_CANDIDATES[id].secPerMinute * durationSec) / 60 / 60));
}

/** Texto curto para a opção "Precisão da legenda": qual modelo, onde roda e o download da primeira vez. */
export function describeMode(mode: AsrMode, c: AsrCapability): string {
  const first = ASR_CANDIDATES[asrLadder(mode, c)[0]!];
  const where = first.device === 'webgpu' ? 'usa a placa de vídeo' : 'usa o processador';
  const extra = mode === 'precisa' && first.device === 'wasm' ? '; sem placa de vídeo compatível, demora alguns minutos' : '';
  return `${first.label.replace(/ \(.*\)$/, '')}, ${where}; baixa cerca de ${formatMB(first.downloadMB)} na primeira vez${extra}.`;
}
