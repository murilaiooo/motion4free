import { z } from 'zod';
import { EMOJI_SET, type Emoji } from './emoji';
import { CAPTION_BOXES, CAPTION_HIGHLIGHTS, FONT_FAMILIES, FONT_FILES, LETTER_CASES, type FontFamily } from './style';

/**
 * Edição manual (v0.13, ADR-0018): tudo o que a pessoa mexe com as mãos no editor e que precisa
 * sobreviver quando o app refaz legendas e cenas (troca de modelo, pedido, cortes).
 *
 * As legendas e cenas continuam sendo geradas pelas palavras; estas edições ficam por cima e são
 * aplicadas na hora de desenhar (prévia e exportação usam a mesma `drawFrame`). Cada elemento é
 * achado por uma chave estável (legenda: id da primeira palavra; cena: tipo + instante no original),
 * então mover um título continua valendo depois de cortar um silêncio antes dele.
 *
 * Coordenadas sempre normalizadas: x e y são frações da largura e da altura do quadro (0 = esquerda/
 * topo, 1 = direita/baixo); tamanhos são multiplicadores; rotação em graus.
 */

export const TEXT_MAX = 120;
export const MAX_ADDED = 60;
export const MAX_EDITED = 400;
export const SCALE_LIMITS = { min: 0.25, max: 4 } as const;
export const VIDEO_SCALE = { min: 0.5, max: 3 } as const;
export const ZOOM_LIMITS = { min: 1.02, max: 1.6 } as const;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const time = z.number().finite().nonnegative();
const coord = z.number().min(-0.5).max(1.5);

/** Posição absoluta (legendas e elementos adicionados): centro do bloco no quadro. */
export const placementSchema = z.object({
  x: coord,
  y: coord,
  scale: z.number().min(SCALE_LIMITS.min).max(SCALE_LIMITS.max),
  rotate: z.number().min(-180).max(180),
});
export type Placement = z.infer<typeof placementSchema>;

/** Deslocamento de uma cena gerada (título, número, emoji…) a partir de onde o modelo a colocou. */
export const offsetSchema = z.object({
  dx: z.number().min(-1.5).max(1.5),
  dy: z.number().min(-1.5).max(1.5),
  scale: z.number().min(SCALE_LIMITS.min).max(SCALE_LIMITS.max),
  rotate: z.number().min(-180).max(180),
});
export type Offset = z.infer<typeof offsetSchema>;

/** Entradas que a pessoa escolhe para qualquer texto (as mesmas palavras da legenda). */
export const ELEMENT_ENTERS = ['auto', 'none', 'fade', 'pop', 'rise', 'slide', 'bounce', 'typewriter'] as const;
export type ElementEnter = (typeof ELEMENT_ENTERS)[number];
export const ELEMENT_EXITS = ['auto', 'none', 'fade', 'shrink'] as const;
export type ElementExit = (typeof ELEMENT_EXITS)[number];
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/**
 * Aparência de um texto (legenda, título, texto adicionado). Campo ausente = o modelo decide.
 * Só valores fechados, números com limite e cores #RRGGBB.
 */
export const textLookSchema = z
  .object({
    font: z.enum(FONT_FAMILIES),
    weight: z.number().int().min(100).max(900),
    italic: z.boolean(),
    text: hex,
    highlight: hex,
    stroke: hex,
    /** cor da caixa atrás do texto, ou 'none' = sem caixa */
    box: z.union([hex, z.literal('none')]),
    /** caixa por linha ou por palavra (legenda) */
    boxMode: z.enum(CAPTION_BOXES),
    strokeWidth: z.number().min(0).max(24),
    shadow: z.boolean(),
    case: z.enum(LETTER_CASES),
    align: z.enum(TEXT_ALIGNS),
    /** largura máxima da linha, em fração da largura do quadro */
    maxWidth: z.number().min(0.25).max(1),
    /** palavras por linha (0 = automático) */
    wordsPerLine: z.number().int().min(0).max(6),
    highlightMode: z.enum(CAPTION_HIGHLIGHTS),
    enter: z.enum(ELEMENT_ENTERS),
    exit: z.enum(ELEMENT_EXITS),
    /** força da animação (0 = quase parada, 1 = muita) */
    intensity: z.number().min(0).max(1),
  })
  .partial()
  .refine((l) => !l.font || l.weight === undefined || FONT_FILES[l.font].some((f) => f.weight === l.weight), { message: 'peso não disponível nesta fonte' });
