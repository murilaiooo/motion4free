import type { ErrorKey } from './errors';

/**
 * Modelos de texto que a "IA no navegador" pode usar (WebLLM 0.2.85, lista oficial `prebuiltAppConfig`).
 * Só modelos com licença Apache-2.0, quantizados q4f16 pela MLC: Qwen2.5 0.5B e 1.5B Instruct e Qwen3 4B.
 * (O Qwen2.5 3B foi descartado: usa a "Qwen Research License", que não permite uso comercial.) IDs e bibliotecas conferidos no
 * pacote instalado (teste em tests/mirror.test.ts). Tamanhos de download são aproximados (pesos q4f16);
 * memória de vídeo é a que o WebLLM informa.
 */
export const LLM_LIB_VERSION = 'v0_2_84/base';
const LIB_PREFIX = `mlc-ai/binary-mlc-llm-libs/main/web-llm-models/${LLM_LIB_VERSION}/`;

export interface LlmModel {
  key: LlmKey;
  /** nome para a pessoa */
  label: string;
  /** model_id do WebLLM */
  id: string;
  /** repositório dos pesos no Hugging Face */
  repo: string;
  /** caminho da biblioteca WebGPU em raw.githubusercontent.com */
  lib: string;
  vramMB: number;
  /** download aproximado na primeira vez */
  downloadMB: number;
  /** tempo máximo de uma resposta */
  timeoutSec: number;
  /** modelo que "pensa" antes de responder (Qwen3): desligado no pedido para não gastar a resposta */
  thinking: boolean;
}

export const LLM_KEYS = ['leve', 'padrao', 'forte'] as const;
export type LlmKey = (typeof LLM_KEYS)[number];

export const LLM_MODELS: Record<LlmKey, LlmModel> = {
  leve: {
    key: 'leve',
    label: 'Leve (Qwen2.5 0.5B) — para computadores fracos; entende menos',
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    repo: 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    lib: `${LIB_PREFIX}Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    vramMB: 945,
    downloadMB: 300,
    timeoutSec: 60,
    thinking: false,
  },
  padrao: {
    key: 'padrao',
    label: 'Padrão (Qwen2.5 1.5B) — recomendado',
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    repo: 'mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    lib: `${LIB_PREFIX}Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    vramMB: 1630,
    downloadMB: 900,
    timeoutSec: 90,
    thinking: false,
  },
  forte: {
    key: 'forte',
    label: 'Forte (Qwen3 4B) — entende melhor; precisa de placa de vídeo boa',
    id: 'Qwen3-4B-q4f16_1-MLC',
    repo: 'mlc-ai/Qwen3-4B-q4f16_1-MLC',
    lib: `${LIB_PREFIX}Qwen3-4B-q4f16_1_cs1k-webgpu.wasm`,
    vramMB: 3432,
    downloadMB: 2300,
    timeoutSec: 150,
    thinking: true,
  },
};

export const DEFAULT_LLM: LlmKey = 'padrao';

export function isLlmKey(v: unknown): v is LlmKey {
  return typeof v === 'string' && (LLM_KEYS as readonly string[]).includes(v);
}

/**
 * Erro do WebLLM/WebGPU → código para a pessoa. Falta de memória de vídeo (ou GPU perdida ao
 * carregar, que é como o navegador costuma avisar) vira M4F-1013 com a sugestão do modelo leve.
 */
export function localAiErrorKey(message: string): ErrorKey {
  if (/out of memory|outofmemory|\boom\b|insufficient|not enough memory|exceed|device (was )?lost|devicelost|maxBufferSize|maxStorageBufferBindingSize|allocation failed|memory/i.test(message)) return 'IA_MODELO_GRANDE';
  return 'IA_LOCAL_FALHOU';
}
