import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Settings2, Sparkles } from 'lucide-react';
import { AppError, toAppError } from '../core/errors';
import { formatBytes } from '../core/bytes';
import { DEFAULT_LLM, LLM_KEYS, LLM_MODELS, bestFittingModel, localAiProgress, modelFit, type LlmKey } from '../core/llm-models';
import type { OnProgress } from '../core/progress';
import { LOCAL_AI_ENABLED, loadLocalAi, webGpuAvailable } from '../ai/local-ai';
import { localModelCapacity } from '../ai/local-capacity';
import { credentialRevision, getKey, onCredentialChange, useKeysVersion } from '../ai/credentials/keys';
import { providerCompleter } from '../ai/providers/client';
import { authorizeRequest } from '../ai/providers/consent';
import { PROVIDERS, isProviderId, type PricingKind, type ProviderId } from '../ai/providers/registry';
import type { AiChoice } from '../editorial/ai-brief';
import { cachedCompletion, clearResponseCache, DEFAULT_AI_POLICY, parseAiPolicy, parseProjectRoutes, parseTaskRoutes, reserveRequest, resetRoutingSession, withoutProvider, type AiPolicy, type AiTask, type ProjectRoutes, type TaskRoutes } from '../ai/routing';
import { openSettings } from './settings/route';

/**
 * Escolha de IA do app inteiro (v0.27, issue #73). Fica em Configurações › IA e provedores e vale para o
 * pedido geral, o pedido de trecho e o criador de clipes. Guardada neste navegador SEM a chave:
 * as chaves ficam em src/ai/credentials/keys.ts (memória da aba ou cofre cifrado).
 */
export type AiMode = 'regras' | 'local' | 'provedor';

export interface AiSettings {
  mode: AiMode;
  /** tamanho da IA no navegador */
  model: LlmKey;
  /** serviço escolhido para o modo "provedor" */
  provider: ProviderId | null;
  /** modelo escolhido no serviço (ID técnico + nome para mostrar) */
  remote: { id: string; label: string; pricing: PricingKind } | null;
  /** serviços para os quais a pessoa autorizou enviar texto */
  consent: ProviderId[];
  taskRoutes?: TaskRoutes;
  projectRoutes?: ProjectRoutes;
  policy?: AiPolicy;
}

const PREFS_KEY = 'm4f-ia';
const DEFAULTS: AiSettings = { mode: 'regras', model: DEFAULT_LLM, provider: null, remote: null, consent: [] };

function read(): AiSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<AiSettings> | null;
    if (!raw || typeof raw !== 'object') return DEFAULTS;
    const mode: AiMode = raw.mode === 'local' || raw.mode === 'provedor' ? raw.mode : 'regras';
    const remote = raw.remote && typeof raw.remote.id === 'string' && typeof raw.remote.label === 'string' ? { id: raw.remote.id, label: raw.remote.label, pricing: raw.remote.pricing ?? 'desconhecido' } : null;
    return {
      mode: mode === 'local' && !LOCAL_AI_ENABLED ? 'regras' : mode,
      model: LLM_KEYS.includes(raw.model as LlmKey) ? (raw.model as LlmKey) : DEFAULT_LLM,
      provider: isProviderId(raw.provider) ? raw.provider : null,
      remote,
      taskRoutes: parseTaskRoutes(raw.taskRoutes),
      projectRoutes: parseProjectRoutes(raw.projectRoutes),
      policy: parseAiPolicy(raw.policy),
      consent: Array.isArray(raw.consent) ? raw.consent.filter(isProviderId) : [],
    };
  } catch {
    return DEFAULTS;
  }
}

let prefs: AiSettings = read();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

onCredentialChange((id) => {
  clearResponseCache();
  setAiSettings({
    ...(prefs.provider === id ? { remote: null } : {}),
    taskRoutes: withoutProvider(prefs.taskRoutes ?? {}, id),
    projectRoutes: Object.fromEntries(Object.entries(prefs.projectRoutes ?? {}).map(([project, routes]) => [project, withoutProvider(routes, id)])),
  });
});

let activeAiProject = 'session';
export function setActiveAiProject(id: string | null): void {
  activeAiProject = id ?? 'session';
  listeners.forEach((listener) => listener());
}
export function activeAiScope(): string { return activeAiProject; }

function routed(s: AiSettings, task: AiTask, project: string): AiSettings {
  const choice = s.projectRoutes?.[project]?.[task] ?? s.taskRoutes?.[task];
  if (!choice) return s;
  if (choice.kind === 'rules') return { ...s, mode: 'regras' };
  if (choice.kind === 'local') return { ...s, mode: 'local', model: choice.model };
  return { ...s, mode: 'provedor', provider: choice.provider, remote: choice.remote };
}

/** Muda a escolha de IA (e guarda neste navegador, sem nenhuma chave). */
export function setAiSettings(patch: Partial<AiSettings>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sem armazenamento: vale até fechar a aba
  }
  listeners.forEach((l) => l());
}