export type TextLook = z.infer<typeof textLookSchema>;

const srcTiming = { srcStart: time.nullable(), srcEnd: time.nullable() };

export const captionEditSchema = z.object({
  placement: placementSchema.nullable(),
  look: textLookSchema,
  hidden: z.boolean(),
  ...srcTiming,
});
export type CaptionEdit = z.infer<typeof captionEditSchema>;

export const sceneEditSchema = z.object({
  hidden: z.boolean(),
  offset: offsetSchema.nullable(),
  look: textLookSchema,
  /** texto trocado (título, citação, chamada, número; lista = itens separados por quebra de linha) */
  text: z.string().min(1).max(TEXT_MAX).nullable(),
  ...srcTiming,
});
export type SceneEdit = z.infer<typeof sceneEditSchema>;

export const ADDED_KINDS = ['text', 'emoji', 'shape'] as const;
export type AddedKind = (typeof ADDED_KINDS)[number];
/** Texto comum ou título (letras do título do modelo, com caixa). */
export const TEXT_PRESETS = ['text', 'title'] as const;
export const SHAPES = ['arrow', 'circle', 'box'] as const;
export type Shape = (typeof SHAPES)[number];

/** Camadas de elementos adicionados (v0.18). */
export const MAX_TRACK = 9;
export const addedSchema = z
  .object({
    id: z.string().regex(/^e[0-9]{1,4}$/),
    kind: z.enum(ADDED_KINDS),
    preset: z.enum(TEXT_PRESETS),
    srcStart: time,
    srcEnd: time,
    placement: placementSchema,
    text: z.string().max(TEXT_MAX),
    emoji: z.enum(EMOJI_SET).nullable(),
    shape: z.enum(SHAPES).nullable(),
    look: textLookSchema,
    /** camada na linha do tempo (v0.18): maior fica por cima; ausente = 0 */
    track: z.number().int().min(0).max(MAX_TRACK).optional(),
  })
  .refine((e) => e.srcEnd > e.srcStart, { message: 'elemento com fim antes do início' })
  .refine((e) => (e.kind === 'text' ? e.text.trim().length > 0 : e.kind === 'emoji' ? e.emoji !== null : e.shape !== null), { message: 'elemento sem conteúdo' });
export type AddedElement = z.infer<typeof addedSchema>;

export const FRAMING_FITS = ['fill', 'fit'] as const;
export const framingSchema = z.object({
  /** fill = preenche o 9:16 (corta as sobras); fit = mostra o quadro inteiro (faixas atrás) */
  fit: z.enum(FRAMING_FITS),
  scale: z.number().min(VIDEO_SCALE.min).max(VIDEO_SCALE.max),
  /** deslocamento do centro do vídeo, em fração do quadro */
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
});
export type Framing = z.infer<typeof framingSchema>;
export const DEFAULT_FRAMING: Framing = { fit: 'fill', scale: 1, x: 0, y: 0 };

export const zoomRangeSchema = z
  .object({ srcStart: time, srcEnd: time, scale: z.number().min(ZOOM_LIMITS.min).max(ZOOM_LIMITS.max) })
  .refine((r) => r.srcEnd > r.srcStart, { message: 'zoom com fim antes do início' });
export type ZoomRange = z.infer<typeof zoomRangeSchema>;

