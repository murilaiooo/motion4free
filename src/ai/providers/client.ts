import { AppError, describeError } from '../../core/errors';
import type { AiMessages, Completer } from '../../editorial/ai-brief';
import { PROVIDERS, allowedUrl, providerErrorKey, redact, sortModels, type HttpRequest, type ModelInfo, type ProviderId } from './registry';

/**
 * Rede dos serviços de IA com chave própria. O navegador fala DIRETO com o serviço escolhido:
 * sem servidor do Motion4Free no meio, sem cookies, sem seguir redirecionamento para outro domínio.
 * A chave vai só no cabeçalho, nunca na URL, e é apagada de qualquer texto de erro.
 * Não testado contra os serviços reais no ambiente de desenvolvimento (sem chaves); ver ADR-0028.
 */

const LIST_TIMEOUT_MS = 20_000;
const COMPLETE_TIMEOUT_MS = 45_000;
const MAX_PAGES = 10;

async function send(id: ProviderId, req: HttpRequest, key: string, timeoutMs: number, outer?: AbortSignal): Promise<unknown> {
  if (!allowedUrl(id, req.url)) throw new AppError('PROVEDOR_BLOQUEADO', `endereço fora da lista permitida de ${PROVIDERS[id].name}`);
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onOuter = () => ctrl.abort();
  outer?.addEventListener('abort', onOuter);
  const host = PROVIDERS[id].host;
  let res: Response;
  try {
    res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: ctrl.signal,
      redirect: 'error',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
  } catch (err) {
    if (timedOut) throw new AppError('PROVEDOR_DEMOROU', `${host}: mais de ${Math.round(timeoutMs / 1000)} s`);
    throw new AppError('PROVEDOR_BLOQUEADO', `${host}: ${redact(describeError(err), key)}`);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
  let text = '';
  try {
    text = await res.text();
  } catch (err) {
    throw new AppError('PROVEDOR_ERRO', `${host}: resposta interrompida (${redact(describeError(err), key)})`);
  }
  if (!res.ok) throw new AppError(providerErrorKey(res.status, text), `${host} HTTP ${res.status}: ${redact(text.replace(/\s+/g, ' ').slice(0, 200), key)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('PROVEDOR_LISTA_FALHOU', `${host}: resposta não é JSON`);
  }
}

/** Todos os modelos de texto que a chave consegue listar (sem gerar texto: listar não gasta cota de uso). */
export async function listModels(id: ProviderId, key: string, signal?: AbortSignal): Promise<ModelInfo[]> {
  const spec = PROVIDERS[id];
  const all: ModelInfo[] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const body = await send(id, spec.modelsRequest(key, page), key, LIST_TIMEOUT_MS, signal);
    const parsed = spec.parseModels(body);
    if (!parsed) throw new AppError('PROVEDOR_LISTA_FALHOU', `${spec.host}: formato inesperado`);
    all.push(...parsed.models);
    if (!parsed.next) break;
    page = parsed.next;
  }
  const seen = new Set<string>();
  return sortModels(all.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))));
}

/** Função que conversa com o modelo escolhido; lança AppError com código próprio em cada tipo de falha. */
export function providerCompleter(id: ProviderId, key: string, modelId: string): Completer {
  const spec = PROVIDERS[id];
  return async (m: AiMessages) => {
    const body = await send(id, spec.completeRequest(key, modelId, m), key, COMPLETE_TIMEOUT_MS);
    const text = spec.parseCompletion(body);
    if (!text) throw new AppError('IA_RESPOSTA_INVALIDA', `${spec.host}: resposta sem texto`);
    return text;
  };
}

/** Pedido mínimo para confirmar que o modelo responde de verdade. Gasta muito pouco da cota (poucos tokens). */
export async function testModel(id: ProviderId, key: string, modelId: string): Promise<void> {
  const spec = PROVIDERS[id];
  const m: AiMessages = { system: 'Responda somente com o JSON {"ok":true}.', examples: [], user: 'Teste de conexão do Motion4Free.' };
  const body = await send(id, spec.completeRequest(key, modelId, m, 32), key, COMPLETE_TIMEOUT_MS);
  // modelos que "pensam" podem gastar os 32 tokens pensando e voltar sem texto: a resposta 200 já prova acesso
  void spec.parseCompletion(body);
}
