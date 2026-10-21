import type { AddedElement, CaptionEdit, Placement, SceneEdit, TextLook } from '../core/edits';
import { isEmoji } from '../core/emoji';
import type { Caption, EditPlan, ListItem, SceneInstance, SceneKind, TimeRange } from '../core/types';
import { outputDuration, outputToSource, outputToSourceEnd, sourceEndToOutputClamped, sourceToOutputClamped } from '../engine/timeline';

/**
 * Elementos do vídeo como a pessoa os vê no editor (v0.13, ADR-0018): legendas, cenas geradas
 * (título, número, lista, citação, nome, chamada, emoji, barra de progresso) e elementos adicionados
 * (texto, emoji, forma). Camada pura: junta o plano gerado com as edições manuais.
 */

export type ElementRef = { type: 'caption'; key: string } | { type: 'scene'; key: string } | { type: 'added'; id: string };

export const refId = (r: ElementRef): string => (r.type === 'added' ? `added:${r.id}` : `${r.type}:${r.key}`);
export const sameRef = (a: ElementRef | null, b: ElementRef | null): boolean => !!a && !!b && refId(a) === refId(b);

/** Cenas que aparecem na tela e podem ser escolhidas, movidas e apagadas. */
export const VISIBLE_SCENES: ReadonlySet<SceneKind> = new Set(['kinetic-title', 'big-number', 'list', 'quote', 'lower-third', 'end-cta', 'emoji', 'progress-bar']);
/** Cenas com texto que dá para trocar. */
export const TEXT_SCENES: ReadonlySet<SceneKind> = new Set(['kinetic-title', 'big-number', 'list', 'quote', 'lower-third', 'end-cta']);

/** Nome do elemento para a tela. */
export function elementName(plan: EditPlan, ref: ElementRef): string {
  if (ref.type === 'caption') return 'Legenda';
  if (ref.type === 'added') {
    const el = plan.edits.added.find((a) => a.id === ref.id);
    if (!el) return 'Elemento';
    return el.kind === 'emoji' ? 'Emoji' : el.kind === 'shape' ? ({ arrow: 'Seta', circle: 'Círculo', box: 'Retângulo' } as const)[el.shape ?? 'box'] : el.preset === 'title' ? 'Título' : 'Texto';
  }
  const kind = ref.key.split('@')[0] as SceneKind;
  return SCENE_LABELS[kind] ?? 'Animação';
}

export const SCENE_LABELS: Partial<Record<SceneKind, string>> = {
  'kinetic-title': 'Título',
  'big-number': 'Número grande',
  list: 'Lista',
  quote: 'Frase em destaque',
  'lower-third': 'Nome na tela',
  'end-cta': 'Chamada final',
  emoji: 'Emoji',
  'progress-bar': 'Barra de progresso',
};

/** Chave estável de uma legenda: a primeira palavra dela (ou o id, sem palavras). */
export function captionKey(c: Pick<Caption, 'id' | 'wordIds'>): string {
  return c.wordIds[0] ? `w:${c.wordIds[0]}` : `c:${c.id}`;
}

