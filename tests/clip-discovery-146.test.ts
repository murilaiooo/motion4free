import { describe, expect, it, vi } from 'vitest';
import type { Word } from '../src/core/types';
import { AppError } from '../src/core/errors';
import { discoverContextualMoments } from '../src/editorial/clip-discovery';

// issue #146: cada caminho de falha da análise contextual tem um código próprio e não é confundido com sucesso.
const transcript = (count: number): Word[] =>
  Array.from({ length: count }, (_, i) => ({ id: 'w' + i, text: i % 6 === 5 ? 'conclusão.' : i % 6 === 0 ? 'Questão' : 'resposta', start: i * 0.5, end: i * 0.5 + 0.4 }));
const options = { length: 'curto' as const, count: 5 };
const run = (words: Word[], complete: () => Promise<string>, source = 'ia-chave') =>
  discoverContextualMoments(words, words.at(-1)!.end + 1, options, { source, complete: vi.fn(complete) } as never, new AbortController().signal, () => {});

describe('issue #146: análise contextual de clipes', () => {
  it('resposta válida e vazia em todas as partes: sem aviso e tudo coberto', async () => {
    const result = await run(transcript(110), async () => '{"spans":[]}');
    expect(result.warning).toBeNull();
    expect(result.covered).toBe(result.total);
    expect(result.moments.length).toBeGreaterThan(0);
  });

  it('texto fora do formato ganha uma segunda tentativa antes de falhar', async () => {
    let calls = 0;
    const result = await run(transcript(110), async () => (++calls === 1 ? 'Claro! Aqui estão os momentos.' : '{"spans":[]}'));
    expect(calls).toBe(2);
    expect(result.warning).toBeNull();
    expect(result.covered).toBe(1);
  });

  it('formato inválido duas vezes vira M4F-1112, mantendo os candidatos locais', async () => {
    const result = await run(transcript(110), async () => 'não sei');
    expect(result.warning?.code).toBe('M4F-1112');
    expect(result.covered).toBe(0);
    expect(result.moments.length).toBeGreaterThan(0);
    expect(result.moments.every((m) => m.sourceEvidence?.source !== 'ai-context')).toBe(true);
  });

  it('trecho ancorado em IDs reais entra como revisto pela IA', async () => {
    const result = await run(transcript(110), async () => JSON.stringify({ spans: [{ firstWordId: 'w0', lastWordId: 'w47', titleFirstWordId: 'w0', titleLastWordId: 'w5', setupWordIds: ['w0', 'w6'], payoffWordIds: ['w41', 'w47'] }] }));
    expect(result.accepted).toBe(1);
    expect(result.moments.some((m) => m.sourceEvidence?.source === 'ai-context')).toBe(true);
  });

  it('erro de conta (sem crédito) para na hora, sem gastar as outras partes', async () => {
    const complete = vi.fn(async () => { throw new AppError('PROVEDOR_SEM_CREDITO'); });
    const words = transcript(4000);
    const result = await discoverContextualMoments(words, 2001, options, { source: 'ia-chave', complete } as never, new AbortController().signal, () => {});
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.warning?.code).toBe('M4F-1207');
  });

  it('falha depois de partes boas vira M4F-1114 (parcial) e não esconde o que deu certo', async () => {
    let calls = 0;
    const words = transcript(4000);
    const result = await discoverContextualMoments(words, 2001, options, { source: 'ia-chave', complete: async () => { calls++; if (calls > 3) throw new AppError('PROVEDOR_ERRO'); return '{"spans":[]}'; } } as never, new AbortController().signal, () => {});
    expect(result.covered).toBe(3);
    expect(result.warning?.code).toBe('M4F-1114');
    expect(result.failed).toBe(2);
  });
});
