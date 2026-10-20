import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';
import type { Segment, Word } from '../src/core/types';
import type { AiChoice, AiMessages } from '../src/editorial/ai-brief';
import { autoEdit } from '../src/editorial/auto-edit';
import { GENTLE_MIN_CUT_SEC, retimeCuts } from '../src/editorial/cuts';
import { findHooks, pickHook } from '../src/editorial/hooks';
import { interpretPrompt } from '../src/editorial/interpret';
import { applyBrief, applyRange, type EditContext } from '../src/editorial/ops';
import { interpretRangeLayered } from '../src/editorial/range-ai';
import { interpretRangePrompt } from '../src/editorial/range-interpret';
import { outputDuration, sourceToOutput } from '../src/engine/timeline';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const w = (id: string, start: number, end: number, text = 'palavra'): Word => ({ id, text, start, end });
const inside = (segs: Segment[], t: number) => segs.some((s) => t >= s.srcStart - 1e-6 && t <= s.srcEnd + 1e-6);

describe('retimeCuts: ritmo dos cortes pedido por texto', () => {
  const words = [w('a', 0.5, 1.0), w('b', 1.1, 1.6), w('c', 2.4, 2.9), w('d', 3.0, 3.5)];
  const all: Segment[] = [{ srcStart: 0, srcEnd: 5 }];
  it('"agressivo" tira pausas ≥ 0,3 s, o silêncio do começo e do fim', () => {
    const out = retimeCuts(all, words, 5, 'agressivo');
    expect(out.length).toBeGreaterThan(1);
    expect(outputDuration(out)).toBeLessThan(outputDuration(all) - 1.5);
    // a pausa entre b (1,6) e c (2,4) sumiu
    expect(inside(out, 2.0)).toBe(false);
  });
  it('nunca corta dentro de uma palavra', () => {
    const out = retimeCuts(all, words, 5, 'agressivo');
    for (const x of words) for (let t = x.start; t <= x.end; t += 0.05) expect(inside(out, t), `${x.id}@${t}`).toBe(true);
  });
  it('respeita trechos travados', () => {
    const out = retimeCuts(all, words, 5, 'agressivo', [{ start: 1.5, end: 2.5 }]);
    expect(inside(out, 2.0)).toBe(true);
  });
  it('"suave" devolve cortes curtos e mantém os longos', () => {
    const segs: Segment[] = [
      { srcStart: 0, srcEnd: 1 },
      { srcStart: 1.4, srcEnd: 2 },
      { srcStart: 4, srcEnd: 5 },
    ];
    const out = retimeCuts(segs, words, 5, 'suave');
    expect(inside(out, 1.2)).toBe(true);
    expect(inside(out, 3)).toBe(false);
    expect(GENTLE_MIN_CUT_SEC).toBe(0.8);
  });
  it('"normal" não muda; sem palavras não muda; nunca devolve lista vazia', () => {
    expect(retimeCuts(all, words, 5, 'normal')).toBe(all);
    expect(retimeCuts(all, [], 5, 'agressivo')).toBe(all);
    expect(retimeCuts([{ srcStart: 1, srcEnd: 1.05 }], [w('x', 1, 1.04)], 2, 'agressivo').length).toBeGreaterThan(0);
  });
});

