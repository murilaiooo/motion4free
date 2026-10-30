import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { keywordScore } from '../src/editorial/detect';
import { addSemanticWord, suggestSemanticWords } from '../src/editorial/semantic-word-edits';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT);
const duration = words.at(-1)!.end + 0.5;
const plan = autoEdit(duration, [], words);

describe('issue #117: sugestão automática de destaques por palavra', () => {
  it('sugere palavras fortes da própria fala, espaçadas e sem passar do limite', () => {
    const picked = suggestSemanticWords(plan, words, keywordScore, 8, 4);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(8);
    const ids = new Set(words.map((w) => w.id));
    for (const w of picked) expect(ids.has(w.id)).toBe(true);
    for (let i = 1; i < picked.length; i++) expect(picked[i]!.start - picked[i - 1]!.start).toBeGreaterThanOrEqual(4);
    const next = picked.reduce((acc, w) => addSemanticWord(acc, w), plan);
    expect(next.semanticCues?.length).toBe(picked.length);
  });

  it('nunca destaca palavra depois de "não" na mesma legenda', () => {
    const picked = suggestSemanticWords(plan, words, keywordScore, 60, 0);
    expect(picked.map((w) => w.text.toLowerCase())).not.toContain('intensidade.');
  });

  it('não repete palavra já destacada', () => {
    const first = suggestSemanticWords(plan, words, keywordScore);
    const withCues = first.reduce((acc, w) => addSemanticWord(acc, w), plan);
    const again = suggestSemanticWords(withCues, words, keywordScore);
    for (const w of again) expect(first.some((f) => f.id === w.id)).toBe(false);
  });
});
