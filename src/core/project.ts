import { z } from 'zod';
import { ERRORS, type ErrorKey } from './errors';
import { anyPlanSchema } from './schema';
import type { EditPlan, TimeRange, Word } from './types';
import { createHistory, type History } from '../engine/history';

/**
 * Projeto salvo no navegador (OPFS). Tudo o que é preciso para continuar a edição
 * sem refazer análise nem transcrição. O vídeo original nunca é alterado; o app guarda
 * uma cópia à parte e, se ela sumir, pede o arquivo de novo.
 */
export const PROJECT_FORMAT = 1;

export interface VideoMeta {
  name: string;
  size: number;
  durationSec: number;
}

export interface SavedWarning {
  key: ErrorKey;
  detail: string;
}

export interface SavedProject {
  format: typeof PROJECT_FORMAT;
  savedAt: string;
  appVersion: string;
  video: VideoMeta;
  words: Word[];
  silences: TimeRange[];
  warnings: SavedWarning[];
  history: { past: EditPlan[]; present: EditPlan; future: EditPlan[] };
}

const time = z.number().finite().nonnegative();
const errorKey = z.enum(Object.keys(ERRORS) as [ErrorKey, ...ErrorKey[]]);

const projectSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  savedAt: z.string(),
  appVersion: z.string(),
  video: z.object({ name: z.string(), size: z.number().int().nonnegative(), durationSec: time }),
  words: z.array(z.object({ id: z.string().min(1), text: z.string(), start: time, end: time })),
  silences: z.array(z.object({ start: time, end: time })),
  warnings: z.array(z.object({ key: errorKey, detail: z.string() })),
  // planos v1 (Fase 2) são migrados para v2 ao abrir
  history: z.object({ past: z.array(anyPlanSchema), present: anyPlanSchema, future: z.array(anyPlanSchema) }),
});

export type ProjectParse = { ok: true; project: SavedProject } | { ok: false; errors: string[] };

/** Arquivo salvo é entrada externa: passa pela validação antes de chegar ao motor. */
export function parseProject(input: unknown): ProjectParse {
  const r = projectSchema.safeParse(input);
  if (!r.success) return { ok: false, errors: r.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) };
  return { ok: true, project: r.data as SavedProject };
}

export function makeProject(p: Omit<SavedProject, 'format' | 'history'> & { history: History<EditPlan> }): SavedProject {
  const { past, present, future } = p.history;
  return { ...p, format: PROJECT_FORMAT, history: { past, present, future } };
}

export function restoreHistory(p: SavedProject): History<EditPlan> {
  const h = createHistory(p.history.present);
  return { ...h, past: p.history.past.slice(-h.limit), future: p.history.future.slice(0, h.limit) };
}

/** O arquivo escolhido de novo é o mesmo do projeto? Confere tamanho exato e duração. */
export function sameVideo(meta: VideoMeta, candidate: { size: number; durationSec: number }): boolean {
  return meta.size === candidate.size && Math.abs(meta.durationSec - candidate.durationSec) < 0.1;
}
