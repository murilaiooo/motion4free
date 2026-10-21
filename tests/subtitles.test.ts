import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { planCues, srtTime, toSrt } from '../src/editorial/subtitles';
import { outputDuration } from '../src/engine/timeline';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

describe('legenda em arquivo SRT', () => {
  it('formata o tempo com horas, minutos, segundos e milissegundos', () => {
    expect(srtTime(0)).toBe('00:00:00,000');
    expect(srtTime(62.3456)).toBe('00:01:02,346');
    expect(srtTime(3723.5)).toBe('01:02:03,500');
    expect(srtTime(-1)).toBe('00:00:00,000');
  });

  it('numera as falas a partir de 1, com uma linha em branco entre elas', () => {
    const srt = toSrt([
      { start: 0.5, end: 1.75, text: 'Olá pessoal' },
      { start: 2, end: 3, text: 'tudo bem?' },
    ]);
    expect(srt).toBe('1\n00:00:00,500 --> 00:00:01,750\nOlá pessoal\n\n2\n00:00:02,000 --> 00:00:03,000\ntudo bem?\n');
  });

  it('sem falas, o arquivo fica vazio', () => {
    expect(toSrt([])).toBe('');
  });
});

describe('legendas do vídeo editado', () => {
  const words = wordsFrom(SAMPLE_TEXT, 0.2);
  const plan = autoEdit(words.at(-1)!.end + 1, [], words);

  it('sai uma fala por legenda, em ordem, dentro do vídeo e sem sobreposição', () => {
    const cues = planCues(plan);
    expect(cues.length).toBe(plan.captions.length);
    const total = outputDuration(plan.segments);
    cues.forEach((c, i) => {
      expect(c.text.length).toBeGreaterThan(0);
      expect(c.end).toBeGreaterThan(c.start);
      expect(c.end).toBeLessThanOrEqual(total + 1e-9);
      if (i > 0) expect(c.start).toBeGreaterThanOrEqual(cues[i - 1]!.end - 1e-9);
    });
  });

  it('o texto do arquivo é o mesmo das legendas do vídeo', () => {
    expect(planCues(plan).map((c) => c.text)).toEqual(plan.captions.map((c) => c.text.replace(/\s+/g, ' ').trim()));
  });
});
