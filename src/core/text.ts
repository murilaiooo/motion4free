/** Textos curtos da tela, com o número concordando (1 legenda, 2 legendas). */
export function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "2 trechos · 3 legendas · 12 palavras reconhecidas" */
export function planSummary(segments: number, captions: number, words: number): string {
  return [count(segments, 'trecho', 'trechos'), count(captions, 'legenda', 'legendas'), count(words, 'palavra reconhecida', 'palavras reconhecidas')].join(' · ');
}
