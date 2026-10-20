import type { ClipRef, EditPlan, TimeRange, Word } from '../core/types';
import { AppError } from '../core/errors';
import { totalDuration, placeRanges, placeWords } from '../engine/clips';
import { outputDuration } from '../engine/timeline';
import { autoEdit } from './auto-edit';
import { captionOptionsFor, buildCaptions } from './captions';

/**
 * Acrescenta novos clipes sem substituir cortes, cenas, legendas editadas, travas ou elementos
 * já existentes. Somente o novo material recebe edição automática.
 */
export function appendClipsToPlan(
  plan: EditPlan,
  more: ClipRef[],
  wordsByClip: Readonly<Record<string, readonly Word[]>>,
  silencesByClip: Readonly<Record<string, readonly TimeRange[]>>,
): EditPlan {
  if (!more.length) return plan;
  const all = [...plan.clips, ...more];
  if (all.length > 30) throw new AppError('CLIPES_DEMAIS', `${all.length}/30`);
  if (totalDuration(all) > 600) throw new AppError('CLIPES_LONGOS', `${totalDuration(all).toFixed(1)} s > 600 s`);
  if (new Set(all.map(c => c.id)).size !== all.length) throw new AppError('CLIPES_AUSENTES', 'Identificadores duplicados.');
  const oldSourceEnd = totalDuration(plan.clips);
  const oldOutEnd = outputDuration(plan.segments);
  const extraDuration = totalDuration(more);
  const localWords = placeWords(more, wordsByClip);
  const localSilences = placeRanges(more, silencesByClip);
  const extraPlan = autoEdit(extraDuration, localSilences, localWords, plan.style, {
    clips: more, output: plan.output, framing: plan.framing,
  });
  const newSegments = extraPlan.segments.map(s => ({
    srcStart: +(s.srcStart + oldSourceEnd).toFixed(3),
    srcEnd: +(s.srcEnd + oldSourceEnd).toFixed(3),
  }));
  const extraCaptions = buildCaptions(localWords, extraPlan.segments, captionOptionsFor(plan.style)).map((c) => ({
    ...c,
    id: `append-${more[0]!.id}-${c.id}`,
    start: +(c.start + oldOutEnd).toFixed(3),
    end: +(c.end + oldOutEnd).toFixed(3),
    wordStarts: c.wordStarts.map(t => +(t + oldOutEnd).toFixed(3)),
  }));
  const extraScenes = extraPlan.scenes.filter(s => s.kind !== 'progress-bar').map(s => {
    const shifted = {
      ...s, id: `append-${more[0]!.id}-${s.id}`,
      start: +(s.start + oldOutEnd).toFixed(3),
      end: +(s.end + oldOutEnd).toFixed(3),
    };
    if (shifted.kind === 'cut-transition') return { ...shifted, at: +(shifted.at + oldOutEnd).toFixed(3) };
    if (shifted.kind === 'list') return { ...shifted, items: shifted.items.map(i => ({ ...i, at: +(i.at + oldOutEnd).toFixed(3) })) };
    return shifted;
  });
  const totalOut = oldOutEnd + outputDuration(extraPlan.segments);
  const scenes = [...plan.scenes.map(s => s.kind === 'progress-bar' ? { ...s, end: totalOut } : s), ...extraScenes];
  return {
    ...plan,
    clips: all,
    segments: [...plan.segments, ...newSegments],
    captions: [...plan.captions, ...extraCaptions],
    scenes,
  };
}
