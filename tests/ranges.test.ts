import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/core/presets';
import { parseEditPlan } from '../src/core/schema';
import type { EditPlan, TimeRange } from '../src/core/types';
import { autoEdit } from '../src/editorial/auto-edit';
import { interpretPrompt } from '../src/editorial/interpret';
import { applyBrief, applyRange, applyReferencePalette, applyStyle, editCaptionText, listCuts, rebuildAll, restoreCut, withSegments, type EditContext } from '../src/editorial/ops';
import { interpretRangePrompt } from '../src/editorial/range-interpret';
import { newRange, styleAt } from '../src/editorial/ranges';
import { outputDuration, sourceToOutput } from '../src/engine/timeline';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT);
const durationSec = words.at(-1)!.end + 0.5;
const ctx: EditContext = { durationSec, words };
// com dois cortes, para a sincronia passar por emendas
const base = withSegments(autoEdit(durationSec, [], words), ctx, [
  { srcStart: 0, srcEnd: 9.9 },
  { srcStart: 10.5, srcEnd: 24.3 },
  { srcStart: 24.9, srcEnd: durationSec },
]);
const byWord = new Map(words.map((w) => [w.id, w]));

const ask = (p: EditPlan, target: Parameters<typeof applyRange>[2], text: string) => applyRange(p, ctx, target, interpretRangePrompt(text));
const isInside = (s: { kind: string; start: number; end: number }, out: TimeRange) => s.kind !== 'progress-bar' && s.start >= out.start - 1e-6 && s.end <= out.end + 1e-6;
const outsideScenes = (p: EditPlan, out: TimeRange) => p.scenes.filter((s) => !isInside(s, out)).sort((a, b) => a.id.localeCompare(b.id));

/** Cada legenda continua começando quando a sua primeira palavra é falada (voz e legenda juntas). */
function expectInSync(p: EditPlan) {
  for (const c of p.captions) {
    const first = byWord.get(c.wordIds[0]!)!;
    expect(c.start).toBeCloseTo(sourceToOutput(p.segments, first.start)!, 9);
  }
}

/** Garantia da revisão focal: fora do trecho, nada muda. */
function expectOnlyInside(before: EditPlan, after: EditPlan, out: TimeRange) {
  expect(after.segments).toEqual(before.segments);
  expect(after.captions).toEqual(before.captions);
  expect(after.style).toEqual(before.style);
  expect(after.brief).toEqual(before.brief);
  expect(outsideScenes(after, out)).toEqual(outsideScenes(before, out));
  for (const s of after.scenes) if (!before.scenes.some((b) => b.id === s.id)) expect(isInside(s, out), `${s.id} ${s.kind} ${s.start}-${s.end}`).toBe(true);
  expect(parseEditPlan(after).ok).toBe(true);
  expectInSync(after);
}

const REQUESTS = ['mais calmo aqui', 'sem animação aqui', 'troca essa animação', 'destaque isso', 'sem zoom aqui, destaque os números', 'bem animado e rápido aqui'];

describe('gate da Fase 5: mudar o trecho de 12 s a 18 s não altera nada fora dele', () => {
  for (const preset of PRESETS) {
    for (const text of REQUESTS) {
      it(`${preset.id}: "${text}"`, () => {
        const start = applyStyle(base, ctx, preset.id);
        let next: EditPlan;
        try {
          next = ask(start, { start: 12, end: 18 }, text).plan;
        } catch (err) {
          // troca sem alternativa é recusada com código e não muda nada
          expect(String(err)).toContain('M4F-1011');
          return;
        }
        const r = next.ranges[0]!;
        expect(r.out.start).toBeCloseTo(12, 9);
        expect(r.out.end).toBeCloseTo(18, 9);
        expectOnlyInside(start, next, r.out);
      });
    }
  }

  it('"sem animação aqui" esvazia o trecho; "mais calmo aqui" deixa o trecho com menos movimento', () => {
    const quiet = ask(base, { start: 12, end: 18 }, 'sem animação aqui').plan;
    expect(quiet.scenes.filter((s) => isInside(s, quiet.ranges[0]!.out))).toEqual([]);
    const calm = ask(base, { start: 12, end: 18 }, 'mais calmo aqui').plan;
    const r = calm.ranges[0]!;
    expect(r.style!.motion.intensity).toBeLessThan(base.style.motion.intensity);
    expect(styleAt(calm, 15)).toBe(r.style);
    expect(styleAt(calm, 5)).toBe(calm.style);
  });

  it('"troca essa animação" muda as cenas do trecho a cada pedido', () => {
    const once = ask(base, { start: 12, end: 18 }, 'troca essa animação').plan;
    const id = once.ranges[0]!.id;
    const twice = ask(once, { id }, 'troca essa animação').plan;
    const out = once.ranges[0]!.out;
    const inside = (p: EditPlan) => JSON.stringify(p.scenes.filter((s) => isInside(s, out)).map(({ id: _i, ...x }) => x));
    expect(inside(once)).not.toBe(inside(base));
    expect(inside(twice)).not.toBe(inside(once));
    expectOnlyInside(once, twice, twice.ranges[0]!.out);
  });

  it('"destaque isso" põe palavra-chave e zoom com a fala do trecho', () => {
    const p = ask(base, { start: 12, end: 18 }, 'destaque isso').plan;
    const inside = p.scenes.filter((s) => isInside(s, p.ranges[0]!.out));
    expect(inside.some((s) => s.kind === 'highlight-word')).toBe(true);
    expect(inside.some((s) => s.kind === 'emphasis-zoom')).toBe(true);
  });
});