/** Chaves estáveis das cenas: tipo + instante no vídeo original (sobrevive a cortes antes dela). */
export function sceneKeys(plan: Pick<EditPlan, 'scenes' | 'segments'>): string[] {
  const seen = new Map<string, number>();
  return plan.scenes.map((s) => {
    if (s.kind === 'progress-bar') return 'progress-bar';
    const src = outputToSource(plan.segments, s.start) ?? s.start;
    const base = `${s.kind}@${src.toFixed(1)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

/** Texto editável de uma cena (lista e número/nome usam uma linha por campo). */
export function sceneText(s: SceneInstance): string | null {
  switch (s.kind) {
    case 'kinetic-title':
    case 'quote':
    case 'end-cta':
    case 'highlight-word':
      return s.text;
    case 'big-number':
      return s.label ? `${s.value}\n${s.label}` : s.value;
    case 'lower-third':
      return s.subtitle ? `${s.title}\n${s.subtitle}` : s.title;
    case 'list':
      return s.items.map((i) => i.text).join('\n');
    case 'emoji':
      return s.emoji;
    default:
      return null;
  }
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** Limites de texto por tipo de cena (os mesmos do esquema do plano). */
export const SCENE_TEXT_MAX: Partial<Record<SceneKind, number[]>> = {
  'kinetic-title': [60],
  quote: [80],
  'end-cta': [32],
  'big-number': [12, 30],
  'lower-third': [32, 40],
  list: [40, 40, 40, 40, 40],
};

/** Cena com o texto trocado. Texto que não cabe é cortado (a validação com aviso fica na operação). */
export function withSceneText(s: SceneInstance, text: string): SceneInstance {
  const ls = lines(text);
  if (ls.length === 0) return s;
  const max = SCENE_TEXT_MAX[s.kind] ?? [120];
  const cut = (x: string, i: number) => x.slice(0, max[Math.min(i, max.length - 1)]!);
  switch (s.kind) {
    case 'kinetic-title':
    case 'quote':
    case 'end-cta':
      return { ...s, text: cut(ls.join(' '), 0) };
    case 'big-number':
      return { ...s, value: cut(ls[0]!, 0), label: ls[1] ? cut(ls.slice(1).join(' '), 1) : '' };
    case 'lower-third':
      return { ...s, title: cut(ls[0]!, 0), subtitle: ls[1] ? cut(ls.slice(1).join(' '), 1) : '' };
    case 'list': {
      const items: ListItem[] = ls.slice(0, 5).map((t, i) => {
        const prev = s.items[i]?.at;
        const at = prev ?? Math.min(s.end - 0.2, (s.items.at(-1)?.at ?? s.start) + 0.5 * (i - s.items.length + 1));
        return { text: cut(t, i), at: Math.max(s.start, at) };
      });
      return { ...s, items };
    }
    case 'emoji':
      return isEmoji(ls[0]) ? { ...s, emoji: ls[0] } : s;
    default:
      return s;
  }
}

export interface ResolvedScene {
  key: string;
  /** cena como é desenhada (texto e tempo da edição aplicados) */
  scene: SceneInstance;
  /** cena como o app gerou */
  base: SceneInstance;
  edit: SceneEdit | null;
}

export interface ResolvedCaption {
  key: string;
  caption: Caption;
  base: Caption;
  edit: CaptionEdit | null;
  /** posição usada (a da legenda, senão a de todas, senão null = a do modelo) */
  placement: Placement | null;
  /** aparência usada (a de todas + a desta legenda por cima) */
  look: TextLook;
  /** dentro de um trecho travado: segue a posição/aparência do momento da trava */
  locked: boolean;
}

export interface ResolvedAdded {
  el: AddedElement;
  start: number;
  end: number;
}

export interface Resolved {
  scenes: ResolvedScene[];
  /** todas as cenas desenhadas (para câmera, transição etc.), sem as escondidas */
  hiddenKeys: ReadonlySet<string>;
  captions: ResolvedCaption[];
  added: ResolvedAdded[];
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Tempo no vídeo editado de um intervalo do original (cortado = encosta na emenda seguinte). Com os
 * pedaços fora da ordem do original (v0.17), o elemento fica onde o começo dele aparece e nunca dura
 * mais do que durava no original.
 */
export function srcToOut(plan: Pick<EditPlan, 'segments'>, srcStart: number, srcEnd: number): TimeRange {
  const start = sourceToOutputClamped(plan.segments, srcStart);
  let end = sourceEndToOutputClamped(plan.segments, srcEnd);
  if (end < start || end - start > srcEnd - srcStart + 1e-6) end = Math.min(outputDuration(plan.segments), start + (srcEnd - srcStart));
  return { start: r3(start), end: r3(end) };
}

/** Intervalo do original de um intervalo do vídeo editado. */
export function outToSrc(plan: Pick<EditPlan, 'segments'>, out: TimeRange): { srcStart: number; srcEnd: number } {
  const a = outputToSource(plan.segments, out.start) ?? plan.segments[0]!.srcStart;
  const b = outputToSourceEnd(plan.segments, out.end) ?? plan.segments.at(-1)!.srcEnd;
  return { srcStart: r3(a), srcEnd: r3(Math.max(a + 0.01, b)) };
}

const cache = new WeakMap<EditPlan, Resolved>();

/** Junta o plano gerado com as edições manuais (memorizado por plano: o plano nunca muda). */
export function resolvePlan(plan: EditPlan): Resolved {
  const hit = cache.get(plan);
  if (hit) return hit;
  const E = plan.edits;
  const keys = sceneKeys(plan);
  const hiddenKeys = new Set<string>();
  const scenes: ResolvedScene[] = [];
  plan.scenes.forEach((base, i) => {
    const key = keys[i]!;
    const edit = E.scenes[key] ?? null;
    if (edit?.hidden) {
      hiddenKeys.add(key);
      return;
    }
    let scene = base;
    if (edit?.text) scene = withSceneText(scene, edit.text);
    if (edit && (edit.srcStart !== null || edit.srcEnd !== null)) {
      const cur = outToSrc(plan, { start: base.start, end: base.end });
      const out = srcToOut(plan, edit.srcStart ?? cur.srcStart, edit.srcEnd ?? cur.srcEnd);
      if (out.end - out.start < 0.05) return;
      scene = retimeScene(scene, out);
    }
    scenes.push({ key, scene, base, edit });
  });

  const lockedOut = plan.ranges.filter((r) => r.locked).map((r) => ({ out: r.out, snap: r.locked!.captionEdits }));
  const captions: ResolvedCaption[] = [];
  const seenCaption = new Map<string, number>();
  for (const base of plan.captions) {
    // a mesma fala colada duas vezes (v0.17): a cópia ganha chave própria, como as cenas repetidas
    const k0 = captionKey(base);
    const n = (seenCaption.get(k0) ?? 0) + 1;
    seenCaption.set(k0, n);
    const key = n === 1 ? k0 : `${k0}#${n}`;
    const edit = E.captions[key] ?? null;
    if (edit?.hidden) continue;
    let caption = base;
    if (edit && (edit.srcStart !== null || edit.srcEnd !== null)) {
      const cur = outToSrc(plan, { start: base.start, end: base.end });
      const out = srcToOut(plan, edit.srcStart ?? cur.srcStart, edit.srcEnd ?? cur.srcEnd);
      if (out.end - out.start < 0.05) continue;
      caption = retimeCaption(base, out);
    }
    const lock = lockedOut.find((l) => caption.start < l.out.end && caption.end > l.out.start);
    const global = lock ? lock.snap : { placement: E.captionPlacement, look: E.captionLook };
    captions.push({ key, caption, base, edit, placement: edit?.placement ?? global.placement, look: { ...global.look, ...(edit?.look ?? {}) }, locked: !!lock });
  }
  captions.sort((a, b) => a.caption.start - b.caption.start);

  const added: ResolvedAdded[] = [];
  for (const el of E.added) {
    const out = srcToOut(plan, el.srcStart, el.srcEnd);
    if (out.end - out.start >= 0.05) added.push({ el, start: out.start, end: out.end });
  }
  const res: Resolved = { scenes, hiddenKeys, captions, added };
  cache.set(plan, res);
  return res;
}

/** Cena levada para outro intervalo: tempos internos (itens da lista, instante do corte) acompanham. */
export function retimeScene(s: SceneInstance, out: TimeRange): SceneInstance {
  const len = Math.max(0.01, s.end - s.start);
  const k = (out.end - out.start) / len;
  const map = (x: number) => r3(out.start + (x - s.start) * k);
  if (s.kind === 'list') return { ...s, start: out.start, end: out.end, items: s.items.map((i) => ({ ...i, at: map(i.at) })) };
  if (s.kind === 'cut-transition') return { ...s, start: out.start, end: out.end, at: map(s.at) };
  return { ...s, start: out.start, end: out.end };
}

/** Legenda levada para outro intervalo: o início de cada palavra acompanha, na mesma proporção. */
export function retimeCaption(c: Caption, out: TimeRange): Caption {
  const len = Math.max(0.01, c.end - c.start);
  const k = (out.end - out.start) / len;
  return { ...c, start: out.start, end: out.end, wordStarts: c.wordStarts.map((w) => r3(out.start + (w - c.start) * k)) };
}

/** Elemento achado no plano atual, com o intervalo em que aparece (tempo do vídeo editado). */
export function findElement(plan: EditPlan, ref: ElementRef): { start: number; end: number } | null {
  const R = resolvePlan(plan);
  if (ref.type === 'caption') {
    const c = R.captions.find((x) => x.key === ref.key);
    return c ? { start: c.caption.start, end: c.caption.end } : null;
  }
  if (ref.type === 'scene') {
    const s = R.scenes.find((x) => x.key === ref.key);
    return s ? { start: s.scene.start, end: s.scene.end } : null;
  }
  const a = R.added.find((x) => x.el.id === ref.id);
  return a ? { start: a.start, end: a.end } : null;
}

/** Todos os elementos que dá para escolher, em ordem de tempo (faixa "Elementos" da linha do tempo). */
export function listElements(plan: EditPlan): { ref: ElementRef; start: number; end: number; label: string; kind: string }[] {
  const R = resolvePlan(plan);
  const out: { ref: ElementRef; start: number; end: number; label: string; kind: string }[] = [];
  for (const s of R.scenes) {
    if (!VISIBLE_SCENES.has(s.scene.kind) || s.scene.kind === 'progress-bar') continue;
    const text = sceneText(s.scene) ?? '';
    out.push({ ref: { type: 'scene', key: s.key }, start: s.scene.start, end: s.scene.end, label: text.split('\n')[0] || (SCENE_LABELS[s.scene.kind] ?? ''), kind: s.scene.kind });
  }
  for (const a of R.added) {
    const label = a.el.kind === 'text' ? a.el.text : a.el.kind === 'emoji' ? (a.el.emoji ?? '') : elementName(plan, { type: 'added', id: a.el.id });
    out.push({ ref: { type: 'added', id: a.el.id }, start: a.start, end: a.end, label, kind: `added-${a.el.kind}` });
  }
  return out.sort((a, b) => a.start - b.start);
}
