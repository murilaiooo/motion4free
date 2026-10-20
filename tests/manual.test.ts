import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { parseEditPlan } from '../src/core/schema';
import type { EditPlan } from '../src/core/types';
import { autoEdit } from '../src/editorial/auto-edit';
import { captionKey, findElement, listElements, resolvePlan, sceneKeys, sceneText, withSceneText, type ElementRef } from '../src/editorial/elements';
import {
  addElement,
  cutSourceRange,
  deleteElement,
  deleteSegment,
  duplicateElement,
  moveLayer,
  patchCaptionLook,
  patchElementLook,
  resetElement,
  retimeElement,
  segmentZoom,
  setCaptionPlacement,
  setElementPlacement,
  setElementText,
  setFraming,
  setSegmentZoom,
  splitAt,
  trimSegment,
} from '../src/editorial/manual';
import { applyStyle, withSegments, type EditContext } from '../src/editorial/ops';
import { applyRange } from '../src/editorial/ops';
import { interpretRangePrompt } from '../src/editorial/range-interpret';
import { outputDuration } from '../src/engine/timeline';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT, 0.2);
const dur = words.at(-1)!.end + 1;
const ctx: EditContext = { durationSec: dur, words };
const base = autoEdit(dur, [], words);

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
  return 'sem erro';
}
const valid = (p: EditPlan) => {
  const r = parseEditPlan(p);
  return r.ok ? 'ok' : r.errors.join('\n');
};
const firstScene = (p: EditPlan, kind: string) => {
  const i = p.scenes.findIndex((s) => s.kind === kind);
  return { scene: p.scenes[i]!, key: sceneKeys(p)[i]! };
};

describe('elementos: chaves estáveis e resolução', () => {
  it('chave da cena sobrevive a um corte antes dela (tipo + instante no original)', () => {
    const t = firstScene(base, 'big-number');
    const cut = cutSourceRange(base, ctx, { start: words[0]!.start, end: words[2]!.end });
    expect(sceneKeys(cut)).toContain(t.key);
    const moved = setElementPlacement(base, { type: 'scene', key: t.key }, { dx: 0.1, dy: -0.2, scale: 1.5, rotate: 10 });
    const after = cutSourceRange(moved, ctx, { start: words[0]!.start, end: words[2]!.end });
    expect(resolvePlan(after).scenes.find((s) => s.key === t.key)!.edit!.offset).toEqual({ dx: 0.1, dy: -0.2, scale: 1.5, rotate: 10 });
  });

  it('legenda é achada pela primeira palavra', () => {
    const c = base.captions[2]!;
    expect(captionKey(c)).toBe(`w:${c.wordIds[0]}`);
    expect(captionKey({ id: 'c9', wordIds: [] })).toBe('c:c9');
  });

  it('texto editável de cada cena vai e volta', () => {
    const t = { id: 'k', kind: 'kinetic-title' as const, text: 'Velho', start: 1, end: 2 };
    expect(sceneText(withSceneText(t, 'Novo título'))).toBe('Novo título');
    const big = { id: 'b', kind: 'big-number' as const, value: '90%', label: 'desistem', start: 1, end: 3 };
    expect(withSceneText(big, '75%\nficam')).toMatchObject({ value: '75%', label: 'ficam' });
    const list = { id: 'l', kind: 'list' as const, items: [{ text: 'a', at: 1 }], start: 1, end: 4 };
    const l2 = withSceneText(list, 'um\ndois\ntrês');
    expect(l2.kind === 'list' && l2.items.map((i) => i.text)).toEqual(['um', 'dois', 'três']);
    expect(l2.kind === 'list' && l2.items.every((i) => i.at >= 1 && i.at <= 4)).toBe(true);
  });

  it('plano sem edições resolve igual ao gerado', () => {
    const R = resolvePlan(base);
    expect(R.captions.map((c) => c.caption)).toEqual(base.captions);
    expect(R.scenes.map((s) => s.scene)).toEqual(base.scenes);
    expect(R.added).toEqual([]);
    expect(resolvePlan(base)).toBe(R);
  });
});

