/**
 * Modelos de transcrição e a escolha de qual usar em cada aparelho (ADR-0013, ADR-0036, ADR-0039).
 *
 * Whisper: exportações ONNX "_timestamped" da comunidade onnx-community no Hugging Face; elas devolvem a
 * atenção cruzada do decodificador, que o Transformers.js 4.3.1 precisa para dar o tempo de cada palavra
 * (`return_timestamps: 'word'`). Licença: Whisper da OpenAI (código e pesos MIT; ver docs/licencas.md).
 *
 * Parakeet TDT 0.6B v3 (NVIDIA, CC-BY-4.0, v0.38): reconhece a fala de uma vez (não escreve palavra por
 * palavra como o Whisper), por isso é bem mais rápido no processador, não entra em laço repetindo frases e
 * dá o tempo de cada palavra direto da saída do modelo. Em português erra menos que o Whisper small e o
 * medium e só perde para o large-v3/turbo (FLEURS pt: ~4,8–5,0% contra 7,7% do small; ADR-0039). Roda pela
 * biblioteca parakeet.js (MIT) no mesmo onnxruntime-web do Transformers.js.
 *
 * A escolha é uma "escada": se um degrau não carregar ou falhar no meio, o Worker desce para o próximo
 * sem parar a transcrição (aviso M4F-307). Os tamanhos são estimativas do download na primeira vez.
 */

export type AsrMode = 'rapida' | 'precisa';
export const ASR_MODES: AsrMode[] = ['rapida', 'precisa'];

export type AsrDevice = 'webgpu' | 'wasm';
/** Qual motor roda o modelo: Whisper pelo Transformers.js ou Parakeet pelo parakeet.js. */
export type AsrEngine = 'whisper' | 'parakeet';
/** dtype por arquivo do modelo (nomes do Transformers.js: fp32, fp16, q8 = `_quantized`, q4 = `_q4`). */
export type AsrDtype = 'fp32' | 'fp16' | 'q8' | 'q4' | { encoder_model: 'fp32' | 'fp16' | 'q8' | 'q4'; decoder_model_merged: 'fp32' | 'fp16' | 'q8' | 'q4' };

export interface AsrCandidate {
  id: AsrCandidateId;
  /** nome para a pessoa */
  label: string;
  repo: string;
  engine: AsrEngine;
  device: AsrDevice;
  dtype: AsrDtype;
  /** download aproximado na primeira vez, em MB */
  downloadMB: number;
  /** segundos de processamento por minuto de fala, estimativa para um computador comum (ADR-0013) */
  secPerMinute: number;
  /** Parakeet: qual conjunto de arquivos baixar (int8 para o processador, fp16 para a placa) */
  parakeetFiles?: ParakeetVariant;
}

export const ASR_REPOS = {
  turbo: 'onnx-community/whisper-large-v3-turbo_timestamped',
  small: 'onnx-community/whisper-small_timestamped',
  base: 'onnx-community/whisper-base_timestamped',
  // Exportação ONNX de nvidia/parakeet-tdt-0.6b-v3 no formato que o parakeet.js lê (vocab.txt com ids).
  parakeet: 'ysdede/parakeet-tdt-0.6b-v3-onnx',
} as const;

/**
 * Arquivos do Parakeet para o processador: encoder int8 (652 MB) + decodificador int8 (18 MB) + vocabulário.
 * O pré-processamento (espectrograma) é feito em JavaScript pelo parakeet.js, sem baixar o `nemo128.onnx`.
 * Tamanhos conferidos na listagem do repositório (nov/2026); a revisão fica fixa para não mudar sozinha.
 */
export const PARAKEET_FILES = {
  revision: 'main',
  files: [
    { key: 'vocab', name: 'vocab.txt', bytes: 102_132 },
    { key: 'decoder', name: 'decoder_joint-model.int8.onnx', bytes: 18_202_004 },
    { key: 'encoder', name: 'encoder-model.int8.onnx', bytes: 652_183_999 },
  ],
  /**
   * Na placa de vídeo (v0.38, cardápio): encoder fp16 (1,24 GB; o int8 dá resultado errado no WebGPU, segundo
   * quem publicou a exportação para navegador). O decodificador roda sempre no processador no parakeet.js.
   */
  gpuFiles: [
    { key: 'vocab', name: 'vocab.txt', bytes: 102_132 },
    { key: 'decoder', name: 'decoder_joint-model.int8.onnx', bytes: 18_202_004 },
    { key: 'encoder', name: 'encoder-model.fp16.onnx', bytes: 1_238_960_452 },
  ],
} as const;

