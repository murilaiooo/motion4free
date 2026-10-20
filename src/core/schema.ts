import { z } from 'zod';
import { EMPHASES, EMPTY_BRIEF, LEVELS, PACES, PROHIBITIONS, TONES, briefSchema, briefV1Schema, migrateBrief } from './brief';
import { EMOJI_SET } from './emoji';
import { lookSchema } from './look';
import { DEFAULT_STYLE } from './presets';
import { migrateStyle, styleSchema, styleV1Schema } from './style';
import type { EditPlan, Framing } from './types';

/** Recorte das versões até a v0.13: preenche a tela pelo centro. */
const LEGACY_FRAMING: Framing = { mode: 'fill', fill: 'blur', zoom: 1, x: 0, y: 0 };

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

const sceneV4Options = [
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
] as const;
const sceneV4 = z.discriminatedUnion('kind', [...sceneV4Options]);
const scene = z.discriminatedUnion('kind', [...sceneV4Options, z.object({ ...base, kind: z.literal('emoji'), emoji: z.enum(EMOJI_SET) })]);

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const rangeFields = {
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
};
const rangeOk = (r: { srcStart: number; srcEnd: number }) => r.srcEnd > r.srcStart;

const range = z
  .object({
    ...rangeFields,
    look: lookSchema.nullable(),
    style: styleSchema.nullable(),
    locked: z.object({ outStart: time, scenes: z.array(scene).max(200), captions: z.array(caption).max(200) }).nullable(),
  })
  .refine(rangeOk, { message: 'trecho com fim antes do início' });

const rangeV4 = z
  .object({
    ...rangeFields,
    style: styleV1Schema.nullable(),
    locked: z.object({ outStart: time, scenes: z.array(sceneV4).max(200), captions: z.array(caption).max(200) }).nullable(),
  })
  .refine(rangeOk, { message: 'trecho com fim antes do início' });

const reference = z.object({ colors: z.array(color).min(1).max(6) }).nullable();

export const framingSchema = z.object({
  mode: z.enum(['fill', 'fit', 'smart']),
  fill: z.enum(['blur', 'color']),
  zoom: z.number().min(1).max(3),
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
});

/** Limite de clipes por projeto (v0.14; ver ADR-0019). */
export const MAX_CLIPS = 30;

const clipRef = z.object({
  id: z.string().regex(/^c[0-9]{1,3}$/),
  name: z.string().max(200),
  duration: z.number().finite().positive(),
  framing: framingSchema.nullable(),
});

const planV5Fields = {
  output,
  style: styleSchema,
  brief: briefSchema,
  segments: z.array(segment).min(1),
  captions: z.array(caption),
  scenes: z.array(scene),
  ranges: z.array(range).max(50),
  reference,
};

/** Formato atual (v0.14): vários clipes em sequência e enquadramento por formato de saída. */
export const editPlanSchema = z
  .object({
    version: z.literal(6),
    ...planV5Fields,
    clips: z
      .array(clipRef)
      .min(1)
      .max(MAX_CLIPS)
      .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, { message: 'clipes com o mesmo id' }),
    framing: framingSchema,
  })
  .refine((p) => p.segments.every((s) => s.srcEnd <= p.clips.reduce((a, c) => a + c.duration, 0) + 0.01), { message: 'trecho depois do fim dos clipes' });

/** Formato da v0.6 à v0.13 (um vídeo só, sempre 9:16). Mantido para abrir projetos antigos. */
export const editPlanV5Schema = z.object({ version: z.literal(5), ...planV5Fields });

/** Formato da Fase 5 (trechos; estilo v1, pedido v1, sem emojis). Mantido para abrir projetos antigos. */
export const editPlanV4Schema = z.object({
  version: z.literal(4),
  output,
  style: styleV1Schema,
  brief: briefV1Schema,
  segments: z.array(segment).min(1),
  captions: z.array(caption),
  scenes: z.array(sceneV4),
  ranges: z.array(rangeV4).max(50),
  reference,
});

/** Formato da Fase 4 (pedido por texto, sem trechos). Mantido para abrir projetos antigos. */
export const editPlanV3Schema = editPlanV4Schema.omit({ ranges: true, reference: true }).extend({ version: z.literal(3) });

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
 * - v4 → v5: estilo v2 (emojis desligados, cores próprias da legenda vazias, entrada 'auto'),
 *   pedido v2 (look vazio) e trechos sem look (nada muda no vídeo).
 * - v5 → v6: um clipe ('c1') com o vídeo inteiro e enquadramento "preencher" no centro, que é o
 *   recorte que as versões antigas faziam (nada muda no vídeo).
 */
export function migratePlan(input: unknown): unknown {
  let current = input;
  const v1 = editPlanV1Schema.safeParse(current);
  if (v1.success) {
    const p = v1.data;
    current = {
      version: 2,
      output: p.output,
      style: { ...DEFAULT_STYLE_V1 },
      segments: p.segments,
      captions: p.captions.map((c) => ({ ...c, wordStarts: [] })),
      scenes: p.scenes,
    };
  }
  const v2 = editPlanV2Schema.safeParse(current);
  if (v2.success) current = { ...v2.data, version: 3, brief: EMPTY_BRIEF_V1 };
  const v3 = editPlanV3Schema.safeParse(current);
  if (v3.success) current = { ...v3.data, version: 4, ranges: [], reference: null };
  const v4 = editPlanV4Schema.safeParse(current);
  if (v4.success) {
    const p = v4.data;
    current = {
      ...p,
      version: 5,
      style: migrateStyle(p.style),
      brief: migrateBrief(p.brief),
      ranges: p.ranges.map((r) => ({ ...r, look: null, style: r.style ? migrateStyle(r.style) : null })),
    };
  }
  const v5 = editPlanV5Schema.safeParse(current);
  if (v5.success) {
    const p = v5.data;
    // um clipe só; a duração certa vem do projeto (fixClipDuration), aqui fica o fim do último trecho
    const end = Math.max(...p.segments.map((s) => s.srcEnd), ...p.ranges.map((r) => r.srcEnd));
    current = { ...p, version: 6, clips: [{ id: 'c1', name: '', duration: end, framing: null }], framing: { ...LEGACY_FRAMING } };
  }
  return current;
}

/** Estilo padrão e pedido vazio no formato antigo (v1), para os degraus de migração. */
const { emoji: _emoji, ...defaultV1Rest } = DEFAULT_STYLE;
const DEFAULT_STYLE_V1 = {
  ...defaultV1Rest,
  version: 1 as const,
  captions: (({ y: _y, enter: _e, wordsPerLine: _w, colors: _c, ...rest }) => rest)(DEFAULT_STYLE.captions),
};
const { look: _look, hookStyle: _hs, unsupported: _u, summary: _s, ...emptyV1Rest } = EMPTY_BRIEF;
const EMPTY_BRIEF_V1 = { ...emptyV1Rest, version: 1 as const };

/** Projeto antigo (um vídeo): o clipe migrado passa a ter a duração real do vídeo salvo. */
export function fixClipDuration(plan: EditPlan, durationSec: number): EditPlan {
  if (plan.clips.length !== 1 || Math.abs(plan.clips[0]!.duration - durationSec) < 1e-6) return plan;
  const end = Math.max(...plan.segments.map((s) => s.srcEnd));
  return { ...plan, clips: [{ ...plan.clips[0]!, duration: Math.max(durationSec, end) }] };
}

/** Aceita plano v1 a v6 e entrega sempre v6 validado (usado no projeto salvo). */
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
