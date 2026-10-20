/**
 * Espelho do modelo e do runtime de transcrição no próprio site.
 * O navegador baixa tudo de `/hf/...` e `/cdn/...` no mesmo endereço do app; o Worker da
 * Cloudflare busca no Hugging Face e no jsdelivr. Assim, quem não alcança esses servidores
 * (firewall, antivírus, bloqueador) ainda consegue transcrever.
 * Só repassa o modelo e o runtime que o app usa, para não virar um proxy aberto.
 */
export const MODEL_ID = 'onnx-community/whisper-base_timestamped';

/**
 * Modelo de texto opcional (Fase 4, ADR-0009): Qwen2.5 0.5B (Apache-2.0) compilado para WebLLM.
 * Pesos no Hugging Face; a biblioteca WebGPU do modelo no GitHub (raw.githubusercontent.com).
 * Versão da biblioteca = a que o @mlc-ai/web-llm instalado usa na sua lista de modelos.
 */
export const LLM_REPO = 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const LLM_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const LLM_LIB_PATH = 'mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm';
/** memória de vídeo que o WebLLM informa para este modelo */
export const LLM_VRAM_MB = 945;

export const HF_PREFIX = '/hf/';
export const CDN_PREFIX = '/cdn/';
export const GH_PREFIX = '/gh/';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const HF_REPOS = [MODEL_ID, LLM_REPO];
const HF_PATH = new RegExp(`^${HF_PREFIX}(${HF_REPOS.map(esc).join('|')})\\/resolve\\/[\\w.-]+\\/[\\w./-]+$`);
const CDN_PATH = /^\/cdn\/npm\/onnxruntime-web@[\w.-]+\/dist\/[\w.-]+$/;
const GH_PATH = new RegExp(`^${GH_PREFIX}${esc(LLM_LIB_PATH)}$`);

/** URL de origem para um caminho do espelho, ou null se o caminho não for permitido. */
export function upstreamUrl(pathname: string): string | null {
  if (pathname.includes('..')) return null;
  if (HF_PATH.test(pathname)) return `https://huggingface.co/${pathname.slice(HF_PREFIX.length)}`;
  if (CDN_PATH.test(pathname)) return `https://cdn.jsdelivr.net/${pathname.slice(CDN_PREFIX.length)}`;
  if (GH_PATH.test(pathname)) return `https://raw.githubusercontent.com/${pathname.slice(GH_PREFIX.length)}`;
  return null;
}

/**
 * Registro do modelo para o WebLLM. `origin` = endereço do site (usa o espelho);
 * null = servidores originais (desenvolvimento local).
 */
export function llmModelRecord(origin: string | null): { model: string; model_id: string; model_lib: string; vram_required_MB: number; low_resource_required: boolean; overrides: { context_window_size: number } } {
  return {
    model: origin ? `${origin}${HF_PREFIX}${LLM_REPO}` : `https://huggingface.co/${LLM_REPO}`,
    model_id: LLM_MODEL_ID,
    model_lib: origin ? `${origin}${GH_PREFIX}${LLM_LIB_PATH}` : `https://raw.githubusercontent.com/${LLM_LIB_PATH}`,
    vram_required_MB: LLM_VRAM_MB,
    low_resource_required: true,
    overrides: { context_window_size: 4096 },
  };
}

/** Troca o endereço do jsdelivr pelo espelho no site (`origin` sem barra final). */
export function mirrorCdnUrl(url: string, origin: string): string {
  return url.replace('https://cdn.jsdelivr.net/', `${origin}${CDN_PREFIX}`);
}
