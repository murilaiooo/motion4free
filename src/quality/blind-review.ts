import { z } from 'zod';
import { AppError } from '../core/errors';
import { readQualityDataset } from './dataset';
export const REVIEW_AXES = {
  direction: 'Direção de arte e hierarquia', typography: 'Tipografia e legibilidade',
  timing: 'Timing e movimento', meaning: 'Significado visual ligado à fala',
  composition: 'Composição e enquadramento', narrative: 'Narrativa e gancho fiel',
  originality: 'Originalidade e ausência de clichês', fidelity: 'Fidelidade ao briefing',
  audio: 'Áudio e cortes',
} as const;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const blindId = z.string().regex(/^A[0-9]{3}$/);
const hash = (text: string) => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const blindPackageSchema = z.object({ version: z.literal(2), packageId: z.string().uuid(), rubric: z.literal(1), seed: id,
  cases: z.array(z.object({id, variantIds: z.array(blindId).min(2).max(8)}).strict()).min(1).max(50),
  variants: z.array(z.object({id: blindId, caseId: id, brief: z.string().min(1).max(1000), file: z.string().regex(/^A[0-9]{3}\.(mp4|webm|mov)$/)}).strict()).min(2).max(200),
}).strict().superRefine((pack, ctx) => {
  const ids = new Set(pack.variants.map(v => v.id)), cases = new Set(pack.cases.map(c => c.id));
  if (ids.size !== pack.variants.length || cases.size !== pack.cases.length || new Set(pack.variants.map(v => v.file)).size !== pack.variants.length || pack.variants.some(v => !cases.has(v.caseId)) || pack.cases.some(c => new Set(c.variantIds).size !== c.variantIds.length || c.variantIds.some(id => !pack.variants.some(v => v.id === id && v.caseId === c.id))) || pack.variants.some(v => !pack.cases.find(c => c.id === v.caseId)?.variantIds.includes(v.id))) ctx.addIssue({code: 'custom', message: 'Referências inválidas'});
});
export type BlindPackage = z.infer<typeof blindPackageSchema>;
export function readBlindPackage(input: unknown): BlindPackage {
  const parsed = blindPackageSchema.safeParse(input); if (!parsed.success) throw new AppError('QUALIDADE_PACOTE'); return parsed.data;
}
const outputsSchema = z.array(z.object({id, recordingId: id, producer: z.enum(['motion4free', 'deterministic', 'editonny', 'human']),
  brief: z.string().min(1).max(1000), file: z.string().regex(/^[^\/\\]{1,160}\.(mp4|webm|mov)$/), authorizedDerivative: z.literal(true),
}).strict()).min(2).max(200);
/** Curator-only input is never put in the reviewer package. File copies must be renamed separately. */
export function prepareBlindPackage(datasetInput: unknown, outputsInput: unknown, seedInput: string, packageIdInput: string) {
  const dataset = readQualityDataset(datasetInput), parsed = outputsSchema.safeParse(outputsInput), seed = id.safeParse(seedInput), packageId = z.string().uuid().safeParse(packageIdInput);
  if (!parsed.success || !seed.success || !packageId.success || new Set(parsed.data.map(o => o.id)).size !== parsed.data.length) throw new AppError('QUALIDADE_PACOTE');
  const records = new Set(dataset.records.map(r => r.id));
  if (parsed.data.some(o => !records.has(o.recordingId))) throw new AppError('QUALIDADE_PACOTE');
  const ordered = [...parsed.data].sort((a, b) => hash(seed.data + a.id) - hash(seed.data + b.id) || a.id.localeCompare(b.id));
  const cases: BlindPackage['cases'] = [], variants: BlindPackage['variants'] = [];
  const groups = new Map<string, BlindPackage['cases'][number]>();
  const privateKey: {blindId: string; outputId: string; recordingId: string; producer: string; originalFile: string; blindFile: string}[] = [];
  for (const [i, output] of ordered.entries()) {
    let group = groups.get(output.recordingId);
    if (!group) { group = {id: `case-${cases.length + 1}`, variantIds: []}; cases.push(group); groups.set(output.recordingId, group); }
    const blindId = `A${String(i + 1).padStart(3, '0')}`, file = `${blindId}.${output.file.split('.').at(-1)}`;
    group.variantIds.push(blindId); variants.push({id: blindId, caseId: group.id, brief: output.brief, file});
    privateKey.push({blindId, outputId: output.id, recordingId: output.recordingId, producer: output.producer, originalFile: output.file, blindFile: file});
  }
  return {pack: readBlindPackage({version: 2, packageId: packageId.data, rubric: 1, seed: seed.data, cases, variants}), privateKey: {version: 2, packageId: packageId.data, entries: privateKey}};
}
export function reviewerOrder(pack: BlindPackage, reviewer: string) {
  if (!id.safeParse(reviewer).success) throw new AppError('QUALIDADE_NOTAS');
  return [...pack.cases].sort((a,b) => hash(pack.seed + reviewer + a.id) - hash(pack.seed + reviewer + b.id)).flatMap(c =>
    [...c.variantIds].sort((a,b) => hash(pack.seed + reviewer + a) - hash(pack.seed + reviewer + b) || a.localeCompare(b)));
}
const evidence = z.object({score: z.number().int().min(0).max(5), second: z.number().finite().nonnegative().max(14_400), note: z.string().trim().min(1).max(500)}).strict();
const scores = z.object({direction: evidence, typography: evidence, timing: evidence, meaning: evidence, composition: evidence, narrative: evidence, originality: evidence, fidelity: evidence, audio: evidence}).strict();
const severe = z.object({kind: z.enum(['factual-inversion','invented-claim','clipped-word','disconnected-motion','unreadable','technical-failure']), second: z.number().finite().nonnegative().max(14_400), note: z.string().trim().min(1).max(500)}).strict();
const rating = z.discriminatedUnion('status', [
  z.object({status: z.literal('rated'), variantId: blindId, scores, severe: z.array(severe).max(20)}).strict(),
  z.object({status: z.literal('abstain'), variantId: blindId, reason: z.string().trim().min(1).max(500)}).strict(),
]);
export function readBlindRating(input: unknown) {
  const parsed = rating.safeParse(input);
  if (!parsed.success) throw new AppError('QUALIDADE_NOTAS', 'Revise notas, tempos e justificativas desta versão.');
  return parsed.data;
}
const reviewSchema = z.object({version: z.literal(2), packageId: z.string().uuid(), reviewerId: id, expertise: z.enum(['motion-professional','editor','viewer']),
  ratings: z.array(rating).min(2).max(200), preferences: z.array(z.object({caseId: id, variantId: blindId.nullable(), reason: z.string().trim().min(1).max(500)}).strict()).min(1).max(50),
}).strict();
export function readBlindReview(input: unknown, pack: BlindPackage) {
  const parsed = reviewSchema.safeParse(input); if (!parsed.success) throw new AppError('QUALIDADE_NOTAS');
  const review = parsed.data;
  if (review.packageId !== pack.packageId) throw new AppError('QUALIDADE_NOTAS', 'Esta resposta pertence a outra rodada. Use o pacote original.');
  if (new Set(review.ratings.map(r => r.variantId)).size !== pack.variants.length || review.ratings.length !== pack.variants.length || review.ratings.some(r => !pack.variants.some(v => v.id === r.variantId)) || new Set(review.preferences.map(p => p.caseId)).size !== pack.cases.length || review.preferences.length !== pack.cases.length || review.preferences.some(p => !pack.cases.some(c => c.id === p.caseId && (p.variantId === null || c.variantIds.includes(p.variantId))))) throw new AppError('QUALIDADE_NOTAS');
  if (review.preferences.some(p => p.variantId !== null && !review.ratings.some(r => r.variantId === p.variantId && r.status === 'rated'))) throw new AppError('QUALIDADE_NOTAS');
  return review;
}

