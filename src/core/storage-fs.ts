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
  /** Conteúdo do arquivo, ou null se ele não existe. Outras falhas de leitura lançam erro (não são "não existe"). */
  readFile(path: string[]): Promise<Blob | null>;
  /**
   * Cria as pastas que faltarem e grava (substitui) o arquivo. Se a gravação falhar, o conteúdo
   * anterior fica como estava, e um arquivo que não existia antes não fica para trás vazio.
   * `onProgress` (v0.23): bytes já gravados, para a tela mostrar a cópia de um vídeo grande andando.
   */
  writeFile(path: string[], data: Blob | string, onProgress?: (written: number, total: number) => void): Promise<void>;
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
    // um arquivo ilegível conta 0, mas não impede medir (nem apagar) o resto
    else total += (await fs.readFile([...dir, e.name]).catch(() => null))?.size ?? 0;
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
