import { creativeReviewSchema, sceneGraphSchema, storyboardSchema, type CreativePlan } from '../core/creative-plan';
import type { EditPlan } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { resolvePlan } from './elements';
import { deleteElement } from './manual';
import { sceneKey } from './selector';
import { SCENE_CATALOG } from '../motion/catalog';

const cache = new WeakMap<EditPlan, CreativePlan>();
/** Structural storyboard of the current edit; never a claim of rendered-frame analysis. */
export function compileCreativePlan(plan: EditPlan): CreativePlan {
  const previous = cache.get(plan);
  if (previous) return previous;
  const resolved = resolvePlan(plan), total = outputDuration(plan.segments);
  const allNodes = [
    ...resolved.scenes.map(s => ({ id: `scene:${s.key}`, kind: 'scene' as const, ref: s.key, start: s.scene.start, end: s.scene.end })),
    ...resolved.captions.map(c => ({ id: `caption:${c.key}`, kind: 'caption' as const, ref: c.key, start: c.caption.start, end: c.caption.end })),
    ...resolved.added.map(a => ({ id: `added:${a.el.id}`, kind: 'added' as const, ref: a.el.id, start: a.start, end: a.end })),
  ];
  const nodes = allNodes.filter(n => n.id.length <= 200 && n.ref.length <= 200).slice(0, 2400);
  const boundaries = [0];
  for (const { caption } of resolved.captions) {
    if (boundaries.length >= 120) break;
    if (caption.end < total && caption.end - boundaries.at(-1)! >= 8) boundaries.push(caption.end);
  }
  if (total > 0) boundaries.push(total);
  const beats = boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1]!;
    const captions = resolved.captions.filter(c => c.caption.start < end && c.caption.end > start);
    const active = nodes.filter(n => n.start < end && n.end > start);
    const kinds = [...new Set(resolved.scenes.filter(s => s.scene.start < end && s.scene.end > start).map(s => SCENE_CATALOG[s.scene.kind].name))];
    return { id: `beat-${i + 1}`, start, end,
      purpose: i === 0 ? 'opening' as const : i === boundaries.length - 2 ? 'closing' as const : captions.length ? 'speech' as const : 'visual' as const,
      wordIds: [...new Set(captions.flatMap(c => c.caption.wordIds))].filter(id => id.length > 0 && id.length <= 200).slice(0, 80),
      nodeIds: active.slice(0, 200).map(n => n.id),
      why: (kinds.length ? `Elementos desta edição: ${kinds.join(', ')}.` : 'Sem cena automática neste intervalo; vídeo, legendas e elementos manuais seguem o plano.').slice(0, 300),
    };
  });
  const findings: CreativePlan['review']['findings'] = [];
  const last = new Map<string, (typeof resolved.scenes)[number]>();
  for (const current of [...resolved.scenes].sort((a, b) => a.scene.start - b.scene.start)) {
    if (!['kinetic-title', 'big-number', 'list', 'quote', 'lower-third', 'end-cta', 'emoji'].includes(current.scene.kind)) continue;
    const identity = sceneKey(current.scene), before = last.get(identity);
    last.set(identity, current);
    if (current.key.length > 160) continue;
    if (!before || current.scene.start - before.scene.end > 20) continue;
    const locked = plan.ranges.some(range => range.locked && range.out.start < current.scene.end && range.out.end > current.scene.start);
    findings.push({ id: `repeat:${current.key}`, message: `Repetição próxima de ${SCENE_CATALOG[current.scene.kind].name}. Confira se acrescenta informação.`,
      action: !current.edit && !locked ? { kind: 'hide-repetition', sceneKey: current.key } : null });
    if (findings.length === 8) break;
  }
  const truncated = allNodes.length > nodes.length || beats.some(beat => nodes.filter(n => n.start < beat.end && n.end > beat.start).length > 200) || boundaries.length >= 121;
  const value: CreativePlan = { version: 1, mode: 'current-edit-structure',
    storyboard: storyboardSchema.parse({ version: 1, beats }),
    sceneGraph: sceneGraphSchema.parse({ version: 1, nodes: nodes.map(({ id, kind, ref }) => ({ id, kind, ref })) }),
    review: creativeReviewSchema.parse({ version: 1, basis: 'structure-only', visualSample: 'not-analyzed', requiresHumanReview: true, truncated, findings }),
  };
  cache.set(plan, value);
  return value;
}

/** One explicit, current-plan action per click; existing operation enforces locks/history semantics. */
export function applyCreativeFinding(plan: EditPlan, findingId: string): EditPlan {
  const finding = compileCreativePlan(plan).review.findings.find(item => item.id === findingId);
  if (!finding?.action) return plan;
  return deleteElement(plan, { type: 'scene', key: finding.action.sceneKey });
}
