import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory } from '../src/engine/history';
import { makeProject } from '../src/core/project';
import { LEGACY_DIR, saveProjectData, saveVideo } from '../src/core/project-library';
import { cachedRepos, classifyCacheEntry, deleteEverything, deleteItem, measureStorage, spaceCheck, type CacheBackend, type CacheEntry, type IdbBackend, type QuotaBackend, type StorageDeps } from '../src/core/storage-report';
import { MemoryFs } from './helpers/memory-fs';

class FakeCaches implements CacheBackend {
  readonly store = new Map<string, CacheEntry[]>();
  failDelete = false;
  put(cache: string, url: string, bytes: number) {
    const list = this.store.get(cache) ?? [];
    list.push({ url, bytes });
    this.store.set(cache, list);
  }
  async names() {
    return [...this.store.keys()];
  }
  async urls(cache: string) {
    return (this.store.get(cache) ?? []).map((e) => e.url);
  }
  async entries(cache: string) {
    return [...(this.store.get(cache) ?? [])];
  }
  async deleteEntries(cache: string, urls: string[]) {
    if (this.failDelete) throw new Error('negado');
    this.store.set(cache, (this.store.get(cache) ?? []).filter((e) => !urls.includes(e.url)));
  }
  async deleteCache(cache: string) {
    this.store.delete(cache);
  }
}

class FakeIdb implements IdbBackend {
  dbs = ['webllm/model'];
  async names() {
    return [...this.dbs];
  }
  async remove(name: string) {
    this.dbs = this.dbs.filter((d) => d !== name);
  }
}

const quota = (usage: number, quotaBytes: number, persisted = false): QuotaBackend => ({
  estimate: async () => ({ usage, quota: quotaBytes, details: { indexedDB: 1000 } }),
  persisted: async () => persisted,
  persist: async () => true,
});

const SITE = 'https://motion4free.example';
const words = [{ id: 'w1', text: 'Olá.', start: 0.1, end: 0.5 }];
const plan = autoEdit(3, [], words);

async function seeded(): Promise<{ deps: StorageDeps; fs: MemoryFs; caches: FakeCaches; prefs: Map<string, string> }> {
  const fs = new MemoryFs();
  await saveProjectData(fs, 'p-aaaa', makeProject({ video: { name: 'a.webm', size: 5000, durationSec: 3 }, words, silences: [], warnings: [], history: createHistory(plan), appVersion: 't', savedAt: 't' }), 'Fala A', 't');
  await saveVideo(fs, 'p-aaaa', new Blob([new Uint8Array(5000)]));
  const caches = new FakeCaches();
  caches.put('transformers-cache', `${SITE}/hf/onnx-community/whisper-base_timestamped/resolve/main/onnx/encoder_model_quantized.onnx`, 20_000_000);
  caches.put('transformers-cache', `${SITE}/hf/onnx-community/whisper-base_timestamped/resolve/main/config.json`, 2000);
  caches.put('transformers-cache', `https://huggingface.co/onnx-community/whisper-large-v3-turbo_timestamped/resolve/main/onnx/encoder_model_fp16.onnx`, 1_200_000_000);
  caches.put('transformers-cache', `${SITE}/cdn/npm/onnxruntime-web@1.24.0/dist/ort-wasm-simd-threaded.jsep.wasm`, 25_000_000);
  caches.put('webllm/model', `${SITE}/hf/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/resolve/main/params_shard_0.bin`, 30_000_000);
  caches.put('webllm/config', `${SITE}/hf/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json`, 1000);
  caches.put('webllm/wasm', `${SITE}/gh/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`, 4_000_000);
  caches.put('outra-coisa', `${SITE}/x.bin`, 10);
  const prefs = new Map([
    ['m4f-tema', 'light'],
    ['m4f-gemini-key', 'segredo'],
    ['de-outro-app', 'fica'],
  ]);
  const deps: StorageDeps = {
    fs,
    caches,
    idb: new FakeIdb(),
    quota: quota(1_400_000_000, 10_000_000_000),
    prefs: { keys: () => [...prefs.keys()], remove: (k) => void prefs.delete(k) },
  };
  return { deps, fs, caches, prefs };
}

describe('classificação dos arquivos em cache', () => {
  it('modelo de legenda pelo repositório (espelho do site ou Hugging Face direto)', () => {
    expect(classifyCacheEntry('transformers-cache', `${SITE}/hf/onnx-community/whisper-small_timestamped/resolve/main/x.onnx`)).toMatchObject({ kind: 'asr-model', label: 'Whisper small' });
    expect(classifyCacheEntry('transformers-cache', 'https://huggingface.co/onnx-community/whisper-tiny/resolve/main/x.onnx')).toMatchObject({ kind: 'asr-model', label: 'whisper-tiny' });
  });
  it('modelo de IA pelos pesos e pela biblioteca WebGPU', () => {
    expect(classifyCacheEntry('webllm/model', `${SITE}/hf/mlc-ai/Qwen3-4B-q4f16_1-MLC/resolve/main/a.bin`)).toMatchObject({ id: 'ai:forte', kind: 'ai-model' });
    expect(classifyCacheEntry('webllm/wasm', `${SITE}/gh/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Qwen3-4B-q4f16_1_cs1k-webgpu.wasm`)).toMatchObject({ id: 'ai:forte' });
  });
  it('runtime ONNX e caches desconhecidos vão para "outros"', () => {
    expect(classifyCacheEntry('transformers-cache', `${SITE}/cdn/npm/onnxruntime-web@1/dist/ort-wasm.wasm`).id).toBe('other:asr-runtime');
    expect(classifyCacheEntry('x', `${SITE}/a`).id).toBe('other:cache:x');
  });
});

