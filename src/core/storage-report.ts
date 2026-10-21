import { ASR_REPOS } from './asr-models';
import { CLIP_JOB_DIR } from './clip-job';
import { AppError, describeError } from './errors';
import { LLM_MODELS, type LlmKey } from './llm-models';
import { ROOT, deleteProject, listProjects, type ProjectSummary } from './project-library';
import { dirSize, type Fs } from './storage-fs';

/**
 * Tela "Armazenamento" (ADR-0016): quanto o Motion4Free ocupa neste navegador, por item, e como apagar.
 * Tudo o que toca o navegador entra por interfaces (`StorageDeps`), para os testes rodarem sem navegador.
 *
 * Onde cada coisa fica (conferido no código-fonte das bibliotecas, ver ADR-0016):
 * - projetos: OPFS, pasta `motion4free/` (e `motion4free-projeto/` da v0.10, até migrar);
 * - modelos de legenda (Transformers.js 4.3.1): Cache Storage `transformers-cache`, uma entrada por arquivo,
 *   com a URL do arquivo como chave (…/onnx-community/whisper-…/resolve/main/…) — inclui o runtime ONNX (ort-wasm);
 * - modelos de IA (WebLLM 0.2.85, `cacheBackend: "cache"`): Cache Storage `webllm/model` (pesos + tokenizer),
 *   `webllm/config` (mlc-chat-config.json) e `webllm/wasm` (biblioteca WebGPU do modelo);
 * - qualquer outro cache, banco IndexedDB ou pasta do OPFS desta origem também é do app.
 */

export interface CacheEntry {
  url: string;
  bytes: number;
}

export interface CacheBackend {
  names(): Promise<string[]>;
  /** só as URLs (rápido: não mede nada) */
  urls(cache: string): Promise<string[]>;
  entries(cache: string): Promise<CacheEntry[]>;
  deleteEntries(cache: string, urls: string[]): Promise<void>;
  deleteCache(cache: string): Promise<void>;
}

export interface IdbBackend {
  /** null = o navegador não sabe listar os bancos */
  names(): Promise<string[] | null>;
  remove(name: string): Promise<void>;
}

export interface Estimate {
  usage: number;
  quota: number;
  /** Chrome: { caches, fileSystem, indexedDB, serviceWorkerRegistrations } */
  details?: Record<string, number>;
}

export interface QuotaBackend {
  estimate(): Promise<Estimate | null>;
  persisted(): Promise<boolean | null>;
  persist(): Promise<boolean | null>;
}

export interface PrefsBackend {
  keys(): string[];
  remove(key: string): void;
}

export interface StorageDeps {
  fs: Fs | null;
  caches: CacheBackend | null;
  idb: IdbBackend | null;
  quota: QuotaBackend | null;
  prefs?: PrefsBackend | null;
}

export type ItemKind = 'project' | 'asr-model' | 'ai-model' | 'other';

export type StorageRef = { type: 'cache-entries'; cache: string; urls: string[] } | { type: 'fs'; path: string[] } | { type: 'idb'; name: string } | { type: 'project'; id: string };

export interface StorageItem {
  id: string;
  kind: ItemKind;
  label: string;
  detail: string;
  /** null = o navegador não informa o tamanho */
  bytes: number | null;
  refs: StorageRef[];
  project?: ProjectSummary;
}

export interface StorageReport {
  estimate: Estimate | null;
  persisted: boolean | null;
  projects: StorageItem[];
  asrModels: StorageItem[];
  aiModels: StorageItem[];
  other: StorageItem[];
  /** soma do que foi medido item a item */
  measuredBytes: number;
  /** usado (estimate) − medido: espaço que o navegador conta mas não dá para separar */
  unaccountedBytes: number;
  problems: AppError[];
}

const ASR_LABELS: Record<string, string> = {
  [ASR_REPOS.turbo]: 'Whisper large-v3-turbo',
  [ASR_REPOS.small]: 'Whisper small',
  [ASR_REPOS.base]: 'Whisper base',
};
const ASR_DETAILS: Record<string, string> = {
  [ASR_REPOS.turbo]: 'Legenda no modo Precisa, na placa de vídeo',
  [ASR_REPOS.small]: 'Legenda no modo Precisa, no processador',
  [ASR_REPOS.base]: 'Legenda no modo Rápida (e reserva)',
};

const HF_REPO = /(?:\/hf\/|huggingface\.co\/)([\w.-]+\/[\w.-]+)\/resolve\//;

function llmKeyFor(url: string): LlmKey | null {
  // a biblioteca WebGPU muda de pasta a cada versão do WebLLM: compara só o nome do arquivo
  for (const m of Object.values(LLM_MODELS)) if (url.includes(`${m.repo}/`) || url.endsWith(`/${m.lib.split('/').pop()}`)) return m.key;
  return null;
}