export type ParakeetVariant = 'int8' | 'fp16';
export function parakeetFiles(v: ParakeetVariant = 'int8') {
  return v === 'fp16' ? PARAKEET_FILES.gpuFiles : PARAKEET_FILES.files;
}

export const ASR_CANDIDATES = {
  'turbo-webgpu': {
    id: 'turbo-webgpu',
    label: 'Whisper large-v3-turbo (placa de vídeo)',
    repo: ASR_REPOS.turbo,
    engine: 'whisper',
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
    engine: 'whisper',
    device: 'wasm',
    dtype: 'q8',
    downloadMB: 250,
    secPerMinute: 60,
  },
  // Degrau do meio na placa de vídeo (v0.36): placa integrada, placa sem fp16 ou pouca memória ainda
  // transcrevem na placa, que é bem mais rápida que o processador, antes de cair no processador.
  'small-webgpu': {
    id: 'small-webgpu',
    label: 'Whisper small (placa de vídeo)',
    repo: ASR_REPOS.small,
    engine: 'whisper',
    device: 'webgpu',
    // encoder em fp16 (precisa de `shader-f16`); decodificador q4, como no turbo
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    downloadMB: 380,
    secPerMinute: 10,
  },
  'small-webgpu-fp32': {
    id: 'small-webgpu-fp32',
    label: 'Whisper small (placa de vídeo)',
    repo: ASR_REPOS.small,
    engine: 'whisper',
    device: 'webgpu',
    // placa sem fp16: encoder em fp32 (maior, mas roda em qualquer placa com WebGPU)
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    downloadMB: 560,
    secPerMinute: 12,
  },
  // Degrau do meio no processador (v0.38): erra bem menos que o Whisper small e é mais rápido que ele no
  // processador. Pede pelo menos 4 GB de memória (o encoder ocupa ~1 GB depois de montado).
  'parakeet-wasm': {
    id: 'parakeet-wasm',
    label: 'Parakeet v3 (processador)',
    repo: ASR_REPOS.parakeet,
    engine: 'parakeet',
    device: 'wasm',
    dtype: 'q8',
    downloadMB: 670,
    secPerMinute: 40,
    parakeetFiles: 'int8',
  },
  // Só pelo cardápio e pela conferência dupla (v0.38): Parakeet na placa com encoder fp16. Muito mais rápido
  // que o turbo, do mesmo tamanho, mas erra um pouco mais em português; por isso não é o automático.
  'parakeet-webgpu': {
    id: 'parakeet-webgpu',
    label: 'Parakeet v3 (placa de vídeo)',
    repo: ASR_REPOS.parakeet,
    engine: 'parakeet',
    device: 'webgpu',
    dtype: 'fp16',
    downloadMB: 1260,
    secPerMinute: 4,
    parakeetFiles: 'fp16',
  },
  'base-webgpu': {
    id: 'base-webgpu',
    label: 'Whisper base (placa de vídeo)',
    repo: ASR_REPOS.base,
    engine: 'whisper',
    device: 'webgpu',
    dtype: 'fp32',
    downloadMB: 290,
    secPerMinute: 6,
  },
  'base-wasm': {
    id: 'base-wasm',
    label: 'Whisper base (processador)',
    repo: ASR_REPOS.base,
    engine: 'whisper',
    device: 'wasm',
    dtype: 'q8',
    downloadMB: 80,
    secPerMinute: 20,
  },
} as const satisfies Record<string, Omit<AsrCandidate, 'id'> & { id: string }>;

export type AsrCandidateId = keyof typeof ASR_CANDIDATES;

