import { REELS_PROFILE, type EditPlan, type SceneInstance, type TimeRange, type Word } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { buildCaptions } from './captions';
import { planKeepSegments } from './cuts';

/**
 * Edição automática da Fase 1, 100% por regras (sem IA):
 * corta silêncios longos, gera legendas e abre com um título cinético
 * usando as primeiras palavras da primeira frase.
 */
export function autoEdit(durationSec: number, silences: TimeRange[], words: Word[]): EditPlan {
  const segments = planKeepSegments(durationSec, silences, words);
  const captions = buildCaptions(words, segments);
  const total = outputDuration(segments);
  const scenes: SceneInstance[] = [];
  const title = openingTitle(words);
  if (title && total > 1.5) {
    scenes.push({ id: 's1', kind: 'kinetic-title', text: title, start: 0, end: Math.min(2.2, total) });
  }
  return { version: 1, output: REELS_PROFILE, segments, captions, scenes };
}

export function openingTitle(words: Word[], maxWords = 4): string | null {
  const picked: string[] = [];
  for (const w of words) {
    const clean = w.text.trim();
    if (!clean) continue;
    picked.push(clean.replace(/[.,!?;:]+$/, ''));
    if (picked.length >= maxWords || /[.!?]$/.test(clean)) break;
  }
  const text = picked.join(' ').trim();
  return text.length > 0 ? text.slice(0, 60) : null;
}
