import { describe, expect, it, vi } from 'vitest';
import type { Word } from '../src/core/types';
import { extractJsonObject } from '../src/editorial/ai-brief';
import { jsonValues, repairJson, salvageObjects } from '../src/editorial/ai-json';
import { discoverContextualMoments, parseSpanProposals } from '../src/editorial/clip-discovery';

// v0.37 / M4F-1112: modelos grátis (Nemotron, DeepSeek R1, Qwen3, Llama…) respondem JSON de jeitos diferentes.
describe('leitura tolerante de JSON da IA', () => {
  it('conserta vírgula sobrando e comentários sem mexer em strings', () => {
    expect(JSON.parse(repairJson('{"a":[1,2,],// nota\n"b":"x, ]"/* fim */,}'))).toEqual({ a: [1, 2], b: 'x, ]' });
  });

  it('ignora raciocínio e rascunhos e fica com o último objeto completo', () => {
    const raw = '<think>Formato: {"spans":[{"firstWordId":"w0"}]} ... vou escolher</think>\nResposta final:\n```json\n{"spans":[{"firstWordId":"w3","lastWordId":"w9"}]}\n```';
    expect(extractJsonObject(raw)).toEqual({ ok: true, value: { spans: [{ firstWordId: 'w3', lastWordId: 'w9' }] } });
  });

  it('pensamento sem fechar ainda deixa achar o JSON', () => {
    expect(jsonValues('<think>analisando… {"spans":[]}')).toEqual([{ spans: [] }]);
  });

  it('aproveita os objetos inteiros de uma resposta cortada pelo limite de tokens', () => {
    expect(salvageObjects('{"spans":[{"firstWordId":"w1","lastWordId":"w5"},{"firstWordId":"w8","last')).toEqual([{ firstWordId: 'w1', lastWordId: 'w5' }]);
  });

  it('continua recusando resposta sem objeto', () => {
    expect(extractJsonObject('não sei').ok).toBe(false);
    expect(extractJsonObject('[{"preset":"pop"}]').ok).toBe(false);
    expect(extractJsonObject('{"a":1').ok).toBe(false);
  });
});

describe('parseSpanProposals: trechos em qualquer formato razoável', () => {
  it('formato combinado', () => {
    expect(parseSpanProposals('{"spans":[{"firstWordId":"w1","lastWordId":"w9","titleFirstWordId":"w1","titleLastWordId":"w4"}]}'))
      .toEqual([{ first: 'w1', last: 'w9', titleFirst: 'w1', titleLast: 'w4', setup: [], payoff: [] }]);
  });

  it('lista solta, nomes em português/snake_case, IDs numéricos e campos a mais', () => {
    expect(parseSpanProposals('[{"inicio":"w2","fim":"w20","motivo":"gancho forte"}]')).toEqual([{ first: 'w2', last: 'w20', setup: [], payoff: [] }]);
    expect(parseSpanProposals('{"clips":[{"start_id":12,"end_id":40,"score":9}]}')).toEqual([{ first: '12', last: '40', setup: [], payoff: [] }]);
    expect(parseSpanProposals('{"spans":[{"first_word_id":"w1","last_word_id":"w30","reason":"x"}],"note":"ok"}')?.[0]?.first).toBe('w1');
  });

  it('lista vazia é resposta válida; texto puro não é', () => {
    expect(parseSpanProposals('Nada serve. {"spans":[]}')).toEqual([]);
    expect(parseSpanProposals('Claro! Aqui estão os momentos.')).toBeNull();
  });
});

const transcript = (count: number): Word[] =>
  Array.from({ length: count }, (_, i) => ({ id: 'w' + i, text: i % 6 === 5 ? 'conclusão.' : i % 6 === 0 ? 'Questão' : 'resposta', start: i * 0.5, end: i * 0.5 + 0.4 }));

describe('análise contextual com respostas de modelos que pensam', () => {
  const run = (complete: () => Promise<string>) => {
    const words = transcript(110);
    return discoverContextualMoments(words, words.at(-1)!.end + 1, { length: 'curto', count: 5 }, { source: 'ia-chave', complete: vi.fn(complete) } as never, new AbortController().signal, () => {});
  };

  it('resposta estilo Nemotron (raciocínio + cerca + campos extras) entra como revista pela IA', async () => {
    const result = await run(async () => 'Okay, the user wants clips. Let me think about {"spans": "format"}.\n\n```json\n{"spans":[{"firstWordId":"w0","lastWordId":"w47","titleFirstWordId":"w0","titleLastWordId":"w5","why":"hook",}]}\n```');
    expect(result.warning).toBeNull();
    expect(result.accepted).toBeGreaterThan(0);
    expect(result.moments.some((m) => m.sourceEvidence?.source === 'ai-context')).toBe(true);
  });

  it('IDs só com número viram IDs reais da transcrição', async () => {
    const result = await run(async () => '{"spans":[{"start":0,"end":47}]}');
    expect(result.accepted).toBeGreaterThan(0);
  });

  it('falha de formato mostra o começo da resposta no detalhe para diagnóstico', async () => {
    const result = await run(async () => 'Desculpe, não posso.');
    expect(result.warning?.code).toBe('M4F-1112');
    expect(result.warning?.detail).toContain('Desculpe');
  });
});