/**
 * Tipo de placa de vídeo que o navegador entregou (v0.36):
 * - `dedicada`: placa separada (NVIDIA, AMD Radeon RX, Intel Arc A/B) ou chip Apple, forte o bastante para o modelo grande;
 * - `integrada`: a placa que vem dentro do processador (Intel UHD/Iris, AMD Radeon Graphics/Vega, Adreno, Mali);
 * - `desconhecida`: há WebGPU, mas o navegador escondeu o nome (o Brave faz isso para proteger a privacidade);
 * - `nenhuma`: sem WebGPU ou só o adaptador de software (que é o processador fingindo ser placa).
 */
export type GpuKind = 'dedicada' | 'integrada' | 'desconhecida' | 'nenhuma';

/** O que o aparelho oferece (medido em `src/asr/capability.ts`). */
export interface AsrCapability {
  /** WebGPU com um adaptador de verdade (não o de software) */
  webgpu: boolean;
  /** WebGPU com `shader-f16` (necessário para o encoder em fp16) */
  f16: boolean;
  /** `navigator.deviceMemory` em GB (o Chrome informa no máximo 8); null quando o navegador não informa */
  memoryGB: number | null;
  /** tipo da placa de vídeo; ausente = `dedicada` se há WebGPU (comportamento antigo), `nenhuma` se não */
  gpu?: GpuKind;
  /** nome curto da placa para mostrar (ex.: "NVIDIA GeForce RTX 3060"); null quando o navegador não informa */
  gpuName?: string | null;
}

export const NO_CAPABILITY: AsrCapability = { webgpu: false, f16: false, memoryGB: null, gpu: 'nenhuma', gpuName: null };

export function gpuKind(c: AsrCapability): GpuKind {
  if (!c.webgpu) return 'nenhuma';
  return c.gpu && c.gpu !== 'nenhuma' ? c.gpu : 'dedicada';
}

/** O que o navegador conta da placa: WebGPU (`GPUAdapterInfo`) e, de reserva, o nome do WebGL. */
export interface GpuInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  /** `UNMASKED_RENDERER_WEBGL`, ex.: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" */
  renderer?: string;
  /** fabricante do adaptador de economia de energia; diferente do de alto desempenho = há duas placas */
  lowPowerVendor?: string;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|microsoft basic render|software adapter|lavapipe/i;

/** Nome curto e legível a partir do texto do WebGL ("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 …)" → "NVIDIA GeForce RTX 3060"). */
export function gpuDisplayName(info: GpuInfo): string | null {
  const fromRenderer = (r: string) => {
    const m = /^ANGLE \(([^,]+),\s*([^,]+?)(?:\s+\(0x[0-9a-f]+\))?(?:\s+Direct3D.*|\s+OpenGL.*|\s+Vulkan.*|\s+Metal.*)?(?:,.*)?\)$/i.exec(r.trim());
    return (m ? m[2]! : r).replace(/\((R|TM)\)/gi, '').replace(/\s+/g, ' ').trim();
  };
  const name = info.description?.trim() || (info.renderer ? fromRenderer(info.renderer) : '');
  if (name) return name.slice(0, 60);
  const vendor = info.vendor?.trim();
  return vendor ? vendor.charAt(0).toUpperCase() + vendor.slice(1) : null;
}

/**
 * Classifica a placa pelo que o navegador informou. Na dúvida devolve `desconhecida` (não `integrada`):
 * a escada tenta o modelo da placa forte e desce sozinha se não der.
 */
export function classifyGpu(info: GpuInfo): GpuKind {
  const text = [info.vendor, info.architecture, info.device, info.description, info.renderer].filter(Boolean).join(' ').toLowerCase();
  if (SOFTWARE.test(text)) return 'nenhuma';
  // duas placas e o navegador entregou a de alto desempenho: é a dedicada
  const hp = (info.vendor ?? '').trim().toLowerCase();
  const lp = (info.lowPowerVendor ?? '').trim().toLowerCase();
  if (hp && lp && hp !== lp) return 'dedicada';
  if (!text.trim()) return 'desconhecida';
  if (/nvidia|geforce|quadro|\brtx\b|\bgtx\b|tesla/.test(text)) return 'dedicada';
  if (/\bapple\b/.test(text)) return 'dedicada';
  if (/intel/.test(text)) return /arc(\(tm\))? [ab]\d|xe-?hpg|xe2-?hpg|\bdg2\b|alchemist|battlemage/.test(text) ? 'dedicada' : 'integrada';
  if (/amd|radeon|\bati\b/.test(text)) {
    if (/\brx ?\d|radeon pro|radeon vii|firepro|\bw\d{4}\b/.test(text)) return 'dedicada';
    if (/radeon(\(tm\))? graphics|vega|\b\d{3}m\b/.test(text)) return 'integrada';
    return 'desconhecida';
  }
  if (/adreno|qualcomm|mali|\barm\b|powervr|imagination|img tec/.test(text)) return 'integrada';
  return 'desconhecida';
}