/** Gerador determinístico (mulberry32) para os testes de propriedade. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('propriedade: qualquer trecho, qualquer pedido, nada muda fora', () => {
  const total = outputDuration(base.segments);
  const rand = rng(20261020);
  for (let i = 0; i < 40; i++) {
    const a = Math.round(rand() * (total - 1) * 100) / 100;
    const b = Math.min(total, Math.round((a + 0.5 + rand() * 8) * 100) / 100);
    const text = REQUESTS[i % REQUESTS.length]!;
    const preset = PRESETS[i % PRESETS.length]!;
    it(`#${i} ${preset.id} ${a}–${b} s: "${text}"`, () => {
      const start = applyStyle(base, ctx, preset.id);
      let res;
      try {
        res = ask(start, { start: a, end: b }, text);
      } catch (err) {
        expect(String(err)).toMatch(/M4F-1011/);
        return;
      }
      expectOnlyInside(start, res.plan, res.plan.ranges[0]!.out);
      // um segundo pedido em outro trecho também não mexe no primeiro
      const other = a > total / 2 ? { start: 0, end: Math.min(a, 3) } : { start: Math.min(total - 0.6, b + 0.5), end: total };
      if (other.end - other.start < 0.5) return;
      const res2 = ask(res.plan, other, 'sem animação aqui');
      expectOnlyInside(res.plan, res2.plan, res2.plan.ranges.find((r) => r.id !== res.rangeId)!.out);
    });
  }
});

describe('trava', () => {
  const sel = { start: 12, end: 18 };
  const locked = ask(ask(base, sel, 'destaque isso').plan, { id: 'r1' }, 'trava esse pedaço').plan;
  const r = locked.ranges[0]!;
  const touching = (p: EditPlan, out: TimeRange) => ({
    scenes: p.scenes.filter((s) => s.kind !== 'progress-bar' && s.start < out.end && s.end > out.start).sort((x, y) => x.id.localeCompare(y.id)),
    captions: p.captions.filter((c) => c.start < out.end && c.end > out.start),
  });
  const snapshot = touching(locked, r.out);

  it('travar não muda nada na tela', () => {
    expect(r.locked).not.toBeNull();
    expect(locked.scenes).toEqual(ask(base, sel, 'destaque isso').plan.scenes);
    expect(parseEditPlan(locked).ok).toBe(true);
  });

  for (const preset of PRESETS.filter((p) => p.id !== base.style.id)) {
    it(`trocar para ${preset.id} não muda o trecho travado (cenas, legendas e estilo)`, () => {
      const next = applyStyle(locked, ctx, preset.id);
      expect(next.style.id).toBe(preset.id);
      expect(touching(next, next.ranges[0]!.out)).toEqual(snapshot);
      expect(next.ranges[0]!.style).toEqual(r.style);
      expect(styleAt(next, 15)).toEqual(r.style);
      expect(parseEditPlan(next).ok).toBe(true);
      // legendas fora da trava seguem a fala, sem palavra repetida nem faltando
      expect(next.captions.flatMap((c) => c.wordIds)).toEqual(locked.captions.flatMap((c) => c.wordIds));
    });
  }

  it('pedido geral e cores de imagem não mudam o trecho travado', () => {
    const next = applyBrief(locked, ctx, interpretPrompt('bem animado, sem números, estilo editorial').brief);
    expect(touching(next, next.ranges[0]!.out)).toEqual(snapshot);
    const colored = applyReferencePalette(next, ctx, { colors: ['#C81E28', '#1428C8'] });
    expect(colored.style.palette.accent).not.toBe(next.style.palette.accent);
    expect(touching(colored, colored.ranges[0]!.out)).toEqual(snapshot);
    expect(colored.ranges[0]!.style).toEqual(r.style);
  });

  it('corte antes do trecho só desloca a trava; corte dentro é recusado com M4F-504', () => {
    const cuts = listCuts(locked.segments, durationSec);
    expect(cuts[0]!.end).toBeLessThan(r.srcStart);
    const moved = restoreCut(locked, ctx, 0);
    const out = moved.ranges[0]!.out;
    const d = out.start - r.out.start;
    expect(d).toBeGreaterThan(0.5);
    const shifted = touching(moved, out);
    expect(shifted.captions.map((c) => [c.id, c.text, c.wordIds])).toEqual(snapshot.captions.map((c) => [c.id, c.text, c.wordIds]));
    shifted.captions.forEach((c, i) => expect(c.start).toBeCloseTo(snapshot.captions[i]!.start + d, 6));
    expect(shifted.scenes.map((s) => [s.id, s.kind])).toEqual(snapshot.scenes.map((s) => [s.id, s.kind]));
    shifted.scenes.forEach((s, i) => expect(s.start).toBeCloseTo(snapshot.scenes[i]!.start + d, 2));
    expectInSync(moved);

    const inside = [...locked.segments];
    inside.splice(1, 1, { srcStart: 10.5, srcEnd: 14 }, { srcStart: 14.5, srcEnd: 24.3 });
    expect(() => withSegments(locked, ctx, inside)).toThrow(/M4F-504/);
  });

  it('legenda e pedido dentro da trava são recusados; destravar volta a seguir o vídeo', () => {
    const cap = snapshot.captions[0]!;
    expect(() => editCaptionText(locked, cap.id, 'outro texto')).toThrow(/M4F-504/);
    expect(() => ask(locked, { id: 'r1' }, 'mais calmo aqui')).toThrow(/M4F-504/);
    const restyled = applyStyle(locked, ctx, 'documental');
    const unlocked = ask(restyled, { id: 'r1' }, 'destrava').plan;
    expect(unlocked.ranges[0]!.locked).toBeNull();
    expect(unlocked.ranges[0]!.style).toBeNull();
    // o destaque pedido continua, agora no estilo novo
    expect(unlocked.captions).toEqual(rebuildAll({ ...unlocked }, ctx).captions);
    expect(parseEditPlan(unlocked).ok).toBe(true);
    expectInSync(unlocked);
  });
});

describe('trechos sem trava seguem as mudanças gerais', () => {
  it('"sem zoom aqui" continua valendo depois de trocar o estilo', () => {
    const p = ask(base, { start: 5, end: 20 }, 'sem zoom aqui').plan;
    for (const preset of PRESETS) {
      const next = applyStyle(p, ctx, preset.id);
      const out = next.ranges[0]!.out;
      expect(next.scenes.filter((s) => isInside(s, out) && s.kind === 'emphasis-zoom')).toEqual([]);
      expect(next.ranges[0]!.style!.id).toBe(preset.id);
    }
  });

  it('"volta ao normal" tira o trecho e devolve o vídeo como era', () => {
    const start = rebuildAll(base, ctx);
    const p = ask(start, { start: 12, end: 18 }, 'sem animação aqui').plan;
    const back = ask(p, { id: 'r1' }, 'volta ao normal').plan;
    expect(back.ranges).toEqual([]);
    expect(back).toEqual(start);
  });
});

describe('seleção de trecho', () => {
  it('curto demais = M4F-505; encostando em outro = M4F-506', () => {
    expect(() => newRange(base, { start: 3, end: 3.2 })).toThrow(/M4F-505/);
    const p = ask(base, { start: 12, end: 18 }, 'mais calmo aqui').plan;
    expect(() => newRange(p, { start: 17, end: 20 })).toThrow(/M4F-506/);
    expect(newRange(p, { start: 18, end: 20 }).id).toBe('r2');
  });

  it('pedido não entendido não chega ao motor (o painel mostra M4F-1010)', () => {
    expect(interpretRangePrompt('banana aqui').understood).toBe(false);
  });
});
