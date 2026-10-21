import { LLM_KEYS, LLM_MODELS, type LlmKey } from '../core/llm-models';
import { cachedRepos } from '../core/storage-report';
import { storage } from '../app/project-store';

/** Browser quota is advisory (Brave may deliberately underreport it); never delete caches automatically. */
export async function localModelCapacity(): Promise<{ free: number | null; cached: ReadonlySet<LlmKey> }> {
  const estimate = await storage.quota?.estimate().catch(() => null);
  const repos = await cachedRepos(storage.caches).catch(() => new Set<string>());
  return {
    free: estimate ? Math.max(0, estimate.quota - estimate.usage) : null,
    cached: new Set(LLM_KEYS.filter((key) => repos.has(LLM_MODELS[key].repo))),
  };
}