/** O turbo pede placa dedicada (ou não identificada) com fp16 e pelo menos 8 GB de memória (ou memória não informada). */
export function canRunTurbo(c: AsrCapability): boolean {
  const kind = gpuKind(c);
  return (kind === 'dedicada' || kind === 'desconhecida') && c.f16 && (c.memoryGB === null || c.memoryGB >= 8);
}

/** O Parakeet no processador pede pelo menos 4 GB de memória (ou memória não informada). */
export function canRunParakeet(c: AsrCapability): boolean {
  return c.memoryGB === null || c.memoryGB >= 4;
}

/**
 * Ordem de tentativa para o modo escolhido (ADR-0039).
 * - Placa dedicada: Whisper turbo na placa (o mais preciso em português).
 * - Depois, ou sem placa forte: Parakeet v3 no processador, que erra bem menos que o Whisper small.
 * - Se o Parakeet não carregar: Whisper small na placa (dedicada ou integrada) e, por fim, no processador.
 * Sempre termina no base em WASM, que roda em qualquer navegador.
 */
export function asrLadder(mode: AsrMode, c: AsrCapability): AsrCandidateId[] {
  const parakeet: AsrCandidateId[] = canRunParakeet(c) ? ['parakeet-wasm'] : [];
  if (!c.webgpu) return mode === 'rapida' ? ['base-wasm'] : [...parakeet, 'small-wasm', 'base-wasm'];
  if (mode === 'rapida') return ['base-webgpu', 'base-wasm'];
  const smallGpu: AsrCandidateId = c.f16 ? 'small-webgpu' : 'small-webgpu-fp32';
  return [...(canRunTurbo(c) ? (['turbo-webgpu'] as const) : []), ...parakeet, smallGpu, 'base-webgpu', 'small-wasm', 'base-wasm'];
}

/** Nome do modelo com o lugar onde rodou, ex.: "Whisper small (placa de vídeo integrada: Intel UHD Graphics 620)". */
export function modelWhereLabel(id: AsrCandidateId, c: AsrCapability): string {
  const cand = ASR_CANDIDATES[id];
  if (cand.device !== 'webgpu') return cand.label;
  const kind = gpuKind(c);
  const what = kind === 'dedicada' ? 'placa de vídeo dedicada' : kind === 'integrada' ? 'placa de vídeo integrada' : 'placa de vídeo';
  return cand.label.replace('(placa de vídeo)', `(${what}${c.gpuName ? `: ${c.gpuName}` : ''})`);
}

