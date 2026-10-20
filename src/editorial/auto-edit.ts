import { EMPTY_BRIEF } from '../core/brief';
import { DEFAULT_STYLE } from '../core/presets';
import type { StyleDNA } from '../core/style';
import { REELS_PROFILE, type EditPlan, type TimeRange, type Word } from '../core/types';
import { buildCaptions, captionOptionsFor } from './captions';
import { planKeepSegments } from './cuts';
import { proposeScenes } from './selector';

export { openingTitle } from './selector';

/**
 * Edição automática, 100% por regras (sem IA): corta silêncios longos, gera legendas
 * no tamanho do estilo e propõe as cenas de motion design pelo seletor.
 */
export function autoEdit(durationSec: number, silences: TimeRange[], words: Word[], style: StyleDNA = DEFAULT_STYLE): EditPlan {
  const segments = planKeepSegments(durationSec, silences, words);
  const captions = buildCaptions(words, segments, captionOptionsFor(style));
  const scenes = proposeScenes(words, segments, style);
  return { version: 4, output: REELS_PROFILE, style, brief: EMPTY_BRIEF, segments, captions, scenes, ranges: [], reference: null };
}
