import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { CLIP_LENGTHS, clock, findMoments, nudgeMoment, shortTitle, speechPieces } from '../src/editorial/highlights';
import { wordsFrom } from './helpers/words';

/** Fala longa sintética: blocos de assunto separados, um deles bem mais forte (pergunta, número, palavras fortes). */
function longTalk(): Word[] {
  const filler = 'a gente estava conversando sobre várias coisas do dia a dia e foi indo assim sem muita pressa.';
  const strong =
    'Você sabia que noventa por cento das pessoas cometem esse erro com dinheiro? O segredo é simples! ' +
    'Primeiro, nunca gaste antes de guardar. Segundo, acompanhe o resultado toda semana. ' +
    'Eu perdi dois mil reais antes de entender isso. Não cometa o mesmo erro.';
  const blocks = [filler, filler, filler, filler, strong, filler, filler, filler, filler, filler, filler, filler];
  let text = '';
  for (const b of blocks) text += ` ${b} ${b}`;
  return wordsFrom(text.trim());
}

describe('findMoments', () => {
  const words = longTalk();
  const duration = words.at(-1)!.end + 1;
  const moments = findMoments(words, duration, { length: 'curto', count: 3 });

  it('devolve até o número pedido, sem sobreposição, do melhor para o pior', () => {
    expect(moments.length).toBeGreaterThan(0);
    expect(moments.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < moments.length; i++) expect(moments[i - 1]!.score).toBeGreaterThanOrEqual(moments[i]!.score);
    for (const a of moments) for (const b of moments) if (a !== b) expect(a.end <= b.start || b.end <= a.start).toBe(true);
    expect(moments.map((m) => m.rank)).toEqual(moments.map((_, i) => i + 1));
  });

  it('o melhor momento é o trecho forte (pergunta, número, palavras fortes)', () => {
    expect(moments[0]!.text).toContain('noventa por cento');
    expect(moments[0]!.reasons.length).toBeGreaterThan(0);
  });

  it('tamanho dentro do pedido (mais a folga) e sem cortar palavra', () => {
    const L = CLIP_LENGTHS.curto;
    for (const m of moments) {
      expect(m.end - m.start).toBeGreaterThanOrEqual(L.min);
      expect(m.end - m.start).toBeLessThanOrEqual(L.max + 1);
      for (const w of words) {
        const cuts = (t: number) => w.start < t - 1e-6 && w.end > t + 1e-6;
        expect(cuts(m.start) || cuts(m.end)).toBe(false);
      }
    }
  });

  it('a fala do momento é exatamente a sequência transcrita', () => {
    const m = moments[0]!;
    const inside = words.filter((w) => w.start >= m.start && w.end <= m.end).map((w) => w.text).join(' ');
    expect(m.text).toBe(inside);
    expect(m.title.length).toBeLessThanOrEqual(60);
  });

  it('determinístico', () => {
    expect(findMoments(words, duration, { length: 'curto', count: 3 })).toEqual(moments);
  });

  it('energia mais alta puxa a nota para cima', () => {
    const step = 0.5;
    const env = new Float32Array(Math.ceil(duration / step)).fill(-30);
    const target = moments.at(-1)!;
    for (let i = Math.floor(target.start / step); i < Math.ceil(target.end / step); i++) env[i] = -12;
    const withEnergy = findMoments(words, duration, { length: 'curto', count: 3, energy: env, energyStep: step });
    const same = withEnergy.find((m) => Math.abs(m.start - target.start) < 0.01);
    expect(same === undefined || same.score > target.score).toBe(true);
    expect(withEnergy.some((m) => m.reasons.includes('fala mais animada que o resto'))).toBe(true);
  });

  it('sem fala ou sem janela do tamanho pedido: lista vazia', () => {
    expect(findMoments([], 600, { length: 'medio', count: 5 })).toEqual([]);
    const short = wordsFrom('Uma frase curta só.');
    expect(findMoments(short, 10, { length: 'longo', count: 5 })).toEqual([]);
  });
});

describe('pedaços de fala', () => {
  it('frase sem pontuação muito longa é dividida (nenhum pedaço passa de 14 s)', () => {
    const ws = wordsFrom(Array.from({ length: 120 }, (_, i) => `palavra${i}`).join(' '), 0, 0.35, 0);
    for (const p of speechPieces(ws)) expect(p.end - p.start).toBeLessThanOrEqual(14.5);
  });
});

describe('ajuste fino (nudgeMoment)', () => {
  const words = longTalk();
  const duration = words.at(-1)!.end + 1;
  const m = findMoments(words, duration, { length: 'curto', count: 1 })[0]!;

  it('começar antes e terminar depois encaixam em palavra', () => {
    const a = nudgeMoment(m, words, duration, 'start', -1);
    expect(a.start).toBeLessThan(m.start);
    const b = nudgeMoment(m, words, duration, 'end', 1);
    expect(b.end).toBeGreaterThan(m.end);
    for (const x of [a, b])
      for (const w of words) {
        const cuts = (t: number) => w.start < t - 1e-6 && w.end > t + 1e-6;
        expect(cuts(x.start) || cuts(x.end)).toBe(false);
      }
  });

  it('não deixa o clipe menor que 5 s', () => {
    let x = m;
    for (let i = 0; i < 20; i++) x = nudgeMoment(x, words, duration, 'end', -1);
    expect(x.end - x.start).toBeGreaterThanOrEqual(5);
  });
});

describe('textos', () => {
  it('título curto não parte palavra', () => {
    const t = shortTitle('Esta é uma frase bem comprida que não cabe inteira no título do cartão de jeito nenhum', 40);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t.endsWith('…')).toBe(true);
  });
  it('relógio', () => {
    expect(clock(65)).toBe('1:05');
    expect(clock(3725)).toBe('1:02:05');
  });
});
