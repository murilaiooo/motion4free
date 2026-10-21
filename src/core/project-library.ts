import { z } from 'zod';
import { outputDuration } from '../engine/timeline';
import { parseProject, referencedClips, type SavedProject } from './project';
import { copyTree, dirSize, type Fs } from './storage-fs';

/**
 * "Meus projetos": vários projetos salvos no armazenamento privado do navegador (OPFS), só neste
 * aparelho (ADR-0016). Cada projeto é uma pasta:
 *
 *   motion4free/state.json                 projeto aberto por último ({ current })
 *   motion4free/projects/<id>/meta.json    nome, datas, vídeo, duração editada, modelo
 *   motion4free/projects/<id>/project.json plano, histórico, transcrição, versões (SavedProject)
 *   motion4free/projects/<id>/video.bin    cópia do vídeo (o arquivo original da pessoa nunca é tocado)
 *   motion4free/projects/<id>/thumb.jpg    miniatura para a lista
 *
 * Até a v0.10 havia um projeto só, em `motion4free-projeto/` (project.json + video.bin): `migrateLegacy`
 * move esse projeto para a lista sem perder nada.
 */
export const ROOT = 'motion4free';
export const LEGACY_DIR = 'motion4free-projeto';
export const PROJECTS_DIR = [ROOT, 'projects'];
const STATE = [ROOT, 'state.json'];
export const META = 'meta.json';
export const PROJECT = 'project.json';
export const VIDEO = 'video.bin';
export const VIDEO_DIR = 'video'; // multi-clip: video/<clipId>.bin
export const THUMB = 'thumb.jpg';
export const NAME_MAX = 80;

export interface ProjectMeta {
  format: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  video: { name: string; size: number; durationSec: number };
  /** duração do vídeo editado (depois dos cortes), em segundos */
  editedSec: number;
  /** modelo (estilo) em uso */
  templateId: string;
}

export interface ProjectSummary extends ProjectMeta {
  /** espaço ocupado pela pasta inteira do projeto (cópia do vídeo + dados + miniatura) */
  sizeBytes: number;
  /** a cópia do vídeo existe e está completa */
  hasVideo: boolean;
  thumb: Blob | null;
  /**
   * Situação da pasta (v0.16):
   * - `ok`: abre normalmente (sem a cópia do vídeo, o app pede o arquivo original de novo);
   * - `interrupted`: o app foi fechado antes do primeiro salvamento; só há cópia do vídeo/miniatura, nenhuma edição;
   * - `damaged`: os dados do projeto existem mas não abrem (arquivo cortado, JSON inválido, versão incompatível).
   */
  status: ProjectStatus;
  /** não dá para abrir (`interrupted` ou `damaged`): aparece na lista para a pessoa decidir apagar */
  broken: boolean;
  /** por que não abre, para o "Copiar detalhes" (vazio quando abre) */
  problem: string;
}

export type ProjectStatus = 'ok' | 'interrupted' | 'damaged';

export type LoadResult = { kind: 'none' } | { kind: 'corrupt'; detail: string } | { kind: 'ok'; project: SavedProject; video: File | Blob | null };

const metaSchema = z.object({
  format: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(NAME_MAX),
  createdAt: z.string(),
  updatedAt: z.string(),
  video: z.object({ name: z.string(), size: z.number().int().nonnegative(), durationSec: z.number().nonnegative() }),
  editedSec: z.number().nonnegative(),
  templateId: z.string(),
});

const ID_RE = /^p-[a-z0-9-]{4,40}$/;
export const isProjectId = (id: string) => ID_RE.test(id);

/** Identificador novo, único na prática (tempo + sorteio), só letras minúsculas, números e hífen. */
export function newProjectId(now: number, rand: () => number = Math.random): string {
  const r = Math.floor(rand() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `p-${now.toString(36)}-${r}`;
}

/** Nome inicial: o nome do arquivo sem a extensão. */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '').trim();
  return cleanName(base) ?? 'Projeto sem nome';
}

/** Nome válido (sem espaços nas pontas, até 80 letras) ou null se vazio. */
export function cleanName(name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return n ? n : null;
}

const dir = (id: string) => [...PROJECTS_DIR, id];

