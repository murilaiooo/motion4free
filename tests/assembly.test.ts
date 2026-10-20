import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { parseEditPlan } from '../src/core/schema';
import type { Word } from '../src/core/types';
import { clipJoins, clipLayout, splitAtClips } from '../src/engine/clips';
import { outputDuration, sourceToOutput } from '../src/engine/timeline';
import { addClip, assemble, assemblyTooLong, autoOrder, contextFor, keptByClip, moveClip, reassemble, removeClip, reorderClips, setFraming, setOutputFormat, type ClipData } from '../src/editorial/assembly';
import { adjustCut, applyRange, applyStyle, listCuts, restoreCut } from '../src/editorial/ops';
import { interpretRangePrompt } from '../src/editorial/range-interpret';

function say(prefix: string, text: string, from: number, step = 0.32): Word[] {
  return text.split(' ').map((t, i) => ({ id: `${prefix}w${i + 1}`, text: t, start: +(from + i * step).toFixed(3), end: +(from + i * step + 0.27).toFixed(3) }));
}

/** Clipe com fala de `from` até o fim da frase e silêncio no resto. */
function clip(id: string, text: string, duration: number, from = 0.6): ClipData {
  const words = say(id, text, from);
  const end = words.at(-1)!.end;
  return { id, name: `${id}.mp4`, duration, words, silences: [{ start: 0, end: from - 0.05 }, { start: end + 0.05, end: duration }] };
}

const c1 = clip('c1', 'Três dicas para gravar melhor com o celular.', 5);
const c2 = clip('c2', 'Primeira dica: luz de janela na frente do rosto.', 6);
const c3 = clip('c3', 'Segunda dica: use um microfone de lapela barato.', 5.5);
const lib = { c1, c2, c3 };

