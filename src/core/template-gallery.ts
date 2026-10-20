import type { StyleDNA } from './style';
import { TAG_LABELS, TEMPLATES, TEMPLATE_TAGS } from './templates';

/**
 * Adaptador da galeria de modelos (v0.10): a tela só conhece `TemplateInfo`. Os dados vêm do registro
 * de modelos (`templates.ts`, ADR-0014); aqui as etiquetas viram rótulos em português, na ordem do registro.
 */
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  /** rótulos em português (ex.: "Energético") */
  tags: string[];
  style: StyleDNA;
}

export function listTemplates(): TemplateInfo[] {
  return TEMPLATES.map((tp) => ({
    id: tp.id,
    name: tp.name,
    description: tp.description,
    tags: tp.tags.map((tag) => TAG_LABELS[tag]),
    style: tp.style,
  }));
}

/** Etiquetas usadas por algum modelo da lista, na ordem do registro (as desconhecidas vão no fim). */
export function templateTags(list: TemplateInfo[]): string[] {
  const used = new Set(list.flatMap((t) => t.tags));
  const known = TEMPLATE_TAGS.map((tag) => TAG_LABELS[tag]).filter((label) => used.has(label));
  return [...known, ...[...used].filter((label) => !known.includes(label))];
}

export function filterTemplates(list: TemplateInfo[], tag: string | null): TemplateInfo[] {
  return tag ? list.filter((t) => t.tags.includes(tag)) : list;
}
