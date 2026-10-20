/**
 * Sistema de arquivos mínimo que a biblioteca de projetos usa (ADR-0016).
 * No navegador é o OPFS (`src/app/browser-storage.ts`); nos testes, uma árvore em memória.
 * Caminhos são listas de nomes: `['motion4free', 'projects', 'p-1', 'video.bin']`.
 */
export interface FsEntry {
  name: string;
  kind: 'file' | 'dir';
}

export interface Fs {
  /** Itens da pasta, ou null se ela não existe. */
  list(dir: string[]): Promise<FsEntry[] | null>;
  /** Conteúdo do arquivo, ou null se ele não existe. */
  readFile(path: string[]): Promise<Blob | null>;
  /** Cria as pastas que faltarem e grava (substitui) o arquivo. */
  writeFile(path: string[], data: Blob | string): Promise<void>;
  /** Apaga arquivo ou pasta inteira; não falha se não existir. */
  remove(path: string[]): Promise<void>;
}

/** Soma dos tamanhos de todos os arquivos dentro da pasta (0 se não existir). */
export async function dirSize(fs: Fs, dir: string[]): Promise<number> {
  const entries = await fs.list(dir);
  if (!entries) return 0;
  let total = 0;
  for (const e of entries) {
    if (e.kind === 'dir') total += await dirSize(fs, [...dir, e.name]);
    else total += (await fs.readFile([...dir, e.name]))?.size ?? 0;
  }
  return total;
}

/** Copia a pasta inteira (arquivos e subpastas) para outro caminho. */
export async function copyTree(fs: Fs, from: string[], to: string[]): Promise<void> {
  const entries = await fs.list(from);
  if (!entries) return;
  for (const e of entries) {
    if (e.kind === 'dir') await copyTree(fs, [...from, e.name], [...to, e.name]);
    else {
      const data = await fs.readFile([...from, e.name]);
      if (data) await fs.writeFile([...to, e.name], data);
    }
  }
}
