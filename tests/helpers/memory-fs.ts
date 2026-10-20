import type { Fs, FsEntry } from '../../src/core/storage-fs';

/** OPFS de mentira, em memória, para testar a biblioteca de projetos sem navegador. */
export class MemoryFs implements Fs {
  readonly files = new Map<string, Blob>();
  readonly dirs = new Set<string>(['']);
  /** quantos bytes ainda cabem (simula disco cheio); Infinity = sem limite */
  space = Infinity;

  private key(path: string[]): string {
    return path.join('/');
  }

  async list(dir: string[]): Promise<FsEntry[] | null> {
    const k = this.key(dir);
    if (!this.dirs.has(k)) return null;
    const prefix = k ? `${k}/` : '';
    const out = new Map<string, FsEntry>();
    for (const d of this.dirs) if (d && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) out.set(d.slice(prefix.length), { name: d.slice(prefix.length), kind: 'dir' });
    for (const f of this.files.keys()) if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) out.set(f.slice(prefix.length), { name: f.slice(prefix.length), kind: 'file' });
    return [...out.values()];
  }

  async readFile(path: string[]): Promise<Blob | null> {
    return this.files.get(this.key(path)) ?? null;
  }

  async writeFile(path: string[], data: Blob | string): Promise<void> {
    const blob = typeof data === 'string' ? new Blob([data]) : data;
    const old = this.files.get(this.key(path))?.size ?? 0;
    if (blob.size - old > this.space) throw new DOMException('sem espaço', 'QuotaExceededError');
    this.space -= blob.size - old;
    for (let i = 1; i < path.length; i++) this.dirs.add(this.key(path.slice(0, i)));
    this.files.set(this.key(path), blob);
  }

  async remove(path: string[]): Promise<void> {
    const k = this.key(path);
    for (const f of [...this.files.keys()])
      if (f === k || f.startsWith(`${k}/`)) {
        this.space += this.files.get(f)!.size;
        this.files.delete(f);
      }
    for (const d of [...this.dirs]) if (d === k || d.startsWith(`${k}/`)) this.dirs.delete(d);
  }
}
