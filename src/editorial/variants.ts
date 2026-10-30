import type { EditPlan } from '../core/types';
import { templateById } from '../core/templates';
import { findHooks } from './hooks';
import { applyHook, applyStyle, type EditContext } from './ops';

/**
 * Variações do mesmo vídeo para comparar (issue #118). Cada variação parte do plano ATUAL (cortes,
 * correções de legenda, elementos e travas continuam), muda a direção visual para uma família bem
 * diferente e, quando a fala oferece, abre com outro gancho. Nada é inventado: o gancho é sempre uma
 * frase da própria fala. O vídeo original e o plano atual não mudam; cada variação vira uma versão.
 */
export interface PlanVariant {
  /** rótulo curto para a pessoa: "Energética · Pop" */
  name: string;
  /** por que é diferente, em uma frase */
  why: string;
  plan: EditPlan;
}

const DIRECTIONS: { label: string; why: string; styles: string[] }[] = [
  { label: 'Energética', why: 'letras grandes, cores fortes e mais movimento', styles: ['pop', 'impacto', 'neon', 'turbo'] },
  { label: 'Elegante', why: 'tipografia de revista, ritmo calmo e poucas animações', styles: ['editorial', 'luxo', 'minimal', 'cinema'] },
  { label: 'Direta', why: 'visual sóbrio, foco na informação, quase sem efeitos', styles: ['documental', 'podcast', 'jornal', 'tutorial'] },
];

export function makeVariants(plan: EditPlan, ctx: EditContext, count = 3): PlanVariant[] {
  const hooks = findHooks(ctx.words, 4);
  const currentHook = plan.brief.hook?.wordIds.join('|') ?? null;
  const otherHooks = hooks.filter((h) => h.wordIds.join('|') !== currentHook);
  const out: PlanVariant[] = [];
  for (const [i, direction] of DIRECTIONS.slice(0, count).entries()) {
    const styleId = direction.styles.find((id) => id !== plan.style.id && templateById(id)) ?? direction.styles[0]!;
    let next = applyStyle(plan, ctx, styleId);
    // Primeira variação mantém o gancho atual (compara só o visual); as outras testam outra abertura.
    const hook = i === 0 ? null : otherHooks[i - 1] ?? null;
    if (hook) next = applyHook(next, ctx, { text: hook.text, wordIds: hook.wordIds });
    const styleName = templateById(styleId)?.name ?? styleId;
    out.push({
      name: `${direction.label} · ${styleName}`,
      why: `${direction.why}${hook ? `; abre com “${hook.text.length > 50 ? `${hook.text.slice(0, 48)}…` : hook.text}”` : ''}.`,
      plan: next,
    });
  }
  return out;
}
