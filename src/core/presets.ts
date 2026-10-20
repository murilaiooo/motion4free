import type { StyleDNA } from './style';
import { TEMPLATES } from './templates';

/**
 * Estilos prontos: o StyleDNA de cada modelo do registro (`templates.ts`), na mesma ordem.
 * Os parâmetros de cada um ficam em `template-styles.ts`; nome, frase e etiquetas, no registro.
 */
export { CINEMA, DATILOGRAFIA, DOCUMENTAL, EDITORIAL, IMPACTO, JORNAL, LUXO, MARCA_TEXTO, MINIMAL, NEON, PODCAST, POP, RETRO, TURBO, TUTORIAL } from './template-styles';
import { POP } from './template-styles';

export const PRESETS: readonly StyleDNA[] = TEMPLATES.map((t) => t.style);
/** Estilo dos projetos novos e dos projetos antigos (v1) ao abrir. */
export const DEFAULT_STYLE = POP;

export function presetById(id: string): StyleDNA | undefined {
  return PRESETS.find((p) => p.id === id);
}
