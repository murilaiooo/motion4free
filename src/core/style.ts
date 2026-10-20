import { z } from 'zod';

/**
 * StyleDNA: a "identidade visual" de um vídeo, só com parâmetros (nada de código).
 * Cada cena e a legenda leem estes campos; nenhum desenho pergunta "qual preset é este".
 * Isso permite que, na Fase 4, a IA proponha um StyleDNA novo que passe por este esquema.
 * Tamanhos em pixels são relativos a um quadro de 1080 px de largura.
 */
export const STYLE_VERSION = 2;

/** Só fontes com licença livre (OFL) que acompanham o app. Ver docs/licencas.md. */
export const FONT_FAMILIES = [
  'Instrument Serif',
  'Inter',
  'Anton',
  'Montserrat',
  'IBM Plex Sans',
  'IBM Plex Sans Condensed',
  'IBM Plex Mono',
  // v0.9 (modelos): todas OFL-1.1, ver docs/licencas.md
  'Archivo Black',
  'DM Sans',
  'Space Grotesk',
  'Nunito',
  'Cormorant Garamond',
  'Oswald',
  'VT323',
  'Bungee',
  'Rubik',
  'Courier Prime',
  'Caveat',
  'Kalam',
  'Playfair Display',
] as const;
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
  'Archivo Black': [{ weight: 400, style: 'normal' }],
  'DM Sans': [500, 700].map((weight) => ({ weight, style: 'normal' as const })),
  'Space Grotesk': [500, 700].map((weight) => ({ weight, style: 'normal' as const })),
  Nunito: [800, 900].map((weight) => ({ weight, style: 'normal' as const })),
  'Cormorant Garamond': [
    { weight: 500, style: 'normal' },
    { weight: 600, style: 'normal' },
    { weight: 500, style: 'italic' },
  ],
  Oswald: [500, 700].map((weight) => ({ weight, style: 'normal' as const })),
  VT323: [{ weight: 400, style: 'normal' }],
  Bungee: [{ weight: 400, style: 'normal' }],
  Rubik: [
    { weight: 800, style: 'italic' },
    { weight: 900, style: 'italic' },
  ],
  'Courier Prime': [400, 700].map((weight) => ({ weight, style: 'normal' as const })),
  Caveat: [{ weight: 700, style: 'normal' }],
  Kalam: [{ weight: 700, style: 'normal' }],
  'Playfair Display': [
    { weight: 400, style: 'normal' },
    { weight: 400, style: 'italic' },
  ],
};

/** Famílias com serifa, monoespaçadas e manuscritas (reserva do sistema enquanto a fonte não carrega). */
const SERIF_FAMILIES: ReadonlySet<FontFamily> = new Set(['Instrument Serif', 'Cormorant Garamond', 'Playfair Display']);
const MONO_FAMILIES: ReadonlySet<FontFamily> = new Set(['IBM Plex Mono', 'VT323', 'Courier Prime']);
const HAND_FAMILIES: ReadonlySet<FontFamily> = new Set(['Caveat', 'Kalam']);

const color = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'cor deve ser #RRGGBB ou #RRGGBBAA');

/** Caixa das letras: 'upper' = sempre maiúsculas, 'lower' = sempre minúsculas (v2), 'none' = como foi escrito. */
export const LETTER_CASES = ['upper', 'lower', 'none'] as const;

const fontFields = {
  family: z.enum(FONT_FAMILIES),
  weight: z.number().int().min(100).max(900),
  style: z.enum(['normal', 'italic']),
  /** espaçamento entre letras, em fração do tamanho da fonte */
  tracking: z.number().min(-0.1).max(0.4),
};
const fontOk = (f: { family: FontFamily; weight: number; style: 'normal' | 'italic' }) => FONT_FILES[f.family].some((x) => x.weight === f.weight && x.style === f.style);

const fontV1 = z
  .object({
    ...fontFields,
    /** 'upper' = sempre em maiúsculas. */
    case: z.enum(['upper', 'none']),
  })
  .refine(fontOk, { message: 'peso/estilo de fonte não disponível' });

const font = z
  .object({
    ...fontFields,
    case: z.enum(LETTER_CASES),
  })
  .refine(fontOk, { message: 'peso/estilo de fonte não disponível' });

/** Entrada da legenda (v2). 'auto' = a entrada do estilo (como na v1). */
export const CAPTION_ANIMATIONS = ['auto', 'none', 'fade', 'pop', 'rise', 'slide', 'bounce', 'typewriter'] as const;
export type CaptionAnimation = (typeof CAPTION_ANIMATIONS)[number];

/** Posição da legenda: 'middle' (v1) fica no terço de baixo; 'center' é o meio da tela; 'custom' usa `y`. */
export const CAPTION_POSITIONS = ['top', 'center', 'middle', 'bottom', 'custom'] as const;

