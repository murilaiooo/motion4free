import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertProviderReady, cachedCompletion, clearResponseCache, DEFAULT_AI_POLICY,
  noteProviderFailure, noteProviderSuccess, parseAiPolicy, parseProjectRoutes,
  parseTaskRoutes, projectUsage, reserveRequest, resetRoutingSession, routingUsage,
} from '../src/ai/routing';
import { prepareAi, type AiSettings } from '../src/app/AiOptions';
import type { AiMessages } from '../src/editorial/ai-brief';

const MSG: AiMessages = { system: 'regras', examples: [], user: 'crie um gancho' };
const context = { project: 'project-a', task: 'creative-brief' as const, provider: 'openrouter', model: 'free-model', account: 1 };
const POLICY = { ...DEFAULT_AI_POLICY, projectRequests: 1, sessionRequests: 2 };
const noKeySettings: AiSettings = {
  mode: 'regras', model: 'padrao', provider: null, remote: null, consent: [],
  taskRoutes: { 'creative-brief': { kind: 'provider', provider: 'openrouter', remote: { id: 'demo', label: 'Demo', pricing: 'desconhecido' } } },
};

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  });
  vi.stubGlobal('navigator', {});
  resetRoutingSession();
});
afterEach(() => {
  clearResponseCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('rotas, orçamentos e fallback explícitos (#9)', () => {
  it('saneia preferências inválidas e ignora tarefas/projetos desconhecidos', () => {
    expect(parseAiPolicy({ projectRequests: -1 })).toEqual(DEFAULT_AI_POLICY);
    expect(parseTaskRoutes({
      'creative-brief': { kind: 'rules' },
      'moment-ranking': { kind: 'provider', provider: 'desconhecido', remote: { id: 'x' } },
      dangerous: { kind: 'provider' },
    })).toEqual({ 'creative-brief': { kind: 'rules' } });
    expect(parseProjectRoutes({ 'p1': { 'local-revision': { kind: 'rules' } }, p2: 'invalid' })).toEqual({
      p1: { 'local-revision': { kind: 'rules' } },
      p2: {},
    });
  });

  it('impõe limites de pedidos por projeto sem afetar outro projeto e sem enviar requisições', async () => {
    await reserveRequest('project-a', '{"prompt":"x"}', POLICY);
    expect(projectUsage('project-a').requests).toBe(1);
    await expect(reserveRequest('project-a', 'outro', POLICY)).rejects.toMatchObject({ code: expect.stringMatching(/^M4F-/) });
    await reserveRequest('project-b', 'outro', POLICY);
    expect(routingUsage('project-b').session.requests).toBe(2);
    await expect(reserveRequest('project-c', 'outro', POLICY)).rejects.toMatchObject({ code: expect.stringMatching(/^M4F-/) });
  });

  it('orçamento de texto conserva capacidade de saída e zero pedidos bloqueia', async () => {
    const body = '{"hello":"world"}';
    const allowance = new TextEncoder().encode(body).length + 128;
    await expect(reserveRequest('x', body, { ...DEFAULT_AI_POLICY, projectRequests: 0 })).rejects.toBeTruthy();
    await expect(reserveRequest('x', body, { ...DEFAULT_AI_POLICY, projectTokens: allowance - 1, outputTokens: 128 })).rejects.toBeTruthy();
    await reserveRequest('x', body, { ...DEFAULT_AI_POLICY, projectTokens: allowance, outputTokens: 128 });
    expect(projectUsage('x')).toEqual({ requests: 1, reservedTokens: allowance });
  });

  it('429 impõe cooldown sem retries automáticos; sucesso antigo não apaga o cooldown', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    noteProviderFailure('groq', 429, '30');
    expect(() => assertProviderReady('groq')).toThrow();
    noteProviderSuccess('groq');
    expect(() => assertProviderReady('groq')).toThrow();
    now.mockReturnValue(130_001);
    expect(() => assertProviderReady('groq')).not.toThrow();
  });

  it('três falhas de rede ativam proteção temporária', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(200_000);
    noteProviderFailure('anthropic', 0);
    noteProviderFailure('anthropic', 502);
    expect(() => assertProviderReady('anthropic')).not.toThrow();
    noteProviderFailure('anthropic', 503);
    expect(() => assertProviderReady('anthropic')).toThrow();
    now.mockReturnValue(260_001);
    expect(() => assertProviderReady('anthropic')).not.toThrow();
  });

  it('reusa resposta por projeto/tarefa/modelo e elimina cache no reset', async () => {
    let calls = 0;
    const complete = async () => { calls++; return '{"ok":true}'; };
    expect(await cachedCompletion(context, MSG, complete)).toBe('{"ok":true}');
    expect(await cachedCompletion(context, MSG, complete)).toBe('{"ok":true}');
    expect(calls).toBe(1);
    await cachedCompletion({ ...context, task: 'moment-ranking' }, MSG, complete);
    await cachedCompletion({ ...context, project: 'project-b' }, MSG, complete);
    expect(calls).toBe(3);
    clearResponseCache();
    await cachedCompletion(context, MSG, complete);
    expect(calls).toBe(4);
  });

  it('respeita a escolha por tarefa/projeto e mantém edição por regras sem credencial', async () => {
    const progress = () => undefined;
    const external = await prepareAi(noKeySettings, progress, 'creative-brief', 'project-a');
    expect(external.ai).toBeNull();
    expect(external.warning).toBeTruthy();
    const manual = await prepareAi(noKeySettings, progress, 'moment-ranking', 'project-a');
    expect(manual.ai).toBeNull();
    expect(manual.warning).toBeNull();
    const onlyProject: AiSettings = {
      ...noKeySettings,
      projectRoutes: { 'project-a': { 'creative-brief': { kind: 'rules' } } },
    };
    const overridden = await prepareAi(onlyProject, progress, 'creative-brief', 'project-a');
    expect(overridden.ai).toBeNull();
    expect(overridden.warning).toBeNull();
    const elsewhere = await prepareAi(onlyProject, progress, 'creative-brief', 'project-b');
    expect(elsewhere.warning).toBeTruthy();
  });
});
