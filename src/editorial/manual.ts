import {
  DEFAULT_FRAMING,
  EMPTY_CAPTION_EDIT,
  EMPTY_SCENE_EDIT,
  IDENTITY_OFFSET,
  MAX_ADDED,
  MAX_KEYS,
  MAX_TRACK,
  SCALE_LIMITS,
  TEXT_MAX,
  VIDEO_SCALE,
  ZOOM_LIMITS,
  captionEditIsEmpty,
  mergeTextLook,
  sceneEditIsEmpty,
  type AddedElement,
  type AddedKind,
  type CaptionEdit,
  type Framing,
  type Keyframe,
  type ManualEdits,
  type Offset,
  type Placement,
  type SceneEdit,
  type Shape,
  type TextLook,
} from '../core/edits';
import type { Emoji } from '../core/emoji';
import { AppError } from '../core/errors';
import type { EditPlan, Segment, TimeRange } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { clipAt, clipLayout } from '../engine/clips';
import { SCENE_TEXT_MAX, TEXT_SCENES, findElement, outToSrc, resolvePlan, sceneText, type ElementRef } from './elements';
import { MIN_KEEP_SEC, editCaptionText, withSegments, type EditContext } from './ops';
import { keyAt, keyedPose } from '../render/keyframes';

/**
 * Operações da edição manual (v0.13, ADR-0018). Todas puras: recebem o plano e devolvem outro, ou o
 * mesmo objeto quando nada muda (não cria entrada vazia no desfazer). Elemento dentro de um trecho
 * travado é recusado com M4F-504, como as outras edições (ADR-0010).
 */

export type Scope = 'all' | 'one';
type LookPatch = { [K in keyof TextLook]?: TextLook[K] | null };

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const MIN_ELEMENT_SEC = 0.2;

export function clampPlacement(p: Placement): Placement {
  return { x: r4(clamp(p.x, -0.5, 1.5)), y: r4(clamp(p.y, -0.5, 1.5)), scale: r4(clamp(p.scale, SCALE_LIMITS.min, SCALE_LIMITS.max)), rotate: r3(clamp(normAngle(p.rotate), -180, 180)) };
}
export function clampOffset(o: Offset): Offset {
  return { dx: r4(clamp(o.dx, -1.5, 1.5)), dy: r4(clamp(o.dy, -1.5, 1.5)), scale: r4(clamp(o.scale, SCALE_LIMITS.min, SCALE_LIMITS.max)), rotate: r3(clamp(normAngle(o.rotate), -180, 180)) };
}
const normAngle = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

const withEdits = (plan: EditPlan, edits: ManualEdits): EditPlan => (JSON.stringify(edits) === JSON.stringify(plan.edits) ? plan : { ...plan, edits });

/** Recusa mexer em algo que aparece dentro de um trecho travado. */
export function assertUnlocked(plan: EditPlan, out: TimeRange, what: string): void {
  const r = plan.ranges.find((x) => x.locked && out.start < x.out.end - 1e-6 && out.end > x.out.start + 1e-6);
  if (r) throw new AppError('TRECHO_TRAVADO', `${what} (trecho de ${r.out.start.toFixed(2)} s a ${r.out.end.toFixed(2)} s)`);
}

function located(plan: EditPlan, ref: ElementRef): { start: number; end: number } {
  const at = findElement(plan, ref);
  if (!at) throw new AppError('ELEMENTO_SUMIU', ref.type === 'added' ? ref.id : ref.key);
  return at;
}

function editable(plan: EditPlan, ref: ElementRef): { start: number; end: number } {
  const at = located(plan, ref);
  assertUnlocked(plan, at, ref.type === 'caption' ? 'legenda' : 'elemento');
  return at;
}

function putCaption(edits: ManualEdits, key: string, f: (e: CaptionEdit) => CaptionEdit): ManualEdits {
  const next = f(edits.captions[key] ?? EMPTY_CAPTION_EDIT);
  const captions = { ...edits.captions };
  if (captionEditIsEmpty(next)) delete captions[key];
  else captions[key] = next;
  return { ...edits, captions };
}

function putScene(edits: ManualEdits, key: string, f: (e: SceneEdit) => SceneEdit): ManualEdits {
  const next = f(edits.scenes[key] ?? EMPTY_SCENE_EDIT);
  const scenes = { ...edits.scenes };
  if (sceneEditIsEmpty(next)) delete scenes[key];
  else scenes[key] = next;
  return { ...edits, scenes };
}

