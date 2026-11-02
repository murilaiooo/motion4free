import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerCompleter, testModel, testModelForTask } from '../src/ai/providers/client';
import { PROVIDERS } from '../src/ai/providers/registry';
import { DEFAULT_AI_POLICY, reserveRequest, resetRoutingSession, routingUsage } from '../src/ai/routing';
import { discoverContextualMoments } from '../src/editorial/clip-discovery';
import type { Word } from '../src/core/types';

const KEY = 'sk-or-synthetic-issue163';
const MODEL = 'nvidia/nemotron-test:free';
const messages = { system: 'Responda apenas JSON.', examples: [], user: 'Fala fictícia.' };
const thinking = { choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'The user wants me to select up to 4 independent clips.' } }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const answer = (content: string) => response({ choices: [{ finish_reason: 'stop', message: { content } }] });
const words = (count = 110): Word[] => Array.from({ length: count }, (_, i) => ({ id: `w${i}`, text: i % 6 === 5 ? 'conclusão.' : 'Questão', start: i * .5, end: i * .5 + .4 }));
const discover = (complete: ReturnType<typeof providerCompleter>, count = 110) => discoverContextualMoments(words(count), count / 2 + 1, { length: 'curto', count: 5 }, { source: 'ia-chave', complete }, new AbortController().signal, () => {});

afterEach(() => { vi.restoreAllMocks(); resetRoutingSession(); });

