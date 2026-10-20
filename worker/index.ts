// Worker da Cloudflare: serve o site (arquivos estáticos) e o espelho do modelo de transcrição.
// Só /hf/* e /cdn/* passam por aqui (run_worker_first no wrangler.jsonc); o resto vai direto aos arquivos.
import { upstreamUrl } from '../src/core/mirror';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const DAY = 86_400;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const upstream = upstreamUrl(url.pathname);
    if (!upstream) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('método não permitido', { status: 405 });

    // cacheEverything guarda na borda da Cloudflare: o Hugging Face recebe poucas requisições.
    const init = { method: request.method, redirect: 'follow', cf: { cacheEverything: true, cacheTtl: 30 * DAY } } as RequestInit;
    let res: Response;
    try {
      res = await fetch(upstream, init);
    } catch (err) {
      return new Response(`espelho: falha ao buscar ${new URL(upstream).host}: ${String(err)}`, { status: 502, headers: { 'x-m4f-mirror': 'erro' } });
    }
    const headers = new Headers();
    for (const h of ['content-type', 'content-length', 'etag', 'last-modified']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('cache-control', res.ok ? `public, max-age=${7 * DAY}` : 'no-store');
    headers.set('x-m4f-mirror', new URL(upstream).host);
    return new Response(res.body, { status: res.status, headers });
  },
};