function putAdded(plan: EditPlan, id: string, f: (e: AddedElement) => AddedElement): EditPlan {
  const i = plan.edits.added.findIndex((a) => a.id === id);
  if (i < 0) throw new AppError('ELEMENTO_SUMIU', id);
  const added = [...plan.edits.added];
  added[i] = f(added[i]!);
  return withEdits(plan, { ...plan.edits, added });
}

/**
 * Posição de uma legenda. "Todas" (padrão) muda a posição de todas as legendas e tira as posições
 * próprias; "só esta" guarda a posição só na legenda escolhida. null = volta à posição do modelo.
 */
export function setCaptionPlacement(plan: EditPlan, scope: Scope, key: string | null, placement: Placement | null): EditPlan {
  const p = placement ? clampPlacement(placement) : null;
  if (scope === 'one') {
    if (!key) return plan;
    editable(plan, { type: 'caption', key });
    return withEdits(plan, putCaption(plan.edits, key, (e) => ({ ...e, placement: p })));
  }
  let edits: ManualEdits = { ...plan.edits, captionPlacement: p };
  for (const k of Object.keys(edits.captions)) edits = putCaption(edits, k, (e) => ({ ...e, placement: null }));
  return withEdits(plan, edits);
}

/** Aparência da legenda: todas (tira o mesmo campo das legendas com aparência própria) ou só esta. */
export function patchCaptionLook(plan: EditPlan, scope: Scope, key: string | null, patch: LookPatch): EditPlan {
  if (scope === 'one') {
    if (!key) return plan;
    editable(plan, { type: 'caption', key });
    return withEdits(plan, putCaption(plan.edits, key, (e) => ({ ...e, look: mergeTextLook(e.look, patch) })));
  }
  let edits: ManualEdits = { ...plan.edits, captionLook: mergeTextLook(plan.edits.captionLook, patch) };
  const clear = Object.fromEntries(Object.keys(patch).map((k) => [k, null])) as LookPatch;
  for (const k of Object.keys(edits.captions)) edits = putCaption(edits, k, (e) => ({ ...e, look: mergeTextLook(e.look, clear) }));
  return withEdits(plan, edits);
}

/** Posição de qualquer elemento: legenda (escopo), cena gerada (deslocamento) ou adicionado (posição). */
export function setElementPlacement(plan: EditPlan, ref: ElementRef, value: Placement | Offset | null, scope: Scope = 'all', t?: number): EditPlan {
  if (ref.type === 'caption') return setCaptionPlacement(plan, scope, ref.key, value as Placement | null);
  const at = editable(plan, ref);
  if (ref.type === 'scene') {
    const o = value ? clampOffset(value as Offset) : null;
    const isId = o && o.dx === 0 && o.dy === 0 && o.scale === 1 && o.rotate === 0;
    return withEdits(plan, putScene(plan.edits, ref.key, (e) => ({ ...e, offset: isId ? null : o })));
  }
  const p = value ? clampPlacement(value as Placement) : null;
  if (!p) return plan;
  // com pontos de animação (v0.26): mexer no elemento cria ou atualiza o ponto da agulha
  const el = plan.edits.added.find((a) => a.id === ref.id);
  if (el?.keys?.length && t !== undefined) {
    const local = r3(clamp(t - at.start, 0, at.end - at.start));
    const now = keyedPose(el, local);
    return putAdded(plan, ref.id, (e) => ({ ...e, keys: upsertKey(e.keys ?? [], { at: local, ...p, opacity: now.opacity, ease: 'smooth' }) }));
  }
  return putAdded(plan, ref.id, (e) => ({ ...e, placement: p }));
}

/** Põe o ponto no lugar dele (por tempo); se já há um ponto nesse instante, troca os valores e mantém a curva. */
function upsertKey(keys: readonly Keyframe[], k: Keyframe): Keyframe[] {
  const i = keyAt(keys, k.at);
  if (i >= 0) return keys.map((x, j) => (j === i ? { ...k, at: x.at, ease: x.ease } : x));
  if (keys.length >= MAX_KEYS) throw new AppError('LIMITE_PONTOS', `${MAX_KEYS} pontos`);
  return [...keys, k].sort((a, b) => a.at - b.at);
}

/**
 * Pontos de animação (v0.26): cria um ponto na agulha com a posição, o tamanho, o giro e a opacidade
 * que o elemento tem nesse instante. Depois, mexer no elemento em outro instante cria outro ponto.
 */