/** Em que item da tela cai cada arquivo guardado no Cache Storage. */
export function classifyCacheEntry(cache: string, url: string): { id: string; kind: ItemKind; label: string; detail: string } {
  const llm = llmKeyFor(url);
  if (llm) {
    const m = LLM_MODELS[llm];
    return { id: `ai:${llm}`, kind: 'ai-model', label: `IA ${m.label.split(' — ')[0]}`, detail: 'Modelo da IA no navegador (opcional, para entender pedidos)' };
  }
  const repo = HF_REPO.exec(url)?.[1];
  if (repo && /whisper/i.test(repo)) {
    return { id: `asr:${repo}`, kind: 'asr-model', label: ASR_LABELS[repo] ?? repo.split('/')[1]!, detail: ASR_DETAILS[repo] ?? 'Modelo de legenda de uma versão anterior do app' };
  }
  if (cache.startsWith('webllm/')) {
    return repo
      ? { id: `ai:${repo}`, kind: 'ai-model', label: repo.split('/')[1]!, detail: 'Modelo de IA de uma versão anterior do app' }
      : { id: 'other:webllm', kind: 'other', label: 'Outros arquivos da IA no navegador', detail: 'Bibliotecas e configurações da IA' };
  }
  if (cache === 'transformers-cache') {
    return /onnxruntime|ort-wasm/.test(url)
      ? { id: 'other:asr-runtime', kind: 'other', label: 'Motor da transcrição (ONNX Runtime)', detail: 'Programa que roda os modelos de legenda; baixa de novo quando precisar' }
      : { id: 'other:transformers', kind: 'other', label: 'Outros arquivos da transcrição', detail: 'Arquivos auxiliares dos modelos de legenda' };
  }
  return { id: `other:cache:${cache}`, kind: 'other', label: `Cache "${cache}"`, detail: 'Arquivos guardados pelo app' };
}

/** Quais repositórios de modelo já estão no cache (para saber se vai haver download). */
export async function cachedRepos(caches: CacheBackend | null): Promise<Set<string>> {
  const out = new Set<string>();
  if (!caches) return out;
  for (const name of await caches.names()) {
    for (const url of await caches.urls(name)) {
      const repo = HF_REPO.exec(url)?.[1];
      if (repo) out.add(repo);
    }
  }
  return out;
}

export async function measureStorage(deps: StorageDeps): Promise<StorageReport> {
  const problems: AppError[] = [];
  const estimate = deps.quota ? await deps.quota.estimate().catch(() => null) : null;
  if (!estimate) problems.push(new AppError('MEDIDA_INDISPONIVEL', deps.quota ? 'navigator.storage.estimate falhou' : 'navigator.storage.estimate ausente'));
  const persisted = deps.quota ? await deps.quota.persisted().catch(() => null) : null;

  const projects: StorageItem[] = [];
  const other: StorageItem[] = [];
  if (!deps.fs) problems.push(new AppError('PROJETOS_INDISPONIVEIS', 'navigator.storage.getDirectory ausente'));
  else {
    try {
      for (const p of await listProjects(deps.fs)) {
        projects.push({ id: `project:${p.id}`, kind: 'project', label: p.name, detail: p.video.name, bytes: p.sizeBytes, refs: [{ type: 'project', id: p.id }], project: p });
      }
      // outras pastas no OPFS desta origem (projeto da v0.10 ainda não migrado, caches de bibliotecas)
      for (const e of (await deps.fs.list([])) ?? []) {
        if (e.name === ROOT) continue;
        const size = e.kind === 'dir' ? await dirSize(deps.fs, [e.name]) : ((await deps.fs.readFile([e.name]))?.size ?? 0);
        other.push({ id: `fs:${e.name}`, kind: 'other', label: e.name === 'motion4free-projeto' ? 'Projeto da versão anterior' : e.name === CLIP_JOB_DIR ? 'Análise do último vídeo longo (Clipes)' : `Pasta "${e.name}"`, detail: e.name === CLIP_JOB_DIR ? 'Fala transcrita e energia do áudio; o vídeo longo não é copiado' : 'Arquivos no armazenamento privado do navegador', bytes: size, refs: [{ type: 'fs', path: [e.name] }] });
      }
    } catch (err) {
      problems.push(new AppError('LISTA_FALHOU', describeError(err)));
    }
  }

  const groups = new Map<string, StorageItem>();
  if (!deps.caches) problems.push(new AppError('CACHE_INDISPONIVEL', 'Cache Storage (caches) ausente'));
  else {
    try {
      for (const name of await deps.caches.names()) {
        for (const e of await deps.caches.entries(name)) {
          const c = classifyCacheEntry(name, e.url);
          let item = groups.get(c.id);
          if (!item) {
            item = { ...c, bytes: 0, refs: [] };
            groups.set(c.id, item);
          }
          item.bytes = (item.bytes ?? 0) + e.bytes;
          let ref = item.refs.find((r): r is Extract<StorageRef, { type: 'cache-entries' }> => r.type === 'cache-entries' && r.cache === name);
          if (!ref) {
            ref = { type: 'cache-entries', cache: name, urls: [] };
            item.refs.push(ref);
          }
          ref.urls.push(e.url);
        }
      }
    } catch (err) {
      problems.push(new AppError('CACHE_INDISPONIVEL', describeError(err)));
    }
  }
  const all = [...groups.values()].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));

  if (deps.idb) {
    const names = await deps.idb.names().catch(() => null);
    if (names && names.length) {
      other.push({ id: 'idb', kind: 'other', label: 'Bancos de dados do navegador (IndexedDB)', detail: names.join(', '), bytes: estimate?.details?.indexedDB ?? null, refs: names.map((name) => ({ type: 'idb' as const, name })) });
    }
  }

  const asrModels = all.filter((i) => i.kind === 'asr-model');
  const aiModels = all.filter((i) => i.kind === 'ai-model');
  const otherAll = [...all.filter((i) => i.kind === 'other'), ...other];
  const measuredBytes = [...projects, ...asrModels, ...aiModels, ...otherAll].reduce((s, i) => s + (i.bytes ?? 0), 0);
  return {
    estimate,
    persisted,
    projects,
    asrModels,
    aiModels,
    other: otherAll,
    measuredBytes,
    unaccountedBytes: estimate ? Math.max(0, estimate.usage - measuredBytes) : 0,
    problems,
  };
}