export function getAiSettings(): AiSettings {
  return prefs;
}

/** Depois de "Apagar tudo": volta ao padrão (só regras), sem tocar no localStorage já limpo. */
export function resetAiSettings(): void {
  prefs = DEFAULTS;
  resetRoutingSession();
  listeners.forEach((l) => l());
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, () => prefs, () => prefs);
}

/**
 * Prepara a IA escolhida. Falha ao carregar a IA do navegador, falta de chave, de modelo ou de autorização
 * não impedem o pedido: devolvem o aviso com código próprio e o pedido segue pelas regras.
 */
export async function prepareAi(s: AiSettings, setBusy: OnProgress, task: AiTask = 'creative-brief', project = activeAiProject, signal?: AbortSignal): Promise<{ ai: AiChoice | null; warning: AppError | null }> {
  if (signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
  s = routed(s, task, project);
  if (s.mode === 'local') {
    try {
      const capacity = await localModelCapacity();
      const suggested = bestFittingModel(s.model, capacity.free, capacity.cached);
      // Quota reported by Brave is advisory, not a hard limit. Offer a smaller model
      // before starting a multi-GB download, but never silently change the user's choice.
      if (suggested !== s.model && !capacity.cached.has(s.model)) {
        const alternative = suggested ? ` Em Configurações → IA, escolha ${LLM_MODELS[suggested].label.split(' (')[0]}.` : ' Abra Armazenamento para liberar espaço.';
        return { ai: null, warning: new AppError('IA_SEM_ESPACO', `Estimativa do navegador: ${capacity.free === null ? 'desconhecida' : formatBytes(capacity.free)} disponíveis; ${LLM_MODELS[s.model].label.split(' (')[0]} baixa cerca de ${formatBytes(LLM_MODELS[s.model].downloadMB * 1024 * 1024)}.${alternative} A estimativa pode ser menor que o espaço real (Brave).`) };
      }
      const local = await loadLocalAi(s.model, (f, t) => setBusy(localAiProgress(s.model, f, t)));
      setBusy({ label: 'A IA no navegador está lendo o pedido', phase: 'ia-ler', fraction: null, detail: `pode levar até ${LLM_MODELS[s.model].timeoutSec} s` });
      if (signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
      return { ai: { complete: async (messages) => {
        if (signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
        const response = await cachedCompletion({ project, task, provider: 'local', model: s.model, account: 0 }, messages, () => local.complete(messages));
        if (signal?.aborted) throw new AppError('PROVEDOR_CANCELADO');
        return response;
      }, source: 'ia-local' }, warning: null };
    } catch (err) {
      return { ai: null, warning: toAppError(err, 'IA_LOCAL_FALHOU') };
    }
  }
  if (s.mode === 'provedor') {
    if (!s.provider || !s.remote) return { ai: null, warning: new AppError('IA_SEM_MODELO') };
    const key = getKey(s.provider);
    if (!key) return { ai: null, warning: new AppError('IA_SEM_CHAVE', PROVIDERS[s.provider].name) };
    if (!s.consent.includes(s.provider)) return { ai: null, warning: new AppError('IA_SEM_AUTORIZACAO', PROVIDERS[s.provider].name) };
    setBusy({ label: `Consultando ${s.remote.label} (${PROVIDERS[s.provider].name}), só texto`, phase: 'ia-chave', fraction: null, detail: 'o vídeo continua neste computador' });
    const provider = s.provider;
    const model = s.remote.id;
    const revision = credentialRevision(provider);
    return { ai: { complete: async (messages) => {
      // prepareAi pode ser guardado por uma operação longa: nunca reutilizar chave/autorização revogada.
      const current = routed(getAiSettings(), task, project);
      if (credentialRevision(provider) !== revision || getKey(provider) !== key || current.mode !== 'provedor' || current.provider !== provider || current.remote?.id !== model || !current.consent.includes(provider)) throw new AppError('PROVEDOR_CANCELADO');
      const ctrl = new AbortController();
      const cancel = () => ctrl.abort();
      if (signal?.aborted) cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      const unsubscribeKey = onCredentialChange((id) => { if (id === provider) cancel(); });
      listeners.add(cancel);
      try {
        const policy = current.policy ?? DEFAULT_AI_POLICY;
        const response = await cachedCompletion({ project, task, provider, model, account: revision, outputTokens: policy.outputTokens }, messages, () => providerCompleter(provider, key, model, {
          signal: ctrl.signal,
          authorize: (body) => authorizeRequest(provider, model, body, ctrl.signal),
          beforeSend: (body) => reserveRequest(project, body, policy),
          maxTokens: policy.outputTokens, timeoutMs: policy.timeoutMs,
        })(messages));
        if (ctrl.signal.aborted) throw new AppError('PROVEDOR_CANCELADO');
        return response;
      } finally {
        unsubscribeKey();
        signal?.removeEventListener('abort', cancel);
        listeners.delete(cancel);
      }
    }, source: 'ia-chave' }, warning: null };
  }
  return { ai: null, warning: null };
}

/** Nome curto da IA em uso, para a linha "IA: … · Alterar". */
export function aiLabel(s: AiSettings): string {
  if (s.mode === 'local') return `IA no navegador, ${LLM_MODELS[s.model].label.split(' (')[0]!.toLowerCase()}`;
  if (s.mode === 'provedor') return s.provider && s.remote ? `${s.remote.label} (${PROVIDERS[s.provider].name})` : 'serviço com sua chave (nenhum modelo escolhido)';
  return 'só regras';
}

/** Problema que impede usar a IA escolhida agora, em uma frase (ou null se está tudo pronto). */
export function aiProblem(s: AiSettings): string | null {
  if (s.mode !== 'provedor') return null;
  if (!s.provider || !s.remote) return 'Falta escolher um modelo.';
  if (!getKey(s.provider)) return 'A chave não está aberta nesta aba.';
  if (!s.consent.includes(s.provider)) return 'Falta autorizar o envio de texto.';
  return null;
}

/**
 * Atalho da mesa de edição e do criador de clipes: mostra qual IA está em uso e leva para Configurações.
 * As opções técnicas (chaves, modelos, tamanhos) não ficam na mesa.
 */
export function AiStatusLine() {
  const s = useAiSettings();
  useKeysVersion();
  const problem = aiProblem(s);
  return (
    <div className={`ai-status ${problem ? 'warn' : ''}`} data-testid="ai-status">
      <Sparkles size={15} aria-hidden />
      <span>
        <b>IA: {aiLabel(s)}{Object.keys(s.taskRoutes ?? {}).length || Object.keys(s.projectRoutes ?? {}).length ? ' · com escolhas por tarefa' : ''}</b>
        <small className="hint">
          {problem
            ? `${problem} Enquanto isso, os pedidos usam as regras.`
            : s.mode === 'regras'
              ? 'As regras entendem pedidos comuns, sem internet. Uma IA entende pedidos mais livres.'
              : s.mode === 'local'
                ? 'Roda neste computador; nada sai dele.'
                : 'Só o texto do pedido e trechos da fala vão para o serviço; o vídeo fica aqui.'}
        </small>
      </span>
      <button type="button" className="sm" onClick={() => openSettings('ia')} data-testid="ai-change">
        <Settings2 size={14} aria-hidden /> Alterar
      </button>
    </div>
  );
}

/** Espaço livre para o app e modelos já no cache (issue #72): mede só quando a IA no navegador é escolhida. */
function useModelSpace(active: boolean): { free: number | null; cached: Set<LlmKey> } | null {
  const [space, setSpace] = useState<{ free: number | null; cached: Set<LlmKey> } | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void (async () => {
      const capacity = await localModelCapacity();
      if (alive) setSpace({ free: capacity.free, cached: new Set(capacity.cached) });
    })();
    return () => {
      alive = false;
    };
  }, [active]);
  return space;
}

const gb = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`);

export function useWebGpu(): boolean {
  return useMemo(webGpuAvailable, []);
}

/** Tamanhos da IA no navegador (Configurações › IA). */
export function LocalModelPicker() {
  const s = useAiSettings();
  const space = useModelSpace(LOCAL_AI_ENABLED && s.mode === 'local');
  return (
    <div className="set-sub" data-testid="ai-models">
      <p className="set-sub-title">Tamanho da IA no navegador</p>
      <p className="hint">Maior entende melhor, mas baixa mais e precisa de uma placa de vídeo mais forte. Na dúvida, use o Padrão; se der erro de memória (M4F-1013), troque pelo Leve.</p>
      {space && space.free !== null && (
        <p className="hint" data-testid="ai-space">
          O navegador informa <b>{formatBytes(space.free)}</b> livres para o app. Alguns navegadores (como o Brave) informam um número menor que o real para proteger a privacidade; por isso o app tenta baixar mesmo assim e só avisa (M4F-1014) se faltar espaço de verdade.
        </p>
      )}
      <div className="set-options">
        {LLM_KEYS.map((k) => {
          const m = LLM_MODELS[k];
          const fit = space ? modelFit(k, space.free, space.cached.has(k)) : 'desconhecido';
          return (
            <label className="set-option" key={k} data-fit={fit}>
              <input type="radio" name="ai-model" checked={s.model === k} onChange={() => setAiSettings({ model: k })} data-testid={`ai-model-${k}`} />
              <span>
                <b>{m.label}</b>
                <small className="hint">
                  {fit === 'baixado' ? 'Já baixado neste navegador' : `Baixa cerca de ${gb(m.downloadMB)} na primeira vez`}; precisa de uns {gb(m.vramMB)} livres na placa de vídeo.
                  {fit === 'nao-cabe' && <b> Maior que o espaço que o navegador informa; pode não caber.</b>}
                </small>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
