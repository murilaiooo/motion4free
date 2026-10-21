import type { AddedElement } from '../core/edits';
import type { EditPlan, SceneInstance, TimeRange } from '../core/types';
import { outputDuration, sourceToOutputClamped } from '../engine/timeline';

/**
 * "O que mudou": compara dois planos e descreve as diferenças em português simples, no tempo do
 * vídeo editado. Puro: serve para a lista da tela e para os testes.
 */

export type ChangeKind = 'added' | 'removed' | 'caption' | 'style' | 'colors' | 'cuts' | 'range' | 'manual';

export interface PlanChange {
  kind: ChangeKind;
  /** instante (s, vídeo editado) para levar a prévia até a mudança; null = vale para o vídeo inteiro */
  at: number | null;
  text: string;
}

export interface PlanDiff {
  changes: PlanChange[];
  /** de onde até onde há mudanças nas cenas e legendas (para escolher o quadro do antes/depois) */
  span: TimeRange | null;
}

const fmt = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;
const quote = (s: string) => `“${s.length > 28 ? `${s.slice(0, 27)}…` : s}”`;

export function describeScene(s: SceneInstance): string {
  switch (s.kind) {
    case 'kinetic-title':
      return `título ${quote(s.text)}`;
    case 'highlight-word':
      return `palavra-chave ${quote(s.text)}`;
    case 'big-number':
      return `número grande ${quote(s.value)}`;
    case 'list':
      return `lista (${s.items.length} ${s.items.length === 1 ? 'item' : 'itens'})`;
    case 'quote':
      return `pergunta em destaque ${quote(s.text)}`;
    case 'lower-third':
      return `nome na tela ${quote(s.title)}`;
    case 'emphasis-zoom':
      return 'zoom';
    case 'cut-transition':
      return 'transição';
    case 'progress-bar':
      return 'barra de progresso';
    case 'end-cta':
      return `chamada final ${quote(s.text)}`;
    case 'emoji':
      return `emoji ${s.emoji}`;
  }
}

const sceneKey = ({ id: _id, ...rest }: SceneInstance) => JSON.stringify(rest);
const addedName = (el: AddedElement) => el.kind === 'text'
  ? `${el.preset === 'title' ? 'título' : 'texto'} ${quote(el.text)}`
  : el.kind === 'emoji' ? `emoji ${el.emoji}` : `forma ${el.shape}`;

export const MAX_CHANGES = 40;

