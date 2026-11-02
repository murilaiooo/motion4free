import { describe, expect, it } from 'vitest';
import type { Caption } from '../src/core/types';
import { editPlanSchema } from '../src/core/schema';
import { autoEdit } from '../src/editorial/auto-edit';
import { editCaptionText, withSegments } from '../src/editorial/ops';
import { applySubtitleTranslation, selectSubtitleLanguage, translatedCaptions, translatedCueLength, translationGroups } from '../src/editorial/subtitle-translation';
import { planCues, toSrt } from '../src/editorial/subtitles';
import { wordsFrom } from './helpers/words';

const caption = (id: string, text: string, start: number, end: number): Caption => ({ id, text, start, end, wordIds: [id], wordStarts: [start] });

describe('idioma e tradução de legendas', () => {
  it('agrupa frases em inglês preservando intervalos e pausas, sem juntar fala distante', () => {
    const groups = translationGroups([
      caption('a', 'Hello', 0, 0.5),
      caption('b', 'world.', 0.5, 1.1),
      caption('c', 'How are you?', 2.3, 3.5),
      caption('d', 'I am fine.', 3.6, 4.6),
    ]);
    expect(groups).toEqual([
      { source: 'Hello world.', start: 0, end: 1.1 },
      { source: 'How are you?', start: 2.3, end: 3.5 },
      { source: 'I am fine.', start: 3.6, end: 4.6 },
    ]);
  });

  it('quebra a tradução em legendas legíveis sem inventar alinhamento de palavras', () => {
    const groups = [{ source: 'Hello, this is an example of a rather long sentence that needs to stay readable.', start: 0.5, end: 4.5 }];
    const translated = translatedCaptions(groups, ['Olá, este é um exemplo de uma frase bastante longa que precisa ficar legível.']);
    expect(translated.length).toBeGreaterThan(1);
    expect(translated[0]!.start).toBe(0.5);
    expect(translated.at(-1)!.end).toBe(4.5);
    translated.forEach((cue, i) => {
      expect(cue.text.length).toBeLessThanOrEqual(55);
      expect(cue.translationCue).toBe(true);
      expect(cue.wordStarts).toEqual([]);
      expect(cue.wordIds).toEqual([]);
      expect(cue.end).toBeGreaterThan(cue.start);
      if (i) expect(cue.start).toBeCloseTo(translated[i - 1]!.end);
    });
  });

  it('permite alternar e editar as duas faixas; o SRT segue a faixa ativa e o projeto salva ambas', () => {
    const words = wordsFrom('Hello world how are you today', 0.4);
    const plan = autoEdit(4, [], words);
    const groups = translationGroups(plan.captions);
    const translated = translatedCaptions(groups, groups.map(() => 'Olá mundo, tudo bem com você hoje?'));
    const pt = applySubtitleTranslation(plan, translated);
    expect(pt.subtitleTranslation).toMatchObject({ active: 'translated', sourceLanguage: 'en', targetLanguage: 'pt' });
    expect(toSrt(planCues(pt))).toContain('Olá mundo');
    expect(editPlanSchema.safeParse(pt).success).toBe(true);

    const en = selectSubtitleLanguage(pt, 'original');
    expect(en.captions).toEqual(plan.captions);
    expect(toSrt(planCues(en))).not.toContain('Olá mundo');
    const edited = editCaptionText(en, en.captions[0]!.id, 'Corrected English');
    const backToPt = selectSubtitleLanguage(edited, 'translated');
    expect(backToPt.captions).toEqual(translated);
    expect(selectSubtitleLanguage(backToPt, 'original').captions[0]!.text).toBe('Corrected English');
  });

  it('revisão da linha do tempo cancela a tradução antiga e preserva a fonte em inglês', () => {
    const words = wordsFrom('Hello world how are you today', 0.4);
    const base = autoEdit(4, [], words);
    const groups = translationGroups(base.captions);
    const translated = translatedCaptions(groups, groups.map(() => 'Olá mundo'));
    const pt = applySubtitleTranslation(base, translated);
    const rebuilt = withSegments(pt, { words, durationSec: 4 }, pt.segments);
    expect(rebuilt.subtitleTranslation).toBeUndefined();
    expect(rebuilt.captions.map((c) => c.text)).toEqual(base.captions.map((c) => c.text));
  });
});

describe('tamanho das legendas traduzidas', () => {
  it('segue o tamanho das legendas originais e fecha a legenda no fim da frase', () => {
    const short = [caption('a', 'Hello there', 0, 1), caption('b', 'my friend', 1, 2)];
    expect(translatedCueLength(short)).toBe(18);
    expect(translatedCueLength([caption('a', 'x'.repeat(80), 0, 1)])).toBe(42);
    expect(translatedCueLength([])).toBe(42);
    const cues = translatedCaptions(
      [{ source: 'Hi. How are you doing today, my good friend?', start: 0, end: 4 }],
      ['Oi. Como você está hoje, meu bom amigo?'],
      18,
    );
    expect(cues[0]!.text).toBe('Oi.');
    cues.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(18));
    expect(cues.map((c) => c.text).join(' ')).toBe('Oi. Como você está hoje, meu bom amigo?');
  });
});