describe('posição e aparência das legendas', () => {
  const key = captionKey(base.captions[1]!);

  it('"todas" muda a posição de todas e tira as posições próprias; "só esta" muda uma', () => {
    const one = setCaptionPlacement(base, 'one', key, { x: 0.5, y: 0.8, scale: 1, rotate: 0 });
    expect(resolvePlan(one).captions[1]!.placement).toEqual({ x: 0.5, y: 0.8, scale: 1, rotate: 0 });
    expect(resolvePlan(one).captions[0]!.placement).toBeNull();
    const all = setCaptionPlacement(one, 'all', key, { x: 0.5, y: 0.15, scale: 1.2, rotate: 0 });
    expect(resolvePlan(all).captions.every((c) => c.placement?.y === 0.15)).toBe(true);
    expect(all.edits.captions[key]).toBeUndefined();
    expect(valid(all)).toBe('ok');
  });

  it('valores fora do limite são presos dentro (x/y, tamanho, ângulo)', () => {
    const p = setCaptionPlacement(base, 'all', null, { x: 9, y: -9, scale: 99, rotate: 270 });
    expect(p.edits.captionPlacement).toEqual({ x: 1.5, y: -0.5, scale: 4, rotate: -90 });
  });

  it('aparência: geral + própria por cima; null volta ao modelo; mesma aparência = mesmo objeto', () => {
    const g = patchCaptionLook(base, 'all', null, { text: '#00FF00', font: 'Anton' });
    const o = patchCaptionLook(g, 'one', key, { text: '#FF0000' });
    expect(resolvePlan(o).captions[1]!.look).toEqual({ text: '#FF0000', font: 'Anton' });
    expect(resolvePlan(o).captions[0]!.look).toEqual({ text: '#00FF00', font: 'Anton' });
    expect(patchCaptionLook(o, 'all', null, { text: '#00FF00' }).edits.captions[key]).toBeUndefined();
    expect(patchCaptionLook(g, 'all', null, { text: null }).edits.captionLook).toEqual({ font: 'Anton' });
    expect(patchCaptionLook(g, 'all', null, { text: '#00FF00' })).toBe(g);
  });

  it('trocar a fonte tira um peso que não existe nela', () => {
    const p = patchCaptionLook(base, 'all', null, { font: 'Montserrat', weight: 900 });
    expect(patchCaptionLook(p, 'all', null, { font: 'Anton' }).edits.captionLook).toEqual({ font: 'Anton' });
  });

  it('edições manuais sobrevivem a trocar o modelo e a cortar', () => {
    let p = setCaptionPlacement(base, 'all', null, { x: 0.5, y: 0.2, scale: 1, rotate: 0 });
    p = patchCaptionLook(p, 'all', null, { text: '#00FF00' });
    p = applyStyle(p, ctx, 'documental');
    p = cutSourceRange(p, ctx, { start: words[5]!.start, end: words[6]!.end });
    expect(p.edits.captionPlacement?.y).toBe(0.2);
    expect(resolvePlan(p).captions.every((c) => c.look.text === '#00FF00')).toBe(true);
  });
});

describe('cenas geradas: mover, apagar, texto, tempo', () => {
  const t = firstScene(base, 'end-cta');
  const ref: ElementRef = { type: 'scene', key: t.key };

  it('apagar esconde a cena (fica fora do desenho) e "voltar ao modelo" traz de volta', () => {
    const del = deleteElement(base, ref);
    expect(resolvePlan(del).scenes.some((s) => s.key === t.key)).toBe(false);
    expect(findElement(del, ref)).toBeNull();
    expect(resetElement(del, ref)).toMatchObject({ edits: { scenes: {} } });
    expect(code(() => deleteElement(del, ref))).toBe('M4F-510');
  });

  it('texto novo: vazio é M4F-511, longo é M4F-512; igual ao gerado não guarda nada', () => {
    const p = setElementText(base, ref, 'Me siga já');
    expect(resolvePlan(p).scenes.find((s) => s.key === t.key)!.scene).toMatchObject({ text: 'Me siga já' });
    expect(code(() => setElementText(base, ref, '   '))).toBe('M4F-511');
    expect(code(() => setElementText(base, ref, 'x'.repeat(33)))).toBe('M4F-512');
    expect(setElementText(p, ref, sceneText(t.scene)!).edits.scenes[t.key]).toBeUndefined();
  });

  it('deslocamento identidade sai do plano', () => {
    const p = setElementPlacement(base, ref, { dx: 0.1, dy: 0, scale: 1, rotate: 0 });
    expect(p.edits.scenes[t.key]!.offset!.dx).toBe(0.1);
    expect(setElementPlacement(p, ref, { dx: 0, dy: 0, scale: 1, rotate: 0 }).edits.scenes[t.key]).toBeUndefined();
  });

  it('novo tempo fica guardado no original; mínimo 0,2 s', () => {
    const p = retimeElement(base, ref, { start: t.scene.start - 1, end: t.scene.end - 0.5 });
    const s = resolvePlan(p).scenes.find((x) => x.key === t.key)!.scene;
    expect(s.start).toBeCloseTo(t.scene.start - 1, 2);
    expect(s.end).toBeCloseTo(t.scene.end - 0.5, 2);
    expect(code(() => retimeElement(base, ref, { start: 1, end: 1.1 }))).toBe('M4F-517');
  });

  it('duplicar um título gerado cria um texto adicionado com as mesmas palavras', () => {
    const r = duplicateElement(base, ref)!;
    const el = r.plan.edits.added.find((a) => a.id === r.id)!;
    expect(el.kind).toBe('text');
    expect(el.text).toBe(sceneText(t.scene));
    expect(valid(r.plan)).toBe('ok');
  });
});

