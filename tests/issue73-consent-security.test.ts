import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/core/errors';
import { providerCompleter } from '../src/ai/providers/client';
import { authorizeRequest } from '../src/ai/providers/consent';
import type { AiMessages } from '../src/editorial/ai-brief';

const KEY = 'gsk_test-do-not-send';
const MESSAGES: AiMessages = {
  system: 'System instructions',
  examples: [{ user: 'EXAMPLE_SENTINEL', assistant: 'Example reply' }],
  user: 'TRANSCRIPT_SENTINEL',
};

afterEach(() => vi.unstubAllGlobals());

describe('issue #73: outbound body, cancellation and safety', () => {
  it('does not send anything after outbound permission is rejected', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const send = providerCompleter('groq', KEY, 'llama-3.3-70b-versatile', {
      authorize: async () => false,
    });
    await expect(send(MESSAGES)).rejects.toBeInstanceOf(AppError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires approval for the exact serialized request, without the credential', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: 'OK' } }] }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);
    let approvedBody = '';
    const send = providerCompleter('groq', KEY, 'llama-3.3-70b-versatile', {
      authorize: async body => { approvedBody = body; return true; },
    });
    expect(await send(MESSAGES)).toBe('OK');
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.groq.com');
    expect(options.body).toBe(approvedBody);
    expect(approvedBody).toContain('TRANSCRIPT_SENTINEL');
    expect(approvedBody).toContain('EXAMPLE_SENTINEL');
    expect(approvedBody).toContain('System instructions');
    expect(approvedBody).not.toContain(KEY);
    expect(options.credentials).toBe('omit');
    expect(options.redirect).toBe('error');
  });

  it('revocation while consent is pending prevents sending', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ctrl = new AbortController();
    const send = providerCompleter('groq', KEY, 'llama-3.3-70b-versatile', {
      signal: ctrl.signal,
      authorize: async () => { ctrl.abort(); return true; },
    });
    await expect(send(MESSAGES)).rejects.toBeInstanceOf(AppError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('abort removes a pending consent request and rejects a late answer', async () => {
    const ctrl = new AbortController();
    const permission = authorizeRequest('groq', 'model-test', 'private-text', ctrl.signal);
    ctrl.abort();
    expect(await permission).toBe(false);
  });

  it('times out while reading the response body, after headers arrived', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true, status: 200, headers: new Headers(),
      text: () => new Promise<string>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const send = providerCompleter('groq', KEY, 'llama-3.3-70b-versatile', { timeoutMs: 30 });
    await expect(send(MESSAGES)).rejects.toBeInstanceOf(AppError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not expose private provider error bodies or credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      'YOUR_PRIVATE_TRANSCRIPT ' + KEY,
      { status: 402 },
    )));
    const send = providerCompleter('groq', KEY, 'llama-3.3-70b-versatile');
    const error = await send(MESSAGES).catch(e => e as Error);
    expect(error).toBeInstanceOf(AppError);
    expect(String(error)).not.toContain('YOUR_PRIVATE_TRANSCRIPT');
    expect(String(error)).not.toContain(KEY);
  });
});
