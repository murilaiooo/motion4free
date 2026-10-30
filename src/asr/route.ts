import { useSyncExternalStore } from 'react';
import { getKey } from '../ai/credentials/keys';
import { PROVIDERS, isProviderId, type ProviderId } from '../ai/providers/registry';
import { ASR_APIS, isAsrProvider } from './remote-plan';

/**
 * Escolha de quem transcreve (issue #127), separada da IA de texto: Whisper local (padrão, nada sai do
 * computador) ou uma API de transcrição. A autorização para enviar ÁUDIO é própria: autorizar texto
 * para a IA não libera áudio. Guardada neste navegador, sem chave.
 */
export interface AsrRoute {
  kind: 'local' | 'api';
  provider: ProviderId | null;
  model: string | null;
  /** serviços para os quais a pessoa autorizou enviar o áudio da fala */
  audioConsent: ProviderId[];
  /** se a API não estiver pronta ou falhar: usar o Whisper local e avisar (true) ou parar e avisar (false) */
  fallbackLocal: boolean;
}

const KEY = 'm4f-asr';
const DEFAULTS: AsrRoute = { kind: 'local', provider: null, model: null, audioConsent: [], fallbackLocal: true };

function read(): AsrRoute {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AsrRoute> | null;
    if (!raw || typeof raw !== 'object') return DEFAULTS;
    const provider = isProviderId(raw.provider) && isAsrProvider(raw.provider) ? raw.provider : null;
    const model = provider && typeof raw.model === 'string' && ASR_APIS[provider]!.models.some((m) => m.id === raw.model) ? raw.model : provider ? ASR_APIS[provider]!.models[0]!.id : null;
    return {
      kind: raw.kind === 'api' ? 'api' : 'local',
      provider,
      model,
      audioConsent: Array.isArray(raw.audioConsent) ? raw.audioConsent.filter(isProviderId).filter(isAsrProvider) : [],
      fallbackLocal: raw.fallbackLocal !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

let route: AsrRoute = typeof localStorage === 'undefined' ? DEFAULTS : read();
const listeners = new Set<() => void>();

export function getAsrRoute(): AsrRoute { return route; }

export function setAsrRoute(patch: Partial<AsrRoute>): void {
  route = { ...route, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(route)); } catch { /* vale até fechar a aba */ }
  listeners.forEach((l) => l());
}

export function resetAsrRoute(): void {
  route = DEFAULTS;
  listeners.forEach((l) => l());
}

export function useAsrRoute(): AsrRoute {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => route, () => route);
}

/** O que falta para usar a API escolhida agora (ou null se está pronta). */
export function asrProblem(r: AsrRoute): string | null {
  if (r.kind !== 'api') return null;
  if (!r.provider || !r.model) return 'falta escolher o serviço de transcrição';
  if (!getKey(r.provider)) return `a chave do ${PROVIDERS[r.provider].name} não está aberta nesta aba`;
  if (!r.audioConsent.includes(r.provider)) return `falta autorizar enviar o áudio para o ${PROVIDERS[r.provider].name}`;
  return null;
}

export function asrRouteLabel(r: AsrRoute): string {
  if (r.kind === 'api' && r.provider && r.model) {
    const m = ASR_APIS[r.provider]!.models.find((x) => x.id === r.model);
    return `${m?.label ?? r.model} por API (${PROVIDERS[r.provider].name}) · envia o áudio`;
  }
  return 'Whisper neste computador · o áudio não sai daqui';
}