describe('elementos adicionados', () => {
  it('adiciona texto, emoji e forma; valida e aparece na lista de elementos', () => {
    let p = addElement(base, ctx, { kind: 'text', text: 'Olá mundo' }, 2).plan;
    p = addElement(p, ctx, { kind: 'emoji', emoji: '🚀' }, 3).plan;
    const r = addElement(p, ctx, { kind: 'shape', shape: 'circle' }, 4);
    p = r.plan;
    expect(p.edits.added.map((a) => a.id)).toEqual(['e1', 'e2', 'e3']);
    expect(valid(p)).toBe('ok');
    const list = listElements(p).filter((e) => e.ref.type === 'added');
    expect(list.map((e) => e.label)).toEqual(['Olá mundo', '🚀', 'Círculo']);
    const at = findElement(p, { type: 'added', id: 'e1' })!;
    expect(at.start).toBeCloseTo(2, 2);
    expect(at.end).toBeCloseTo(5, 2);
  });

  it('camadas, duplicar, aparência, apagar', () => {
    let p = addElement(base, ctx, { kind: 'text', text: 'A' }, 1).plan;
    p = addElement(p, ctx, { kind: 'text', text: 'B' }, 1).plan;
    p = moveLayer(p, 'e2', 'down');
    expect(p.edits.added.map((a) => a.text)).toEqual(['B', 'A']);
    expect(moveLayer(p, 'e2', 'bottom')).toBe(p);
    const d = duplicateElement(p, { type: 'added', id: 'e1' })!;
    expect(d.plan.edits.added.map((a) => a.text)).toEqual(['B', 'A', 'A']);
    p = patchElementLook(d.plan, { type: 'added', id: 'e1' }, { box: '#FF0000', enter: 'pop' });
    expect(p.edits.added.find((a) => a.id === 'e1')!.look).toEqual({ box: '#FF0000', enter: 'pop' });
    p = deleteElement(p, { type: 'added', id: d.id });
    expect(p.edits.added).toHaveLength(2);
    expect(code(() => setElementText(p, { type: 'added', id: 'e1' }, ''))).toBe('M4F-511');
  });

  it('limite de 60 elementos (M4F-513)', () => {
    let p = base;
    for (let i = 0; i < 60; i++) p = addElement(p, ctx, { kind: 'emoji' }, 1).plan;
    expect(code(() => addElement(p, ctx, { kind: 'emoji' }, 1))).toBe('M4F-513');
  });

  it('acompanha um corte antes dele (ancorado no original)', () => {
    const p = addElement(base, ctx, { kind: 'text', text: 'X' }, 10).plan;
    const before = findElement(p, { type: 'added', id: 'e1' })!;
    const cut = cutSourceRange(p, ctx, { start: words[0]!.start, end: words[3]!.end });
    const after = findElement(cut, { type: 'added', id: 'e1' })!;
    const removed = outputDuration(p.segments) - outputDuration(cut.segments);
    expect(after.start).toBeCloseTo(before.start - removed, 2);
  });
});

