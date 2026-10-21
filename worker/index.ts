// Worker da Cloudflare: serve arquivos estáticos e espelha modelos autorizados.
// Somente /hf/*, /cdn/* e /gh/* chegam ao proxy; upstreamUrl valida cada caminho.
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
    const upstreamHeaders = new Headers();
    const range = request.headers.get('range');
    if (range) upstreamHeaders.set('range', range);

    // HF usa URLs assinadas temporárias (Xet/CDN). Nunca guardar redirects ou respostas
    // delas por 30 dias na borda: depois que a assinatura expira o modelo recebe HTTP 403.
    // Modelos grandes são transmitidos em streaming, sem buffering nem edge cache.
    // /cdn e /gh continuam usando edge cache; os modelos ficam no Cache Storage do navegador.
    const init = {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow',
      cf: isHuggingFace
        ? { cacheEverything: false, cacheTtl: 0 }
        : { cacheEverything: true, cacheTtl: 30 * DAY },
    } as RequestInit;
    let res: Response;
    try {
      res = await fetch(upstream, init);
    } catch {
      // Não expor URLs assinadas, chaves ou conteúdo do request em erros e logs.
      return new Response('espelho: origem temporariamente indisponível', {
        status: 502,
        headers: { 'x-m4f-mirror': 'erro', 'cache-control': 'no-store' },
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
