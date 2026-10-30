import { z } from 'zod';
const ref = z.string().min(1).max(200);
const time = z.number().finite().nonnegative();
/** References to existing allowlisted renderer elements only. No executable payloads. */
export const sceneGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({ id: ref, kind: z.enum(['scene', 'caption', 'added']), ref }).strict()).max(2400),
}).strict();
export const storyboardSchema = z.object({
  version: z.literal(1),
  beats: z.array(z.object({
    id: ref, start: time, end: time, purpose: z.enum(['opening', 'speech', 'visual', 'closing']),
    wordIds: z.array(ref).max(80), nodeIds: z.array(ref).max(200), why: z.string().max(300),
  }).strict().refine(beat => beat.end > beat.start)).max(120),
}).strict();
export const creativeReviewSchema = z.object({
  version: z.literal(1), basis: z.literal('structure-only'), visualSample: z.literal('not-analyzed'),
  requiresHumanReview: z.literal(true), truncated: z.boolean(),
  findings: z.array(z.object({ id: ref, message: z.string().max(300),
    action: z.object({ kind: z.literal('hide-repetition'), sceneKey: ref }).strict().nullable(),
  }).strict()).max(8),
}).strict();
export interface CreativePlan {
  version: 1;
  mode: 'current-edit-structure';
  storyboard: z.infer<typeof storyboardSchema>;
  sceneGraph: z.infer<typeof sceneGraphSchema>;
  review: z.infer<typeof creativeReviewSchema>;
}
