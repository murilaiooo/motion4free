import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { AppError } from '../core/errors';
import { LLM_KEYS, type LlmKey } from '../core/llm-models';
import type { AiMessages } from '../editorial/ai-brief';
import { APP_VERSION } from '../version';
import { PROVIDER_IDS, type PricingKind, type ProviderId } from './providers/registry';

export const AI_TASKS = ['creative-brief', 'local-revision', 'moment-ranking'] as const;
export type AiTask = typeof AI_TASKS[number];
export type RouteChoice = { kind: 'rules' } | { kind: 'local'; model: LlmKey } | {
  kind: 'provider'; provider: ProviderId; remote: { id: string; label: string; pricing: PricingKind };
};
export type TaskRoutes = Partial<Record<AiTask, RouteChoice>>;
export type ProjectRoutes = Record<string, TaskRoutes>;
const routeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rules') }),
  z.object({ kind: z.literal('local'), model: z.enum(LLM_KEYS) }),
  z.object({ kind: z.literal('provider'), provider: z.enum(PROVIDER_IDS), remote: z.object({ id: z.string().min(1).max(300), label: z.string().max(300), pricing: z.enum(['gratis', 'cota', 'pago', 'desconhecido']) }) }),
]);
export function parseTaskRoutes(input: unknown): TaskRoutes {
  const result: TaskRoutes = {};
  if (!input || typeof input !== 'object') return result;
  for (const task of AI_TASKS) {
    const parsed = routeSchema.safeParse((input as Record<string, unknown>)[task]);
    if (parsed.success) result[task] = parsed.data;
  }
  return result;
}
export function parseProjectRoutes(input: unknown): ProjectRoutes {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).filter(([id]) => id.length <= 200).slice(0, 500).map(([id, routes]) => [id, parseTaskRoutes(routes)]));
}
export function withoutProvider(routes: TaskRoutes, provider: ProviderId): TaskRoutes {
  return Object.fromEntries(Object.entries(routes).filter(([, choice]) => choice?.kind !== 'provider' || choice.provider !== provider));
}

export const DEFAULT_AI_POLICY = { projectRequests: 20, projectTokens: 100_000, sessionRequests: 50, sessionTokens: 250_000, outputTokens: 800, timeoutMs: 45_000 };
const policySchema = z.object({
  projectRequests: z.number().int().min(0).max(1000), projectTokens: z.number().int().min(0).max(10_000_000),
  sessionRequests: z.number().int().min(0).max(1000), sessionTokens: z.number().int().min(0).max(10_000_000),
  outputTokens: z.number().int().min(128).max(4096), timeoutMs: z.number().int().min(5000).max(120_000),
});
export type AiPolicy = typeof DEFAULT_AI_POLICY;
export function parseAiPolicy(input: unknown): AiPolicy {
  const result = policySchema.safeParse(input);
  return result.success ? result.data : { ...DEFAULT_AI_POLICY };
}

interface Usage { requests: number; reservedTokens: number }
const emptyUsage = (): Usage => ({ requests: 0, reservedTokens: 0 });
const usageSchema = z.object({ requests: z.number().int().nonnegative(), reservedTokens: z.number().int().nonnegative() });
let sessionUsage = emptyUsage();
const memoryUsage = new Map<string, Usage>();
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { text: string; at: number }>();
const inflight = new Map<string, Promise<string>>();
let cacheHits = 0;
let cacheEpoch = 0;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => { revision++; for (const listener of listeners) listener(); };
export function useRoutingVersion(): number {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => revision, () => revision);
}
const usageKey = (project: string) => `m4f-ai-usage:${project}`;
export function projectUsage(project: string): Usage {
  const memory = memoryUsage.get(project) ?? emptyUsage();
  let raw: string | null;
  try { raw = localStorage.getItem(usageKey(project)); }
  catch { return memory; }
  if (!raw) return memory;
  let stored: Usage;
  try { stored = usageSchema.parse(JSON.parse(raw)); }
  catch { throw new AppError('IA_ORCAMENTO', 'contador local inválido'); }
  return { requests: Math.max(stored.requests, memory.requests), reservedTokens: Math.max(stored.reservedTokens, memory.reservedTokens) };
}
export function routingUsage(project: string) {
  return { project: projectUsage(project), session: sessionUsage, cacheHits, cached: cache.size };
}

