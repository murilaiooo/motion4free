import { cleanName, loadProject, loadProjectVideos, metaFor, newProjectId, readMeta, usesClipStorage, PROJECTS_DIR } from './project-library';
import { parseProject, type SavedProject } from './project';
import type { Fs } from './storage-fs';

/**
 * Portable project backup, no server or secrets. Contents are OPFS project
 * files only; each 2 MiB block has a SHA-256 digest to detect truncation or
 * corruption before any target project is written.
 *
 * [8 byte magic][4 byte LE manifest length][UTF-8 JSON manifest][file blobs].
 * Files are Blob parts (not base64) to avoid copying videos into JS memory.
 */
const MAGIC = 'M4FBACK1';
const CHUNK = 2 * 1024 * 1024;
const MAX_HEADER = 4 * 1024 * 1024;
const MAX_TOTAL = 16 * 1024 ** 3;
const MAX_FILES = 500;
const ALLOWED_FILE = /^(?:project\.json|meta\.json|video\.bin|thumb\.jpg|music\.bin|video\/[a-zA-Z0-9_-]{1,100}\.bin)$/;

type Entry = { path: string; offset: number; size: number; digests: string[] };
type Manifest = { format: 1; name: string; files: Entry[] };
const bytes = (value: string) => new TextEncoder().encode(value);
const hex = (value: ArrayBuffer) => [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');

async function digestBlocks(file: Blob): Promise<string[]> {
  const hashes = [];
  for (let at = 0; at < file.size; at += CHUNK) {
    const data = await file.slice(at, at + CHUNK).arrayBuffer();
    hashes.push(hex(await crypto.subtle.digest('SHA-256', data)));
  }
  return hashes;
}

async function projectFiles(fs: Fs, id: string): Promise<{ path: string; content: Blob }[]> {
  const root = [...PROJECTS_DIR, id];
  const out: { path: string; content: Blob }[] = [];
  const walk = async (parts: string[]) => {
    const children = await fs.list([...root, ...parts]);
    if (!children) throw new Error('Pasta do projeto incompleta.');
    for (const item of children) {
      const next = [...parts, item.name];
      const name = next.join('/');
      if (item.kind === 'dir') {
        if (name !== 'video') throw new Error(`Pasta inesperada no projeto: ${name}`);
        await walk(next);
      } else {
        if (!ALLOWED_FILE.test(name)) throw new Error(`Arquivo do projeto não reconhecido: ${name}`);
        const content = await fs.readFile([...root, ...next]);
        if (!content) throw new Error(`Arquivo desapareceu durante o backup: ${name}`);
        out.push({ path: name, content });
      }
    }
  };
  await walk([]);
  if (out.length > MAX_FILES) throw new Error('Projeto tem arquivos demais para este backup.');
  return out.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export async function exportProjectBackup(fs: Fs, id: string): Promise<Blob> {
  const loaded = await loadProject(fs, id);
  if (loaded.kind !== 'ok') throw new Error('Abra e salve o projeto antes de criar o backup.');
  const complete = usesClipStorage(loaded.project)
    ? !!(await loadProjectVideos(fs, id, loaded.project))
    : !!loaded.video;
  if (!complete) throw new Error('Falta uma cópia de vídeo. Selecione o original novamente antes de baixar o backup completo.');
  const info = await readMeta(fs, id);
  if (!info) throw new Error('Nome do projeto indisponível.');
  const files = await projectFiles(fs, id);
  if (!files.some(f => f.path === 'project.json')) throw new Error('O plano de edição não foi salvo.');
  const dataSize = files.reduce((sum, file) => sum + file.content.size, 0);
  if (dataSize > MAX_TOTAL) throw new Error('Este projeto excede o limite de 16 GiB de um backup.');
  let offset = 0;
  const entries: Entry[] = [];
  for (const item of files) {
    entries.push({ path: item.path, offset, size: item.content.size, digests: await digestBlocks(item.content) });
    offset += item.content.size;
  }
  const manifest: Manifest = { format: 1, name: info.name, files: entries };
  const header = bytes(JSON.stringify(manifest));
  if (header.byteLength > MAX_HEADER) throw new Error('Índice do backup é grande demais.');
  const prefix = new Uint8Array(12);
  prefix.set(bytes(MAGIC));
  new DataView(prefix.buffer).setUint32(8, header.byteLength, true);
  return new Blob([prefix, header, ...files.map(file => file.content)], { type: 'application/octet-stream' });
}

async function inspectBackup(archive: Blob): Promise<{ manifest: Manifest; payload: number; project: SavedProject }> {
  if (archive.size < 12 || archive.size > MAX_TOTAL + MAX_HEADER + 12) throw new Error('Tamanho de backup inválido.');
  const header = new Uint8Array(await archive.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(header.slice(0, 8)) !== MAGIC) throw new Error('Arquivo não é um backup Motion4Free.');
  const len = new DataView(header.buffer).getUint32(8, true);
  if (len < 20 || len > MAX_HEADER || len + 12 > archive.size) throw new Error('Índice do backup incompleto.');
  let m: unknown;
  try { m = JSON.parse(await archive.slice(12, 12 + len).text()); }
  catch { throw new Error('Índice do backup está danificado.'); }
  if (!m || typeof m !== 'object') throw new Error('Índice de backup inválido.');
  const manifest = m as Manifest;
  if (manifest.format !== 1 || typeof manifest.name !== 'string' || !cleanName(manifest.name) || !Array.isArray(manifest.files) ||
    manifest.files.length === 0 || manifest.files.length > MAX_FILES) throw new Error('Formato do backup não suportado.');
  const payload = 12 + len;
  let expected = 0;
  const seen = new Set<string>();
  let project: SavedProject | null = null;
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || !ALLOWED_FILE.test(file.path) || seen.has(file.path) ||
      !Number.isSafeInteger(file.size) || file.size < 0 || !Number.isSafeInteger(file.offset) || file.offset !== expected ||
      !Array.isArray(file.digests) || file.digests.length !== Math.ceil(file.size / CHUNK) ||
      file.digests.some(d => typeof d !== 'string' || !/^[a-f0-9]{64}$/.test(d))) throw new Error('Caminhos, offsets ou hashes inválidos no backup.');
    seen.add(file.path);
    expected += file.size;
    if (expected > MAX_TOTAL || payload + expected > archive.size) throw new Error('Backup truncado ou excedeu o limite.');
    for (let i = 0; i < file.digests.length; i++) {
      const chunk = archive.slice(payload + file.offset + i * CHUNK, payload + file.offset + Math.min(file.size, (i + 1) * CHUNK));
      const found = hex(await crypto.subtle.digest('SHA-256', await chunk.arrayBuffer()));
      if (found !== file.digests[i]) throw new Error(`Backup corrompido: ${file.path}, bloco ${i + 1}.`);
    }
    if (file.path === 'project.json') {
      if (file.size > 64 * 1024 * 1024) throw new Error('Dados do projeto excedem o limite de validação.');
      let raw: unknown;
      try { raw = JSON.parse(await archive.slice(payload + file.offset, payload + file.offset + file.size).text()); }
      catch { throw new Error('Projeto dentro do backup não é JSON válido.'); }
      const parsed = parseProject(raw);
      if (!parsed.ok) throw new Error('Projeto incompatível: ' + parsed.errors[0]);
      project = parsed.project;
    }
  }
  if (payload + expected !== archive.size || !project) throw new Error('Backup incompleto ou com bytes extras.');
  return { manifest, payload, project };
}