export const EMOJI_MODES = ['off', 'interval', 'keywords'] as const;
export type EmojiMode = (typeof EMOJI_MODES)[number];
/** 'auto' = longe da legenda (em cima dela quando ela está embaixo; embaixo quando ela está em cima). */
export const EMOJI_POSITIONS = ['auto', 'top', 'middle', 'bottom', 'left', 'right'] as const;
export const EMOJI_ANIMATIONS = ['pop', 'bounce', 'float', 'spin', 'fade', 'none'] as const;
export const TRANSITIONS = ['zoom', 'flash', 'dip', 'none'] as const;

/**
 * Entradas das cenas: rise (máscara que sobe), pop (mola), wipe (cortina) e, desde a v0.9, slide (desliza
 * da esquerda e sai pela direita), drop (cai de cima e quica), zoom (assenta de um pouco maior, cinema) e
 * type (aparece letra a letra, como digitando).
 */
export const MOTION_ENTERS = ['rise', 'pop', 'wipe', 'slide', 'drop', 'zoom', 'type'] as const;
export type MotionEnter = (typeof MOTION_ENTERS)[number];
/** Destaque da palavra falada; 'marker' (v0.9) = traço de marca-texto desenhado atrás da palavra. */
export const CAPTION_HIGHLIGHTS = ['box', 'color', 'underline', 'reveal', 'marker'] as const;
/** Caixa da legenda: nenhuma, uma por linha ou, desde a v0.9, uma por palavra ('word'). */
export const CAPTION_BOXES = ['none', 'line', 'word'] as const;

/** Moldura do título e da chamada final (v0.9); 'auto' = a composição do estilo (só tipografia, adesivo, cartão). */
export const TITLE_DECORS = ['auto', 'frame', 'corners', 'band', 'marker'] as const;
/** Selo no canto de cima: rótulo, "ao vivo" (ponto que pisca) ou gravação (ponto + tempo do vídeo). */
export const TAG_KINDS = ['none', 'label', 'live', 'rec'] as const;
/** Marcador dos itens das listas. */
export const LIST_MARKERS = ['number', 'circle'] as const;

/**
 * Acabamento do quadro (v0.9, ADR-0014). Tudo desligado por padrão: estilos e projetos antigos ficam iguais.
 * Cada campo é um número com limite, um valor fechado ou uma cor; nada é código.
 */
export const DECOR_OFF = {
  title: 'auto',
  /** faixas pretas de cinema, em fração da altura (cada uma) */
  letterbox: 0,
  /** escurecimento das bordas */
  vignette: 0,
  /** linhas de TV antiga */
  scanlines: 0,
  /** separação de cores (vermelho/ciano) nas letras da legenda e dos títulos */
  chroma: 0,
  /** tremor de fita na legenda (segue a intensidade do movimento) */
  jitter: 0,
  /** véu de cor sobre o vídeo (#RRGGBBAA; alfa 0 = nenhum) */
  tint: '#00000000',
  tag: 'none',
  tagText: '',
  /** faixa de manchetes correndo embaixo (frases das cenas do próprio vídeo) */
  ticker: false,
  /** cursor de digitação depois da última palavra que apareceu */
  cursor: false,
  listMarker: 'number',
  /** palavra falada e palavra-chave pintadas em degradê (destaque → segundo destaque) */
  gradient: false,
} as const;

/** Marca desligada (v0.12): sem @ no canto, palavra-chave na cor do estilo. */
export const BRAND_OFF = { handle: null, keyword: null } as const;

