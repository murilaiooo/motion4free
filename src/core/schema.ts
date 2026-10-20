import { z } from 'zod';
import { DEFAULT_STYLE } from './presets';
import { styleSchema } from './style';
import type { EditPlan } from './types';

const time = z.number().finite().nonnegative();
const line = (max: number) => z.string().min(1).max(max);

const segment = z
  .object({ srcStart: time, srcEnd: time })
  .refine((s) => s.srcEnd > s.srcStart, { message: 'segmento com fim antes do início' });

const output = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().min(12).max(60),
});

const captionV1 = z.object({
  id: z.string().min(1),
  text: line(120),
  start: time,
  end: time,
  wordIds: z.array(z.string()),
});

const caption = captionV1.extend({ wordStarts: z.array(time).max(60) });

const base = { id: z.string().min(1), start: time, end: time };

const scene = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('kinetic-title'), text: line(60) }),
  z.object({ ...base, kind: z.literal('highlight-word'), text: line(30) }),
  z.object({ ...base, kind: z.literal('big-number'), value: line(12), label: z.string().max(30) }),
  z.object({ ...base, kind: z.literal('list'), items: z.array(z.object({ text: line(40), at: time })).min(1).max(5) }),
  z.object({ ...base, kind: z.literal('quote'), text: line(80) }),
  z.object({ ...base, kind: z.literal('lower-third'), title: line(32), subtitle: z.string().max(40) }),
  z.object({ ...base, kind: z.literal('emphasis-zoom'), scale: z.number().min(1).max(1.4) }),
  z.object({ ...base, kind: z.literal('cut-transition'), at: time }),
  z.object({ ...base, kind: z.literal('progress-bar') }),
  z.object({ ...base, kind: z.literal('end-cta'), text: line(32) }),
]);

export const editPlanSchema = z.object({
  version: z.literal(2),
  output,
  style: styleSchema,
  segments: z.array(segment).min(1),
  captions: z.array(caption),
  scenes: z.array(scene),
});

/** Formato da Fase 1/2 (só título cinético, sem estilo). Mantido para abrir projetos antigos. */
export const editPlanV1Schema = z.object({
  version: z.literal(1),
  output,
  segments: z.array(segment).min(1),
  captions: z.array(captionV1),
  scenes: z.array(z.object({ ...base, kind: z.literal('kinetic-title'), text: line(60) })),
});

/**
 * v1 → v2: ganha o estilo padrão; legendas sem tempos por palavra (o desenho distribui
 * proporcionalmente); o título cinético continua igual. Entrada que não é v1 válida passa intacta
 * (o esquema v2 decide).
 */
export function migratePlan(input: unknown): unknown {
  const v1 = editPlanV1Schema.safeParse(input);
  if (!v1.success) return input;
  const p = v1.data;
  return {
    version: 2,
    output: p.output,
    style: DEFAULT_STYLE,
    segments: p.segments,
    captions: p.captions.map((c) => ({ ...c, wordStarts: [] })),
    scenes: p.scenes,
  };
}

/** Aceita plano v1 ou v2 e entrega sempre v2 validado (usado no projeto salvo). */
export const anyPlanSchema = z.preprocess(migratePlan, editPlanSchema);

export type ParseResult = { ok: true; plan: EditPlan } | { ok: false; errors: string[] };

/** Toda entrada externa (arquivo salvo, IA no futuro) passa por aqui antes de chegar ao motor. */
export function parseEditPlan(input: unknown): ParseResult {
  const r = anyPlanSchema.safeParse(input);
  if (!r.success) {
    return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, plan: r.data as EditPlan };
}
