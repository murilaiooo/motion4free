import { EMPTY_BRIEF } from '../core/brief';
import { DEFAULT_STYLE } from '../core/presets';
import type { StyleDNA } from '../core/style';
import { DEFAULT_FRAMING, REELS_PROFILE, type ClipRef, type EditPlan, type Framing, type OutputProfile, type TimeRange, type Word } from '../core/types';
import { clipJoins, splitAtClips } from '../engine/clips';
import { buildCaptions, captionOptionsFor } from './captions';
import { planKeepSegments } from './cuts';
import { NO_SCENE_OPTIONS, proposeScenes } from './selector';

export { openingTitle } from './selector';

export interface AutoEditOptions {
  /** clipes em ordem (v0.14); sem clipes = um vídeo só ('c1') com a duração dada */
  clips?: ClipRef[];
  output?: OutputProfile;
  framing?: Framing;
}

/**
 * Edição automática, 100% por regras (sem IA): corta silêncios longos, gera legendas
 * no tamanho do estilo e propõe as cenas de motion design pelo seletor.
 */
export function autoEdit(durationSec: number, silences: TimeRange[], words: Word[], style: StyleDNA = DEFAULT_STYLE, opts: AutoEditOptions = {}): EditPlan {
  const clips = opts.clips ?? [{ id: 'c1', name: '', duration: durationSec, framing: null }];
  const segments = splitAtClips(planKeepSegments(durationSec, silences, words), clips);
  const captions = buildCaptions(words, segments, captionOptionsFor(style));
  const scenes = proposeScenes(words, segments, style, { ...NO_SCENE_OPTIONS, joins: clipJoins(segments, clips) });
  return {
    version: 6,
    output: opts.output ?? REELS_PROFILE,
    clips,
    framing: opts.framing ?? DEFAULT_FRAMING,
    style,
    brief: EMPTY_BRIEF,
    segments,
    captions,
    scenes,
    ranges: [],
    reference: null,
  };
}