/** Frase para a pessoa: qual placa o app achou e o que faz com ela. */
export function describeGpu(c: AsrCapability): string {
  const name = c.gpuName ? ` (${c.gpuName})` : '';
  switch (gpuKind(c)) {
    case 'dedicada':
      return `placa de vídeo dedicada${name}: a transcrição usa ela e fica bem mais rápida.`;
    case 'integrada':
      return `placa de vídeo integrada ao processador${name}: a transcrição usa ela, que é mais rápida que só o processador. Se o computador também tem uma placa dedicada (NVIDIA ou AMD), escolha "Alto desempenho" para o navegador nas configurações de gráficos do Windows.`;
    case 'desconhecida':
      return 'placa de vídeo encontrada, mas o navegador não disse o modelo (o Brave esconde por privacidade). A transcrição tenta primeiro o modelo da placa forte e, se não der, desce sozinha para um mais leve.';
    default:
      return 'não encontrada ou não liberada pelo navegador; a transcrição usa o processador e demora mais. Chrome, Edge e Brave atualizados costumam liberar.';
  }
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

/**
 * Opções de cada chamada ao Whisper. Idioma e tarefa fixos: sem detecção automática, o Whisper às vezes
 * "decide" que um trecho é espanhol ou traduz para inglês. Decodificação gulosa (o Transformers.js 4.3.1
 * não tem beam search de verdade nem a troca de temperatura do Whisper original). Na segunda tentativa de
 * uma janela com cara de laço, proíbe repetir sequências de 6 tokens.
 */
/** Modelos Whisper multilíngues; o modo automático deixa o próprio modelo identificar a fala. */
export const SPEECH_LANGUAGE = { label: 'vários idiomas, incluindo português e inglês' } as const;
export type SpeechLanguage = 'auto' | 'pt' | 'en';

export function whisperOptions(retry = false, language: SpeechLanguage = 'auto'):
  { language?: 'portuguese' | 'english'; task: 'transcribe'; return_timestamps: 'word'; no_repeat_ngram_size?: number } {
  return {
    ...(language === 'pt' ? { language: 'portuguese' as const } : language === 'en' ? { language: 'english' as const } : {}),
    task: 'transcribe', return_timestamps: 'word', ...(retry ? { no_repeat_ngram_size: 6 } : {}),
  };
}

/** Texto curto para a opção "Precisão da legenda": qual modelo, onde roda e o download da primeira vez. */
export function describeMode(mode: AsrMode, c: AsrCapability): string {
  const first = ASR_CANDIDATES[asrLadder(mode, c)[0]!];
  const kind = gpuKind(c);
  const where = first.device === 'webgpu' ? (kind === 'integrada' ? 'usa a placa de vídeo integrada' : 'usa a placa de vídeo') : 'usa o processador';
  const extra = mode === 'precisa' && first.device === 'wasm' && !c.webgpu ? '; sem placa de vídeo compatível, demora alguns minutos' : '';
  return `${first.label.replace(/ \(.*\)$/, '')}, ${where}; baixa cerca de ${formatMB(first.downloadMB)} na primeira vez${extra}.`;
}

/**
 * Pedido de transcrição (v0.38, cardápio): o modo (escada automática), uma escada explícita, ou um desses com a
 * conferência dupla ligada (uma segunda IA ouve de novo e as palavras em que as duas discordam ficam para revisar).
 */
export type AsrRequest = AsrMode | AsrCandidateId[] | { ladder: AsrMode | AsrCandidateId[]; check: boolean };

export function requestLadder(r: AsrRequest, c: AsrCapability): AsrCandidateId[] {
  const l = typeof r === 'object' && !Array.isArray(r) ? r.ladder : r;
  return Array.isArray(l) ? l : asrLadder(l, c);
}

export function requestChecks(r: AsrRequest | undefined): boolean {
  return !!r && typeof r === 'object' && !Array.isArray(r) && r.check;
}

/** A escada foi escolhida pelo app (modo), não pela pessoa? */
export function requestIsAuto(r: AsrRequest): boolean {
  const l = typeof r === 'object' && !Array.isArray(r) ? r.ladder : r;
  return !Array.isArray(l);
}

/** Item do cardápio "IA da legenda": um modelo, escolhido na versão certa para este aparelho. */
export interface AsrMenuEntry {
  key: AsrMenuKey;
  title: string;
  /** erro por palavra em português (FLEURS pt, %), fonte em ADR-0039 */
  ptErrorPct: number;
  /** para que serve, em uma frase */
  note: string;
  /** qual degrau usar neste aparelho; null = não roda aqui */
  pick(c: AsrCapability): AsrCandidateId | null;
  /** por que não roda aqui (quando `pick` devolve null) */
  why: string;
}

export type AsrMenuKey = 'turbo' | 'parakeet-gpu' | 'parakeet' | 'small' | 'base';
export const ASR_MENU_KEYS: AsrMenuKey[] = ['turbo', 'parakeet-gpu', 'parakeet', 'small', 'base'];

const hasF16Gpu = (c: AsrCapability) => c.webgpu && c.f16;

export const ASR_MENU: Record<AsrMenuKey, AsrMenuEntry> = {
  turbo: {
    key: 'turbo',
    title: 'Whisper large-v3-turbo',
    ptErrorPct: 4.2,
    note: 'O que mais acerta em português. Precisa de placa de vídeo boa.',
    pick: (c) => (hasF16Gpu(c) ? 'turbo-webgpu' : null),
    why: 'precisa de placa de vídeo com WebGPU e fp16',
  },
  'parakeet-gpu': {
    key: 'parakeet-gpu',
    title: 'Parakeet v3 na placa de vídeo',
    ptErrorPct: 4.8,
    note: 'Quase tão preciso quanto o turbo e várias vezes mais rápido. Bom para vídeos longos.',
    pick: (c) => (hasF16Gpu(c) ? 'parakeet-webgpu' : null),
    why: 'precisa de placa de vídeo com WebGPU e fp16',
  },
  parakeet: {
    key: 'parakeet',
    title: 'Parakeet v3 no processador',
    ptErrorPct: 4.8,
    note: 'O mais preciso sem placa de vídeo. Não repete frases e marca bem o tempo de cada palavra.',
    pick: (c) => (canRunParakeet(c) ? 'parakeet-wasm' : null),
    why: 'precisa de pelo menos 4 GB de memória',
  },
  small: {
    key: 'small',
    title: 'Whisper small',
    ptErrorPct: 7.7,
    note: 'Leve e rápido na placa de vídeo, mas erra mais.',
    pick: (c) => (!c.webgpu ? 'small-wasm' : c.f16 ? 'small-webgpu' : 'small-webgpu-fp32'),
    why: '',
  },
  base: {
    key: 'base',
    title: 'Whisper base',
    ptErrorPct: 13.9,
    note: 'O menor download e o mais rápido. Erra bastante: bom só para um rascunho.',
    pick: (c) => (c.webgpu ? 'base-webgpu' : 'base-wasm'),
    why: '',
  },
};

/** Escada quando a pessoa escolhe um modelo: ele primeiro; se falhar, segue a escada automática (aviso M4F-307). */
export function chosenLadder(id: AsrCandidateId, c: AsrCapability): AsrCandidateId[] {
  return [id, ...asrLadder('precisa', c).filter((x) => x !== id)];
}

/** Velocidade em palavras para a pessoa, a partir dos segundos por minuto de fala. */
export function speedLabel(id: AsrCandidateId): string {
  const s = ASR_CANDIDATES[id].secPerMinute;
  return s <= 8 ? 'muito rápida' : s <= 20 ? 'rápida' : s <= 45 ? 'média' : 'lenta';
}

/** Acerto em palavras para a pessoa, a partir do erro por palavra. */
export function accuracyLabel(ptErrorPct: number): string {
  return ptErrorPct <= 4.5 ? 'excelente' : ptErrorPct <= 5.5 ? 'muito bom' : ptErrorPct <= 8 ? 'bom' : 'básico';
}

/**
 * Segunda IA da conferência dupla: sempre de outra família (Whisper ↔ Parakeet), porque modelos diferentes
 * erram em lugares diferentes. A concordância das duas é o sinal; a discordância vira "revisar esta palavra".
 * Lista vazia = não há segunda IA que preste neste aparelho.
 */
export function checkLadder(primary: AsrCandidateId, c: AsrCapability): AsrCandidateId[] {
  if (ASR_CANDIDATES[primary].engine === 'whisper') {
    if (!canRunParakeet(c)) return [];
    return hasF16Gpu(c) && (gpuKind(c) === 'dedicada' || gpuKind(c) === 'desconhecida') ? ['parakeet-webgpu', 'parakeet-wasm'] : ['parakeet-wasm'];
  }
  if (canRunTurbo(c)) return ['turbo-webgpu', c.f16 ? 'small-webgpu' : 'small-webgpu-fp32', 'small-wasm'];
  if (c.webgpu) return [c.f16 ? 'small-webgpu' : 'small-webgpu-fp32', 'small-wasm'];
  return ['small-wasm'];
}
