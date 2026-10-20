import type { Fs, FsEntry } from '../core/storage-fs';
import type { CacheBackend, CacheEntry, Estimate, IdbBackend, PrefsBackend, QuotaBackend, StorageDeps } from '../core/storage-report';

/**
 * Ligação das interfaces de armazenamento (core) com as APIs do navegador (ADR-0016):
 * OPFS (`navigator.storage.getDirectory`), Cache Storage (`caches`), IndexedDB, `navigator.storage.estimate/persist`
 * e localStorage. Cada uma é opcional: navegador sem a API recebe null e a tela mostra o código do problema.
 */

type DirHandle = FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> };

export function opfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function walk(path: string[], create: boolean): Promise<DirHandle | null> {
  let dir = (await navigator.storage.getDirectory()) as DirHandle;
  for (const name of path) {
    try {
      dir = (await dir.getDirectoryHandle(name, { create })) as DirHandle;
    } catch {
      return null;
    }
  }
  return dir;
}

export class OpfsFs implements Fs {
  async list(dir: string[]): Promise<FsEntry[] | null> {
    const handle = await walk(dir, false);
    if (!handle) return null;
    const out: FsEntry[] = [];
    for await (const [name, h] of handle.entries()) out.push({ name, kind: h.kind === 'directory' ? 'dir' : 'file' });
    return out;
  }

  async readFile(path: string[]): Promise<Blob | null> {
    const dir = await walk(path.slice(0, -1), false);
    if (!dir) return null;
    try {
      return await (await dir.getFileHandle(path[path.length - 1]!)).getFile();
    } catch {
      return null;
    }
  }

  async writeFile(path: string[], data: Blob | string): Promise<void> {
    const dir = await walk(path.slice(0, -1), true);
    if (!dir) throw new Error(`pasta ${path.slice(0, -1).join('/')} indisponível`);
    const handle = await dir.getFileHandle(path[path.length - 1]!, { create: true });
    if (!('createWritable' in handle)) throw new Error('createWritable indisponível neste navegador');
    const w = await handle.createWritable();
    try {
      await w.write(data);
      await w.close();
    } catch (err) {
      await w.abort().catch(() => undefined);
      throw err;
    }
  }

  async remove(path: string[]): Promise<void> {
    const dir = await walk(path.slice(0, -1), false);
    if (!dir) return;
    try {
      await dir.removeEntry(path[path.length - 1]!, { recursive: true });
    } catch (err) {
      if ((err as DOMException)?.name !== 'NotFoundError') throw err;
    }
  }
}

/** Tamanho guardado de uma resposta: cabeçalho Content-Length, ou o corpo (o navegador lê do disco). */
async function responseBytes(res: Response | undefined): Promise<number> {
  if (!res) return 0;
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > 0) return len;
  try {
    return (await res.blob()).size;
  } catch {
    return 0;
  }
}

export class BrowserCaches implements CacheBackend {
  async names(): Promise<string[]> {
    return caches.keys();
  }

  async urls(name: string): Promise<string[]> {
    return (await (await caches.open(name)).keys()).map((r) => r.url);
  }

  async entries(name: string): Promise<CacheEntry[]> {
    const cache = await caches.open(name);
    const out: CacheEntry[] = [];
    for (const req of await cache.keys()) out.push({ url: req.url, bytes: await responseBytes(await cache.match(req)) });
    return out;
  }

  async deleteEntries(name: string, urls: string[]): Promise<void> {
    const cache = await caches.open(name);
    for (const url of urls) await cache.delete(url);
  }

  async deleteCache(name: string): Promise<void> {
    await caches.delete(name);
  }
}

export class BrowserIdb implements IdbBackend {
  async names(): Promise<string[] | null> {
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return null;
    return (await indexedDB.databases()).map((d) => d.name).filter((n): n is string => !!n);
  }

  remove(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error(`não apagou ${name}`));
      // outra aba com o banco aberto: o navegador apaga quando ela fechar
      req.onblocked = () => resolve();
    });
  }
}

export class BrowserQuota implements QuotaBackend {
  async estimate(): Promise<Estimate | null> {
    if (!navigator.storage?.estimate) return null;
    const e = (await navigator.storage.estimate()) as StorageEstimate & { usageDetails?: Record<string, number> };
    if (typeof e.usage !== 'number' || typeof e.quota !== 'number') return null;
    return { usage: e.usage, quota: e.quota, details: e.usageDetails };
  }

  async persisted(): Promise<boolean | null> {
    return navigator.storage?.persisted ? navigator.storage.persisted() : null;
  }

  async persist(): Promise<boolean | null> {
    return navigator.storage?.persist ? navigator.storage.persist() : null;
  }
}

const browserPrefs: PrefsBackend = {
  keys: () => {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  },
  remove: (k) => localStorage.removeItem(k),
};

/** O que este navegador oferece; o que faltar vira null. */
export function browserStorage(): StorageDeps {
  return {
    fs: opfsAvailable() ? new OpfsFs() : null,
    caches: typeof caches !== 'undefined' ? new BrowserCaches() : null,
    idb: typeof indexedDB !== 'undefined' ? new BrowserIdb() : null,
    quota: typeof navigator !== 'undefined' && navigator.storage ? new BrowserQuota() : null,
    prefs: browserPrefs,
  };
}
