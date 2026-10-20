import { z } from 'zod';
import { EMPHASES, EMPTY_BRIEF, LEVELS, PACES, PROHIBITIONS, TONES, briefSchema } from './brief';
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

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const range = z
  .object({
    id: z.string().regex(/^r[0-9]{1,4}$/),
    srcStart: time,
    srcEnd: time,
    out: z.object({ start: time, end: time }),
    prompt: z.string().max(200),
    tone: z.enum(TONES).nullable(),
    intensity: z.enum(LEVELS).nullable(),
    pace: z.enum(PACES).nullable(),
    forbid: z.array(z.enum(PROHIBITIONS)).max(PROHIBITIONS.length),
    emphasize: z.array(z.enum(EMPHASES)).max(EMPHASES.length),
    quiet: z.boolean(),
    accent: z.boolean(),
    variant: z.number().int().min(0).max(999),
    style: styleSchema.nullable(),
    locked: z.object({ outStart: time, scenes: z.array(scene).max(200), captions: z.array(caption).max(200) }).nullable(),
  })
  .refine((r) => r.srcEnd > r.srcStart, { message: 'trecho com fim antes do início' });

export const editPlanSchema = z.object({
  version: z.literal(4),
  output,
  style: styleSchema,
  brief: briefSchema,
  segments: z.array(segment).min(1),
  captions: z.array(caption),
  scenes: z.array(scene),
  ranges: z.array(range).max(50),
  reference: z.object({ colors: z.array(color).min(1).max(6) }).nullable(),
});

/** Formato da Fase 4 (pedido por texto, sem trechos). Mantido para abrir projetos antigos. */
export const editPlanV3Schema = editPlanSchema.omit({ ranges: true, reference: true }).extend({ version: z.literal(3) });

/** Formato da Fase 3 (estilo, sem pedido por texto). Mantido para abrir projetos antigos. */
export const editPlanV2Schema = editPlanV3Schema.omit({ brief: true }).extend({ version: z.literal(2) });

/** Formato da Fase 1/2 (só título cinético, sem estilo). Mantido para abrir projetos antigos. */
export const editPlanV1Schema = z.object({
  version: z.literal(1),
  output,
  segments: z.array(segment).min(1),
  captions: z.array(captionV1),
  scenes: z.array(z.object({ ...base, kind: z.literal('kinetic-title'), text: line(60) })),
});

/**
 * Migração em degraus até a versão atual. Entrada que não é de uma versão antiga válida passa intacta
 * (o esquema atual decide).
 * - v1 → v2: ganha o estilo padrão; legendas sem tempos por palavra (o desenho distribui
 *   proporcionalmente); o título cinético continua igual.
 * - v2 → v3: ganha um pedido vazio (nada muda no vídeo).
 * - v3 → v4: sem trechos ajustados e sem cores de referência (nada muda no vídeo).
 */
export function migratePlan(input: unknown): unknown {
  let current = input;
  const v1 = editPlanV1Schema.safeParse(current);
  if (v1.success) {
    const p = v1.data;
    current = {
      version: 2,
      output: p.output,
      style: DEFAULT_STYLE,
      segments: p.segments,
      captions: p.captions.map((c) => ({ ...c, wordStarts: [] })),
      scenes: p.scenes,
    };
  }
  const v2 = editPlanV2Schema.safeParse(current);
  if (v2.success) current = { ...v2.data, version: 3, brief: EMPTY_BRIEF };
  const v3 = editPlanV3Schema.safeParse(current);
  if (v3.success) current = { ...v3.data, version: 4, ranges: [], reference: null };
  return current;
}

/** Aceita plano v1 a v4 e entrega sempre v4 validado (usado no projeto salvo). */
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