export function metaFor(project: SavedProject, base: { id: string; name: string; createdAt: string }): ProjectMeta {
  const present = project.history.present;
  return {
    format: 1,
    id: base.id,
    name: base.name,
    createdAt: base.createdAt,
    updatedAt: project.savedAt,
    video: { ...project.video },
    editedSec: Math.round(outputDuration(present.segments) * 100) / 100,
    templateId: present.style.id,
  };
}

async function readJson(fs: Fs, path: string[]): Promise<unknown | undefined> {
  const blob = await fs.readFile(path);
  if (!blob) return undefined;
  try {
    return JSON.parse(await blob.text());
  } catch {
    return null;
  }
}

export async function readMeta(fs: Fs, id: string): Promise<ProjectMeta | null> {
  const r = metaSchema.safeParse(await readJson(fs, [...dir(id), META]));
  if (r.success && r.data.id === id) return r.data as ProjectMeta;
  // meta.json ausente ou estragado (o app fechou entre gravar project.json e meta.json):
  // os dados completos estão em project.json, então o resumo é refeito a partir dele.
  const inspected = await inspectProjectData(fs, id);
  return inspected.kind === 'ok' && isProjectId(id) ? recoveredMeta(id, inspected.project) : null;
}

/** Resumo refeito a partir de project.json (o nome volta a ser o do arquivo, a criação vira o último salvamento). */
function recoveredMeta(id: string, project: SavedProject): ProjectMeta {
  return metaFor(project, { id, name: nameFromFile(project.video.name), createdAt: project.savedAt });
}

type DataInspection = { kind: 'missing' } | { kind: 'damaged'; detail: string } | { kind: 'ok'; project: SavedProject };

/** Lê e valida project.json, separando "não existe" de "existe mas não abre". */
async function inspectProjectData(fs: Fs, id: string): Promise<DataInspection> {
  const blob = await fs.readFile([...dir(id), PROJECT]);
  if (!blob) return { kind: 'missing' };
  let json: unknown;
  try {
    json = JSON.parse(await blob.text());
  } catch (err) {
    return { kind: 'damaged', detail: `JSON inválido (${blob.size} bytes): ${String(err)}` };
  }
  const parsed = parseProject(json);
  return parsed.ok ? { kind: 'ok', project: parsed.project } : { kind: 'damaged', detail: parsed.errors.join('; ') };
}

/** Projeto com vídeos em `video/<clipId>.bin` (vários clipes, ou um clipe que não é o c1 original). */
export function usesClipStorage(project: Pick<SavedProject, 'history' | 'versions'>): boolean {
  const clips = referencedClips(project);
  return clips.length > 1 || (clips.length === 1 && clips[0]!.id !== 'c1');
}

/** Cópia utilizável: existe e não está vazia (gravação que falhou no começo deixa um arquivo de 0 bytes). */
const usable = (b: Blob | null): b is Blob => !!b && b.size > 0;

export async function getCurrent(fs: Fs): Promise<string | null> {
  const json = (await readJson(fs, STATE)) as { current?: unknown } | null | undefined;
  const id = json && typeof json.current === 'string' ? json.current : null;
  return id && isProjectId(id) && (await fs.list(dir(id))) ? id : null;
}

export async function setCurrent(fs: Fs, id: string | null): Promise<void> {
  await fs.writeFile(STATE, JSON.stringify({ current: id }));
}

/** Grava os dados do projeto (cria o projeto na primeira vez); nome e criação ficam como estavam. */
export async function saveProjectData(fs: Fs, id: string, project: SavedProject, name: string, now: string): Promise<ProjectMeta> {
  const old = await readMeta(fs, id);
  const meta = metaFor(project, { id, name: old?.name ?? name, createdAt: old?.createdAt ?? now });
  await fs.writeFile([...dir(id), PROJECT], JSON.stringify(project));
  await fs.writeFile([...dir(id), META], JSON.stringify(meta));
  return meta;
}

export async function saveVideo(fs: Fs, id: string, video: Blob, onProgress?: (written: number, total: number) => void): Promise<void> {
  await fs.writeFile([...dir(id), VIDEO], video, onProgress);
}

