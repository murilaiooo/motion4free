import { assertProviderReady, noteProviderFailure, noteProviderSuccess } from '../routing';
import { AppError } from '../../core/errors';
import type { AiMessages, Completer } from '../../editorial/ai-brief';
import { PROVIDERS, allowedUrl, providerErrorKey, sortModels, type HttpRequest, type ModelInfo, type ProviderId } from './registry';

const LIST_TIMEOUT_MS = 20_000;
const COMPLETE_TIMEOUT_MS = 45_000;
const MAX_PAGES = 10;

async function send(id: ProviderId, req: HttpRequest, _key: string, timeoutMs: number, outer?: AbortSignal): Promise<unknown> {
  if (!allowedUrl(id, req.url)) throw new AppError('PROVEDOR_BLOQUEADO', PROVIDERS[id].host);
  if (outer?.aborted) throw new AppError('PROVEDOR_CANCELADO');
  assertProviderReady(id);
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onOuter = () => ctrl.abort();
  outer?.addEventListener('abort', onOuter, { once: true });
  const host = PROVIDERS[id].host;
  try {
    const res = await fetch(req.url, {
      method: req.method, headers: req.headers, body: req.body, signal: ctrl.signal,
      redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
    });
    const text = await res.text();
    if (outer?.aborted) throw new AppError('PROVEDOR_CANCELADO');
    if (!res.ok) {
      noteProviderFailure(id, res.status, res.headers.get('retry-after'));
      // Não exibir corpo remoto: pode ecoar chave, transcrição ou dados da conta, mesmo truncado.
      throw new AppError(providerErrorKey(res.status, text), `${host} HTTP ${res.status}`);
    }
    noteProviderSuccess(id);
    try { return JSON.parse(text); }
    catch { throw new AppError('PROVEDOR_LISTA_FALHOU', `${host}: resposta não é JSON`); }
  } catch (err) {
    if (timedOut) { noteProviderFailure(id, 0); throw new AppError('PROVEDOR_DEMOROU', host); }
    if (outer?.aborted) throw new AppError('PROVEDOR_CANCELADO');
    if (err instanceof AppError) throw err;
    noteProviderFailure(id, 0);
    // Exceções de fetch também podem conter URLs ou cabeçalhos; nunca ecoá-las.
    throw new AppError('PROVEDOR_BLOQUEADO', host);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
}

/** Catálogo consultável; listar não comprova inferência, saldo nem autorização de uso. */
export async function listModels(id: ProviderId, key: string, signal?: AbortSignal): Promise<ModelInfo[]> {
  const spec = PROVIDERS[id];
  const all: ModelInfo[] = [];
  const pages = new Set<string>();
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const body = await send(id, spec.modelsRequest(key, page), key, LIST_TIMEOUT_MS, signal);
    const parsed = spec.parseModels(body);
    if (!parsed) throw new AppError('PROVEDOR_LISTA_FALHOU', spec.host);
    all.push(...parsed.models);
    if (!parsed.next) {
      const seen = new Set<string>();
      return sortModels(all.filter((model) => seen.has(model.id) ? false : (seen.add(model.id), true)));
    }
    if (pages.has(parsed.next)) break;
    pages.add(parsed.next);
    page = parsed.next;
  }
  // Catálogo parcial não pode desmarcar um modelo que ainda existe numa página seguinte.
  throw new AppError('PROVEDOR_LISTA_FALHOU', `${spec.host}: paginação incompleta`);
}

export interface CompletionOptions {
  signal?: AbortSignal;
  authorize?: (body: string) => Promise<boolean>;
  beforeSend?: (body: string) => Promise<void>;
  maxTokens?: number;
  timeoutMs?: number;
}

