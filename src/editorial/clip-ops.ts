import { AppError } from '../core/errors';
import type { ClipRef, EditPlan, TimeRange, Word } from '../core/types';
import { clipAt, remapSegments, remapTime, totalDuration } from '../engine/clips';
import { rangeOut } from '../engine/timeline';
import { rebuildAll } from './ops';

type ClipIdentity = Pick<ClipRef, 'id' | 'duration'>;
const EPS = 1e-4;

/** Uma edição de intervalo acompanha seu arquivo original, jamais um horário aleatório de outro clipe. */
function rebaseInterval(
  from: readonly ClipIdentity[], to: readonly ClipIdentity[],
  range: { srcStart: number; srcEnd: number },
  label: string,
): { srcStart: number; srcEnd: number } | null {
  const first = clipAt(from, range.srcStart);
  const last = clipAt(from, Math.max(range.srcStart, range.srcEnd - EPS));
  if (!first || !last) return null;
  if (first.id !== last.id) {
    throw new AppError('TRECHO_TRAVADO', `${label} cruza dois clipes. Divida o elemento no ponto de junção antes de mudar a ordem.`);
  }
  const a = remapTime(from, to, range.srcStart);
  const b = remapTime(from, to, range.srcEnd, true);
  return a === null || b === null ? null : { srcStart: a, srcEnd: b };
}

/** Atualiza a posição de todos os elementos sem trocar o arquivo a que pertencem. */
export function reorderClipPlan(
  plan: EditPlan,
  nextClips: ClipRef[],
  wordsByClip: Readonly<Record<string, readonly Word[]>>,
): EditPlan {
  if (!nextClips.length) throw new AppError('CLIPE_UNICO');
  const oldIds = plan.clips.map((c) => c.id);
  if (new Set(nextClips.map((c) => c.id)).size !== nextClips.length ||
      nextClips.some((c) => !oldIds.includes(c.id))) {
    throw new AppError('CLIPES_AUSENTES', 'A nova ordem contém um clipe desconhecido ou repetido.');
  }
  if (oldIds.join('|') === nextClips.map((c) => c.id).join('|')) return plan;

  const from = plan.clips;
  const to = nextClips;
  const segments = remapSegments(plan.segments, from, to);
  if (!segments.length) throw new AppError('CORTE_TOTAL');

  const ranges = plan.ranges.flatMap((range) => {
    const shifted = rebaseInterval(from, to, range, 'Trecho ajustado');
    if (!shifted) return [];
    const out = rangeOut(segments, shifted);
    return out ? [{ ...range, ...shifted, out }] : [];
  });
  const added = plan.edits.added.flatMap((element) => {
    const shifted = rebaseInterval(from, to, element, 'Elemento manual');
    return shifted ? [{ ...element, ...shifted }] : [];
  });
  const zooms = plan.edits.zooms.flatMap((zoom) => {
    const shifted = rebaseInterval(from, to, zoom, 'Zoom manual');
    return shifted ? [{ ...zoom, ...shifted }] : [];
  });

  // Edições de cenas usam chaves tipo@timestamp-original; refaz a chave para o mesmo clipe.
  const scenes: typeof plan.edits.scenes = {};
  for (const [key, value] of Object.entries(plan.edits.scenes)) {
    const m = /^(.*)@(\d+(?:\.\d+)?)(#\d+)?$/.exec(key);
    const src = m ? remapTime(from, to, Number(m[2])) : null;
    if (m && src === null) continue;
    const destKey = m ? `${m[1]}@${src!.toFixed(1)}${m[3] ?? ''}` : key;
    const shifted = value.srcStart !== null && value.srcEnd !== null
      ? rebaseInterval(from, to, { srcStart: value.srcStart, srcEnd: value.srcEnd }, 'Cena manual')
      : null;
    if (value.srcStart !== null && value.srcEnd !== null && !shifted) continue;
    scenes[destKey] = shifted ? { ...value, ...shifted } : value;
  }
  const captions: typeof plan.edits.captions = {};
  for (const [key, value] of Object.entries(plan.edits.captions)) {
    const shifted = value.srcStart !== null && value.srcEnd !== null
      ? rebaseInterval(from, to, { srcStart: value.srcStart, srcEnd: value.srcEnd }, 'Legenda manual')
      : null;
    if (value.srcStart !== null && value.srcEnd !== null && !shifted) continue;
    captions[key] = shifted ? { ...value, ...shifted } : value;
  }

  // Os textos corrigidos das legendas acompanham os mesmos wordIds no rebuildAll.
  // A ordem de leitura e as cenas seguem a nova ordem do vídeo.
  const words: Word[] = [];
  let offset = 0;
  for (const clip of nextClips) {
    for (const w of wordsByClip[clip.id] ?? []) {
      words.push({ ...w, start: +(w.start + offset).toFixed(3), end: +(w.end + offset).toFixed(3) });
    }
    offset += clip.duration;
  }
  return rebuildAll({
    ...plan, clips: nextClips, segments, ranges,
    edits: { ...plan.edits, added, zooms, scenes, captions },
  }, { durationSec: totalDuration(to), words });
}
