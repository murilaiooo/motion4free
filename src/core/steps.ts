/** Passos mostrados na tela de processamento (v0.10). A mensagem de progresso diz em qual estamos. */
export const PROCESSING_STEPS = [
  { id: 'abrir', label: 'Abrindo o vídeo e o áudio' },
  { id: 'silencios', label: 'Cortando os silêncios' },
  { id: 'fala', label: 'Transcrevendo a fala' },
  { id: 'estilo', label: 'Montando legendas e estilo' },
] as const;

export function processingStep(label: string): number {
  const l = label.toLowerCase();
  if (l.includes('silêncio')) return 1;
  if (l.includes('transcr') || l.includes('modelo')) return 2;
  if (l.includes('montando')) return 3;
  return 0;
}