/** Emojis desligados: o que os estilos e os planos antigos (v1) usam. */
export const EMOJI_OFF = { mode: 'off', everySec: 3, position: 'auto', size: 0.14, animation: 'pop' } as const;
/** Cores próprias da legenda desligadas (null = cor do estilo). */
export const CAPTION_COLORS_DEFAULT = { text: null, highlight: null, stroke: null, box: null } as const;

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
    enter: z.enum(MOTION_ENTERS),
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
    position: z.enum(CAPTION_POSITIONS),
    /** centro vertical da legenda em fração da área segura (só com position 'custom') */
    y: z.number().min(0).max(1),
    /** tamanho da fonte em fração da largura */
    size: z.number().min(0.03).max(0.16),
    maxChars: z.number().int().min(8).max(60),
    maxWords: z.number().int().min(1).max(12),
    maxLines: z.number().int().min(1).max(3),
    /** como a palavra falada aparece: caixa colorida, cor de destaque, sublinhado ou "revelação" (já faladas acesas, próximas apagadas) */
    highlight: z.enum(CAPTION_HIGHLIGHTS),
    /** caixa atrás da linha inteira ('line') ou de cada palavra ('word') */
    box: z.enum(CAPTION_BOXES),
    stroke: z.number().min(0).max(24),
    /** opacidade das palavras que ainda não foram faladas */
    upcomingAlpha: z.number().min(0).max(1),
    /** palavra falada cresce um pouco (1 = não cresce) */
    activeScale: z.number().min(1).max(1.4),
    /** entrada da legenda */
    enter: z.enum(CAPTION_ANIMATIONS),
    /** palavras por linha (0 = automático pela largura) */
    wordsPerLine: z.number().int().min(0).max(6),
    /** cores próprias da legenda; null = a do estilo (texto, destaque, contorno, caixa) */
    colors: z.object({ text: color.nullable(), highlight: color.nullable(), stroke: color.nullable(), box: color.nullable() }),
  }),
  /** emojis desenhados perto da fala (v2) */
  emoji: z.object({
    mode: z.enum(EMOJI_MODES),
    /** no modo 'interval': um emoji a cada N segundos */
    everySec: z.number().min(1).max(30),
    position: z.enum(EMOJI_POSITIONS),
    /** tamanho em fração da largura do quadro */
    size: z.number().min(0.06).max(0.3),
    animation: z.enum(EMOJI_ANIMATIONS),
  }),
  transition: z.enum(TRANSITIONS),
  progress: z.enum(['none', 'line', 'bar']),
  zoomScale: z.number().min(1).max(1.3),
  cta: z.string().min(1).max(32),
  /** acabamento do quadro (v0.9); ausente nos projetos antigos = tudo desligado */
  decor: z
    .object({
      title: z.enum(TITLE_DECORS),
      letterbox: z.number().min(0).max(0.16),
      vignette: z.number().min(0).max(1),
      scanlines: z.number().min(0).max(1),
      chroma: z.number().min(0).max(1),
      jitter: z.number().min(0).max(1),
      tint: color,
      tag: z.enum(TAG_KINDS),
      tagText: z.string().max(18),
      ticker: z.boolean(),
      cursor: z.boolean(),
      listMarker: z.enum(LIST_MARKERS),
      gradient: z.boolean(),
    })
    .default(() => ({ ...DECOR_OFF })),
  /** marca da pessoa (v0.12): @ no canto e cor das palavras-chave; ausente (estilos do registro e projetos antigos) = nada */
  brand: z
    .object({
      handle: z.string().regex(/^@[a-z0-9._]{2,30}$/).nullable(),
      keyword: color.nullable(),
    })
    .optional(),
});

export type StyleDNA = z.infer<typeof styleSchema>;

/** StyleDNA v1 (até a v0.5): sem emojis, sem cores próprias da legenda e sem posição/entrada extra. */
export const styleV1Schema = styleSchema.extend({
  version: z.literal(1),
  type: z.object({ display: fontV1, text: fontV1, emphasis: fontV1, label: fontV1, scale: z.number().min(0.6).max(1.6) }),
  captions: styleSchema.shape.captions.omit({ y: true, enter: true, wordsPerLine: true, colors: true }).extend({ position: z.enum(['bottom', 'middle']), size: z.number().min(0.04).max(0.12) }),
}).omit({ emoji: true, decor: true, brand: true });
export type StyleV1 = z.infer<typeof styleV1Schema>;

/** v1 → v2: os campos novos começam com o comportamento antigo (nada muda na tela). */
export function migrateStyle(v1: StyleV1): StyleDNA {
  return {
    ...v1,
    version: STYLE_VERSION,
    captions: { ...v1.captions, y: 0.5, enter: 'auto', wordsPerLine: 0, colors: { ...CAPTION_COLORS_DEFAULT } },
    emoji: { ...EMOJI_OFF },
    decor: { ...DECOR_OFF },
  };
}
export type FontSpec = StyleDNA['type']['display'];

/** String CSS de fonte para o canvas, com reserva do sistema caso a fonte não carregue. */
export function cssFont(f: Pick<FontSpec, 'family' | 'weight' | 'style'>, sizePx: number): string {
  const fallback = SERIF_FAMILIES.has(f.family) ? 'Georgia, serif' : MONO_FAMILIES.has(f.family) ? 'ui-monospace, monospace' : HAND_FAMILIES.has(f.family) ? 'cursive' : 'system-ui, sans-serif';
  return `${f.style === 'italic' ? 'italic ' : ''}${f.weight} ${Math.round(sizePx * 100) / 100}px "${f.family}", ${fallback}`;
}

/** Peso disponível da família mais perto do pedido (empate: o mais forte). */
export function nearestWeight(family: FontFamily, weight: number, style: 'normal' | 'italic' = 'normal'): { weight: number; style: 'normal' | 'italic' } {
  const files = FONT_FILES[family];
  const same = files.filter((f) => f.style === style);
  const pool = same.length ? same : files;
  const best = [...pool].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || b.weight - a.weight)[0]!;
  return { weight: best.weight, style: best.style };
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
