import { useSyncExternalStore } from 'react';
import type { ProviderId } from './registry';

export interface OutboundRequest {
  readonly id: number;
  readonly provider: ProviderId;
  readonly model: string;
  /** Corpo exato, sem cabeçalhos ou credenciais. Nunca persistido. */
  readonly body: string;
}

type Pending = { request: OutboundRequest; finish: (allowed: boolean) => void };
let sequence = 0;
let pending: Pending[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

/** Cada envio, inclusive reparo de JSON, exige consentimento para o corpo que será transmitido. */
export function authorizeRequest(provider: ProviderId, model: string, body: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const request: OutboundRequest = { id: ++sequence, provider, model, body };
    const finish = (allowed: boolean) => {
      signal.removeEventListener('abort', abort);
      pending = pending.filter((item) => item.request.id !== request.id);
      resolve(allowed && !signal.aborted);
      emit();
    };
    const abort = () => finish(false);
    signal.addEventListener('abort', abort, { once: true });
    pending.push({ request, finish });
    emit();
  });
}

export function answerRequest(id: number, allowed: boolean): void {
  pending.find((item) => item.request.id === id)?.finish(allowed);
}

export function useOutboundRequest(): OutboundRequest | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => pending[0]?.request ?? null,
    () => null,
  );
}
