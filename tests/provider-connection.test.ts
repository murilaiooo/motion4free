import { afterEach, describe, expect, it, vi } from 'vitest';
import { credentialRevision, forgetKey, getKey, setSessionKey } from '../src/ai/credentials/keys';
import { testModel } from '../src/ai/providers/client';
import { AppError } from '../src/core/errors';

const FAKE_KEY = 'sk-or-not-a-real-api-key-for-tests';

afterEach(async () => {
  vi.restoreAllMocks();
  await forgetKey('openrouter');
});

describe('BYOK: seleção e verificação confiáveis (#73)', () => {
  it('HTTP 200 com resposta de texto vazia nunca é anunciado como inferência bem-sucedida', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ choices: [{ message: { content: '' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    await expect(testModel('openrouter', FAKE_KEY, 'modelo-falso')).rejects.toMatchObject({
      code: 'M4F-1217',
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init as RequestInit).redirect).toBe('error');
    expect((init as RequestInit).credentials).toBe('omit');
    expect(url).not.toContain(FAKE_KEY);
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent.max_tokens).toBe(128);
  });

  it('somente uma resposta de texto real valida o modelo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    await expect(testModel('openrouter', FAKE_KEY, 'modelo-falso')).resolves.toBeUndefined();
  });

  it('trocar ou revogar chave invalida versão opaca da credencial, sem salvar segredo no índice', async () => {
    const before = credentialRevision('openrouter');
    setSessionKey('openrouter', 'conta-a-sintetica');
    expect(credentialRevision('openrouter')).toBe(before + 1);
    setSessionKey('openrouter', 'conta-b-sintetica');
    expect(credentialRevision('openrouter')).toBe(before + 2);
    expect(getKey('openrouter')).toBe('conta-b-sintetica');
    await forgetKey('openrouter');
    expect(credentialRevision('openrouter')).toBe(before + 3);
    expect(getKey('openrouter')).toBeNull();
  });

  it('recusa status HTTP de limite sem confundi-lo com resposta válida', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 },
    ));
    const error = await testModel('openrouter', FAKE_KEY, 'modelo-falso').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('M4F-1206');
    expect((error as Error).message).not.toContain(FAKE_KEY);
  });
});
