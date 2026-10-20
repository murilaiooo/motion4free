import { z } from 'zod';
import type { EditPlan } from './types';

const time = z.number().finite().nonnegative();

const segment = z
  .object({ srcStart: time, srcEnd: time })
  .refine((s) => s.srcEnd > s.srcStart, { message: 'segmento com fim antes do início' });

const caption = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(120),
  start: time,
  end: time,
  wordIds: z.array(z.string()),
});

const scene = z.object({
  id: z.string().min(1),
  kind: z.literal('kinetic-title'),
  text: z.string().min(1).max(60),
  start: time,
  end: time,
});

export const editPlanSchema = z.object({
  version: z.literal(1),
  output: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().min(12).max(60),
  }),
  segments: z.array(segment).min(1),
  captions: z.array(caption),
  scenes: z.array(scene),
});

export type ParseResult = { ok: true; plan: EditPlan } | { ok: false; errors: string[] };

/** Toda entrada externa (arquivo salvo, IA no futuro) passa por aqui antes de chegar ao motor. */
export function parseEditPlan(input: unknown): ParseResult {
  const r = editPlanSchema.safeParse(input);
  if (!r.success) {
    return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, plan: r.data };
}
