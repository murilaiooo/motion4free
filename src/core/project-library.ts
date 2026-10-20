import { z } from 'zod';
import { outputDuration } from '../engine/timeline';
import { parseProject, type SavedProject } from './project';
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
  /** meta.json ou project.json não abre: aparece na lista só para poder apagar */
  broken: boolean;
}

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
  return r.success && r.data.id === id ? (r.data as ProjectMeta) : null;
}

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

export async function saveVideo(fs: Fs, id: string, video: Blob): Promise<void> {
  await fs.writeFile([...dir(id), VIDEO], video);
}

export async function saveClipVideo(fs: Fs, id: string, clipId: string, video: Blob): Promise<void> {
  await fs.writeFile([...dir(id), VIDEO_DIR, `${clipId}.bin`], video);
}

export async function loadClipVideo(fs: Fs, id: string, clipId: string): Promise<Blob | null> {
  return (await fs.readFile([...dir(id), VIDEO_DIR, `${clipId}.bin`])) ?? null;
}

export async function listClipVideos(fs: Fs, id: string): Promise<string[]> {
  const entries = await fs.list([...dir(id), VIDEO_DIR]);
  if (!entries) return [];
  return entries.filter(e => e.kind === 'file' && e.name.endsWith('.bin')).map(e => e.name.replace('.bin',''));
}


export async function saveThumb(fs: Fs, id: string, thumb: Blob): Promise<void> {
  await fs.writeFile([...dir(id), THUMB], thumb);
}

export async function loadProject(fs: Fs, id: string): Promise<LoadResult> {
  const blob = await fs.readFile([...dir(id), PROJECT]);
  if (!blob) return { kind: 'none' };
  let json: unknown;
  try {
    json = JSON.parse(await blob.text());
  } catch (err) {
    return { kind: 'corrupt', detail: `JSON inválido: ${String(err)}` };
  }
  const parsed = parseProject(json);
  if (!parsed.ok) return { kind: 'corrupt', detail: parsed.errors.join('; ') };
  // multi-clip: if plan has >1 clip, verify each clip file; else single
  const clips = (parsed.project.history.present as any)?.clips as { id: string; duration: number }[] | undefined;
  if (clips && clips.length > 1) {
    // For multi, we return video as null (caller will load per-clip via loadClipVideo)
    // But we still check existence for hasVideo flag in listProjects
    return { kind: 'ok', project: parsed.project, video: null };
  }
  const f = await fs.readFile([...dir(id), VIDEO]);
  const video = f && f.size === parsed.project.video.size ? f : null;
  return { kind: 'ok', project: parsed.project, video };
}

export async function loadProjectVideos(fs: Fs, id: string, project: SavedProject): Promise<Map<string, Blob> | null> {
  const clips = (project.history.present as any)?.clips as { id: string }[] | undefined;
  if (!clips || clips.length <= 1) return null;
  const map = new Map<string, Blob>();
  const primary = await fs.readFile([...dir(id), VIDEO]);
  for (const c of clips) {
    let blob = await loadClipVideo(fs, id, c.id);
    if (!blob && c.id === clips[0]!.id) blob = primary;
    if (!blob) return null;
    map.set(c.id, blob);
  }
  return map;
}


/** Todos os projetos, do editado por último ao mais antigo. */
export async function listProjects(fs: Fs): Promise<ProjectSummary[]> {
  const entries = (await fs.list(PROJECTS_DIR)) ?? [];
  const out: ProjectSummary[] = [];
  for (const e of entries) {
    if (e.kind !== 'dir') continue;
    const id = e.name;
    const sizeBytes = await dirSize(fs, dir(id));
    const meta = await readMeta(fs, id);
    const video = await fs.readFile([...dir(id), VIDEO]);
    const clipList = await listClipVideos(fs, id);
    let hasVideo: boolean;
    if (clipList.length > 0) {
      // multi: needs every expected clip; check project to know expected count
      const projBlob = await fs.readFile([...dir(id), PROJECT]);
      let expected = clipList.length;
      try { const j = projBlob ? JSON.parse(await projBlob.text()) : null; const cl = j?.history?.present?.clips; if (Array.isArray(cl)) expected = cl.length; } catch {}
      hasVideo = clipList.length >= expected && (clipList.length > 1 || !!video);
      // also consider fallback video.bin for c1: if video.bin exists, counts as c1
      if (!hasVideo && video && expected === clipList.length + 1) hasVideo = true;
    } else {
      hasVideo = !!video && !!meta && video.size === meta.video.size;
    }
    const thumb = await fs.readFile([...dir(id), THUMB]);
    if (meta) {
      const hasProject = !!(await fs.readFile([...dir(id), PROJECT]));
      out.push({ ...meta, sizeBytes, hasVideo, thumb, broken: !hasProject });
    } else {
      out.push({
        format: 1,
        id,
        name: 'Projeto que não abre',
        createdAt: '',
        updatedAt: '',
        video: { name: '', size: 0, durationSec: 0 },
        editedSec: 0,
        templateId: '',
        sizeBytes,
        hasVideo: false,
        thumb,
        broken: true,
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