/** Apaga um item da tela. Devolve o espaço liberado (o que foi medido). */
export async function deleteItem(deps: StorageDeps, item: StorageItem): Promise<number> {
  const failed: string[] = [];
  for (const ref of item.refs) {
    try {
      if (ref.type === 'project') {
        if (!deps.fs) throw new Error('OPFS ausente');
        await deleteProject(deps.fs, ref.id);
      } else if (ref.type === 'fs') {
        if (!deps.fs) throw new Error('OPFS ausente');
        await deps.fs.remove(ref.path);
      } else if (ref.type === 'cache-entries') {
        if (!deps.caches) throw new Error('Cache Storage ausente');
        await deps.caches.deleteEntries(ref.cache, ref.urls);
        // cache que ficou vazio sai inteiro (libera também o espaço de controle)
        if ((await deps.caches.urls(ref.cache)).length === 0) await deps.caches.deleteCache(ref.cache);
      } else {
        if (!deps.idb) throw new Error('IndexedDB ausente');
        await deps.idb.remove(ref.name);
      }
    } catch (err) {
      failed.push(`${ref.type}${'cache' in ref ? ` ${ref.cache}` : ''}: ${describeError(err)}`);
    }
  }
  if (failed.length) throw new AppError('APAGAR_FALHOU', `${item.label} — ${failed.join('; ')}`);
  return item.bytes ?? 0;
}

/** Preferências guardadas pelo app no localStorage (tema, precisão da legenda, chave própria). */
export const PREFS_PREFIX = 'm4f-';

/** "Apagar tudo do Motion4Free": projetos, modelos, caches, bancos e preferências desta origem. */
export async function deleteEverything(deps: StorageDeps): Promise<void> {
  const failed: string[] = [];
  const attempt = async (what: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
    } catch (err) {
      failed.push(`${what}: ${describeError(err)}`);
    }
  };
  if (deps.fs) {
    const fs = deps.fs;
    for (const e of (await fs.list([]).catch(() => null)) ?? []) await attempt(`pasta ${e.name}`, () => fs.remove([e.name]));
  }
  if (deps.caches) {
    const caches = deps.caches;
    for (const name of await caches.names().catch(() => [] as string[])) await attempt(`cache ${name}`, () => caches.deleteCache(name));
  }
  if (deps.idb) {
    const idb = deps.idb;
    for (const name of (await idb.names().catch(() => null)) ?? []) await attempt(`banco ${name}`, () => idb.remove(name));
  }
  if (deps.prefs) {
    const prefs = deps.prefs;
    for (const k of prefs.keys().filter((k) => k.startsWith(PREFS_PREFIX))) await attempt(`preferência ${k}`, () => prefs.remove(k));
  }
  if (failed.length) throw new AppError('APAGAR_FALHOU', failed.join('; '));
}

export interface SpaceCheck {
  ok: boolean;
  /** espaço livre segundo o navegador (null = não informa) */
  free: number | null;
  needed: number;
}

/**
 * Cabe? Compara o que vai ser gravado (+10% de folga) com a cota livre informada pelo navegador.
 * Sem estimativa, não bloqueia nada (a gravação em si avisa se falhar: M4F-601/M4F-604).
 */
export function spaceCheck(estimate: Pick<Estimate, 'usage' | 'quota'> | null, neededBytes: number, margin = 0.1): SpaceCheck {
  if (!estimate || !Number.isFinite(estimate.quota) || estimate.quota <= 0) return { ok: true, free: null, needed: neededBytes };
  const free = Math.max(0, estimate.quota - estimate.usage);
  return { ok: neededBytes * (1 + margin) <= free, free, needed: neededBytes };
}
