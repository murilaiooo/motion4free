/** Conservative lexical signals; these are review flags, not semantic confidence. */
export type ContextFlag = 'negation' | 'conditional' | 'comparison' | 'reference';
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const wordsOf = (text: string) => normalize(text).match(/[a-z]+/g) ?? [];
export function contextFlags(text: string): ContextFlag[] {
  const ws = new Set(wordsOf(text));
  const flags: ContextFlag[] = [];
  if (['nao', 'nunca', 'jamais', 'nem', 'sem', 'not', 'never', 'without', 'no'].some(w => ws.has(w))) flags.push('negation');
  if (['se', 'caso', 'talvez', 'poderia', 'depende', 'if', 'unless', 'might', 'could'].some(w => ws.has(w))) flags.push('conditional');
  if (['menos', 'mais', 'melhor', 'pior', 'versus', 'than', 'less', 'more'].some(w => ws.has(w))) flags.push('comparison');
  if (/^(isso|isto|aquilo|esse|essa|esses|essas|ele|ela|eles|elas|mas|portanto|porem|this|that|these|those|but|therefore)\b/.test(wordsOf(text).join(' '))) flags.push('reference');
  return flags;
}
export const CONTEXT_LABELS: Record<ContextFlag, string> = {
  negation: 'Há negação ou ausência na fala; confira se o destaque preserva o sentido.',
  conditional: 'Há condição ou hipótese; confira a ressalva.',
  comparison: 'Há comparação; confira os dois lados e suas unidades.',
  reference: 'A frase pode depender de contexto anterior.',
};
