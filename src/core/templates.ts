import { PRESETS } from './presets';
import type { StyleDNA } from './style';

/**
 * Adaptador da galeria de modelos (v0.10): a tela só conhece `TemplateInfo`. Hoje vem da lista de
 * estilos; quando existir um registro de modelos, só esta função muda.
 */
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  style: StyleDNA;
}

const ABOUT: Record<string, { description: string; tags: string[] }> = {
  pop: { description: 'Energético: letras grandes, palavra falada em destaque amarelo, cortes com flash e muitas animações.', tags: ['Energético', 'Caixa de destaque'] },
  neon: { description: 'Limpo e atual: letras brancas grossas, poucas palavras por vez e a palavra falada acendendo em verde.', tags: ['Limpo', 'Energético'] },
  editorial: { description: 'Elegante: letra de revista, legenda que acende palavra por palavra, movimento lento e poucas animações.', tags: ['Elegante', 'Calmo'] },
  documental: { description: 'Sóbrio: painéis escuros à esquerda, letra técnica, quase sem movimento.', tags: ['Sóbrio', 'Calmo'] },
};

export function listTemplates(): TemplateInfo[] {
  return PRESETS.map((style) => ({
    id: style.id,
    name: style.name,
    description: ABOUT[style.id]?.description ?? style.name,
    tags: ABOUT[style.id]?.tags ?? ['Outros'],
    style,
  }));
}

export function templateTags(list: TemplateInfo[]): string[] {
  return [...new Set(list.flatMap((t) => t.tags))];
}

export function filterTemplates(list: TemplateInfo[], tag: string | null): TemplateInfo[] {
  return tag ? list.filter((t) => t.tags.includes(tag)) : list;
}
