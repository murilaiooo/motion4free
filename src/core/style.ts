import { z } from 'zod';

/**
 * StyleDNA: a "identidade visual" de um vídeo, só com parâmetros (nada de código).
 * Cada cena e a legenda leem estes campos; nenhum desenho pergunta "qual preset é este".
 * Isso permite que, na Fase 4, a IA proponha um StyleDNA novo que passe por este esquema.
 * Tamanhos em pixels são relativos a um quadro de 1080 px de largura.
 */
export const STYLE_VERSION = 1;

/** Só fontes com licença livre (OFL) que acompanham o app. Ver docs/licencas.md. */
export const FONT_FAMILIES = ['Instrument Serif', 'Inter', 'Anton', 'Montserrat', 'IBM Plex Sans', 'IBM Plex Sans Condensed', 'IBM Plex Mono'] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

/** Pesos e estilos disponíveis de cada família (os arquivos que o app carrega). */
export const FONT_FILES: Record<FontFamily, { weight: number; style: 'normal' | 'italic' }[]> = {
  'Instrument Serif': [
    { weight: 400, style: 'normal' },
    { weight: 400, style: 'italic' },
  ],
  Inter: [500, 600, 700, 800].map((weight) => ({ weight, style: 'normal' as const })),
  Anton: [{ weight: 400, style: 'normal' }],
  Montserrat: [700, 800, 900].map((weight) => ({ weight, style: 'normal' as const })),
  'IBM Plex Sans': [500, 600, 700].map((weight) => ({ weight, style: 'normal' as const })),
  'IBM Plex Sans Condensed': [600, 700].map((weight) => ({ weight, style: 'normal' as const })),
  'IBM Plex Mono': [500, 600].map((weight) => ({ weight, style: 'normal' as const })),
};

const color = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'cor deve ser #RRGGBB ou #RRGGBBAA');

const font = z
  .object({
    family: z.enum(FONT_FAMILIES),
    weight: z.number().int().min(100).max(900),
    style: z.enum(['normal', 'italic']),
    /** 'upper' = sempre em maiúsculas. */
    case: z.enum(['upper', 'none']),
    /** espaçamento entre letras, em fração do tamanho da fonte */
    tracking: z.number().min(-0.1).max(0.4),
  })
  .refine((f) => FONT_FILES[f.family].some((x) => x.weight === f.weight && x.style === f.style), { message: 'peso/estilo de fonte não disponível' });

export const styleSchema = z.object({
  version: z.literal(STYLE_VERSION),
  id: z.string().regex(/^[a-z0-9-]{1,32}$/),
  name: z.string().min(1).max(40),
  palette: z.object({
    /** texto principal sobre o vídeo */
    text: color,
    /** texto secundário (rótulos, palavras ainda não faladas) */
    muted: color,
    accent: color,
    /** segunda cor de destaque (palavra-chave) */
    accent2: color,
    /** fundo de caixas/painéis */
    panel: color,
    /** texto sobre o painel ou sobre a cor de destaque */
    onPanel: color,
    /** gradiente escuro atrás das legendas (legibilidade); alfa no próprio valor */
    scrim: color,
    shadow: color,
  }),
  type: z.object({
    display: font,
    text: font,
    emphasis: font,
    label: font,
    /** multiplicador do tamanho dos títulos */
    scale: z.number().min(0.6).max(1.6),
  }),
  motion: z.object({
    enter: z.enum(['rise', 'pop', 'wipe']),
    ease: z.enum(['smooth', 'snappy', 'gentle']),
    inSec: z.number().min(0.05).max(1.2),
    outSec: z.number().min(0.05).max(1),
    /** 0 = quase parado, 1 = muito movimento (distância, overshoot, rotação) */
    intensity: z.number().min(0).max(1),
    /** atraso entre palavras/itens que entram em sequência */
    staggerSec: z.number().min(0).max(0.3),
  }),
  rhythm: z.object({
    overlaysPer10s: z.number().min(0).max(4),
    minGapSec: z.number().min(0).max(10),
    keywordEverySec: z.number().min(0.5).max(60),
    zoomEverySec: z.number().min(1).max(120),
    titleSec: z.number().min(0.8).max(5),
    sceneSec: z.number().min(0.8).max(5),
  }),
  shape: z.object({
    /** raio dos cantos, em fração da altura da caixa (0 = reto, 0.5 = pílula) */
    radius: z.number().min(0).max(0.5),
    stroke: z.number().min(0).max(24),
    shadow: z.enum(['none', 'soft', 'hard']),
    panel: z.enum(['none', 'box']),
  }),
  layout: z.object({
    align: z.enum(['center', 'left']),
    /** centro vertical das cenas, em fração da área segura */
    overlayY: z.number().min(0).max(1),
  }),
  captions: z.object({
    position: z.enum(['bottom', 'middle']),
    /** tamanho da fonte em fração da largura */
    size: z.number().min(0.04).max(0.12),
    maxChars: z.number().int().min(8).max(60),
    maxWords: z.number().int().min(1).max(12),
    maxLines: z.number().int().min(1).max(3),
    /** como a palavra falada aparece: caixa colorida, cor de destaque, sublinhado ou "revelação" (já faladas acesas, próximas apagadas) */
    highlight: z.enum(['box', 'color', 'underline', 'reveal']),
    /** caixa atrás da linha inteira */
    box: z.enum(['none', 'line']),
    stroke: z.number().min(0).max(24),
    /** opacidade das palavras que ainda não foram faladas */
    upcomingAlpha: z.number().min(0).max(1),
    /** palavra falada cresce um pouco (1 = não cresce) */
    activeScale: z.number().min(1).max(1.4),
  }),
  transition: z.enum(['zoom', 'flash', 'dip', 'none']),
  progress: z.enum(['none', 'line', 'bar']),
  zoomScale: z.number().min(1).max(1.3),
  cta: z.string().min(1).max(32),
});

export type StyleDNA = z.infer<typeof styleSchema>;
export type FontSpec = StyleDNA['type']['display'];

/** String CSS de fonte para o canvas, com reserva do sistema caso a fonte não carregue. */
export function cssFont(f: Pick<FontSpec, 'family' | 'weight' | 'style'>, sizePx: number): string {
  const fallback = f.family === 'Instrument Serif' ? 'Georgia, serif' : f.family === 'IBM Plex Mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
  return `${f.style === 'italic' ? 'italic ' : ''}${f.weight} ${Math.round(sizePx * 100) / 100}px "${f.family}", ${fallback}`;
}

/** Famílias/pesos que um estilo usa (para carregar só o necessário). */
export function fontsOf(style: StyleDNA): Pick<FontSpec, 'family' | 'weight' | 'style'>[] {
  const all = [style.type.display, style.type.text, style.type.emphasis, style.type.label];
  const seen = new Set<string>();
  return all
    .filter((f) => {
      const k = `${f.family}|${f.weight}|${f.style}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(({ family, weight, style: s }) => ({ family, weight, style: s }));
}
