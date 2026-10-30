import { useSyncExternalStore } from 'react';
import type { ProviderId } from './registry';

export interface OutboundRequest {
  readonly id: number;
  readonly provider: ProviderId;
  readonly model: string;
  /** Corpo exato, sem cabeçalhos ou credenciais. Nunca persistido. */
  readonly body: string;
  /** Pedido faz parte de uma análise com várias partes: dá para autorizar todas de uma vez. */
  readonly batch: boolean;
}

type Pending = { request: OutboundRequest; finish: (allowed: boolean) => void };
let sequence = 0;
let pending: Pending[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

/** Análises (ex.: clipes de vídeo longo) cujos próximos envios ao mesmo serviço/modelo já foram autorizados. */
const approvedBatches = new WeakMap<object, string>();
const batches = new Map<number, object>();

/**
 * Cada envio, inclusive reparo de JSON, exige consentimento para o corpo que será transmitido.
 * `batch` (opcional) identifica uma análise com várias partes: a pessoa pode autorizar "esta e as próximas
 * partes desta análise" para o mesmo serviço e modelo. Vale só enquanto aquela análise existir.
 */
export function authorizeRequest(provider: ProviderId, model: string, body: string, signal: AbortSignal, batch?: object): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (batch && approvedBatches.get(batch) === `${provider}/${model}`) return Promise.resolve(true);
  return new Promise((resolve) => {
    const request: OutboundRequest = { id: ++sequence, provider, model, body, batch: !!batch };
    if (batch) batches.set(request.id, batch);
    const finish = (allowed: boolean) => {
      signal.removeEventListener('abort', abort);
      pending = pending.filter((item) => item.request.id !== request.id);
      batches.delete(request.id);
      resolve(allowed && !signal.aborted);
      emit();
    };
    const abort = () => finish(false);
    signal.addEventListener('abort', abort, { once: true });
    pending.push({ request, finish });
    emit();
  });
}

export function answerRequest(id: number, allowed: boolean, wholeBatch = false): void {
  const item = pending.find((entry) => entry.request.id === id);
  const batch = batches.get(id);
  if (item && allowed && wholeBatch && batch) approvedBatches.set(batch, `${item.request.provider}/${item.request.model}`);
  item?.finish(allowed);
}

export function useOutboundRequest(): OutboundRequest | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => pending[0]?.request ?? null,
    () => null,
  );
}
