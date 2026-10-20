/**
 * Espelho do modelo e do runtime de transcrição no próprio site.
 * O navegador baixa tudo de `/hf/...` e `/cdn/...` no mesmo endereço do app; o Worker da
 * Cloudflare busca no Hugging Face e no jsdelivr. Assim, quem não alcança esses servidores
 * (firewall, antivírus, bloqueador) ainda consegue transcrever.
 * Só repassa o modelo e o runtime que o app usa, para não virar um proxy aberto.
 */
export const MODEL_ID = 'onnx-community/whisper-base_timestamped';

export const HF_PREFIX = '/hf/';
export const CDN_PREFIX = '/cdn/';

const HF_PATH = new RegExp(`^${HF_PREFIX}${MODEL_ID.replace('/', '\\/')}\\/resolve\\/[\\w.-]+\\/[\\w./-]+$`);
const CDN_PATH = /^\/cdn\/npm\/onnxruntime-web@[\w.-]+\/dist\/[\w.-]+$/;

/** URL de origem para um caminho do espelho, ou null se o caminho não for permitido. */
export function upstreamUrl(pathname: string): string | null {
  if (pathname.includes('..')) return null;
  if (HF_PATH.test(pathname)) return `https://huggingface.co/${pathname.slice(HF_PREFIX.length)}`;
  if (CDN_PATH.test(pathname)) return `https://cdn.jsdelivr.net/${pathname.slice(CDN_PREFIX.length)}`;
  return null;
}

/** Troca o endereço do jsdelivr pelo espelho no site (`origin` sem barra final). */
export function mirrorCdnUrl(url: string, origin: string): string {
  return url.replace('https://cdn.jsdelivr.net/', `${origin}${CDN_PREFIX}`);
}
