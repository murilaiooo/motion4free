import { z } from 'zod';
import { AppError } from '../core/errors';
import type { SceneKind } from '../core/types';
import { SCENE_CATALOG } from '../motion/catalog';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const time = z.number().finite().nonnegative();
const label = z.object({ kind: z.enum(['hook', 'cut', 'scene']), firstWordId: id, lastWordId: id,
  preferred: z.boolean(), sceneKind: z.custom<SceneKind>(value => typeof value === 'string' && Object.hasOwn(SCENE_CATALOG, value)).optional(),
}).strict();
const recording = z.object({
  id, sourceGroup: id, speakerGroups: z.array(id).min(1).max(20),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), split: z.enum(['development', 'validation', 'holdout']),
  language: z.enum(['pt', 'en', 'mixed']), durationSec: time.positive().max(14_400),
  tags: z.array(z.enum(['negation', 'quantity', 'condition', 'enumeration', 'quiet-speech', 'music', 'multi-speaker', 'story'])).max(8),
  rights: z.object({ basis: z.enum(['owned', 'explicit-permission', 'public-license']), evidenceRef: id,
    localEvaluation: z.literal(true), publicMedia: z.boolean(), publicAnnotations: z.boolean(),
  }).strict(),
  words: z.array(z.object({id, text: z.string().min(1).max(1000), start: time, end: time}).strict()).min(1).max(20_000),
  labels: z.array(label).min(1).max(1000),
}).strict().superRefine((record, ctx) => {
  const positions = new Map<string, number>();
  for (const [i, word] of record.words.entries()) {
    if (positions.has(word.id) || word.end <= word.start || word.end > record.durationSec || (i > 0 && word.start < record.words[i - 1]!.start)) ctx.addIssue({code: 'custom', path: ['words', i], message: 'Palavra/tempo inválido'});
    positions.set(word.id, i);
  }
  for (const [i, label] of record.labels.entries()) {
    const first = positions.get(label.firstWordId), last = positions.get(label.lastWordId);
    if (first === undefined || last === undefined || last < first || (label.kind === 'scene' ? !label.sceneKind : !!label.sceneKind)) ctx.addIssue({code: 'custom', path: ['labels', i], message: 'Referência de anotação inválida'});
  }
});
export const datasetSchema = z.object({ version: z.literal(1), records: z.array(recording).min(1).max(200) }).strict().superRefine((data, ctx) => {
  const groups = new Map<string, string>(), ids = new Set<string>();
  for (const [i, record] of data.records.entries()) {
    if (ids.has(record.id)) ctx.addIssue({code: 'custom', path: ['records', i, 'id'], message: 'ID duplicado'});
    ids.add(record.id);
    // Same content, recording origin OR person cannot cross any split, including transitive groups.
    for (const group of [`source:${record.sourceGroup}`, `hash:${record.sha256}`, ...record.speakerGroups.map(id => `speaker:${id}`)]) {
      const split = groups.get(group);
      if (split && split !== record.split) ctx.addIssue({code: 'custom', path: ['records', i, 'split'], message: 'Origem/pessoa/conteúdo cruza conjuntos'});
      groups.set(group, record.split);
    }
  }
});
export type QualityDataset = z.infer<typeof datasetSchema>;
export function readQualityDataset(input: unknown): QualityDataset {
  const parsed = datasetSchema.safeParse(input);
  // Do not echo transcript, evidence references, names or malformed input into error messages.
  if (!parsed.success) throw new AppError('QUALIDADE_DATASET');
  return parsed.data;
}
export function datasetSummary(dataset: QualityDataset) {
  return { records: dataset.records.length,
    splits: Object.fromEntries(['development', 'validation', 'holdout'].map(split => [split, dataset.records.filter(record => record.split === split).length])),
    languages: [...new Set(dataset.records.map(record => record.language))],
    sourceGroups: new Set(dataset.records.map(record => record.sourceGroup)).size,
    speakerGroups: new Set(dataset.records.flatMap(record => record.speakerGroups)).size,
    publicMedia: dataset.records.filter(record => record.rights.publicMedia).length,
  };
}