/** Conservative byte-based input allowance plus requested output cap, not a provider invoice/token count. */
export async function reserveRequest(project: string, body: string, policy: AiPolicy): Promise<void> {
  const allowance = new TextEncoder().encode(body).length + policy.outputTokens;
  const reserve = () => {
    const current = projectUsage(project);
    if (current.requests + 1 > policy.projectRequests || current.reservedTokens + allowance > policy.projectTokens || sessionUsage.requests + 1 > policy.sessionRequests || sessionUsage.reservedTokens + allowance > policy.sessionTokens) throw new AppError('IA_ORCAMENTO');
    const next = { requests: current.requests + 1, reservedTokens: current.reservedTokens + allowance };
    // Synchronous reservation before fetch, including requests that later fail or time out.
    try { localStorage.setItem(usageKey(project), JSON.stringify(next)); }
    catch { /* In storage-restricted environments the limit lasts for this tab. */ }
    memoryUsage.set(project, next);
    sessionUsage = { requests: sessionUsage.requests + 1, reservedTokens: sessionUsage.reservedTokens + allowance };
    emit();
  };
  if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('m4f-ai-request-budget', reserve);
  else reserve();
}

interface Health { failures: number; until: number }
const health = new Map<ProviderId, Health>();
const healthKey = (provider: ProviderId) => `m4f-ai-health:${provider}`;
function getHealth(provider: ProviderId): Health {
  try {
    const raw = JSON.parse(localStorage.getItem(healthKey(provider)) ?? 'null') as Health | null;
    if (raw && Number.isFinite(raw.until) && Number.isFinite(raw.failures)) return raw;
  } catch { /* session-only on restricted storage */ }
  return health.get(provider) ?? { failures: 0, until: 0 };
}
function saveHealth(provider: ProviderId, state: Health) {
  health.set(provider, state);
  try { localStorage.setItem(healthKey(provider), JSON.stringify(state)); } catch { /* session-only */ }
  emit();
}
export function assertProviderReady(provider: ProviderId): void {
  const remaining = getHealth(provider).until - Date.now();
  if (remaining > 0) throw new AppError('IA_COOLDOWN', `Aguarde cerca de ${Math.ceil(remaining / 1000)} s; sem nova chamada automática.`);
}
export function noteProviderFailure(provider: ProviderId, status: number, retryAfter: string | null = null): void {
  const current = getHealth(provider);
  if (status === 429) {
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : 60_000;
    const duration = Number.isFinite(delay) ? Math.max(1000, Math.min(Number.MAX_SAFE_INTEGER - Date.now(), delay)) : 60_000;
    saveHealth(provider, { failures: current.failures + 1, until: Math.max(current.until, Date.now() + duration) });
  } else if (status === 0 || status >= 500) {
    const failures = current.failures + 1;
    saveHealth(provider, { failures, until: Math.max(current.until, failures >= 3 ? Date.now() + 60_000 : 0) });
  }
}
export function noteProviderSuccess(provider: ProviderId): void {
  // A success already in flight must not erase a newer 429 cooldown.
  const current = getHealth(provider);
  saveHealth(provider, { failures: 0, until: current.until > Date.now() ? current.until : 0 });
}

export async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function cachedCompletion(context: { project: string; task: AiTask; provider: string; model: string; account: number; outputTokens?: number }, messages: AiMessages, run: () => Promise<string>): Promise<string> {
  const epoch = cacheEpoch;
  const key = await fingerprint({ version: APP_VERSION, context, messages });
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) { cacheHits++; emit(); return hit.text; }
  if (inflight.has(key)) return inflight.get(key)!;
  const pending = run().then((text) => {
    // Keep at most 20 bounded replies in tab memory; never persist transcripts or model output.
    if (epoch === cacheEpoch && text.length <= 100_000) {
      cache.delete(key);
      while (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(key, { text, at: Date.now() });
    }
    return text;
  }).finally(() => { if (inflight.get(key) === pending) inflight.delete(key); emit(); });
  inflight.set(key, pending);
  return pending;
}
export function clearResponseCache(): void { cacheEpoch++; cache.clear(); inflight.clear(); emit(); }
export function resetRoutingSession(): void {
  cacheEpoch++; cache.clear(); inflight.clear(); memoryUsage.clear(); health.clear(); sessionUsage = emptyUsage(); cacheHits = 0; emit();
}