export function addKeyframe(plan: EditPlan, id: string, t: number): EditPlan {
  const at = editable(plan, { type: 'added', id });
  const el = plan.edits.added.find((a) => a.id === id);
  if (!el) throw new AppError('ELEMENTO_SUMIU', id);
  const local = r3(clamp(t - at.start, 0, at.end - at.start));
  const now = keyedPose(el, local);
  return putAdded(plan, id, (e) => ({ ...e, keys: upsertKey(e.keys ?? [], { at: local, ...clampPlacement(now.placement), opacity: r3(now.opacity), ease: 'smooth' }) }));
}

/** Muda opacidade, curva ou instante de um ponto (o instante fica entre os vizinhos). */
export function patchKeyframe(plan: EditPlan, id: string, index: number, patch: Partial<Pick<Keyframe, 'opacity' | 'ease' | 'at'>>): EditPlan {
  const at = editable(plan, { type: 'added', id });
  return putAdded(plan, id, (e) => {
    const keys = [...(e.keys ?? [])];
    const k = keys[index];
    if (!k) return e;
    const next = { ...k, ...patch };
    if (patch.opacity !== undefined) next.opacity = r3(clamp(patch.opacity, 0, 1));
    if (patch.at !== undefined) {
      const lo = (keys[index - 1]?.at ?? -0.01) + 0.01;
      const hi = Math.min(at.end - at.start, (keys[index + 1]?.at ?? Infinity) - 0.01);
      next.at = r3(clamp(patch.at, Math.max(0, lo), Math.max(0, hi)));
    }
    keys[index] = next;
    return { ...e, keys };
  });
}

/** Apaga um ponto; sem pontos, o elemento fica parado onde estava no primeiro ponto. */
export function removeKeyframe(plan: EditPlan, id: string, index: number): EditPlan {
  editable(plan, { type: 'added', id });
  return putAdded(plan, id, (e) => {
    const keys = (e.keys ?? []).filter((_, i) => i !== index);
    if (keys.length) return { ...e, keys };
    const only = e.keys?.[0];
    const { keys: _gone, ...rest } = e;
    return only ? { ...rest, placement: clampPlacement({ x: only.x, y: only.y, scale: only.scale, rotate: only.rotate }) } : rest;
  });
}

/** Tira todos os pontos: o elemento para onde está no instante `t`. */
export function clearKeyframes(plan: EditPlan, id: string, t: number): EditPlan {
  const at = editable(plan, { type: 'added', id });
  return putAdded(plan, id, (e) => {
    if (!e.keys?.length) return e;
    const now = keyedPose(e, clamp(t - at.start, 0, at.end - at.start));
    const { keys: _gone, ...rest } = e;
    return { ...rest, placement: clampPlacement(now.placement) };
  });
}

/** Aparência de qualquer elemento (texto, cores, fonte, animação). */
export function patchElementLook(plan: EditPlan, ref: ElementRef, patch: LookPatch, scope: Scope = 'all'): EditPlan {
  if (ref.type === 'caption') return patchCaptionLook(plan, scope, ref.key, patch);
  editable(plan, ref);
  if (ref.type === 'scene') return withEdits(plan, putScene(plan.edits, ref.key, (e) => ({ ...e, look: mergeTextLook(e.look, patch) })));
  return putAdded(plan, ref.id, (e) => ({ ...e, look: mergeTextLook(e.look, patch) }));
}

function cleanText(text: string, max: number, multiline: boolean): string {
  const clean = multiline
    ? text
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
    : text.replace(/\s+/g, ' ').trim();
  if (!clean) throw new AppError('TEXTO_VAZIO');
  if (clean.length > max) throw new AppError('TEXTO_LONGO', `${clean.length} caracteres (máximo ${max})`);
  return clean;
}

