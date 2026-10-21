// Worker da Cloudflare: serve arquivos estáticos e espelha modelos autorizados.
// Somente /hf/*, /cdn/* e /gh/* chegam ao proxy; upstreamUrl valida cada caminho.
import { ASR_REPOS } from '../src/core/asr-models';
import { HF_PREFIX, upstreamUrl } from '../src/core/mirror';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const DAY = 86_400;
const PASSTHROUGH_HEADERS = ['content-type', 'content-length', 'etag', 'last-modified', 'accept-ranges', 'content-range'] as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const upstream = upstreamUrl(url.pathname);
    if (!upstream) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('método não permitido', { status: 405 });

    const isHuggingFace = url.pathname.startsWith(HF_PREFIX);
    // O encoder turbo tem 1,27 GB. O CDN Xet serve CORS, mas o caminho Cloudflare
    // Worker -> CDN expirou a credencial assinada mesmo após desativar o cache.
    // Entregue ao navegador uma URL assinada NOVA (não os bytes), sem servidor M4F.
    const directCdn = url.pathname.startsWith(`${HF_PREFIX}${ASR_REPOS.turbo}/resolve/`)
      && /\/onnx\/[^/]+\.onnx(?:_data)?$/.test(url.pathname);
    const upstreamRequest = directCdn ? `${upstream}?download=true` : upstream;
    const upstreamHeaders = new Headers();
    const range = request.headers.get('range');
    if (range) upstreamHeaders.set('range', range);

    // HF usa URLs assinadas temporárias (Xet/CDN). Nunca guardar redirects ou respostas
    // delas por 30 dias na borda: depois que a assinatura expira o modelo recebe HTTP 403.
    // Arquivos ONNX turbo seguem por redirecionamento ao CDN, os demais por streaming.
    // /cdn e /gh continuam usando edge cache; modelos ficam no Cache Storage do navegador.
    const init = {
      method: request.method,
      headers: upstreamHeaders,
      redirect: directCdn ? 'manual' : 'follow',
      cf: isHuggingFace
        ? { cacheEverything: false, cacheTtl: 0 }
        : { cacheEverything: true, cacheTtl: 30 * DAY },
    } as RequestInit;
    let res: Response;
    try {
      res = await fetch(upstreamRequest, init);
    } catch {
      // Não expor URLs assinadas, chaves ou conteúdo do request em erros e logs.
      return new Response('espelho: origem temporariamente indisponível', {
        status: 502,
        headers: { 'x-m4f-mirror': 'erro', 'cache-control': 'no-store' },
      });
    }
    if (directCdn && res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return new Response('espelho: redirecionamento sem destino', { status: 502 });
      const dest = new URL(location, upstreamRequest);
      // Não transformar o Worker em um redirector arbitrário. CDN público do Hugging Face.
      if (dest.protocol !== 'https:' || !(dest.hostname === 'huggingface.co' || dest.hostname.endsWith('.hf.co') || dest.hostname.endsWith('.xethub.hf.co'))) {
        return new Response('espelho: origem não permitida', { status: 502 });
      }
      return new Response(null, {
        status: 302,
        headers: { location: dest.href, 'cache-control': 'no-store', 'x-m4f-mirror': 'huggingface.co' },
      });
    }
    const headers = new Headers();
    for (const h of PASSTHROUGH_HEADERS) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('cache-control', res.ok && !isHuggingFace ? `public, max-age=${7 * DAY}` : 'no-store');
    headers.set('x-m4f-mirror', new URL(upstream).host);
    // A resposta mantém 206 e Content-Range para clientes capazes de continuar downloads.
    return new Response(request.method === 'HEAD' ? null : res.body, { status: res.status, headers });
  },
};