describe('applyBrief com cortes e tipo de gancho', () => {
  const words = wordsFrom(SAMPLE_TEXT);
  const d = words.at(-1)!.end + 0.5;
  const ctx: EditContext = { durationSec: d, words };
  const base = autoEdit(d, [], words);
  it('"cortes rápidos" encurta o vídeo e as legendas continuam no tempo das palavras', () => {
    const p = applyBrief(base, ctx, interpretPrompt('cortes rapidos e sem pausas').brief);
    expect(outputDuration(p.segments)).toBeLessThan(outputDuration(base.segments));
    const byId = new Map(words.map((x) => [x.id, x]));
    for (const c of p.captions) {
      const first = byId.get(c.wordIds[0]!)!;
      expect(c.start).toBeCloseTo(sourceToOutput(p.segments, first.start) ?? -1, 2);
    }
    expect(() => parseEditPlan(p)).not.toThrow();
  });
  it('voltar para um pedido sem cortes restaura os trechos (sem perder a mídia original)', () => {
    const fast = applyBrief(base, ctx, interpretPrompt('cortes rapidos').brief);
    const back = applyBrief(fast, ctx, interpretPrompt('mantem as pausas').brief);
    expect(outputDuration(back.segments)).toBeGreaterThan(outputDuration(fast.segments));
  });
  it('trecho travado não perde pausas com "cortes rápidos"', () => {
    const locked = applyRange(base, ctx, { start: 2, end: 6 }, interpretRangePrompt('trava esse pedaço')).plan;
    const r = locked.ranges[0]!;
    const fast = applyBrief(locked, ctx, interpretPrompt('cortes rapidos').brief);
    const kept = (segs: Segment[]) => segs.reduce((acc, s) => acc + Math.max(0, Math.min(s.srcEnd, r.srcEnd) - Math.max(s.srcStart, r.srcStart)), 0);
    expect(kept(fast.segments)).toBeCloseTo(kept(locked.segments), 2);
  });
  it('gancho criativo é diferente do óbvio; pergunta escolhe uma pergunta', () => {
    const hooks = findHooks(words);
    expect(hooks.length).toBeGreaterThan(1);
    const creative = pickHook(hooks, 'criativo')!;
    expect(creative.text).not.toBe(hooks[0]!.text);
    expect(pickHook(hooks, 'pergunta')!.text).toMatch(/\?$/);
    expect(pickHook(hooks, null)).toBe(hooks[0]);
    expect(pickHook([], 'criativo')).toBeNull();
    const p = applyBrief(base, ctx, interpretPrompt('gancho com pergunta').brief);
    expect(p.brief.hook?.text).toMatch(/\?$/);
  });
});

describe('pedido de trecho pela IA (escopo trecho)', () => {
  const fake = (reply: string, log: AiMessages[] = []): AiChoice => ({ source: 'ia-chave', complete: async (m) => (log.push(m), reply) });
  it('sem IA: só as regras', async () => {
    const r = await interpretRangeLayered('legenda verde aqui', [], null);
    expect(r.req.look.captions?.text).toBe('#22C55E');
    expect(r.warning).toBeNull();
  });
  it('a IA completa o look do trecho; campos do vídeo inteiro são descartados; regras valem mais', async () => {
    const log: AiMessages[] = [];
    const reply = JSON.stringify({ look: { captions: { text: '#FF0000', scale: 1.4 }, cuts: 'agressivo', emoji: { mode: 'keywords' } }, preset: 'pop', tone: 'calmo', unsupported: ['chuva de confete'], summary: 'Legenda maior aqui.' });
    const r = await interpretRangeLayered('legenda verde e bem chamativa aqui', [], fake(reply, log));
    expect(log[0]!.system).toContain('SÓ para um trecho');
    expect(r.req.look.captions?.text).toBe('#22C55E');
    expect(r.req.look.captions?.scale).toBe(1.4);
    expect(r.req.look.cuts).toBeUndefined();
    expect(r.req.look.emoji?.mode).toBe('keywords');
    // "chamativa" as regras já leram como energético: a IA (calmo) não troca
    expect(r.req.tone).toBe('energetico');
    expect(r.req.unsupported).toContain('chuva de confete');
  });
  it('proibição do trecho vence o que a IA pedir', async () => {
    const r = await interpretRangeLayered('sem emojis aqui', [], fake(JSON.stringify({ look: { emoji: { mode: 'interval', everySec: 2 } } })));
    expect(r.req.look.emoji).toBeUndefined();
    expect(r.req.forbid).toContain('emojis');
  });
  it('travar é só comando: não pergunta à IA', async () => {
    const log: AiMessages[] = [];
    const r = await interpretRangeLayered('trava esse pedaço', [], fake('{}', log));
    expect(log).toHaveLength(0);
    expect(r.req.lock).toBe(true);
  });
  it('IA com resposta inválida duas vezes: fica com as regras e avisa M4F-1012', async () => {
    const r = await interpretRangeLayered('legenda verde aqui', [], fake('não sei'));
    expect(r.req.look.captions?.text).toBe('#22C55E');
    expect(r.warning?.code).toBe('M4F-1012');
  });
});
