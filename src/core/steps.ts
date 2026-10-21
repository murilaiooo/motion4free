/** Passos mostrados na tela de processamento (v0.10). A mensagem de progresso diz em qual estamos. */
export const PROCESSING_STEPS = [
  { id: 'abrir', label: 'Abrindo o vídeo e o áudio' },
  { id: 'silencios', label: 'Cortando os silêncios' },
  { id: 'fala', label: 'Transcrevendo a fala' },
  { id: 'estilo', label: 'Montando legendas e estilo' },
] as const;

/** Em qual dos passos estamos. `phase` (v0.23) vale mais que o texto: "tentando outro modelo" também é transcrição. */
export function processingStep(label: string, phase?: string): number {
  if (phase) {
    if (/^(modelo|preparar|transcrever|reserva)-/.test(phase)) return 2;
    if (phase === 'silencios') return 1;
    if (phase === 'montar') return 3;
    if (phase === 'abrir' || phase === 'audio') return 0;
  }
  const l = label.toLowerCase();
  if (l.includes('silêncio')) return 1;
  if (l.includes('transcr') || l.includes('modelo')) return 2;
  if (l.includes('montando')) return 3;
  return 0;
}