/** Verify ALL archive bytes before writing, then import as a *new* project. */
export async function restoreProjectBackup(fs: Fs, archive: Blob, now = new Date().toISOString()): Promise<string> {
  const { manifest, payload, project } = await inspectBackup(archive);
  const base = [...PROJECTS_DIR];
  let id = '';
  for (let i = 0; i < 10; i++) {
    const candidate = newProjectId(Date.now() + i);
    if (!(await fs.list([...base, candidate]))) { id = candidate; break; }
  }
  if (!id) throw new Error('Não foi possível criar um ID seguro para o projeto.');
  const target = [...base, id];
  try {
    for (const file of manifest.files) {
      if (file.path === 'meta.json') continue; // Regenerated for the new ID.
      await fs.writeFile([...target, ...file.path.split('/')],
        archive.slice(payload + file.offset, payload + file.offset + file.size), () => undefined);
    }
    await fs.writeFile([...target, 'meta.json'], JSON.stringify(metaFor(project, {
      id, name: cleanName(manifest.name)!, createdAt: now,
    })));
    const result = await loadProject(fs, id);
    if (result.kind !== 'ok') throw new Error('Projeto restaurado não abriu.');
    if (usesClipStorage(project)) {
      if (!(await loadProjectVideos(fs, id, project))) throw new Error('Vídeos do projeto restaurado estão incompletos.');
    } else if (!result.video) throw new Error('Vídeo do projeto restaurado está incompleto.');
    return id;
  } catch (error) {
    await fs.remove(target).catch(() => undefined);
    throw error;
  }
}