/** Troca o texto: legenda (correção, M4F-501/502), cena gerada (por tipo) ou texto adicionado. */
export function setElementText(plan: EditPlan, ref: ElementRef, text: string): EditPlan {
  if (ref.type === 'caption') {
    const c = resolvePlan(plan).captions.find((x) => x.key === ref.key);
    if (!c) throw new AppError('ELEMENTO_SUMIU', ref.key);
    return editCaptionText(plan, c.base.id, text);
  }
  editable(plan, ref);
  if (ref.type === 'scene') {
    const s = resolvePlan(plan).scenes.find((x) => x.key === ref.key)!;
    if (!TEXT_SCENES.has(s.scene.kind)) return plan;
    const max = SCENE_TEXT_MAX[s.scene.kind] ?? [TEXT_MAX];
    const clean = cleanText(text, TEXT_MAX, true);
    const lines = clean.split('\n');
    if (lines.length > max.length && s.scene.kind === 'list') throw new AppError('TEXTO_LONGO', `${lines.length} itens (máximo ${max.length})`);
    lines.forEach((l, i) => {
      const lim = max[Math.min(i, max.length - 1)]!;
      if (l.length > lim) throw new AppError('TEXTO_LONGO', `linha ${i + 1} com ${l.length} caracteres (máximo ${lim})`);
    });
    const same = clean === sceneText(s.base);
    return withEdits(plan, putScene(plan.edits, ref.key, (e) => ({ ...e, text: same ? null : clean })));
  }
  const el = plan.edits.added.find((a) => a.id === ref.id);
  if (!el || el.kind !== 'text') return plan;
  const clean = cleanText(text, TEXT_MAX, true);
  return putAdded(plan, ref.id, (e) => ({ ...e, text: clean }));
}

/** Apaga o elemento: legenda e cena gerada ficam escondidas (voltam com "voltar ao modelo"); adicionado sai do plano. */
export function deleteElement(plan: EditPlan, ref: ElementRef): EditPlan {
  editable(plan, ref);
  if (ref.type === 'caption') return withEdits(plan, putCaption(plan.edits, ref.key, (e) => ({ ...e, hidden: true })));
  if (ref.type === 'scene') return withEdits(plan, putScene(plan.edits, ref.key, (e) => ({ ...e, hidden: true })));
  return withEdits(plan, { ...plan.edits, added: plan.edits.added.filter((a) => a.id !== ref.id) });
}

/** Tira todas as edições do elemento (gerado volta a ser como o modelo fez). Adicionado volta à aparência padrão. */
export function resetElement(plan: EditPlan, ref: ElementRef): EditPlan {
  if (ref.type === 'added') {
    editable(plan, ref);
    return putAdded(plan, ref.id, (e) => ({ ...e, look: {}, placement: { ...e.placement, scale: 1, rotate: 0 } }));
  }
  const key = ref.key;
  if (!(ref.type === 'caption' ? plan.edits.captions[key] : plan.edits.scenes[key])) return plan;
  const base = resolveBaseRange(plan, ref);
  if (base) assertUnlocked(plan, base, 'elemento');
  if (ref.type === 'caption') {
    const captions = { ...plan.edits.captions };
    delete captions[key];
    return withEdits(plan, { ...plan.edits, captions });
  }
  const scenes = { ...plan.edits.scenes };
  delete scenes[key];
  return withEdits(plan, { ...plan.edits, scenes });
}

function resolveBaseRange(plan: EditPlan, ref: ElementRef): TimeRange | null {
  if (ref.type === 'caption') {
    const c = plan.captions.find((x) => (x.wordIds[0] ? `w:${x.wordIds[0]}` : `c:${x.id}`) === ref.key);
    return c ? { start: c.start, end: c.end } : null;
  }
  return findElement(plan, ref);
}

/** Volta todas as legendas e cenas apagadas e a posição/aparência geral das legendas. */
export function resetAllCaptionEdits(plan: EditPlan): EditPlan {
  return withEdits(plan, { ...plan.edits, captionPlacement: null, captionLook: {}, captions: {} });
}

const nextId = (added: AddedElement[]) => `e${Math.max(0, ...added.map((a) => Number(a.id.slice(1)))) + 1}`;

export interface AddSpec {
  kind: AddedKind;
  preset?: 'text' | 'title';
  text?: string;
  emoji?: Emoji;
  shape?: Shape;
  placement?: Partial<Placement>;
  look?: TextLook;
}

const DEFAULT_Y: Record<string, number> = { text: 0.36, title: 0.24, emoji: 0.42, shape: 0.5 };