export const editsSchema = z.object({
  /** posição de todas as legendas (null = a do modelo) */
  captionPlacement: placementSchema.nullable(),
  /** aparência de todas as legendas */
  captionLook: textLookSchema,
  captions: z.record(z.string().min(1).max(40), captionEditSchema).refine((r) => Object.keys(r).length <= MAX_EDITED, { message: 'legendas editadas demais' }),
  scenes: z.record(z.string().min(1).max(60), sceneEditSchema).refine((r) => Object.keys(r).length <= MAX_EDITED, { message: 'cenas editadas demais' }),
  added: z.array(addedSchema).max(MAX_ADDED),
  video: framingSchema,
  zooms: z.array(zoomRangeSchema).max(200),
});
export type ManualEdits = z.infer<typeof editsSchema>;

export const EMPTY_EDITS: ManualEdits = Object.freeze({
  captionPlacement: null,
  captionLook: {},
  captions: {},
  scenes: {},
  added: [],
  video: DEFAULT_FRAMING,
  zooms: [],
}) as ManualEdits;

export const EMPTY_CAPTION_EDIT: CaptionEdit = { placement: null, look: {}, hidden: false, srcStart: null, srcEnd: null };
export const EMPTY_SCENE_EDIT: SceneEdit = { hidden: false, offset: null, look: {}, text: null, srcStart: null, srcEnd: null };
export const IDENTITY_OFFSET: Offset = { dx: 0, dy: 0, scale: 1, rotate: 0 };

export const lookIsEmptyText = (l: TextLook) => Object.keys(l).length === 0;

/** A edição não muda nada (pode sair do plano). */
export function captionEditIsEmpty(e: CaptionEdit): boolean {
  return !e.placement && lookIsEmptyText(e.look) && !e.hidden && e.srcStart === null && e.srcEnd === null;
}
export function sceneEditIsEmpty(e: SceneEdit): boolean {
  return !e.hidden && !e.offset && lookIsEmptyText(e.look) && e.text === null && e.srcStart === null && e.srcEnd === null;
}

/** Junta duas aparências: `patch` vale mais; valor `null` no patch apaga o campo (volta ao modelo). */
export function mergeTextLook(base: TextLook, patch: { [K in keyof TextLook]?: TextLook[K] | null }): TextLook {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete out[k];
    else out[k] = v;
  }
  // trocar a fonte sem dizer o peso: o peso antigo pode não existir nela
  if (patch.font && patch.weight === undefined && out.weight !== undefined && !FONT_FILES[patch.font as FontFamily].some((f) => f.weight === out.weight)) delete out.weight;
  return out as TextLook;
}

export function editsAreEmpty(e: ManualEdits): boolean {
  return (
    !e.captionPlacement &&
    lookIsEmptyText(e.captionLook) &&
    Object.keys(e.captions).length === 0 &&
    Object.keys(e.scenes).length === 0 &&
    e.added.length === 0 &&
    e.zooms.length === 0 &&
    e.video.fit === 'fill' &&
    e.video.scale === 1 &&
    e.video.x === 0 &&
    e.video.y === 0
  );
}

/** Fontes usadas pelas edições (para carregar antes de desenhar). */
export function editFonts(e: ManualEdits): { family: FontFamily; weight: number; style: 'normal' | 'italic' }[] {
  const looks = [e.captionLook, ...Object.values(e.captions).map((c) => c.look), ...Object.values(e.scenes).map((s) => s.look), ...e.added.map((a) => a.look)];
  return looks.filter((l) => l.font).map((l) => resolveFont(l.font!, l.weight, l.italic));
}

/** Peso/estilo que existe na família (o mais perto do pedido; itálico só se houver). */
export function resolveFont(family: FontFamily, weight = 700, italic = false): { family: FontFamily; weight: number; style: 'normal' | 'italic' } {
  const files = FONT_FILES[family];
  const style = italic && files.some((f) => f.style === 'italic') ? 'italic' : files.some((f) => f.style === 'normal') ? 'normal' : 'italic';
  const pool = files.filter((f) => f.style === style);
  const best = [...pool].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight) || b.weight - a.weight)[0]!;
  return { family, weight: best.weight, style: best.style };
}

export const planUsesAddedEmoji = (e: ManualEdits | undefined): boolean => !!e && e.added.some((a) => a.kind === 'emoji');
export type { Emoji };