describe('vídeo: dividir, apagar pedaço, aparar, cortar palavras, zoom, enquadramento', () => {
  it('dividir na agulha não muda a duração; apagar um dos pedaços encurta (o resto encosta)', () => {
    const total = outputDuration(base.segments);
    const s = splitAt(base, ctx, 5);
    expect(s.segments).toHaveLength(base.segments.length + 1);
    expect(outputDuration(s.segments)).toBeCloseTo(total, 6);
    expect(s.captions.map((c) => c.text)).toEqual(base.captions.map((c) => c.text));
    const d = deleteSegment(s, ctx, 0);
    expect(outputDuration(d.segments)).toBeCloseTo(total - 5, 2);
    expect(valid(d)).toBe('ok');
    expect(code(() => splitAt(base, ctx, 0.05))).toBe('M4F-515');
    expect(code(() => deleteSegment(autoEdit(dur, [], words), ctx, 0))).toBe('M4F-503');
  });

  it('aparar a ponta de um pedaço, sem passar do vizinho e com mínimo de 0,1 s', () => {
    const s = splitAt(base, ctx, 5);
    const a = s.segments[0]!;
    const t = trimSegment(s, ctx, 1, 'start', a.srcEnd - 1);
    expect(t.segments[1]!.srcStart).toBe(a.srcEnd);
    const t2 = trimSegment(s, ctx, 0, 'end', a.srcEnd - 1);
    expect(t2.segments[0]!.srcEnd).toBeCloseTo(a.srcEnd - 1, 3);
    expect(code(() => trimSegment(s, ctx, 0, 'end', a.srcStart + 0.02))).toBe('M4F-514');
  });

  it('cortar palavras (Descript) encurta exatamente o tempo delas; já cortadas = M4F-516', () => {
    const w = words.slice(8, 11);
    const c = cutSourceRange(base, ctx, { start: w[0]!.start, end: w.at(-1)!.end });
    expect(outputDuration(base.segments) - outputDuration(c.segments)).toBeCloseTo(w.at(-1)!.end - w[0]!.start, 2);
    expect(c.captions.flatMap((x) => x.wordIds)).not.toContain(w[1]!.id);
    expect(code(() => cutSourceRange(c, ctx, { start: w[0]!.start, end: w.at(-1)!.end }))).toBe('M4F-516');
    expect(code(() => cutSourceRange(base, ctx, { start: 0, end: dur }))).toBe('M4F-503');
  });

  it('zoom por pedaço liga, muda e desliga', () => {
    const z = setSegmentZoom(base, 0, 1.2);
    expect(segmentZoom(z, 0)).toBe(1.2);
    expect(segmentZoom(setSegmentZoom(z, 0, null), 0)).toBeNull();
    expect(setSegmentZoom(z, 0, 9).edits.zooms[0]!.scale).toBe(1.6);
  });

  it('enquadramento: caber/preencher, tamanho e posição com limites', () => {
    const f = setFraming(base, { fit: 'fit', scale: 9, x: -3 });
    expect(f.edits.video).toEqual({ fit: 'fit', scale: 3, x: -1, y: 0 });
    expect(setFraming(f, { fit: 'fit' })).toBe(f);
  });
});

describe('travas (ADR-0010): nada muda dentro de um trecho travado (M4F-504)', () => {
  const sel = { start: 0, end: 6 };
  const locked = applyRange(base, ctx, sel, interpretRangePrompt('trava esse pedaço')).plan;
  const inLock = resolvePlan(locked).captions.find((c) => c.caption.start < 5)!;
  const t = firstScene(locked, 'lower-third');

  it('mover, apagar, trocar texto ou estilo só desta legenda dentro da trava é recusado', () => {
    const ref: ElementRef = { type: 'caption', key: inLock.key };
    expect(code(() => setCaptionPlacement(locked, 'one', inLock.key, { x: 0.5, y: 0.2, scale: 1, rotate: 0 }))).toBe('M4F-504');
    expect(code(() => deleteElement(locked, ref))).toBe('M4F-504');
    expect(code(() => setElementText(locked, ref, 'oi'))).toBe('M4F-504');
    expect(code(() => patchCaptionLook(locked, 'one', inLock.key, { text: '#FF0000' }))).toBe('M4F-504');
    expect(code(() => deleteElement(locked, { type: 'scene', key: t.key }))).toBe('M4F-504');
    expect(code(() => addElement(locked, ctx, { kind: 'emoji' }, 1))).toBe('M4F-504');
    expect(code(() => splitAt(locked, ctx, 2))).toBe('M4F-504');
  });

  it('posição geral das legendas não entra no trecho travado (ele guarda a do momento da trava)', () => {
    const moved = setCaptionPlacement(locked, 'all', null, { x: 0.5, y: 0.1, scale: 1, rotate: 0 });
    const R = resolvePlan(moved);
    expect(R.captions.find((c) => c.key === inLock.key)!.placement).toBeNull();
    expect(R.captions.filter((c) => !c.locked).every((c) => c.placement?.y === 0.1)).toBe(true);
  });

  it('withSegments sem mudança no trecho travado continua funcionando', () => {
    expect(() => withSegments(locked, ctx, locked.segments)).not.toThrow();
  });
});