describe('issue #163: OpenRouter com raciocínio sem resposta', () => {
  it('pede resposta sem raciocínio e mantém o limite inicial já previsto', () => {
    const req = JSON.parse(PROVIDERS.openrouter.completeRequest(KEY, MODEL, messages, 800).body!);
    expect(req.reasoning).toEqual({ effort: 'none' });
    expect(req.max_tokens).toBe(2848);
  });

  it('recupera length vazio e entrega clipe com IDs conferidos, sem M4F-1112', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(thinking)).mockResolvedValueOnce(answer('{"spans":[{"firstWordId":"w0","lastWordId":"w47"}]}'));
    const approved: string[] = [], reserved: string[] = [];
    const complete = providerCompleter('openrouter', KEY, MODEL, { maxTokens: 800, authorize: async body => { approved.push(body); return true; }, beforeSend: async body => { reserved.push(body); } });
    const report = await discover(complete);
    expect(report.warning).toBeNull();
    expect(report.accepted).toBe(1);
    expect(report.moments.some(m => m.sourceEvidence?.source === 'ai-context')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    const bodies = fetch.mock.calls.map(([, init]) => String(init?.body));
    expect(approved).toEqual(bodies);
    expect(reserved).toEqual(bodies);
    const retry = JSON.parse(bodies[1]!);
    expect(retry.model).toBe(MODEL);
    expect(retry.messages).toEqual(JSON.parse(bodies[0]!).messages);
    expect(retry.reasoning).toEqual({ max_tokens: 2048 });
    expect(retry.max_tokens).toBe(4896);
  });

  it('se continuar pensando, informa M4F-1018 e poupa as demais janelas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response(thinking));
    const report = await discover(providerCompleter('openrouter', KEY, MODEL), 4000);
    expect(report.warning?.code).toBe('M4F-1018');
    expect(report.covered).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.moments.length).toBeGreaterThan(0);
    expect(report.moments.every(m => m.sourceEvidence?.source !== 'ai-context')).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('recupera HTTP 400 que exige raciocínio sem exibir o corpo remoto', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ error: { message: 'Reasoning is mandatory for this model and cannot be disabled.' } }, 400)).mockResolvedValueOnce(answer('{"ok":true}'));
    await expect(providerCompleter('openrouter', KEY, MODEL)(messages)).resolves.toBe('{"ok":true}');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 402, 403, 429, 500])('HTTP %s alheio ao raciocínio não provoca recuperação', async status => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ error: { message: 'unrelated failure' } }, status));
    await expect(providerCompleter('openrouter', KEY, MODEL)(messages)).rejects.toHaveProperty('code');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['consent', 'abort', 'budget'])('interrompe recuperação por %s antes de enviar', async stop => {
    const ctrl = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(thinking));
    let approvals = 0, reservations = 0;
    const complete = providerCompleter('openrouter', KEY, MODEL, {
      signal: ctrl.signal,
      authorize: async () => { approvals++; if (approvals === 2 && stop === 'abort') ctrl.abort(); return !(approvals === 2 && stop === 'consent'); },
      beforeSend: async () => { reservations++; if (reservations === 2 && stop === 'budget') throw new Error('synthetic budget exhausted'); },
    });
    await expect(complete(messages)).rejects.toThrow();
    expect(approvals).toBe(2);
    expect(reservations).toBe(stop === 'budget' ? 2 : 1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('não usa prosa ou JSON de raciocínio cortado como resposta final', () => {
    expect(PROVIDERS.openrouter.parseCompletion(thinking)).toBeNull();
    expect(PROVIDERS.openrouter.parseCompletion({ choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'Example: {"spans":[]}' } }] })).toBeNull();
    expect(PROVIDERS.openrouter.parseCompletion({ choices: [{ finish_reason: 'stop', message: { content: '', reasoning: 'Still thinking...' } }] })).toBeNull();
  });

  it('aceita objeto JSON completo em raciocínio terminado e prioriza content', () => {
    expect(PROVIDERS.openrouter.parseCompletion({ choices: [{ finish_reason: 'stop', message: { content: '', reasoning: 'Answer: {"ok":true}' } }] })).toBe('{"ok":true}');
    expect(PROVIDERS.openrouter.parseCompletion({ choices: [{ message: { content: '{"ok":true}', reasoning: 'draft' } }] })).toBe('{"ok":true}');
  });

  it('recuperação não contorna validação de IDs reais', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(thinking)).mockResolvedValueOnce(answer('{"spans":[{"firstWordId":"inventado","lastWordId":"w47"}]}'));
    const report = await discover(providerCompleter('openrouter', KEY, MODEL));
    expect(report.accepted).toBe(0);
    expect(report.warning?.code).toBe('M4F-1113');
  });

  it('recupera no tamanho de 30–60 segundos usado no relato', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(thinking)).mockResolvedValueOnce(answer('{"spans":[{"firstWordId":"w0","lastWordId":"w95"}]}'));
    const report = await discoverContextualMoments(words(160), 81, { length: 'medio', count: 4 }, { source: 'ia-chave', complete: providerCompleter('openrouter', KEY, MODEL) }, new AbortController().signal, () => {});
    expect(report.warning).toBeNull();
    expect(report.accepted).toBe(1);
    const clip = report.moments.find(m => m.sourceEvidence?.source === 'ai-context')!;
    expect(clip.end - clip.start).toBeGreaterThanOrEqual(30);
    expect(clip.end - clip.start).toBeLessThanOrEqual(60);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('recupera length com raciocínio oculto, sem depender de expor o pensamento', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ choices: [{ finish_reason: 'length', message: { content: null } }] })).mockResolvedValueOnce(answer('{"ok":true}'));
    await expect(providerCompleter('openrouter', KEY, MODEL)(messages)).resolves.toBe('{"ok":true}');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('segunda rejeição de raciocínio é terminal e não ecoa corpo remoto', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response({ error: { message: `Reasoning is mandatory. Private transcript and ${KEY}` } }, 400));
    const report = await discover(providerCompleter('openrouter', KEY, MODEL), 4000);
    const error = report.warning!;
    expect(error.code).toBe('M4F-1018');
    expect(error.detail).toBe('openrouter.ai HTTP 400');
    expect(JSON.stringify(error)).not.toContain(KEY);
    expect(JSON.stringify(error)).not.toContain('Private transcript');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(report.failed).toBe(1);
  });

  it.each(['connection', 'task'])('microteste %s usa a mesma recuperação limitada', async kind => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(thinking)).mockResolvedValueOnce(answer(kind === 'task' ? '{"melhor":"B"}' : '{"ok":true}'));
    const promise = kind === 'task' ? testModelForTask('openrouter', KEY, MODEL, 'moment-ranking') : testModel('openrouter', KEY, MODEL);
    await expect(promise).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('não repete chamada de outro provedor por length vazio', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(thinking));
    await expect(providerCompleter('groq', KEY, MODEL)(messages)).rejects.toHaveProperty('code');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('reserva teto de saída real e barra recuperação que excederia orçamento', async () => {
    const project = 'synthetic-issue163';
    const policy = { ...DEFAULT_AI_POLICY, projectTokens: 4000 };
    await reserveRequest(project, '{"max_tokens":3000}', policy);
    expect(routingUsage(project).project.reservedTokens).toBe(3019);
    await expect(reserveRequest(project, '{"max_tokens":2000}', policy)).rejects.toMatchObject({ code: 'M4F-1219' });
    expect(routingUsage(project).project.requests).toBe(1);
  });
});
