import { EMPTY_BRIEF } from '../src/core/brief';
import { describe, expect, it } from 'vitest';
import { DOCUMENTAL, EDITORIAL, POP, PRESETS } from '../src/core/presets';
import { parseEditPlan } from '../src/core/schema';
import type { SceneInstance, Segment } from '../src/core/types';
import { buildCaptions, captionOptionsFor } from '../src/editorial/captions';
import { OVERLAY_KINDS, proposeScenes, sceneKey } from '../src/editorial/selector';
import { outputDuration } from '../src/engine/timeline';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT);
const end = words.at(-1)!.end + 0.5;
const all: Segment[] = [{ srcStart: 0, srcEnd: end }];
const of = <K extends SceneInstance['kind']>(scenes: SceneInstance[], kind: K) => scenes.filter((s): s is Extract<SceneInstance, { kind: K }> => s.kind === kind);
const overlays = (scenes: SceneInstance[]) => scenes.filter((s) => OVERLAY_KINDS.has(s.kind));

describe('proposeScenes', () => {
  const pop = proposeScenes(words, all, POP);

  it('número falado vira número grande com rótulo, na hora em que é dito', () => {
    const nums = of(pop, 'big-number');
    expect(nums.map((n) => n.value)).toContain('90%');
    const ninety = nums.find((n) => n.value === '90%')!;
    const spoken = words.find((w) => w.text === 'Noventa')!;
    expect(ninety.label).toBe('desistem antes de três meses');
    expect(Math.abs(ninety.start - spoken.start)).toBeLessThan(0.3);
  });

  it('enumeração "primeiro, segundo, terceiro" vira uma lista com 3 itens que aparecem quando ditos', () => {
    const lists = of(pop, 'list');
    expect(lists).toHaveLength(1);
    expect(lists[0]!.items.map((i) => i.text)).toEqual(['Comece pequeno', 'Durma bem', 'Acompanhe o seu progresso']);
    const second = words.find((w) => w.text === 'Segundo,')!;
    expect(lists[0]!.items[1]!.at).toBeCloseTo(second.start, 1);
  });

  it('pergunta vira citação', () => {
    const qw = wordsFrom('Você já se perguntou por que isso acontece? Isso acontece com todo mundo. A resposta é simples.');
    const segs = [{ srcStart: 0, srcEnd: qw.at(-1)!.end + 0.2 }];
    for (const style of PRESETS) {
      expect(of(proposeScenes(qw, segs, style), 'quote').map((s) => s.text), style.id).toEqual(['Você já se perguntou por que isso acontece?']);
    }
  });

  it('apresentação vira lower third com o nome', () => {
    const lt = of(pop, 'lower-third');
    expect(lt.map((s) => s.title)).toEqual(['Ana Souza']);
  });

  it('palavras-chave destacadas e zoom de ênfase em frase com exclamação', () => {
    const hw = of(pop, 'highlight-word').map((s) => s.text.toLowerCase());
    expect(hw).toContain('segredo');
    expect(of(pop, 'emphasis-zoom').length).toBeGreaterThan(0);
  });

  it('chamada final nos últimos segundos e barra de progresso no vídeo todo', () => {
    const total = outputDuration(all);
    const cta = of(pop, 'end-cta');
    expect(cta).toHaveLength(1);
    expect(cta[0]!.end).toBeCloseTo(total, 5);
    expect(cta[0]!.text).toBe(POP.cta);
    const bar = of(pop, 'progress-bar');
    expect(bar).toHaveLength(1);
    expect(bar[0]!.start).toBe(0);
    expect(bar[0]!.end).toBeCloseTo(total, 2);
    expect(of(proposeScenes(words, all, DOCUMENTAL), 'progress-bar')).toHaveLength(0);
  });

  it('nunca há duas cenas de sobreposição ao mesmo tempo e o intervalo mínimo é respeitado', () => {
    for (const style of PRESETS) {
      const ov = overlays(proposeScenes(words, all, style)).sort((a, b) => a.start - b.start);
      for (let i = 1; i < ov.length; i++) expect(ov[i]!.start - ov[i - 1]!.end, style.id).toBeGreaterThanOrEqual(style.rhythm.minGapSec - 1e-6);
    }
  });

  it('densidade: Pop propõe mais cenas que Editorial, que propõe mais que Documental', () => {
    const count = (s: typeof POP) => overlays(proposeScenes(words, all, s)).length + of(proposeScenes(words, all, s), 'highlight-word').length;
    expect(count(POP)).toBeGreaterThan(count(EDITORIAL));
    expect(count(EDITORIAL)).toBeGreaterThan(count(DOCUMENTAL));
  });

  it('limite de densidade mesmo com um número em cada frase', () => {
    const many = wordsFrom(Array.from({ length: 30 }, (_, i) => `Tenho ${i + 2} gatos.`).join(' '));
    const segs = [{ srcStart: 0, srcEnd: many.at(-1)!.end + 0.2 }];
    const total = outputDuration(segs);
    for (const style of PRESETS) {
      const ov = overlays(proposeScenes(many, segs, style)).filter((s) => s.kind !== 'kinetic-title' && s.kind !== 'end-cta');
      expect(ov.length, style.id).toBeLessThanOrEqual(Math.ceil((total / 10) * style.rhythm.overlaysPer10s));
    }
  });

  it('anti-repetição: a mesma cena com os mesmos parâmetros nunca aparece duas vezes seguidas', () => {
    const rep = wordsFrom('Três dicas. Três dicas. Três dicas. Isso é importante! Isso é importante! Isso é importante! Três dicas. '.repeat(4));
    const segs = [{ srcStart: 0, srcEnd: rep.at(-1)!.end + 0.2 }];
    for (const style of PRESETS) {
      const scenes = proposeScenes(rep, segs, style);
      const byKind = new Map<string, SceneInstance[]>();
      for (const s of scenes) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]);
      for (const [kind, list] of byKind) {
        if (kind === 'cut-transition') continue;
        for (let i = 1; i < list.length; i++) expect(sceneKey(list[i]!), `${style.id} ${kind}`).not.toBe(sceneKey(list[i - 1]!));
      }
      const ov = overlays(scenes).sort((a, b) => a.start - b.start);
      for (let i = 1; i < ov.length; i++) expect(sceneKey(ov[i]!)).not.toBe(sceneKey(ov[i - 1]!));
    }
  });

  it('transição em cada emenda de corte, conforme o estilo', () => {
    const segs = [
      { srcStart: 0, srcEnd: 10 },
      { srcStart: 12, srcEnd: 20 },
      { srcStart: 22, srcEnd: end },
    ];
    const tr = of(proposeScenes(words, segs, POP), 'cut-transition');
    expect(tr.map((s) => s.at)).toEqual([10, 18]);
    for (const s of tr) expect(s.start <= s.at && s.at <= s.end).toBe(true);
  });

  it('palavras cortadas não geram cenas', () => {
    const noventa = words.find((w) => w.text === 'Noventa')!;
    const segs = [
      { srcStart: 0, srcEnd: noventa.start - 0.01 },
      { srcStart: noventa.end + 0.01, srcEnd: end },
    ];
    expect(of(proposeScenes(words, segs, POP), 'big-number').map((n) => n.value)).not.toContain('90%');
  });

  it('sem palavras: só estrutura (progresso), sem inventar texto', () => {
    const scenes = proposeScenes([], [{ srcStart: 0, srcEnd: 6 }], POP);
    expect(scenes.every((s) => s.kind === 'progress-bar')).toBe(true);
  });

  it('o plano resultante passa na validação, em todos os estilos', () => {
    for (const style of PRESETS) {
      const plan = { version: 3 as const, output: { width: 1080, height: 1920, fps: 30 }, style, brief: EMPTY_BRIEF, segments: all, captions: buildCaptions(words, all, captionOptionsFor(style)), scenes: proposeScenes(words, all, style) };
      const r = parseEditPlan(plan);
      expect(r.ok ? 'ok' : r.errors.join('\n'), style.id).toBe('ok');
    }
  });
});