/** Adiciona texto, emoji ou forma a partir do instante `outT` (3 s, ou até o fim do vídeo). */
export function addElement(plan: EditPlan, ctx: EditContext, spec: AddSpec, outT: number, seconds = 3): { plan: EditPlan; id: string } {
  if (plan.edits.added.length >= MAX_ADDED) throw new AppError('LIMITE_ELEMENTOS');
  const total = outputDuration(plan.segments);
  const start = clamp(outT, 0, Math.max(0, total - MIN_ELEMENT_SEC));
  const end = Math.min(total, start + seconds);
  if (end - start < MIN_ELEMENT_SEC) throw new AppError('ELEMENTO_CURTO');
  assertUnlocked(plan, { start, end }, 'elemento novo');
  const src = outToSrc(plan, { start, end });
  const preset = spec.preset ?? 'text';
  const text = spec.kind === 'text' ? cleanText(spec.text ?? (preset === 'title' ? 'Seu título aqui' : 'Seu texto aqui'), TEXT_MAX, true) : '';
  const id = nextId(plan.edits.added);
  const key = spec.kind === 'text' ? preset : spec.kind;
  const el: AddedElement = {
    id,
    kind: spec.kind,
    preset,
    srcStart: src.srcStart,
    srcEnd: Math.min(ctx.durationSec, src.srcEnd),
    placement: clampPlacement({ x: 0.5, y: DEFAULT_Y[key] ?? 0.4, scale: 1, rotate: 0, ...spec.placement }),
    text,
    emoji: spec.kind === 'emoji' ? (spec.emoji ?? '🔥') : null,
    shape: spec.kind === 'shape' ? (spec.shape ?? 'arrow') : null,
    look: spec.look ?? {},
  };
  return { plan: withEdits(plan, { ...plan.edits, added: [...plan.edits.added, el] }), id };
}

/**
 * Duplica: adicionado ganha uma cópia um pouco deslocada; título/texto gerado vira um texto adicionado
 * com as mesmas palavras (o original continua). Legenda não duplica (ela vem da fala).
 */
export function duplicateElement(plan: EditPlan, ref: ElementRef): { plan: EditPlan; id: string } | null {
  if (ref.type === 'caption') return null;
  if (plan.edits.added.length >= MAX_ADDED) throw new AppError('LIMITE_ELEMENTOS');
  const at = editable(plan, ref);
  const id = nextId(plan.edits.added);
  if (ref.type === 'added') {
    const el = plan.edits.added.find((a) => a.id === ref.id)!;
    const copy: AddedElement = { ...el, id, placement: clampPlacement({ ...el.placement, x: el.placement.x + 0.04, y: el.placement.y + 0.04 }) };
    const i = plan.edits.added.indexOf(el);
    const added = [...plan.edits.added.slice(0, i + 1), copy, ...plan.edits.added.slice(i + 1)];
    return { plan: withEdits(plan, { ...plan.edits, added }), id };
  }
  const s = resolvePlan(plan).scenes.find((x) => x.key === ref.key)!;
  const src = outToSrc(plan, at);
  const base: Omit<AddedElement, 'kind' | 'text' | 'emoji' | 'shape' | 'preset'> = { id, srcStart: src.srcStart, srcEnd: src.srcEnd, placement: { x: 0.5, y: 0.3, scale: 1, rotate: 0 }, look: s.edit?.look ?? {} };
  let el: AddedElement;
  if (s.scene.kind === 'emoji') el = { ...base, kind: 'emoji', preset: 'text', text: '', emoji: s.scene.emoji, shape: null, placement: { ...base.placement, y: 0.6 } };
  else {
    const text = (sceneText(s.scene) ?? '').split('\n').join(' ').slice(0, TEXT_MAX).trim();
    if (!text) return null;
    el = { ...base, kind: 'text', preset: 'title', text, emoji: null, shape: null };
  }
  return { plan: withEdits(plan, { ...plan.edits, added: [...plan.edits.added, el] }), id };
}

/** Elemento guardado pelo Copiar/Recortar (v0.17): o que ele é e quanto tempo aparece. */
export interface ElementClip {
  template: Omit<AddedElement, 'id' | 'srcStart' | 'srcEnd'>;
  seconds: number;
}

/**
 * Copia um elemento para colar depois: adicionado vai como é; título/texto/número gerado vira um texto
 * com as mesmas palavras; emoji gerado vira emoji. Legenda não copia (M4F-519): ela vem da fala.
 */
