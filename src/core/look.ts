import { z } from 'zod';
import { parseColorValue } from './color-names';
import { EMOJI_SET, normalizeEmoji, type Emoji } from './emoji';
import { CAPTION_ANIMATIONS, CAPTION_HIGHLIGHTS, EMOJI_ANIMATIONS, EMOJI_MODES, EMOJI_POSITIONS, FONT_FAMILIES, LETTER_CASES, TRANSITIONS } from './style';

/**
 * Look: o espaço de parâmetros que um pedido pode controlar além do tom (v0.6, ADR-0011).
 * Cada campo é opcional (omitido = o estilo decide) e tem limites explícitos. É o que as regras e
 * a IA devolvem; `editorial/brief-apply.ts` transforma em StyleDNA e opções do seletor.
 * Nada aqui é código: só valores fechados, números com limite e cores #RRGGBB.
 */

export const LOOK_POSITIONS = ['top', 'center', 'bottom'] as const;
/** Destaque da palavra falada (o mesmo do StyleDNA; 'marker' = marca-texto, v0.9). */
export const HIGHLIGHT_MODES = CAPTION_HIGHLIGHTS;
export const CUT_LEVELS = ['suave', 'normal', 'agressivo'] as const;
export type CutLevel = (typeof CUT_LEVELS)[number];
/** Cenas que dá para ligar ou desligar pelo nome (as mesmas chaves das proibições). */
export const SCENE_TOGGLES = ['titulo', 'barra', 'destaques', 'zoom', 'numeros', 'listas', 'perguntas', 'nome', 'chamada', 'transicoes'] as const;
export type SceneToggle = (typeof SCENE_TOGGLES)[number];
export const HOOK_STYLES = ['auto', 'pergunta', 'numero', 'impacto', 'criativo'] as const;
export type HookStyle = (typeof HOOK_STYLES)[number];

export const CAPTION_SCALE = { min: 0.5, max: 2.2 } as const;
export const EMOJI_SCALE = { min: 0.5, max: 2 } as const;

