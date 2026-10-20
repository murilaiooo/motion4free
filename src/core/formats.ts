import type { OutputProfile } from './types';

/**
 * Formatos de saída (v0.14). A pessoa escolhe ao enviar e pode trocar depois; qualquer vídeo de
 * origem (deitado, em pé, quadrado) entra em qualquer formato pelo enquadramento (src/render/framing.ts).
 * Lado curto sempre 1080 px: é a resolução que Instagram, TikTok e YouTube usam sem reamostrar.
 */
export const OUTPUT_FORMATS = {
  vertical: { id: 'vertical', label: 'Vertical', ratio: '9:16', width: 1080, height: 1920, use: 'Reels, TikTok, Shorts' },
  retrato: { id: 'retrato', label: 'Retrato', ratio: '4:5', width: 1080, height: 1350, use: 'Feed do Instagram' },
  quadrado: { id: 'quadrado', label: 'Quadrado', ratio: '1:1', width: 1080, height: 1080, use: 'Feed, anúncios' },
  horizontal: { id: 'horizontal', label: 'Horizontal', ratio: '16:9', width: 1920, height: 1080, use: 'YouTube, TV, computador' },
} as const;

export type OutputFormatId = keyof typeof OUTPUT_FORMATS;
export const FORMAT_IDS = Object.keys(OUTPUT_FORMATS) as OutputFormatId[];
export const DEFAULT_FORMAT: OutputFormatId = 'vertical';

export function profileFor(id: OutputFormatId, fps = 30): OutputProfile {
  const f = OUTPUT_FORMATS[id];
  return { width: f.width, height: f.height, fps };
}

/** Formato de um tamanho de saída (o mais próximo pela proporção). */
export function formatOf(output: { width: number; height: number }): OutputFormatId {
  const r = output.width / output.height;
  let best: OutputFormatId = DEFAULT_FORMAT;
  let diff = Infinity;
  for (const id of FORMAT_IDS) {
    const f = OUTPUT_FORMATS[id];
    const d = Math.abs(Math.log(f.width / f.height / r));
    if (d < diff) {
      diff = d;
      best = id;
    }
  }
  return best;
}

export type Orientation = 'vertical' | 'horizontal' | 'quadrado';

/** Orientação de um vídeo de origem (para mostrar na lista de clipes). */
export function orientationOf(width: number, height: number): Orientation {
  if (width <= 0 || height <= 0) return 'vertical';
  const r = width / height;
  if (r > 1.1) return 'horizontal';
  if (r < 0.9) return 'vertical';
  return 'quadrado';
}

export function isFormatId(x: unknown): x is OutputFormatId {
  return typeof x === 'string' && x in OUTPUT_FORMATS;
}