export function diffPlans(before: EditPlan, after: EditPlan): PlanDiff {
  const changes: PlanChange[] = [];
  const times: number[] = [];

  if (before.style.id !== after.style.id) changes.push({ kind: 'style', at: null, text: `Estilo: ${before.style.name} → ${after.style.name}` });
  else if (JSON.stringify({ ...before.style, palette: null }) !== JSON.stringify({ ...after.style, palette: null })) changes.push({ kind: 'style', at: null, text: 'Ajustes do estilo (movimento, ritmo ou o que aparece na tela)' });
  // cores: só quando a imagem de referência mudou ou, no mesmo estilo, a paleta mudou (trocar de estilo já traz as cores dele)
  const sameStyle = before.style.id === after.style.id;
  if (JSON.stringify(before.reference) !== JSON.stringify(after.reference) || (sameStyle && JSON.stringify(before.style.palette) !== JSON.stringify(after.style.palette))) {
    changes.push({ kind: 'colors', at: null, text: after.reference ? 'Cores tiradas da sua imagem' : 'Cores do estilo de volta (sem imagem)' });
  }

  const db = outputDuration(before.segments);
  const da = outputDuration(after.segments);
  if (JSON.stringify(before.segments) !== JSON.stringify(after.segments)) changes.push({ kind: 'cuts', at: null, text: `Cortes mudaram: o vídeo editado foi de ${fmt(db)} para ${fmt(da)}` });

  // trechos ajustados
  const rb = new Map(before.ranges.map((r) => [r.id, r]));
  const ra = new Map(after.ranges.map((r) => [r.id, r]));
  for (const r of after.ranges) {
    const old = rb.get(r.id);
    const where = `${fmt(r.out.start)} a ${fmt(r.out.end)}`;
    if (!old) changes.push({ kind: 'range', at: r.out.start, text: `Trecho novo de ${where}${r.prompt ? `: ${quote(r.prompt)}` : ''}` });
    else if (!old.locked && r.locked) changes.push({ kind: 'range', at: r.out.start, text: `Trecho de ${where} travado` });
    else if (old.locked && !r.locked) changes.push({ kind: 'range', at: r.out.start, text: `Trecho de ${where} destravado` });
    else if (old.prompt !== r.prompt) changes.push({ kind: 'range', at: r.out.start, text: `Pedido no trecho de ${where}: ${quote(r.prompt.split(' · ').at(-1) ?? r.prompt)}` });
  }
  for (const r of before.ranges) if (!ra.has(r.id)) changes.push({ kind: 'range', at: r.out.start, text: `Trecho de ${fmt(r.out.start)} a ${fmt(r.out.end)} voltou ao normal` });

  // cenas: compara pelo conteúdo (tipo, tempos e parâmetros), sem olhar o id
  const count = (list: SceneInstance[]) => {
    const m = new Map<string, SceneInstance[]>();
    for (const s of list) m.set(sceneKey(s), [...(m.get(sceneKey(s)) ?? []), s]);
    return m;
  };
  const cb = count(before.scenes);
  const ca = count(after.scenes);
  const sceneChanges: PlanChange[] = [];
  for (const [k, list] of ca) {
    const extra = list.length - (cb.get(k)?.length ?? 0);
    for (const s of list.slice(0, Math.max(0, extra))) {
      sceneChanges.push({ kind: 'added', at: s.start, text: `+ ${describeScene(s)} em ${fmt(s.start)}` });
      times.push(s.start, s.end);
    }
  }
  for (const [k, list] of cb) {
    const missing = list.length - (ca.get(k)?.length ?? 0);
    for (const s of list.slice(0, Math.max(0, missing))) {
      sceneChanges.push({ kind: 'removed', at: s.start, text: `− ${describeScene(s)} em ${fmt(s.start)}` });
      times.push(s.start, s.end);
    }
  }
  // a mesma cena no mesmo instante, só com parâmetros diferentes (ex.: escala do zoom do novo estilo): uma linha só
  for (let i = 0; i < sceneChanges.length; i++) {
    const r = sceneChanges[i]!;
    if (r.kind !== 'removed') continue;
    const j = sceneChanges.findIndex((a) => a.kind === 'added' && a.text.slice(2) === r.text.slice(2));
    if (j < 0) continue;
    sceneChanges[i] = { kind: 'added', at: r.at, text: `Ajustado: ${r.text.slice(2)}` };
    sceneChanges.splice(j, 1);
    if (j < i) i--;
  }
  sceneChanges.sort((a, b) => a.at! - b.at! || (a.kind === 'removed' ? -1 : 1));

  // Elementos e ajustes manuais pertencem à composição, mesmo que não alterem cenas geradas.
  // Sem isto, guardar A, adicionar um título B e comparar/restaurar A exibia "Nada mudou".
  const manualChanges: PlanChange[] = [];
  const oldAdded = new Map(before.edits.added.map((el) => [el.id, el]));
  const newAdded = new Map(after.edits.added.map((el) => [el.id, el]));
  const changedElement = (kind: ChangeKind, text: string, plan: EditPlan, el: AddedElement) => {
    const start = sourceToOutputClamped(plan.segments, el.srcStart);
    const end = sourceToOutputClamped(plan.segments, el.srcEnd);
    manualChanges.push({ kind, at: start, text: `${text} em ${fmt(start)}` });
    times.push(start, end);
  };
  for (const el of after.edits.added) {
    const old = oldAdded.get(el.id);
    if (!old) changedElement('added', `+ ${addedName(el)}`, after, el);
    else if (JSON.stringify(old) !== JSON.stringify(el)) changedElement('manual', `Ajustado: ${addedName(el)}`, after, el);
  }
  for (const el of before.edits.added) {
    if (!newAdded.has(el.id)) changedElement('removed', `− ${addedName(el)}`, before, el);
  }
  if (before.edits.added.map((el) => el.id).join('|') !== after.edits.added.map((el) => el.id).join('|')
    && oldAdded.size === newAdded.size && [...oldAdded.keys()].every((id) => newAdded.has(id))) {
    manualChanges.push({ kind: 'manual', at: null, text: 'Ordem das camadas alterada' });
  }
  const manualFields: { label: string; old: unknown; next: unknown }[] = [
    { label: 'Posição geral das legendas', old: before.edits.captionPlacement, next: after.edits.captionPlacement },
    { label: 'Aparência das legendas', old: before.edits.captionLook, next: after.edits.captionLook },
    { label: 'Ajustes individuais das legendas', old: before.edits.captions, next: after.edits.captions },
    { label: 'Ajustes manuais das animações', old: before.edits.scenes, next: after.edits.scenes },
    { label: 'Enquadramento manual', old: before.edits.video, next: after.edits.video },
    { label: 'Zooms manuais', old: before.edits.zooms, next: after.edits.zooms },
    { label: 'Máscara de vídeo', old: before.edits.mask ?? null, next: after.edits.mask ?? null },
    { label: 'Ordem e enquadramento dos clipes', old: before.clips, next: after.clips },
    { label: 'Formato de saída', old: before.output, next: after.output },
    { label: 'Enquadramento automático', old: before.framing, next: after.framing },
    { label: 'Música de fundo', old: before.music ?? null, next: after.music ?? null },
    { label: 'Direção criativa', old: before.brief, next: after.brief },
  ];
  for (const field of manualFields) {
    if (JSON.stringify(field.old) !== JSON.stringify(field.next)) {
      manualChanges.push({ kind: 'manual', at: null, text: `Alteração em: ${field.label.toLowerCase()}` });
    }
  }

  // legendas: pelo id; texto corrigido aparece um a um, tempos só no total
  const capBefore = new Map(before.captions.map((c) => [c.id, c]));
  const capChanges: PlanChange[] = [];
  let retimed = 0;
  let firstRetimed: number | null = null;
  for (const c of after.captions) {
    const old = capBefore.get(c.id);
    if (!old) continue;
    if (old.text !== c.text) {
      capChanges.push({ kind: 'caption', at: c.start, text: `Legenda em ${fmt(c.start)}: ${quote(old.text)} → ${quote(c.text)}` });
      times.push(c.start, c.end);
    } else if (old.start !== c.start || old.end !== c.end || old.wordIds.join('|') !== c.wordIds.join('|')) {
      retimed++;
      firstRetimed ??= c.start;
    }
  }
  const added = after.captions.length - before.captions.filter((c) => after.captions.some((a) => a.id === c.id)).length;
  if (retimed > 0 || added > 0 || after.captions.length !== before.captions.length) {
    capChanges.push({ kind: 'caption', at: firstRetimed, text: `Legendas reagrupadas ou com tempo novo (${before.captions.length} → ${after.captions.length} legendas)` });
  }

  const all = [...changes, ...sceneChanges, ...manualChanges, ...capChanges];
  const shown = all.slice(0, MAX_CHANGES);
  if (all.length > MAX_CHANGES) shown.push({ kind: 'added', at: null, text: `… e mais ${all.length - MAX_CHANGES} mudanças` });
  return { changes: shown, span: times.length ? { start: Math.min(...times), end: Math.max(...times) } : null };
}
