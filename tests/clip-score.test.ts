import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { cohesion, hookStrength, leadingFillers, scoreSpan } from '../src/editorial/clip-score';
import { buildTranscriptIndex } from '../src/editorial/clip-context';
import { findContextualMoments, groundedMoment, titleFor } from '../src/editorial/clip-candidates';

const words = (text: string, start = 0, step = 0.37): Word[] =>
  text.split(' ').map((t, i) => ({ id: `w${i}`, text: t, start: start + i * step, end: start + i * step + step * 0.85 }));
const limit = { min: 15, max: 30, ideal: 22 };

describe('v0.37: nota profissional de clipes', () => {
  it('gancho: pergunta, padrão de abertura e número batem saudação e chamada para ação', () => {
    expect(hookStrength('Você sabia que 90% das pessoas erram isso no primeiro emprego?')).toBeGreaterThan(0.7);
    expect(hookStrength('O maior erro de quem começa a investir é esse.')).toBeGreaterThan(0.5);
    expect(hookStrength('Bom dia pessoal, tudo bem com vocês?')).toBeLessThan(0.3);
    expect(hookStrength('Se inscreva no canal e ativa o sininho.')).toBe(0);
  });

  it('trecho com gancho, emoção e conclusão ganha do trecho morno do mesmo tamanho', () => {
    const strong = words('Ninguém te conta isso: eu perdi todo o meu dinheiro em 2019 investindo errado. Foi horrível, eu chorei por semanas. Só que foi aí que eu aprendi a regra mais importante do dinheiro. Por isso hoje eu nunca invisto sem reserva de emergência.');
    const weak = words('Então, continuando aqui o que a gente estava vendo, tem algumas coisas que dá para fazer de vários jeitos diferentes e cada pessoa faz de um jeito, depende muito de cada caso e de como a pessoa organiza as coisas no dia a dia dela e tal');
    const a = scoreSpan(strong, { limit });
    const b = scoreSpan(weak, { limit });
    expect(a.score).toBeGreaterThan(b.score + 15);
    expect(a.parts.gancho).toBeGreaterThan(b.parts.gancho);
    expect(a.parts.conclusao).toBeGreaterThan(0.6);
    expect(a.reasons[0]).toMatch(/gancho|pergunta|emoção|conclusão/);
    expect(b.reasons.join(' ')).toMatch(/começo fraco|antes/);
  });

  it('energia da voz acima da média do vídeo sobe a nota', () => {
    const ws = words('O segredo é simples: você precisa vender antes de produzir. Teste a ideia com dez clientes reais. Se ninguém pagar, mude a ideia.');
    const env = Array.from({ length: 200 }, (_, i) => (i < 30 ? -12 : -24));
    const loud = scoreSpan(ws, { limit, energy: env, energyStep: 0.5 });
    const quiet = scoreSpan(ws.map((w) => ({ ...w, start: w.start + 60, end: w.end + 60 })), { limit, energy: env, energyStep: 0.5 });
    expect(loud.parts.energia).toBeGreaterThan(quiet.parts.energia);
    expect(loud.score).toBeGreaterThan(quiet.score);
  });

  it('assunto único (TextTiling): metades que repetem palavras de conteúdo têm coesão alta', () => {
    expect(cohesion('vender produto cliente preço vendas', 'cliente comprou produto preço caro')).toBeGreaterThan(0.8);
    expect(cohesion('vender produto cliente preço vendas', 'futebol domingo estádio torcida gol')).toBeLessThan(0.3);
  });

  it('enrolação do começo sai, mas "É isso" e "Um erro" ficam', () => {
    expect(leadingFillers(words('Hum, então, o segredo é vender antes.'))).toBe(2);
    expect(leadingFillers(words('É isso que muda tudo na venda.'))).toBe(0);
    expect(leadingFillers(words('Um erro comum é não testar.'))).toBe(0);
  });

  it('o clipe começa depois da enrolação e o título é a frase falada mais forte', () => {
    const ws = words('Hum, bom, deixa eu pensar aqui um pouco sobre isso tudo. O maior erro de quem vende online é esse. Você coloca preço baixo demais e trabalha de graça o mês inteiro. Por isso a regra é simples: calcule o custo antes de anunciar.');
    const index = buildTranscriptIndex(ws, ws.at(-1)!.end + 2);
    const m = groundedMoment(index, 0, ws.length - 1, { length: 'curto', count: 3 })!;
    expect(m).not.toBeNull();
    expect(m.text.startsWith('Hum')).toBe(false);
    expect(m.title).toBe('O maior erro de quem vende online é esse.');
    expect(m.breakdown).toBeDefined();
  });

  it('título cortado nunca deixa de fora uma negação', () => {
    const ws = words('Investir em ações, sem estudar antes, não é uma boa ideia para quem tem pouco dinheiro guardado hoje em dia no banco.');
    const index = buildTranscriptIndex(ws, ws.at(-1)!.end + 1);
    expect(titleFor(index, 0, ws.length - 1)).toBeNull();
  });

  it('2 h de fala continuam rápidas (sem travar o navegador)', () => {
    const base = 'Você sabia que o maior erro é esse? Eu perdi dinheiro com isso. Por isso hoje eu calculo tudo antes. ';
    const long = words(base.repeat(1500).trim(), 0, 0.36);
    const t0 = performance.now();
    const moments = findContextualMoments(long, long.at(-1)!.end + 1, { length: 'medio', count: 10 });
    expect(moments.length).toBeGreaterThan(0);
    expect(performance.now() - t0).toBeLessThan(15000);
  }, 30_000);
});