export function copyElement(plan: EditPlan, ref: ElementRef): ElementClip {
  if (ref.type === 'caption') throw new AppError('LEGENDA_NAO_COPIA');
  const at = located(plan, ref);
  const seconds = Math.max(MIN_ELEMENT_SEC, at.end - at.start);
  if (ref.type === 'added') {
    const el = plan.edits.added.find((a) => a.id === ref.id)!;
    return { template: { kind: el.kind, preset: el.preset, text: el.text, emoji: el.emoji, shape: el.shape, placement: el.placement, look: el.look, track: el.track }, seconds };
  }
  const s = resolvePlan(plan).scenes.find((x) => x.key === ref.key)!;
  const look = s.edit?.look ?? {};
  const placement = { x: 0.5 + (s.edit?.offset?.dx ?? 0), y: 0.3 + (s.edit?.offset?.dy ?? 0), scale: s.edit?.offset?.scale ?? 1, rotate: s.edit?.offset?.rotate ?? 0 };
  if (s.scene.kind === 'emoji') return { template: { kind: 'emoji', preset: 'text', text: '', emoji: s.scene.emoji, shape: null, placement: clampPlacement({ ...placement, y: placement.y + 0.3 }), look }, seconds };
  const text = (sceneText(s.scene) ?? '').split('\n').join(' ').slice(0, TEXT_MAX).trim();
  if (!text) throw new AppError('ELEMENTO_SUMIU', ref.key);
  return { template: { kind: 'text', preset: 'title', text, emoji: null, shape: null, placement: clampPlacement(placement), look }, seconds };
}

/** Cola o elemento copiado a partir do instante `outT`, com a mesma duração (ou até o fim do vídeo). */
export function pasteElement(plan: EditPlan, ctx: EditContext, clip: ElementClip, outT: number): { plan: EditPlan; id: string } {
  if (plan.edits.added.length >= MAX_ADDED) throw new AppError('LIMITE_ELEMENTOS');
  const total = outputDuration(plan.segments);
  const start = clamp(outT, 0, Math.max(0, total - MIN_ELEMENT_SEC));
  const end = Math.min(total, start + clip.seconds);
  if (end - start < MIN_ELEMENT_SEC - 1e-6) throw new AppError('ELEMENTO_CURTO', `${(end - start).toFixed(2)} s`);
  assertUnlocked(plan, { start, end }, 'elemento colado');
  const src = outToSrc(plan, { start, end });
  const id = nextId(plan.edits.added);
  const el: AddedElement = { ...clip.template, id, srcStart: src.srcStart, srcEnd: Math.min(ctx.durationSec, src.srcEnd) };
  return { plan: withEdits(plan, { ...plan.edits, added: [...plan.edits.added, el] }), id };
}

/** Leva um elemento adicionado para outra camada da linha do tempo (0 = a de baixo). */
export function setElementTrack(plan: EditPlan, id: string, track: number): EditPlan {
  const el = plan.edits.added.find((a) => a.id === id);
  if (!el) throw new AppError('ELEMENTO_SUMIU', id);
  const t = Math.max(0, Math.min(MAX_TRACK, Math.round(track)));
  if ((el.track ?? 0) === t) return plan;
  editable(plan, { type: 'added', id });
  return putAdded(plan, id, (e) => ({ ...e, track: t }));
}

/** Camada de um elemento adicionado: frente/trás um passo, ou tudo para frente/trás. */
export function moveLayer(plan: EditPlan, id: string, dir: 'up' | 'down' | 'top' | 'bottom'): EditPlan {
  const list = [...plan.edits.added];
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) throw new AppError('ELEMENTO_SUMIU', id);
  const [el] = list.splice(i, 1);
  const j = dir === 'up' ? Math.min(list.length, i + 1) : dir === 'down' ? Math.max(0, i - 1) : dir === 'top' ? list.length : 0;
  list.splice(j, 0, el!);
  if (j === i) return plan;
  return withEdits(plan, { ...plan.edits, added: list });
}

/**
 * Novo início/fim (tempo do vídeo editado) de um elemento. Guardado no original para acompanhar cortes.
 * Legenda não passa da legenda vizinha. Mínimo 0,2 s (M4F-517).
 */