const hex = z.string().regex(/^#[0-9A-F]{6}$/);

/** Texto curto vindo do pedido: letras, números, espaço e pontuação simples (nada de < > { }). */
export const CTA_MAX = 32;
export const TITLE_MAX = 60;
export const CTA_RE = /^[\p{L}\p{N} .,!?:;'"“”‘’@#%&$+\-/()]{2,32}$/u;
export const TITLE_RE = /^[\p{L}\p{N} .,!?:;'"“”‘’@#%&$+\-/()]{2,60}$/u;
export const HANDLE_RE = /^@[a-z0-9._]{2,30}$/;

export const lookCaptionsSchema = z
  .object({
    text: hex,
    highlight: hex,
    stroke: hex,
    /** cor da caixa atrás da linha, ou 'none' = sem caixa */
    box: z.union([hex, z.literal('none')]),
    /** multiplicador do tamanho do estilo */
    scale: z.number().min(CAPTION_SCALE.min).max(CAPTION_SCALE.max),
    position: z.enum(LOOK_POSITIONS),
    /** centro vertical em fração da área segura (quando a pessoa diz uma altura, ex.: "a 30% da tela") */
    y: z.number().min(0.05).max(0.95),
    case: z.enum(LETTER_CASES),
    font: z.enum(FONT_FAMILIES),
    animation: z.enum(CAPTION_ANIMATIONS),
    wordsPerLine: z.number().int().min(1).max(6),
    /** palavras por legenda (reagrupa as legendas; só no vídeo inteiro) */
    wordsAtOnce: z.number().int().min(1).max(8),
    highlightMode: z.enum(HIGHLIGHT_MODES),
    /** contorno: 0 = sem contorno */
    strokeWidth: z.number().min(0).max(24),
    /** cor das palavras-chave dentro da legenda (v0.12) */
    keyword: hex,
    /** legenda e título longe do rosto (v0.12): true = posição escolhida pelo rosto; false = a do estilo */
    avoidFace: z.boolean(),
  })
  .partial();

export const lookEmojiSchema = z
  .object({
    mode: z.enum(EMOJI_MODES),
    everySec: z.number().min(1).max(30),
    position: z.enum(EMOJI_POSITIONS),
    scale: z.number().min(EMOJI_SCALE.min).max(EMOJI_SCALE.max),
    animation: z.enum(EMOJI_ANIMATIONS),
    /** emojis preferidos quando a fala não sugere nenhum (só da lista do app) */
    prefer: z.array(z.enum(EMOJI_SET)).max(8),
  })
  .partial();

export const lookSchema = z
  .object({
    captions: lookCaptionsSchema,
    emoji: lookEmojiSchema,
    /** cor de destaque das animações (títulos, números, palavra-chave) */
    accent: hex,
    cuts: z.enum(CUT_LEVELS),
    transition: z.enum(TRANSITIONS),
    /** intensidade exata das animações (0 = quase parado, 1 = muito movimento) */
    motion: z.number().min(0).max(1),
    scenes: z.partialRecord(z.enum(SCENE_TOGGLES), z.boolean()),
    /** texto da chamada final (v0.12): frase fixa do app ou texto que a pessoa escreveu no pedido */
    cta: z.string().regex(CTA_RE),
    /** @ da pessoa, pequeno no canto (marca-d'água de texto, v0.12) */
    handle: z.string().regex(HANDLE_RE),
    /** título de abertura escrito pela pessoa (entre aspas ou depois de "título:"; v0.12) */
    title: z.string().regex(TITLE_RE),
  })
  .partial();

export type Look = z.infer<typeof lookSchema>;
export type LookCaptions = z.infer<typeof lookCaptionsSchema>;
export type LookEmoji = z.infer<typeof lookEmojiSchema>;

/** Campos que um pedido de trecho pode mudar (o resto vale só para o vídeo inteiro). */
export const RANGE_LOOK_EXCLUDED = ['cuts', 'captions.wordsAtOnce'] as const;

export function lookIsEmpty(l: Look | null | undefined): boolean {
  if (!l) return true;
  return Object.values(l).every((v) => v === undefined || (typeof v === 'object' && v !== null && Object.values(v).every((x) => x === undefined)));
}

/** Tira o que não vale num trecho; devolve o look do trecho e os campos tirados. */
export function rangeLook(l: Look): { look: Look; removed: string[] } {
  const removed: string[] = [];
  const out: Look = structuredClone(l);
  if (out.cuts !== undefined) {
    delete out.cuts;
    removed.push('cortes');
  }
  if (out.captions?.wordsAtOnce !== undefined) {
    delete out.captions.wordsAtOnce;
    removed.push('palavras por legenda');
  }
  return { look: out, removed };
}

/** Junta dois looks: o segundo vale mais, campo a campo. */
export function mergeLook(base: Look, over: Look): Look {
  const out: Look = { ...base, ...stripUndefined(over) };
  if (base.captions || over.captions) out.captions = { ...base.captions, ...stripUndefined(over.captions ?? {}) };
  if (base.emoji || over.emoji) out.emoji = { ...base.emoji, ...stripUndefined(over.emoji ?? {}) };
  if (base.scenes || over.scenes) out.scenes = { ...base.scenes, ...stripUndefined(over.scenes ?? {}) };
  return out;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/* ---------- Leitura tolerante (resposta da IA) ---------- */

const SIZE_WORDS: Record<string, number> = { minuscula: 0.6, minusculo: 0.6, pequena: 0.8, pequeno: 0.8, menor: 0.8, normal: 1, media: 1, medio: 1, maior: 1.25, grande: 1.25, enorme: 1.5, gigante: 1.6, 'bem grande': 1.5, 'bem pequena': 0.65 };
const POSITION_WORDS: Record<string, (typeof LOOK_POSITIONS)[number]> = { top: 'top', topo: 'top', cima: 'top', 'em cima': 'top', alto: 'top', center: 'center', centro: 'center', meio: 'center', middle: 'center', bottom: 'bottom', baixo: 'bottom', embaixo: 'bottom', rodape: 'bottom' };

const lower = (v: unknown) => (typeof v === 'string' ? v.normalize('NFD').replace(/\p{M}+/gu, '').trim().toLowerCase() : v);

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return null;
}

type FieldReader = (v: unknown) => unknown;

const enumOf =
  <T extends readonly string[]>(values: T, aliases: Record<string, T[number]> = {}): FieldReader =>
  (v) => {
    const s = lower(v);
    if (typeof s !== 'string') return undefined;
    if ((values as readonly string[]).includes(s)) return s;
    return aliases[s];
  };
const range = (lo: number, hi: number, int = false): FieldReader => (v) => {
  const n = num(v);
  if (n === null || n < lo || n > hi) return undefined;
  return int ? Math.round(n) : Math.round(n * 1000) / 1000;
};
const colorReader: FieldReader = (v) => parseColorValue(v) ?? undefined;
const scaleReader = (lo: number, hi: number): FieldReader => (v) => {
  const s = lower(v);
  if (typeof s === 'string' && SIZE_WORDS[s] !== undefined) return SIZE_WORDS[s];
  return range(lo, hi)(v);
};
const fontReader: FieldReader = (v) => {
  const s = lower(v);
  if (typeof s !== 'string') return undefined;
  return FONT_FAMILIES.find((f) => f.toLowerCase() === s);
};

const CAPTION_READERS: Record<keyof LookCaptions, FieldReader> = {
  text: colorReader,
  highlight: colorReader,
  stroke: colorReader,
  box: (v) => (lower(v) === 'none' || lower(v) === 'nenhum' || lower(v) === 'sem' || v === false ? 'none' : colorReader(v)),
  scale: scaleReader(CAPTION_SCALE.min, CAPTION_SCALE.max),
  position: enumOf(LOOK_POSITIONS, POSITION_WORDS),
  y: range(0.05, 0.95),
  case: enumOf(LETTER_CASES, { maiuscula: 'upper', maiusculas: 'upper', uppercase: 'upper', minuscula: 'lower', minusculas: 'lower', lowercase: 'lower', normal: 'none' }),
  font: fontReader,
  animation: enumOf(CAPTION_ANIMATIONS),
  wordsPerLine: range(1, 6, true),
  wordsAtOnce: range(1, 8, true),
  highlightMode: enumOf(HIGHLIGHT_MODES),
  strokeWidth: range(0, 24),
  keyword: colorReader,
  avoidFace: (v) => (typeof v === 'boolean' ? v : undefined),
};

/** Texto curto (chamada final, título): espaços juntados, sem controle; só passa se casar com o padrão. */
export function cleanShortText(v: unknown, re: RegExp): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return re.test(s) ? s : undefined;
}
const handleReader: FieldReader = (v) => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  const h = s.startsWith('@') ? s : `@${s}`;
  return HANDLE_RE.test(h) ? h : undefined;
};

const EMOJI_READERS: Record<keyof LookEmoji, FieldReader> = {
  mode: enumOf(EMOJI_MODES, { on: 'keywords', sim: 'keywords', desligado: 'off', none: 'off' }),
  everySec: range(1, 30),
  position: enumOf(EMOJI_POSITIONS, { cima: 'top', topo: 'top', meio: 'middle', center: 'middle', baixo: 'bottom', esquerda: 'left', direita: 'right' }),
  scale: scaleReader(EMOJI_SCALE.min, EMOJI_SCALE.max),
  animation: enumOf(EMOJI_ANIMATIONS),
  prefer: (v) => {
    if (!Array.isArray(v)) return undefined;
    const out: Emoji[] = [];
    for (const x of v.slice(0, 16)) {
      const e = normalizeEmoji(x);
      if (e && !out.includes(e)) out.push(e);
    }
    return out.length ? out.slice(0, 8) : undefined;
  },
};

function readObject<K extends string>(raw: unknown, readers: Record<K, FieldReader>, prefix: string, dropped: string[]): Partial<Record<K, unknown>> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    dropped.push(prefix);
    return undefined;
  }
  const out: Partial<Record<K, unknown>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    const reader = readers[k as K];
    const value = reader ? reader(v) : undefined;
    if (value === undefined) dropped.push(`${prefix}.${k}=${String(typeof v === 'object' ? JSON.stringify(v) : v).slice(0, 24)}`);
    else out[k as K] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Lê um look de fora (IA): cada campo é conferido sozinho; o que não passa é descartado e listado,
 * sem derrubar o resto. O resultado sempre passa por `lookSchema`.
 */