describe('montagem automática', () => {
  it('três clipes viram um vídeo: silêncios fora, cada trecho num clipe só, transição em cada troca', () => {
    const { plan, retakes } = assemble([c1, c2, c3]);
    expect(parseEditPlan(plan).ok).toBe(true);
    expect(retakes).toEqual([]);
    expect(plan.clips.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(splitAtClips(plan.segments, plan.clips)).toEqual(plan.segments);
    // nenhuma palavra perdida
    const ctx = contextFor(plan.clips, lib);
    for (const w of ctx.words) expect(sourceToOutput(plan.segments, w.start), w.text).not.toBeNull();
    // bem mais curto que a soma (silêncios de começo e fim de cada clipe saíram)
    const total = outputDuration(plan.segments);
    expect(total).toBeLessThan(16.5 - 4);
    const joins = clipJoins(plan.segments, plan.clips);
    expect(joins).toHaveLength(2);
    for (const j of joins) expect(plan.scenes.some((s) => s.kind === 'cut-transition' && Math.abs(s.at - j) < 1e-3), `transição em ${j}`).toBe(true);
    // gancho escolhido pela melhor frase (texto falado)
    expect(plan.brief.hook).not.toBeNull();
    expect(ctx.words.map((w) => w.text).join(' ')).toContain(plan.brief.hook!.text);
    // legendas na ordem dos clipes
    expect(plan.captions[0]!.text.startsWith('Três')).toBe(true);
    expect(plan.captions.at(-1)!.text.endsWith('barato.')).toBe(true);
  });

  it('tentativa repetida entre clipes: a primeira sai, o vídeo fica mais curto e as palavras dela não aparecem', () => {
    const take1 = clip('c1', 'Oi gente hoje vou mostrar três dicas.', 4);
    const take2 = clip('c2', 'Oi gente hoje eu vou mostrar três dicas rápidas.', 4.5);
    const { plan, retakes } = assemble([take1, take2, c3]);
    expect(retakes).toHaveLength(1);
    expect(retakes[0]!.clipId).toBe('c1');
    const ctx = contextFor(plan.clips, { c1: take1, c2: take2, c3 });
    const shown = plan.captions.map((c) => c.text).join(' ');
    expect(shown.startsWith('Oi gente hoje eu vou')).toBe(true);
    expect(ctx.words.filter((w) => w.id.startsWith('c1')).every((w) => sourceToOutput(plan.segments, w.start) === null)).toBe(true);
    expect(keptByClip(plan).c1).toBeLessThan(0.4);
    expect(assemble([take1, take2, c3], { retakes: false }).retakes).toEqual([]);
  });

  it('determinística', () => {
    expect(assemble([c1, c2, c3])).toEqual(assemble([c1, c2, c3]));
  });

  it('um clipe só: igual à edição de um vídeo (sem gancho automático)', () => {
    const { plan } = assemble([c1]);
    expect(plan.clips).toHaveLength(1);
    expect(plan.brief.hook).toBeNull();
  });

  it('ordem automática: data do arquivo, depois nome em ordem natural', () => {
    expect(autoOrder([
      { name: 'clipe 10.mp4', lastModified: 5 },
      { name: 'clipe 2.mp4', lastModified: 5 },
      { name: 'abertura.mp4', lastModified: 1 },
    ])).toEqual([2, 1, 0]);
  });
});

describe('reordenar, tirar e devolver clipes', () => {
  const base = assemble([c1, c2, c3]).plan;

  it('reordenar mantém o que ficou de cada clipe e refaz legendas na ordem nova', () => {
    const next = reorderClips(base, lib, ['c3', 'c1', 'c2']);
    expect(next.clips.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
    expect(outputDuration(next.segments)).toBeCloseTo(outputDuration(base.segments), 6);
    expect(keptByClip(next)).toEqual(keptByClip(base));
    expect(next.captions[0]!.text.startsWith('Segunda')).toBe(true);
    expect(parseEditPlan(next).ok).toBe(true);
    // mesma ordem = mesmo objeto (não cria passo no desfazer)
    expect(reorderClips(base, lib, ['c1', 'c2', 'c3'])).toBe(base);
    expect(moveClip(base, lib, 'c1', -1)).toBe(base);
    expect(moveClip(base, lib, 'c1', 1).clips.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
  });

  it('corte feito à mão num clipe acompanha o clipe quando ele muda de lugar', () => {
    const ctx = contextFor(base.clips, lib);
    const l = clipLayout(base.clips)[1]!;
    const cutsBefore = listCuts(base.segments, ctx.durationSec).length;
    // corta 0,5 s no meio da fala do c2
    const words = ctx.words.filter((w) => w.start >= l.start && w.start < l.end);
    const cutAt = words[3]!;
    const edited = restoreCut(base, ctx, 0); // um passo qualquer no histórico
    const withCut = adjustCut(edited, ctx, 0, { start: 0, end: 0.3 });
    expect(listCuts(withCut.segments, ctx.durationSec).length).toBeGreaterThanOrEqual(cutsBefore - 1);
    const moved = reorderClips(withCut, lib, ['c2', 'c3', 'c1']);
    expect(keptByClip(moved)).toEqual(keptByClip(withCut));
    expect(cutAt.text).toBeTruthy();
  });

  it('tirar um clipe: some do vídeo; devolver: volta no fim com os silêncios cortados; o último não sai (M4F-507)', () => {
    const without = removeClip(base, lib, 'c2');
    expect(without.clips.map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(without.captions.map((c) => c.text).join(' ')).not.toContain('Primeira');
    const back = addClip(without, lib, 'c2');
    expect(back.clips.map((c) => c.id)).toEqual(['c1', 'c3', 'c2']);
    expect(back.captions.map((c) => c.text).join(' ')).toContain('Primeira');
    expect(keptByClip(back).c2).toBeCloseTo(keptByClip(base).c2!, 1);
    const one = removeClip(removeClip(base, lib, 'c1'), lib, 'c2');
    expect(() => removeClip(one, lib, 'c3')).toThrow(AppError);
    try {
      removeClip(one, lib, 'c3');
    } catch (e) {
      expect((e as AppError).code).toBe('M4F-507');
    }
  });

  it('trecho ajustado dentro de um clipe acompanha o clipe; trava continua igual', () => {
    const ctx = contextFor(base.clips, lib);
    const l = clipLayout(base.clips)[1]!;
    const out = { start: sourceToOutput(base.segments, l.start + 1)!, end: sourceToOutput(base.segments, l.start + 2.5)! };
    const r = applyRange(base, ctx, out, interpretRangePrompt('trava esse pedaço'));
    const locked = r.plan.ranges[0]!;
    expect(locked.locked).not.toBeNull();
    const moved = reorderClips(r.plan, lib, ['c2', 'c1', 'c3']);
    const m = moved.ranges[0]!;
    expect(m.srcEnd - m.srcStart).toBeCloseTo(locked.srcEnd - locked.srcStart, 6);
    expect(m.out.end - m.out.start).toBeCloseTo(locked.out.end - locked.out.start, 6);
    expect(m.locked!.captions.map((c) => c.text)).toEqual(locked.locked!.captions.map((c) => c.text));
  });

  it('trocar o modelo continua valendo com vários clipes (transições nas trocas)', () => {
    const ctx = contextFor(base.clips, lib);
    const pop = applyStyle(base, ctx, 'documental');
    for (const j of clipJoins(pop.segments, pop.clips)) expect(pop.scenes.some((s) => s.kind === 'cut-transition' && Math.abs(s.at - j) < 1e-3)).toBe(true);
  });

  it('montar de novo volta ao automático na ordem atual', () => {
    const moved = reorderClips(base, lib, ['c2', 'c1', 'c3']);
    const again = reassemble(moved, lib).plan;
    expect(again.clips.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
    expect(keptByClip(again)).toEqual(keptByClip(moved));
  });
});

describe('formato e enquadramento', () => {
  const base = assemble([c1, c2]).plan;
  it('trocar o formato muda só o tamanho de saída', () => {
    const h = setOutputFormat(base, 'horizontal');
    expect(h.output).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(h.captions).toBe(base.captions);
    expect(setOutputFormat(h, 'horizontal')).toBe(h);
  });
  it('enquadramento do vídeo e por clipe', () => {
    const f = setFraming(base, null, { mode: 'fit', fill: 'color', zoom: 1, x: 0, y: 0 });
    expect(f.framing.mode).toBe('fit');
    const c = setFraming(f, 'c2', { mode: 'fill', fill: 'blur', zoom: 1.5, x: 0.2, y: 0 });
    expect(c.clips[1]!.framing!.zoom).toBe(1.5);
    expect(setFraming(c, 'c2', c.clips[1]!.framing)).toBe(c);
    expect(setFraming(c, 'c2', null).clips[1]!.framing).toBeNull();
    expect(parseEditPlan(c).ok).toBe(true);
  });
  it('aviso de vídeo montado longo (mais de 3 min)', () => {
    expect(assemblyTooLong(base)).toBe(false);
    expect(assemblyTooLong({ ...base, segments: [{ srcStart: 0, srcEnd: 181 }] })).toBe(true);
  });
});
