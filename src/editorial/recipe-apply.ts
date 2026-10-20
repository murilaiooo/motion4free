import type { CreativeBrief } from '../core/brief';
import { ctaText } from '../core/cta';
import { mergeLook } from '../core/look';
import { RECIPES } from '../core/recipes';
import { BLOCKS, enforceForbid } from './ai-brief';

/**
 * Receita do nicho por baixo do pedido (v0.12, ADR-0017). Campo que o pedido já disse fica como está;
 * campo vazio recebe o da receita. Proibições continuam vencendo (inclusive sobre a receita: "sem emojis"
 * tira os emojis da receita de beleza; "sem chamada" tira a chamada final). Pura e determinística.
 */
export function withRecipe(brief: CreativeBrief): CreativeBrief {
  if (!brief.niche) return brief;
  const R = RECIPES[brief.niche];
  const forbid = brief.forbid;
  const register = brief.register ?? R.register;
  const noTitle = forbid.includes('titulo') || forbid.includes('textos');
  const emphasize = [...brief.emphasize];
  for (const e of R.emphasize) if (!emphasize.includes(e) && !BLOCKS[e].some((p) => forbid.includes(p)) && brief.look.scenes?.[EMPHASIS_SCENE[e]] !== false) emphasize.push(e);
  const recipeLook = { ...R.look, ...(forbid.includes('chamada') || brief.look.scenes?.chamada === false ? {} : { cta: ctaText(R.cta, register) }) };
  // o pedido vale mais campo a campo; emojis da receita só entram se o pedido não falou de emojis
  const merged = mergeLook(recipeLook, brief.look);
  if (brief.look.emoji) merged.emoji = brief.look.emoji;
  const { look } = enforceForbid(merged, forbid);
  return {
    ...brief,
    preset: brief.preset ?? R.template,
    tone: brief.tone ?? R.tone,
    goal: brief.goal ?? R.goal,
    pace: brief.pace ?? R.pace,
    intensity: brief.intensity ?? (forbid.includes('efeitos') ? 'baixa' : R.intensity),
    hookStyle: brief.hookStyle ?? R.hookStyle,
    wantsHook: brief.wantsHook || !noTitle,
    register,
    emphasize,
    look,
  };
}

const EMPHASIS_SCENE = { numeros: 'numeros', palavras: 'destaques', perguntas: 'perguntas', listas: 'listas', nome: 'nome' } as const;