describe('medição do armazenamento', () => {
  it('separa projetos, modelos de legenda, modelos de IA e outros, com tamanho de cada um', async () => {
    const { deps } = await seeded();
    const r = await measureStorage(deps);
    expect(r.problems).toEqual([]);
    expect(r.projects).toHaveLength(1);
    expect(r.projects[0]!.label).toBe('Fala A');
    expect(r.projects[0]!.bytes).toBeGreaterThan(5000);
    expect(r.asrModels.map((m) => m.label)).toEqual(['Whisper large-v3-turbo', 'Whisper base']);
    expect(r.asrModels[1]!.bytes).toBe(20_002_000);
    expect(r.aiModels).toHaveLength(1);
    expect(r.aiModels[0]!.bytes).toBe(34_001_000);
    expect(r.aiModels[0]!.refs.map((x) => (x.type === 'cache-entries' ? x.cache : '')).sort()).toEqual(['webllm/config', 'webllm/model', 'webllm/wasm']);
    expect(r.other.map((o) => o.id)).toEqual(expect.arrayContaining(['other:asr-runtime', 'other:cache:outra-coisa', 'idb']));
    expect(r.estimate?.quota).toBe(10_000_000_000);
    expect(r.persisted).toBe(false);
    expect(r.unaccountedBytes).toBe(Math.max(0, 1_400_000_000 - r.measuredBytes));
  });

  it('pasta antiga (v0.10) no OPFS aparece em "outros"', async () => {
    const { deps, fs } = await seeded();
    await fs.writeFile([LEGACY_DIR, 'video.bin'], new Blob([new Uint8Array(77)]));
    const r = await measureStorage(deps);
    expect(r.other.find((o) => o.id === `fs:${LEGACY_DIR}`)).toMatchObject({ label: 'Projeto da versão anterior', bytes: 77 });
  });

  it('navegador sem estimate, sem OPFS e sem Cache Storage: códigos próprios, sem quebrar', async () => {
    const r = await measureStorage({ fs: null, caches: null, idb: null, quota: null });
    expect(r.problems.map((p) => p.code)).toEqual(['M4F-607', 'M4F-608', 'M4F-609']);
    expect(r.projects).toEqual([]);
    expect(r.estimate).toBeNull();
  });

  it('sabe quais modelos já foram baixados', async () => {
    const { caches } = await seeded();
    const repos = await cachedRepos(caches);
    expect(repos.has('onnx-community/whisper-base_timestamped')).toBe(true);
    expect(repos.has('onnx-community/whisper-small_timestamped')).toBe(false);
  });
});

describe('apagar', () => {
  it('apagar um modelo tira só os arquivos dele e remove o cache que ficou vazio', async () => {
    const { deps, caches } = await seeded();
    const r = await measureStorage(deps);
    const freed = await deleteItem(deps, r.aiModels[0]!);
    expect(freed).toBe(34_001_000);
    expect(caches.store.has('webllm/model')).toBe(false);
    expect(caches.store.has('webllm/wasm')).toBe(false);
    const base = r.asrModels.find((m) => m.label === 'Whisper base')!;
    await deleteItem(deps, base);
    const after = await measureStorage(deps);
    expect(after.asrModels.map((m) => m.label)).toEqual(['Whisper large-v3-turbo']);
    expect(after.other.find((o) => o.id === 'other:asr-runtime')).toBeDefined();
  });

  it('apagar um projeto pela tela de armazenamento', async () => {
    const { deps } = await seeded();
    const r = await measureStorage(deps);
    expect(await deleteItem(deps, r.projects[0]!)).toBeGreaterThan(5000);
    expect((await measureStorage(deps)).projects).toEqual([]);
  });

  it('falha ao apagar vira M4F-610 com o que não saiu', async () => {
    const { deps, caches } = await seeded();
    const r = await measureStorage(deps);
    caches.failDelete = true;
    await expect(deleteItem(deps, r.asrModels[0]!)).rejects.toMatchObject({ code: 'M4F-610' });
  });

  it('"Apagar tudo" limpa OPFS, caches, bancos e preferências do app (e só as do app)', async () => {
    const { deps, fs, caches, prefs } = await seeded();
    await deleteEverything(deps);
    expect(await fs.list([])).toEqual([]);
    expect(caches.store.size).toBe(0);
    expect(await deps.idb!.names()).toEqual([]);
    expect([...prefs.keys()]).toEqual(['de-outro-app']);
  });
});

describe('aviso de pouco espaço', () => {
  it('cabe com folga de 10%', () => {
    expect(spaceCheck({ usage: 0, quota: 1000 }, 900).ok).toBe(true);
    expect(spaceCheck({ usage: 0, quota: 1000 }, 950).ok).toBe(false);
    expect(spaceCheck({ usage: 900, quota: 1000 }, 200)).toEqual({ ok: false, free: 100, needed: 200 });
  });
  it('sem estimativa não bloqueia', () => {
    expect(spaceCheck(null, 1e12).ok).toBe(true);
  });
});
