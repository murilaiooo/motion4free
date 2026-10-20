import { parseProject, type SavedProject } from '../core/project';

/**
 * Projeto salvo no armazenamento privado do navegador (OPFS), só neste dispositivo.
 * `project.json` guarda plano, histórico e transcrição; `video.bin` é uma cópia do vídeo
 * (o arquivo original da pessoa nunca é tocado). Um projeto por navegador nesta fase.
 */
const DIR = 'motion4free-projeto';
const PROJECT = 'project.json';
const VIDEO = 'video.bin';

export type LoadResult = { kind: 'none' } | { kind: 'corrupt'; detail: string } | { kind: 'ok'; project: SavedProject; video: File | null };

export function storageAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function folder(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  const root = await navigator.storage.getDirectory();
  try {
    return await root.getDirectoryHandle(DIR, { create });
  } catch {
    return null;
  }
}

async function write(dir: FileSystemDirectoryHandle, name: string, data: Blob | string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  if (!('createWritable' in handle)) throw new Error('createWritable indisponível neste navegador');
  const w = await handle.createWritable();
  await w.write(data);
  await w.close();
}

export async function saveProject(project: SavedProject): Promise<void> {
  const dir = await folder(true);
  if (!dir) throw new Error('pasta do projeto indisponível');
  await write(dir, PROJECT, JSON.stringify(project));
}

export async function saveVideoCopy(file: Blob): Promise<void> {
  const dir = await folder(true);
  if (!dir) throw new Error('pasta do projeto indisponível');
  await write(dir, VIDEO, file);
}

export async function loadProject(): Promise<LoadResult> {
  if (!storageAvailable()) return { kind: 'none' };
  const dir = await folder(false);
  if (!dir) return { kind: 'none' };
  let text: string;
  try {
    text = await (await (await dir.getFileHandle(PROJECT)).getFile()).text();
  } catch {
    return { kind: 'none' };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { kind: 'corrupt', detail: `JSON inválido: ${String(err)}` };
  }
  const parsed = parseProject(json);
  if (!parsed.ok) return { kind: 'corrupt', detail: parsed.errors.join('; ') };
  let video: File | null = null;
  try {
    const f = await (await dir.getFileHandle(VIDEO)).getFile();
    // cópia incompleta ou de outro vídeo conta como ausente
    if (f.size === parsed.project.video.size) video = f;
  } catch {
    video = null;
  }
  return { kind: 'ok', project: parsed.project, video };
}

export async function clearProject(): Promise<void> {
  if (!storageAvailable()) return;
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(DIR, { recursive: true }).catch(() => {});
}
