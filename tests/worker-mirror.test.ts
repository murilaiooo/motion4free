import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker/index';

const origin = 'https://motion4free.murdokmurilo1.workers.dev';
const model = '/hf/onnx-community/whisper-large-v3-turbo_timestamped/resolve/main/onnx/encoder_model_fp16.onnx';
const proxyModel = '/hf/onnx-community/whisper-base_timestamped/resolve/main/onnx/encoder_model_quantized.onnx';
const env = { ASSETS: { fetch: vi.fn(async () => new Response('app', { status: 200 })) } };

afterEach(() => {
  vi.restoreAllMocks();
  env.ASSETS.fetch.mockClear();
});

describe('Cloudflare mirror: signed Hugging Face model URLs (#80)', () => {
  it('never edge-caches expiring Xet links and forwards byte ranges without buffering', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('x', {
      status: 206,
      headers: { 'content-type': 'application/octet-stream', 'content-range': 'bytes 0-0/1274403767', 'accept-ranges': 'bytes', 'content-length': '1' },
    }));
    const request = new Request(origin + proxyModel, { headers: { Range: 'bytes=0-0' } });
    const result = await worker.fetch(request, env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [upstream, init] = fetchMock.mock.calls[0]!;
    expect(upstream).toBe('https://huggingface.co/' + proxyModel.slice('/hf/'.length));
    expect((init as RequestInit & { cf: { cacheEverything: boolean; cacheTtl: number } }).cf).toEqual({ cacheEverything: false, cacheTtl: 0 });
    expect(new Headers(init?.headers).get('range')).toBe('bytes=0-0');
    expect(init?.redirect).toBe('follow');
    expect(result.status).toBe(206);
    expect(result.headers.get('content-range')).toBe('bytes 0-0/1274403767');
    expect(result.headers.get('accept-ranges')).toBe('bytes');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.text()).toBe('x');
  });

  it('HEAD forwards file size/Range metadata but never returns model bytes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, {
      headers: { 'content-length': '1274403767', 'accept-ranges': 'bytes' },
    }));
    const response = await worker.fetch(new Request(origin + proxyModel, { method: 'HEAD' }), env);
    expect(fetchMock.mock.calls[0]![1]?.method).toBe('HEAD');
    expect(response.headers.get('content-length')).toBe('1274403767');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(await response.text()).toBe('');
  });

  it('directs large turbo ONNX files to a freshly signed HTTPS CDN URL, never proxying gigabytes', async () => {
    const signed = 'https://us.aws.cdn.hf.co/xet-bridge-us/encoder?Expires=1792626000&Signature=fresh';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, {
      status: 302, headers: { location: signed },
    }));
    const response = await worker.fetch(new Request(origin + model, { headers: { Range: 'bytes=0-0' } }), env);
    const [upstream, init] = fetchMock.mock.calls[0]!;
    expect(upstream).toBe('https://huggingface.co/' + model.slice('/hf/'.length) + '?download=true');
    expect(init?.redirect).toBe('manual');
    expect(new Headers(init?.headers).get('range')).toBe('bytes=0-0');
    expect((init as RequestInit & { cf: { cacheEverything: boolean; cacheTtl: number } }).cf.cacheTtl).toBe(0);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(signed);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });

  it('refuses an unexpected signed redirect host', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, {
      status: 302, headers: { location: 'https://unexpected.example/weights.onnx' },
    }));
    const response = await worker.fetch(new Request(origin + model), env);
    expect(response.status).toBe(502);
    expect(response.headers.get('location')).toBeNull();
  });

  it('still caches safe static CDN assets at the edge', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('runtime'));
    const response = await worker.fetch(new Request(origin + '/cdn/npm/onnxruntime-web@1.22.0/dist/ort-wasm.wasm'), env);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { cf: { cacheEverything: boolean; cacheTtl: number } };
    expect(init.cf.cacheEverything).toBe(true);
    expect(init.cf.cacheTtl).toBe(30 * 86400);
    expect(response.headers.get('cache-control')).toBe('public, max-age=604800');
  });

  it('rejects unsafe paths and never exposes signed URLs or credentials in network errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('secret signed Xet URL'));
    const error = await worker.fetch(new Request(origin + model), env);
    expect(error.status).toBe(502);
    expect(await error.text()).not.toContain('secret');
    expect(error.headers.get('cache-control')).toBe('no-store');
    const blocked = await worker.fetch(new Request(origin + '/hf/other/repo/resolve/main/config.json'), env);
    expect(await blocked.text()).toBe('app');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
