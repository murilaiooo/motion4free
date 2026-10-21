import { describe, expect, it } from 'vitest';
import type { AiChoice } from '../src/editorial/ai-brief';
import type { Moment } from '../src/editorial/highlights';
import { applyPicks, momentsAiMessages, parseMomentsReply, rankMomentsWithAi } from '../src/editorial/moments-ai';
import { AppError } from '../src/core/errors';

const mk = (i: number): Moment => ({ id: `m${i}`, rank: i, start: i * 100, end: i * 100 + 40, title: `Título ${i}`, text: `fala ${i} <b>`, score: 90 - i, reasons: ['ritmo bom'], wordCount: 80 });
const moments = [1, 2, 3, 4].map(mk);
const ai = (reply: string | Error): AiChoice => ({ source: 'ia-local', complete: async () => (reply instanceof Error ? Promise.reject(reply) : reply) });

describe('IA nos momentos', () => {
  it('mensagem numera os trechos e escapa o texto', () => {
    const m = momentsAiMessages(moments, 2);
    expect(m.user).toContain('<quantos>2</quantos>');
    expect(m.user).toContain('1: fala 1 ‹b›');
    expect(m.user).not.toContain('<b>');
  });

  it('aceita só números da lista, sem repetir; título limpo', () => {
    const p = parseMomentsReply('```json\n{"clipes":[{"n":3,"titulo":"Bom <script>"},{"n":3},{"n":9},{"n":"x"},{"n":1}]}\n```', 4);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.picks).toEqual([{ index: 2, title: 'Bom script' }, { index: 0, title: '' }]);
  });

  it('resposta sem nada aproveitável é recusada', () => {
    expect(parseMomentsReply('não sei', 4).ok).toBe(false);
    expect(parseMomentsReply('{"clipes":[{"n":7}]}', 4).ok).toBe(false);
    expect(parseMomentsReply('{"outra":1}', 4).ok).toBe(false);
  });

  it('nova ordem: escolhidos primeiro, depois o resto; trecho e nota não mudam', () => {
    const out = applyPicks(moments, [{ index: 2, title: 'Novo' }, { index: 0, title: '' }]);
    expect(out.map((m) => m.start)).toEqual([300, 100, 200, 400]);
    expect(out[0]!.title).toBe('Novo');
    expect(out[1]!.title).toBe('Título 1');
    expect(out.map((m) => m.rank)).toEqual([1, 2, 3, 4]);
    expect(out[0]!.reasons[0]).toBe('escolhido pela IA');
  });

  it('falha ou resposta inválida: ordem das regras com M4F-1106', async () => {
    const a = await rankMomentsWithAi(moments, 2, ai(new AppError('IA_LOCAL_FALHOU', 'sem resposta')));
    expect(a.moments).toBe(moments);
    expect(a.warning?.code).toBe('M4F-1106');
    const b = await rankMomentsWithAi(moments, 2, ai('blá'));
    expect(b.warning?.code).toBe('M4F-1106');
    const c = await rankMomentsWithAi(moments, 2, ai('{"clipes":[{"n":4,"titulo":"Quarto"}]}'));
    expect(c.warning).toBeNull();
    expect(c.moments[0]!.start).toBe(400);
  });
});