export async function saveClipVideo(fs: Fs, id: string, clipId: string, video: Blob, onProgress?: (written: number, total: number) => void): Promise<void> {
  await fs.writeFile([...dir(id), VIDEO_DIR, `${clipId}.bin`], video, onProgress);
}

export async function loadClipVideo(fs: Fs, id: string, clipId: string): Promise<Blob | null> {
  return (await fs.readFile([...dir(id), VIDEO_DIR, `${clipId}.bin`])) ?? null;
}

export async function saveThumb(fs: Fs, id: string, thumb: Blob): Promise<void> {
  await fs.writeFile([...dir(id), THUMB], thumb);
}

export async function loadProject(fs: Fs, id: string): Promise<LoadResult> {
  const data = await inspectProjectData(fs, id);
  if (data.kind === 'missing') return { kind: 'none' };
  if (data.kind === 'damaged') return { kind: 'corrupt', detail: data.detail };
  // multi-clip: cada clipe tem o seu arquivo; quem confere é loadProjectVideos
  if (usesClipStorage(data.project)) return { kind: 'ok', project: data.project, video: null };
  const f = await fs.readFile([...dir(id), VIDEO]);
  const video = f && f.size === data.project.video.size ? f : null;
  return { kind: 'ok', project: data.project, video };
}

export async function loadProjectVideos(fs: Fs, id: string, project: SavedProject): Promise<Map<string, Blob> | null> {
  if (!usesClipStorage(project)) return null;
  const clips = referencedClips(project);
  const map = new Map<string, Blob>();
  const primary = await fs.readFile([...dir(id), VIDEO]);
  for (const c of clips) {
    let blob: Blob | null = await loadClipVideo(fs, id, c.id);
    // video.bin sempre contém o c1 original, mesmo depois de reordenar clipes.
    if (!usable(blob) && c.id === 'c1' && primary?.size === project.video.size) blob = primary;
    if (!usable(blob)) return null;
    map.set(c.id, blob);
  }
  return map;
}

/** Resumo de uma pasta de projeto para a lista; nunca descarta nada, só classifica. */
async function summarize(fs: Fs, id: string): Promise<ProjectSummary> {
  const sizeBytes = await dirSize(fs, dir(id));
  const thumb = await fs.readFile([...dir(id), THUMB]).catch(() => null);
  const data = await inspectProjectData(fs, id);
  const stored = metaSchema.safeParse(await readJson(fs, [...dir(id), META]));
  const storedMeta = stored.success && stored.data.id === id ? (stored.data as ProjectMeta) : null;
  if (data.kind === 'ok') {
    const meta = storedMeta ?? recoveredMeta(id, data.project);
    return { ...meta, sizeBytes, hasVideo: await hasVideoCopy(fs, id, data.project), thumb, status: 'ok', broken: false, problem: '' };
  }
  const placeholder = {
    format: 1 as const,
    id,
    createdAt: '',
    updatedAt: '',
    video: { name: '', size: 0, durationSec: 0 },
    editedSec: 0,
    templateId: '',
  };
  if (data.kind === 'missing' && !storedMeta) {
    // Só há a cópia do vídeo e/ou a miniatura: a importação parou antes do primeiro salvamento.
    return { ...placeholder, name: 'Importação interrompida', sizeBytes, hasVideo: false, thumb, status: 'interrupted', broken: true, problem: 'project.json e meta.json ausentes' };
  }
  const detail = data.kind === 'damaged' ? data.detail : 'project.json ausente';
  return { ...(storedMeta ?? { ...placeholder, name: 'Projeto que não abre' }), sizeBytes, hasVideo: false, thumb, status: 'damaged', broken: true, problem: detail };
}

async function hasVideoCopy(fs: Fs, id: string, project: SavedProject): Promise<boolean> {
  if (!usesClipStorage(project)) {
    const video = await fs.readFile([...dir(id), VIDEO]);
    return !!video && video.size === project.video.size;
  }
  return (await loadProjectVideos(fs, id, project)) !== null;
}