export function retimeElement(plan: EditPlan, ref: ElementRef, out: TimeRange): EditPlan {
  const at = editable(plan, ref);
  const total = outputDuration(plan.segments);
  let start = clamp(Math.min(out.start, out.end), 0, total);
  let end = clamp(Math.max(out.start, out.end), 0, total);
  if (ref.type === 'caption') {
    const list = resolvePlan(plan).captions;
    const i = list.findIndex((c) => c.key === ref.key);
    const prev = list[i - 1];
    const next = list[i + 1];
    if (prev) start = Math.max(start, prev.caption.end);
    if (next) end = Math.min(end, next.caption.start);
  }
  if (end - start < MIN_ELEMENT_SEC - 1e-6) throw new AppError('ELEMENTO_CURTO', `${(end - start).toFixed(2)} s`);
  assertUnlocked(plan, { start, end }, 'novo tempo do elemento');
  if (Math.abs(start - at.start) < 1e-4 && Math.abs(end - at.end) < 1e-4) return plan;
  const src = outToSrc(plan, { start, end });
  if (ref.type === 'caption') return withEdits(plan, putCaption(plan.edits, ref.key, (e) => ({ ...e, srcStart: src.srcStart, srcEnd: src.srcEnd })));
  if (ref.type === 'scene') return withEdits(plan, putScene(plan.edits, ref.key, (e) => ({ ...e, srcStart: src.srcStart, srcEnd: src.srcEnd })));
  return putAdded(plan, ref.id, (e) => ({ ...e, srcStart: src.srcStart, srcEnd: src.srcEnd }));
}

/** Enquadramento do vídeo dentro do 9:16 (preencher/caber, tamanho, posição). */
export function setFraming(plan: EditPlan, patch: Partial<Framing>): EditPlan {
  const v = { ...plan.edits.video, ...patch };
  const video: Framing = { fit: v.fit, scale: r4(clamp(v.scale, VIDEO_SCALE.min, VIDEO_SCALE.max)), x: r4(clamp(v.x, -1, 1)), y: r4(clamp(v.y, -1, 1)) };
  return withEdits(plan, { ...plan.edits, video });
}
export const resetFraming = (plan: EditPlan) => withEdits(plan, { ...plan.edits, video: DEFAULT_FRAMING });

const sameRange = (a: { srcStart: number; srcEnd: number }, b: { srcStart: number; srcEnd: number }) => Math.abs(a.srcStart - b.srcStart) < 1e-3 && Math.abs(a.srcEnd - b.srcEnd) < 1e-3;

/** Zoom no pedaço `index` (null = tira; número = aproximação). */
export function setSegmentZoom(plan: EditPlan, index: number, scale: number | null): EditPlan {
  const s = plan.segments[index];
  if (!s) return plan;
  const zooms = plan.edits.zooms.filter((z) => !sameRange(z, s));
  if (scale !== null) zooms.push({ srcStart: s.srcStart, srcEnd: s.srcEnd, scale: r3(clamp(scale, ZOOM_LIMITS.min, ZOOM_LIMITS.max)) });
  zooms.sort((a, b) => a.srcStart - b.srcStart);
  return withEdits(plan, { ...plan.edits, zooms });
}
export const segmentZoom = (plan: EditPlan, index: number): number | null => {
  const s = plan.segments[index];
  return s ? (plan.edits.zooms.find((z) => sameRange(z, s))?.scale ?? null) : null;
};

/** Pedaço mantido que contém o instante `outT` do vídeo editado, e onde ele começa. */
export function segmentAt(segments: Segment[], outT: number): { index: number; offset: number } | null {
  let offset = 0;
  for (let i = 0; i < segments.length; i++) {
    const len = segments[i]!.srcEnd - segments[i]!.srcStart;
    if (outT < offset + len || i === segments.length - 1) return outT <= offset + len ? { index: i, offset } : null;
    offset += len;
  }
  return null;
}

/** Divide o pedaço na agulha (vira dois pedaços seguidos; o vídeo não muda até apagar um deles). */
export function splitAt(plan: EditPlan, ctx: EditContext, outT: number): EditPlan {
  const hit = segmentAt(plan.segments, outT);
  if (!hit) throw new AppError('AGULHA_FORA', `${outT.toFixed(2)} s`);
  const s = plan.segments[hit.index]!;
  const src = r3(s.srcStart + (outT - hit.offset));
  if (src - s.srcStart < MIN_KEEP_SEC || s.srcEnd - src < MIN_KEEP_SEC) throw new AppError('AGULHA_FORA', `${outT.toFixed(2)} s, a menos de ${MIN_KEEP_SEC} s da ponta do pedaço`);
  const segments = [...plan.segments.slice(0, hit.index), { srcStart: s.srcStart, srcEnd: src }, { srcStart: src, srcEnd: s.srcEnd }, ...plan.segments.slice(hit.index + 1)];
  return withSegments(plan, ctx, segments);
}

/** Apaga um pedaço; o resto do vídeo encosta (o que vem depois anda para trás). */
export function deleteSegment(plan: EditPlan, ctx: EditContext, index: number): EditPlan {
  if (!plan.segments[index]) return plan;
  if (plan.segments.length === 1) throw new AppError('CORTE_TOTAL');
  return withSegments(
    plan,
    ctx,
    plan.segments.filter((_, i) => i !== index),
  );
}