export function sanitizeLook(raw: unknown): { look: Look; dropped: string[] } {
  const dropped: string[] = [];
  if (raw === undefined || raw === null) return { look: {}, dropped };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { look: {}, dropped: ['look'] };
  const o = raw as Record<string, unknown>;
  const candidate: Record<string, unknown> = {};
  const captions = readObject(o.captions, CAPTION_READERS, 'captions', dropped);
  if (captions) candidate.captions = captions;
  const emoji = readObject(o.emoji, EMOJI_READERS, 'emoji', dropped);
  if (emoji) candidate.emoji = emoji;
  if (o.accent !== undefined && o.accent !== null) {
    const c = colorReader(o.accent);
    if (c) candidate.accent = c;
    else dropped.push(`accent=${String(o.accent).slice(0, 24)}`);
  }
  for (const [key, reader] of [
    ['cuts', enumOf(CUT_LEVELS, { leve: 'suave', forte: 'agressivo', rapido: 'agressivo' })],
    ['transition', enumOf(TRANSITIONS)],
    ['motion', range(0, 1)],
    ['cta', (v: unknown) => cleanShortText(v, CTA_RE)],
    ['handle', handleReader],
    ['title', (v: unknown) => cleanShortText(v, TITLE_RE)],
  ] as const) {
    if (o[key] === undefined || o[key] === null) continue;
    const v = reader(o[key]);
    if (v === undefined) dropped.push(`${key}=${String(o[key]).slice(0, 24)}`);
    else candidate[key] = v;
  }
  if (o.scenes !== undefined && o.scenes !== null) {
    if (typeof o.scenes !== 'object' || Array.isArray(o.scenes)) dropped.push('scenes');
    else {
      const scenes: Partial<Record<SceneToggle, boolean>> = {};
      for (const [k, v] of Object.entries(o.scenes as Record<string, unknown>)) {
        if ((SCENE_TOGGLES as readonly string[]).includes(k) && typeof v === 'boolean') scenes[k as SceneToggle] = v;
        else dropped.push(`scenes.${k}`);
      }
      if (Object.keys(scenes).length) candidate.scenes = scenes;
    }
  }
  const parsed = lookSchema.safeParse(candidate);
  if (parsed.success) return { look: parsed.data, dropped };
  // nunca deveria acontecer (cada campo já foi conferido), mas se acontecer, nada passa
  return { look: {}, dropped: [...dropped, 'look'] };
}
