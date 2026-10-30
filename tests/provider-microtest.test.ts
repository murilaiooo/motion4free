import { afterEach, describe, expect, it, vi } from 'vitest';
import { testModelForTask } from '../src/ai/providers/client';

const KEY = 'sk-or-synthetic-for-automated-tests';
const model = 'demo-model-no-real-requests';

afterEach(() => vi.restoreAllMocks());

describe('microteste por finalidade sem gastar API real (#126)', () => {
  it.each([
    ['creative-brief', '{"ritmo":"rapido"}'],
    ['moment-ranking', '{"melhor":"B"}'],
    ['local-revision', '{"ajuste":"amarelo"}'],
  ] as const)('valida resposta JSON mínima para %s e usa apenas fala fictícia', async (task, response) => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: response } }],
    }), { status: 200 }));
    const authorize = vi.fn(async () => true);
    const beforeSend = vi.fn(async () => undefined);
    await expect(testModelForTask('openrouter', KEY, model, task, { authorize, beforeSend })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
    expect(authorize).toHaveBeenCalledOnce();
    expect(beforeSend).toHaveBeenCalledOnce();
    const sent = JSON.parse(String((fetch.mock.calls[0]?.[1] as RequestInit).body));
    expect(sent.max_tokens).toBe(128);
    expect(JSON.stringify(sent)).not.toMatch(/transcricao real|sk-or-synthetic/);
    expect(String((fetch.mock.calls[0]?.[0]))).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('rejeita texto fora de JSON e estrutura incorreta em vez de anunciar capacidade', async () => {
    for (const response of ['Olá, claro!', '{"ritmo":"lento"}']) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: response } }],
      }), { status: 200 }));
      await expect(testModelForTask('openrouter', KEY, model, 'creative-brief')).rejects.toMatchObject({ code: 'M4F-1007' });
    }
  });

  it('sem consentimento exato não faz pedido externo nem reserva orçamento', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const beforeSend = vi.fn(async () => undefined);
    await expect(testModelForTask('openrouter', KEY, model, 'moment-ranking', {
      authorize: async () => false, beforeSend,
    })).rejects.toMatchObject({ code: expect.stringMatching(/^M4F-/) });
    expect(fetch).not.toHaveBeenCalled();
    expect(beforeSend).not.toHaveBeenCalled();
  });
});
