/** Conservative lexical signals; these are review flags, not semantic confidence. */
export type ContextFlag = 'negation' | 'conditional' | 'comparison' | 'reference';
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const wordsOf = (text: string) => normalize(text).match(/[a-z]+/g) ?? [];
export function contextFlags(text: string): ContextFlag[] {
  const ws = new Set(wordsOf(text));
  const flags: ContextFlag[] = [];
  // 'no' can be English negation or Portuguese em+o. Prefer a review flag when unclear.
  const portugueseNouns = new Set(['video', 'canal', 'projeto', 'exemplo', 'caso', 'dia', 'ano', 'mes', 'mundo', 'brasil', 'mercado', 'trabalho', 'passo', 'inicio', 'final', 'fim', 'primeiro', 'segundo', 'terceiro', 'nosso', 'seu', 'meu', 'momento', 'processo', 'curso', 'site', 'app', 'computador', 'navegador']);
  const tokens = wordsOf(text);
  const englishNo = tokens.some((word, i) => word === 'no' && (
    !portugueseNouns.has(tokens[i + 1] ?? '') ||
    /\b(?:is|are|was|were|will|would|has|have|available|discount|one|longer)\b/.test(tokens.slice(i + 1, i + 10).join(' '))
  ));
  if (englishNo || ['nao', 'nunca', 'jamais', 'nem', 'sem', 'not', 'never', 'without'].some(w => ws.has(w))) flags.push('negation');
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