/** Todos os projetos, do editado por último ao mais antigo. Uma pasta ilegível não esconde as outras. */
export async function listProjects(fs: Fs): Promise<ProjectSummary[]> {
  const entries = (await fs.list(PROJECTS_DIR)) ?? [];
  const out: ProjectSummary[] = [];
  for (const e of entries) {
    if (e.kind !== 'dir') continue;
    try {
      out.push(await summarize(fs, e.name));
    } catch (err) {
      out.push({
        format: 1, id: e.name, name: 'Projeto que não abre', createdAt: '', updatedAt: '',
        video: { name: '', size: 0, durationSec: 0 }, editedSec: 0, templateId: '',
        sizeBytes: 0, hasVideo: false, thumb: null, status: 'damaged', broken: true, problem: `leitura falhou: ${String(err)}`,
      });
    }
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export async function renameProject(fs: Fs, id: string, name: string): Promise<ProjectMeta | null> {
  const clean = cleanName(name);
  const meta = await readMeta(fs, id);
  if (!clean || !meta) return null;
  const next = { ...meta, name: clean };
  await fs.writeFile([...dir(id), META], JSON.stringify(next));
  return next;
}

/** Cópia completa (inclusive a cópia do vídeo) com nome "… (cópia)". */
export async function duplicateProject(fs: Fs, id: string, newId: string, now: string): Promise<ProjectMeta | null> {
  const meta = await readMeta(fs, id);
  if (!meta) return null;
  try {
    await copyTree(fs, dir(id), dir(newId));
    const copy: ProjectMeta = { ...meta, id: newId, name: `${meta.name.slice(0, NAME_MAX - 9)} (cópia)`, createdAt: now, updatedAt: now };
    await fs.writeFile([...dir(newId), META], JSON.stringify(copy));
    return copy;
  } catch (err) {
    // sem espaço no meio da cópia: não deixa meia cópia para trás
    await fs.remove(dir(newId)).catch(() => undefined);
    throw err;
  }
}

/** Apaga a pasta do projeto e devolve quanto espaço foi liberado. */
export async function deleteProject(fs: Fs, id: string): Promise<number> {
  const size = await dirSize(fs, dir(id));
  await fs.remove(dir(id));
  if ((await getCurrent(fs)) === null) await setCurrent(fs, null);
  return size;
}

export type MigrateResult = { kind: 'none' } | { kind: 'migrated'; id: string } | { kind: 'failed'; detail: string };

/**
 * Projeto único da v0.10 (`motion4free-projeto/`) → primeiro item de "Meus projetos".
 * Copia, confere os tamanhos e só então apaga a pasta antiga. Se algo falhar, a pasta antiga fica
 * intacta e a cópia parcial sai. Um projeto que não abre também é movido (aparece como "não abre").
 */
export async function migrateLegacy(fs: Fs, newId: string, now: string): Promise<MigrateResult> {
  const legacy = [LEGACY_DIR];
  const projectBlob = await fs.readFile([...legacy, PROJECT]);
  if (!projectBlob) return { kind: 'none' };
  const video = await fs.readFile([...legacy, VIDEO]);
  try {
    const text = await projectBlob.text();
    await fs.writeFile([...dir(newId), PROJECT], text);
    if (video) await fs.writeFile([...dir(newId), VIDEO], video);
    let parsed: ReturnType<typeof parseProject> | null = null;
    try {
      parsed = parseProject(JSON.parse(text));
    } catch {
      parsed = null;
    }
    if (parsed?.ok) {
      const meta = metaFor(parsed.project, { id: newId, name: nameFromFile(parsed.project.video.name), createdAt: parsed.project.savedAt || now });
      await fs.writeFile([...dir(newId), META], JSON.stringify(meta));
    }
    const copied = await fs.readFile([...dir(newId), PROJECT]);
    const copiedVideo = await fs.readFile([...dir(newId), VIDEO]);
    if (!copied || copied.size !== projectBlob.size || (video && copiedVideo?.size !== video.size)) throw new Error('cópia incompleta');
    await setCurrent(fs, newId);
    await fs.remove(legacy);
    return { kind: 'migrated', id: newId };
  } catch (err) {
    await fs.remove(dir(newId)).catch(() => undefined);
    return { kind: 'failed', detail: String(err) };
  }
}
