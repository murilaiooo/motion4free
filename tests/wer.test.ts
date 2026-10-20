import { describe, expect, it } from 'vitest';
import { align, tokenize, topErrors, wordErrorRate } from '../src/analysis/wer';

describe('WER (taxa de erro por palavra)', () => {
  it('textos iguais: 0% de erro, mesmo com pontuação e maiúsculas diferentes', () => {
    const r = wordErrorRate('hoje eu vou mostrar três dicas', 'Hoje, eu vou mostrar três dicas!');
    expect(r.wer).toBe(0);
    expect(r.accuracy).toBe(1);
    expect(r.refWords).toBe(6);
  });

  it('conta trocas, faltas e sobras', () => {
    const r = wordErrorRate('a gente vai gravar o vídeo agora', 'a gente vai grava vídeo agora mesmo');
    expect(r.substitutions).toBe(1); // gravar → grava
    expect(r.deletions).toBe(1); // o
    expect(r.insertions).toBe(1); // mesmo
    expect(r.wer).toBeCloseTo(3 / 7);
  });

  it('acento conta como erro, a não ser que peça para ignorar', () => {
    expect(wordErrorRate('ele é bom', 'ele e bom').wer).toBeCloseTo(1 / 3);
    expect(wordErrorRate('ele é bom', 'ele e bom', { ignoreAccents: true }).wer).toBe(0);
  });

  it('80% de acerto = WER 0,2', () => {
    const ref = 'um dois três quatro cinco seis sete oito nove dez';
    const hyp = 'um dois três quatro cinco seis sete oito novo dês';
    expect(wordErrorRate(ref, hyp).accuracy).toBeCloseTo(0.8);
  });

  it('referência vazia', () => {
    expect(wordErrorRate('', '').wer).toBe(0);
    expect(wordErrorRate('', 'oi').wer).toBe(1);
  });

  it('separa por hífen e barra, junta letras e números', () => {
    expect(tokenize('Inscreva-se 2x/semana')).toEqual(['inscreva', 'se', '2x', 'semana']);
  });

  it('alinhamento mostra onde errou e os erros mais comuns', () => {
    const ops = align(['vou', 'te', 'mostrar'], ['vou', 'ti', 'mostrar']);
    expect(ops.map((o) => o.op)).toEqual(['ok', 'troca', 'ok']);
    const r = wordErrorRate('te mostrar te contar', 'ti mostrar ti contar extra');
    expect(topErrors(r.ops)).toEqual([
      { pair: 'te → ti', count: 2 },
      { pair: '(sobrou) → extra', count: 1 },
    ]);
  });
});
