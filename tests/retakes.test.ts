import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { findRetakes, isFalseStart, isRepeat, lcs, retakeToken } from '../src/editorial/retakes';

/** Frase falada a partir de `from` (s), uma palavra a cada 0,3 s, pontuada no fim. */
function say(prefix: string, text: string, from: number): Word[] {
  return text.split(' ').map((t, i) => ({ id: `${prefix}${i}`, text: t, start: from + i * 0.3, end: from + i * 0.3 + 0.25 }));
}

describe('comparação de frases', () => {
  it('palavras sem acento, pontuação e caixa', () => {
    expect(retakeToken('Você,')).toBe('voce');
    expect(retakeToken('É!')).toBe('e');
  });
  it('maior subsequência comum', () => {
    expect(lcs(['a', 'b', 'c', 'd'], ['a', 'c', 'd'])).toBe(3);
    expect(lcs([], ['a'])).toBe(0);
  });
  it('começo falso: a frase seguinte começa igual e vai além', () => {
    expect(isFalseStart(['hoje', 'eu', 'vou'], ['hoje', 'eu', 'vou', 'mostrar', 'tres', 'dicas'])).toBe(true);
    expect(isFalseStart(['hoje', 'eu', 'vou', 'falar'], ['hoje', 'eu', 'vou', 'mostrar', 'tres', 'dicas'])).toBe(true); // uma diferente, começo longo
    expect(isFalseStart(['hoje'], ['hoje', 'eu'])).toBe(false); // uma palavra só não conta
    expect(isFalseStart(['eu', 'vou'], ['hoje', 'eu', 'vou'])).toBe(false);
  });
  it('tentativa repetida: mesma frase com pequenas diferenças', () => {
    expect(isRepeat('oi gente hoje vou mostrar tres dicas'.split(' '), 'oi gente hoje eu vou mostrar tres dicas rapidas'.split(' '))).toBe(true);
    expect(isRepeat('primeira dica luz de janela'.split(' '), 'segunda dica use microfone'.split(' '))).toBe(false);
    expect(isRepeat(['sim', 'sim'], ['sim', 'sim'])).toBe(false); // curta demais para julgar
  });
});

describe('findRetakes', () => {
  it('tentativa repetida no clipe seguinte: fica a última, a primeira sai inteira', () => {
    const c1 = say('a', 'Oi gente hoje vou mostrar três dicas.', 0.5);
    const c2 = say('b', 'Oi gente hoje eu vou mostrar três dicas rápidas.', 10.5);
    const r = findRetakes([...c1, ...c2], [{ id: 'c1', duration: 10 }, { id: 'c2', duration: 10 }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ reason: 'repetida', clipId: 'c1', dropped: 'Oi gente hoje vou mostrar três dicas.', kept: 'Oi gente hoje eu vou mostrar três dicas rápidas.' });
    // cobre a frase inteira (com margem) e não sai do clipe
    expect(r[0]!.start).toBeLessThanOrEqual(c1[0]!.start);
    expect(r[0]!.end).toBeGreaterThanOrEqual(c1.at(-1)!.end);
    expect(r[0]!.end).toBeLessThanOrEqual(10);
  });

  it('começo falso no mesmo clipe e o "pera" no meio saem; frase seguinte que é outra fala fica', () => {
    const words = [...say('a', 'Hoje eu vou...', 0), ...say('p', 'pera.', 1.5), ...say('b', 'Hoje eu vou mostrar três dicas.', 3), ...say('c', 'Primeira dica luz de janela.', 6)];
    const r = findRetakes(words, [{ id: 'c1', duration: 9 }]);
    expect(r.map((x) => [x.reason, x.dropped])).toEqual([
      ['comeco-falso', 'Hoje eu vou...'],
      ['comeco-falso', 'pera.'],
    ]);
    // nunca encosta nas palavras que ficam
    expect(r.at(-1)!.end).toBeLessThanOrEqual(3);
  });

  it('três tentativas seguidas: só a última fica', () => {
    const words = [...say('a', 'O segredo é constância.', 0), ...say('b', 'O segredo é a constância.', 3), ...say('c', 'O segredo de tudo é a constância.', 6)];
    const r = findRetakes(words, [{ id: 'c1', duration: 9 }]);
    expect(r.map((x) => x.dropped)).toEqual(['O segredo é constância.', 'O segredo é a constância.']);
  });

  it('nada repetido: nada sai', () => {
    const words = [...say('a', 'Três dicas para gravar melhor.', 0), ...say('b', 'Primeira dica luz de janela.', 3), ...say('c', 'Segunda dica use o microfone.', 10.5)];
    expect(findRetakes(words, [{ id: 'c1', duration: 10 }, { id: 'c2', duration: 5 }])).toEqual([]);
  });

  it('só compara clipes vizinhos: a mesma frase três clipes depois fica (pode ser de propósito, como um bordão)', () => {
    const words = [...say('a', 'Siga para mais dicas como esta.', 0), ...say('b', 'Primeira dica luz.', 5), ...say('c', 'Segunda dica som.', 10), ...say('d', 'Siga para mais dicas como esta.', 15)];
    expect(findRetakes(words, [{ id: 'c1', duration: 5 }, { id: 'c2', duration: 5 }, { id: 'c3', duration: 5 }, { id: 'c4', duration: 5 }])).toEqual([]);
  });

  it('determinístico', () => {
    const words = [...say('a', 'Oi gente hoje vou mostrar.', 0), ...say('b', 'Oi gente hoje vou mostrar tudo.', 5)];
    const clips = [{ id: 'c1', duration: 5 }, { id: 'c2', duration: 5 }];
    expect(findRetakes(words, clips)).toEqual(findRetakes(words, clips));
  });
});