export function providerCompleter(id: ProviderId, key: string, modelId: string, options: CompletionOptions = {}): Completer {
  const spec = PROVIDERS[id];
  return async (messages: AiMessages) => {
    if (options.signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
    const req = spec.completeRequest(key, modelId, messages, options.maxTokens);
    if (options.authorize && !await options.authorize(req.body ?? '')) throw new AppError('PROVEDOR_CANCELADO');
    if (options.signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
    assertProviderReady(id);
    await options.beforeSend?.(req.body ?? '');
    const body = await send(id, req, key, options.timeoutMs ?? COMPLETE_TIMEOUT_MS, options.signal);
    const text = spec.parseCompletion(body);
    if (!text?.trim()) throw new AppError('IA_RESPOSTA_INVALIDA', spec.host);
    return text;
  };
}

/** One explicit, synthetic microtest for the selected editorial task.
 * Passing proves text + minimal structured output, NOT creative quality, ASR
 * support, updated price or available credits for a longer user request.
 */
export type TextAiTask = 'creative-brief' | 'moment-ranking' | 'local-revision';
const MICROTESTS: Record<TextAiTask, { system: string; user: string; field: string }> = {
  'creative-brief': {
    system: 'Responda APENAS JSON válido contendo o campo "ritmo" com valor "rapido".',
    user: 'Vídeo de teste fictício, deixe o ritmo rápido.',
    field: 'ritmo',
  },
  'moment-ranking': {
    system: 'Escolha o trecho B (que apresenta pergunta e resposta). Responda APENAS JSON com {"melhor":"B"}.',
    user: 'A: Boa tarde. B: Por que economizar? Para investir na educação.',
    field: 'melhor',
  },
  'local-revision': {
    system: 'Responda APENAS JSON com {"ajuste":"amarelo"} para a cor indicada.',
    user: 'Teste sintético, deixe a legenda amarela.',
    field: 'ajuste',
  },
};

export async function testModelForTask(id: ProviderId, key: string, modelId: string, task: TextAiTask, options: CompletionOptions = {}): Promise<void> {
  const spec = PROVIDERS[id];
  const sample = MICROTESTS[task];
  const expected = task === 'creative-brief' ? 'rapido' : task === 'moment-ranking' ? 'B' : 'amarelo';
  const messages: AiMessages = { system: sample.system, examples: [], user: sample.user };
  const req = spec.completeRequest(key, modelId, messages, 128);
  if (options.authorize && !await options.authorize(req.body ?? '')) throw new AppError('PROVEDOR_CANCELADO');
  if (options.signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
  assertProviderReady(id);
  await options.beforeSend?.(req.body ?? '');
  const body = await send(id, req, key, options.timeoutMs ?? COMPLETE_TIMEOUT_MS, options.signal);
  const text = spec.parseCompletion(body);
  if (!text?.trim()) throw new AppError('PROVEDOR_SEM_TEXTO', spec.host);
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text) as Record<string, unknown>; }
  catch { throw new AppError('IA_RESPOSTA_INVALIDA', 'O modelo não retornou JSON válido no microteste.'); }
  if (!parsed || typeof parsed !== 'object' || parsed[sample.field] !== expected) {
    throw new AppError('IA_RESPOSTA_INVALIDA', 'O modelo não seguiu a instrução estruturada do microteste.');
  }
}

/** Só a UI pode pedir esta operação, após autorização explícita do corpo e do possível custo. */
export async function testModel(id: ProviderId, key: string, modelId: string, options: CompletionOptions = {}): Promise<void> {
  const spec = PROVIDERS[id];
  const messages: AiMessages = { system: 'Responda somente com o JSON {"ok":true}.', examples: [], user: 'Teste de conexão do Motion4Free.' };
  const req = spec.completeRequest(key, modelId, messages, 128);
  if (options.authorize && !await options.authorize(req.body ?? '')) throw new AppError('PROVEDOR_CANCELADO');
  if (options.signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
  assertProviderReady(id);
  await options.beforeSend?.(req.body ?? '');
  const body = await send(id, req, key, options.timeoutMs ?? COMPLETE_TIMEOUT_MS, options.signal);
  if (!spec.parseCompletion(body)?.trim()) throw new AppError('PROVEDOR_SEM_TEXTO', spec.host);
}