/**
 * Seleção múltipla (v0.26): apaga vários pedaços e elementos numa entrada só do desfazer. O resto do
 * vídeo encosta (o vídeo editado é a sequência dos pedaços), e os elementos andam junto com a fala.
 */
export function deleteMany(plan: EditPlan, ctx: EditContext, segs: readonly number[], els: readonly ElementRef[]): EditPlan {
  let next = plan;
  for (const ref of els) if (findElement(next, ref)) next = deleteElement(next, ref);
  const drop = new Set(segs.filter((i) => i >= 0 && i < next.segments.length));
  if (drop.size === 0) return next;
  if (drop.size >= next.segments.length) throw new AppError('SELECAO_TUDO', `${drop.size} pedaços`);
  return withSegments(next, ctx, next.segments.filter((_, i) => !drop.has(i)));
}

/** Puxa a ponta de um pedaço (tempo do original), sem passar dos vizinhos nem deixar menos de 0,1 s. */
export function trimSegment(plan: EditPlan, ctx: EditContext, index: number, edge: 'start' | 'end', src: number): EditPlan {
  const s = plan.segments[index];
  if (!s) return plan;
  // o vizinho só limita quando vem antes/depois também no original (v0.17: com a ordem mudada, puxar
  // a ponta pode reaproveitar imagem que outro pedaço também usa, como num editor profissional)
  const before = plan.segments[index - 1];
  const after = plan.segments[index + 1];
  const prev = before && before.srcEnd <= s.srcStart + 1e-6 ? before : undefined;
  const next = after && after.srcStart >= s.srcEnd - 1e-6 ? after : undefined;
  // com vários clipes, o pedaço não passa das pontas do próprio arquivo
  const home = plan.clips.length > 1 ? clipAt(plan.clips, s.srcStart) : null;
  const span = home ? clipLayout(plan.clips)[home.index]! : { start: 0, end: ctx.durationSec };
  let seg: Segment;
  if (edge === 'start') {
    const lo = Math.max(span.start, prev ? prev.srcEnd : 0);
    const v = r3(clamp(src, lo, s.srcEnd));
    if (s.srcEnd - v < MIN_KEEP_SEC - 1e-6) throw new AppError('PEDACO_CURTO', `${(s.srcEnd - v).toFixed(2)} s`);
    seg = { srcStart: v, srcEnd: s.srcEnd };
  } else {
    const hi = Math.min(span.end, next ? next.srcStart : ctx.durationSec);
    const v = r3(clamp(src, s.srcStart, hi));
    if (v - s.srcStart < MIN_KEEP_SEC - 1e-6) throw new AppError('PEDACO_CURTO', `${(v - s.srcStart).toFixed(2)} s`);
    seg = { srcStart: s.srcStart, srcEnd: v };
  }
  if (seg.srcStart === s.srcStart && seg.srcEnd === s.srcEnd) return plan;
  const segments = plan.segments.map((x, i) => (i === index ? seg : x));
  return withSegments(plan, ctx, segments);
}

/**
 * Corta um pedaço do original (ex.: palavras apagadas na transcrição, como no Descript). Sobras menores
 * que 0,1 s saem junto. Nada a cortar = M4F-516; cortar tudo = M4F-503.
 */
export function cutSourceRange(plan: EditPlan, ctx: EditContext, range: TimeRange): EditPlan {
  const a = Math.min(range.start, range.end);
  const b = Math.max(range.start, range.end);
  const segments: Segment[] = [];
  let changed = false;
  for (const s of plan.segments) {
    if (b <= s.srcStart + 1e-3 || a >= s.srcEnd - 1e-3) {
      segments.push(s);
      continue;
    }
    changed = true;
    if (a - s.srcStart >= MIN_KEEP_SEC) segments.push({ srcStart: s.srcStart, srcEnd: r3(a) });
    if (s.srcEnd - b >= MIN_KEEP_SEC) segments.push({ srcStart: r3(b), srcEnd: s.srcEnd });
  }
  if (!changed) throw new AppError('PALAVRAS_JA_CORTADAS', `${a.toFixed(2)} s a ${b.toFixed(2)} s`);
  if (segments.length === 0) throw new AppError('CORTE_TOTAL');
  return withSegments(plan, ctx, segments);
}

export { IDENTITY_OFFSET };