/** Descriptive human reports only, never model judgments or a quality certification. */
export function summarizeBlindReviews(pack: BlindPackage, inputs: unknown[]) {
  if (!inputs.length || inputs.length > 50) throw new AppError('QUALIDADE_NOTAS');
  const reviews = inputs.map(input => readBlindReview(input, pack));
  if (new Set(reviews.map(review => review.reviewerId)).size !== reviews.length) throw new AppError('QUALIDADE_NOTAS');
  const variants = pack.variants.map(variant => {
    const rows = reviews.flatMap(review => review.ratings.flatMap(rating => rating.variantId === variant.id ? [{reviewerId: review.reviewerId, rating}] : []));
    const axes = Object.fromEntries((Object.keys(REVIEW_AXES) as (keyof typeof REVIEW_AXES)[]).map(axis => {
      const observed = rows.flatMap(row => row.rating.status === 'rated' ? [row.rating.scores[axis].score] : []);
      const min = observed.length ? Math.min(...observed) : null, max = observed.length ? Math.max(...observed) : null;
      return [axis, {count: observed.length, mean: observed.length ? observed.reduce((a,b) => a+b, 0) / observed.length : null, min, max,
        disagreement: observed.length >= 2 && max! - min! >= 3}];
    }));
    return {id: variant.id, axes, abstentions: rows.filter(row => row.rating.status === 'abstain').length,
      severeReported: rows.flatMap(row => row.rating.status === 'rated' ? row.rating.severe.map(error => ({reviewerId: row.reviewerId, ...error})) : [])};
  });
  return {version:2, packageId:pack.packageId, rubric:pack.rubric, reviewerCount:reviews.length, variants,
    preferences: pack.cases.map(group => ({caseId:group.id, counts: Object.fromEntries(group.variantIds.map(id => [id, reviews.filter(review => review.preferences.some(p => p.caseId === group.id && p.variantId === id)).length])), abstentions:reviews.filter(review => review.preferences.some(p => p.caseId === group.id && p.variantId === null)).length})),
    limitations:['Descriptive, self-reported human ratings; no statistical equivalence or professional-quality conclusion.', 'Severe errors are reported observations; their absence is not proof that no defect exists.', 'Comments and evidence remain private unless publication rights separately permit disclosure.'],
  };
}
