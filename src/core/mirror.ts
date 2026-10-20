import { ASR_REPOS } from './asr-models';
import { DEFAULT_LLM, LLM_MODELS, type LlmKey } from './llm-models';

/**
 * Espelho do modelo e do runtime de transcrição no próprio site.
 * O navegador baixa tudo de `/hf/...` e `/cdn/...` no mesmo endereço do app; o Worker da
 * Cloudflare busca no Hugging Face e no jsdelivr. Assim, quem não alcança esses servidores
 * (firewall, antivírus, bloqueador) ainda consegue transcrever.
 * Só repassa o modelo e o runtime que o app usa, para não virar um proxy aberto.
 */
/** Modelos de transcrição (ADR-0013): large-v3-turbo, small e base, todos "_timestamped". */
export const ASR_MODEL_REPOS: string[] = Object.values(ASR_REPOS);

/**
 * Modelos de texto opcionais (ADR-0009, ADR-0011): Qwen2.5 0.5B / 1.5B / 3B (Apache-2.0) para WebLLM.
 * Pesos no Hugging Face; a biblioteca WebGPU de cada modelo no GitHub (raw.githubusercontent.com).
 * A lista fica em `llm-models.ts`; o espelho só repassa esses arquivos.
 */
const MODELS = Object.values(LLM_MODELS);

export const HF_PREFIX = '/hf/';
export const CDN_PREFIX = '/cdn/';
export const GH_PREFIX = '/gh/';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const HF_REPOS = [...ASR_MODEL_REPOS, ...MODELS.map((m) => m.repo)];
const HF_PATH = new RegExp(`^${HF_PREFIX}(${HF_REPOS.map(esc).join('|')})\\/resolve\\/[\\w.-]+\\/[\\w./-]+$`);
const CDN_PATH = /^\/cdn\/npm\/onnxruntime-web@[\w.-]+\/dist\/[\w.-]+$/;
const GH_PATH = new RegExp(`^${GH_PREFIX}(${MODELS.map((m) => esc(m.lib)).join('|')})$`);

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
export function llmModelRecord(origin: string | null, key: LlmKey = DEFAULT_LLM): { model: string; model_id: string; model_lib: string; vram_required_MB: number; low_resource_required: boolean; overrides: { context_window_size: number } } {
  const m = LLM_MODELS[key];
  return {
    model: origin ? `${origin}${HF_PREFIX}${m.repo}` : `https://huggingface.co/${m.repo}`,
    model_id: m.id,
    model_lib: origin ? `${origin}${GH_PREFIX}${m.lib}` : `https://raw.githubusercontent.com/${m.lib}`,
    vram_required_MB: m.vramMB,
    low_resource_required: true,
    overrides: { context_window_size: 4096 },
  };
}

/** Troca o endereço do jsdelivr pelo espelho no site (`origin` sem barra final). */
export function mirrorCdnUrl(url: string, origin: string): string {
  return url.replace('https://cdn.jsdelivr.net/', `${origin}${CDN_PREFIX}`);
}
