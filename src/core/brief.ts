import { z } from 'zod';
import { HOOK_STYLES, lookIsEmpty, lookSchema, type HookStyle, type Look } from './look';
import { TEMPLATE_IDS, TEMPLATE_NAMES, type TemplateId } from './templates';
import { NICHE_IDS, NICHE_NAMES, type NicheId } from './niches';
import { creativeSetupSchema } from './production';

/**
 * CreativeBrief: o que a pessoa pediu, já entendido e em campos fechados.
 * É a única coisa que o intérprete (regras ou IA) devolve; o motor nunca lê o texto livre.
 * Guardado no plano (EditPlan v3), então entra no desfazer e no projeto salvo.
 */
export const BRIEF_VERSION = 2;

export const UNSUPPORTED_MAX = 8;
export const SUMMARY_MAX = 300;

export const PROMPT_MAX = 500;

/** Estilos que um pedido pode escolher: os modelos do registro (v0.9, ADR-0014). */
export const PRESET_IDS = TEMPLATE_IDS;
export type PresetId = TemplateId;

export const GOALS = ['ensinar', 'vender', 'inspirar', 'entreter', 'informar'] as const;
export type Goal = (typeof GOALS)[number];

/** 'inspirador' e 'acolhedor' entraram na v0.12 (enum só cresce: pedidos antigos continuam válidos). */
export const TONES = ['calmo', 'energetico', 'elegante', 'serio', 'divertido', 'inspirador', 'acolhedor'] as const;
export type Tone = (typeof TONES)[number];

export const LEVELS = ['baixa', 'media', 'alta'] as const;
export type Level = (typeof LEVELS)[number];

export const PACES = ['lento', 'normal', 'rapido'] as const;
export type Pace = (typeof PACES)[number];

/**
 * Proibições. Cada uma remove tipos de cena ou ajusta o estilo (ver editorial/brief-apply.ts).
 * - efeitos: sem zoom, sem transições e movimento contido;
 * - emojis: tira os emojis (desde a v0.6 o app desenha emojis perto da fala);
 * - textos: nenhum texto animado na tela além da legenda.
 */
export const PROHIBITIONS = ['efeitos', 'emojis', 'numeros', 'zoom', 'transicoes', 'titulo', 'listas', 'perguntas', 'nome', 'destaques', 'barra', 'chamada', 'textos'] as const;
export type Prohibition = (typeof PROHIBITIONS)[number];

export const EMPHASES = ['numeros', 'palavras', 'perguntas', 'listas', 'nome'] as const;
export type Emphasis = (typeof EMPHASES)[number];

/** Registro da linguagem dos textos fixos do app (chamada final): "Siga para mais" × "Me segue pra mais". */
export const REGISTERS = ['formal', 'informal'] as const;
export type Register = (typeof REGISTERS)[number];

export const BRIEF_SOURCES = ['regras', 'ia-local', 'ia-chave'] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];

/** Nomes em português simples, para o resumo "o que entendi". */
export const LABELS = {
  preset: TEMPLATE_NAMES satisfies Record<PresetId, string>,
  goal: { ensinar: 'ensinar', vender: 'vender', inspirar: 'inspirar', entreter: 'entreter', informar: 'informar' } satisfies Record<Goal, string>,
  tone: { calmo: 'calmo', energetico: 'animado', elegante: 'elegante', serio: 'sério', divertido: 'divertido', inspirador: 'inspirador', acolhedor: 'acolhedor' } satisfies Record<Tone, string>,
  niche: NICHE_NAMES satisfies Record<NicheId, string>,
  register: { formal: 'linguagem formal', informal: 'linguagem informal' } satisfies Record<Register, string>,
  intensity: { baixa: 'pouco movimento', media: 'movimento médio', alta: 'muito movimento' } satisfies Record<Level, string>,
  pace: { lento: 'ritmo lento', normal: 'ritmo normal', rapido: 'ritmo rápido' } satisfies Record<Pace, string>,
  prohibition: {
    efeitos: 'efeitos (zoom, transições e movimento forte)',
    emojis: 'emojis',
    numeros: 'números grandes na tela',
    zoom: 'zoom',
    transicoes: 'transições',
    titulo: 'título de abertura',
    listas: 'listas',
    perguntas: 'perguntas em destaque',
    nome: 'nome na tela',
    destaques: 'palavras-chave em destaque',
    barra: 'barra de progresso',
    chamada: 'chamada final',
    textos: 'textos animados (fica só a legenda)',
  } satisfies Record<Prohibition, string>,
  emphasis: { numeros: 'números', palavras: 'palavras-chave', perguntas: 'perguntas', listas: 'listas', nome: 'nome' } satisfies Record<Emphasis, string>,
};

const short = (max: number) => z.string().max(max);

export const hookSchema = z.object({
  /** frase exatamente como foi falada (nunca inventada) */
  text: z.string().min(1).max(60),
  wordIds: z.array(z.string().min(1)).min(1).max(20),
});
export type Hook = z.infer<typeof hookSchema>;

const briefV1Fields = {
  /** texto que a pessoa escreveu (só para mostrar de novo; o motor não lê) */
  prompt: short(PROMPT_MAX),
  source: z.enum(BRIEF_SOURCES),
  goal: z.enum(GOALS).nullable(),
  audience: short(60).nullable(),
  tone: z.enum(TONES).nullable(),
  /** null = a do estilo */
  intensity: z.enum(LEVELS).nullable(),
  pace: z.enum(PACES).nullable(),
  /** estilo pedido; null = manter o atual */
  preset: z.enum(PRESET_IDS).nullable(),
  forbid: z.array(z.enum(PROHIBITIONS)).max(PROHIBITIONS.length),
  emphasize: z.array(z.enum(EMPHASES)).max(EMPHASES.length),
  /** pediu gancho forte: o melhor candidato vira a abertura */
  wantsHook: z.boolean(),
  hook: hookSchema.nullable(),
  /** trechos travados (Fase 5): ainda não usados */
  locked: z.array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative() })).max(50),
  /** o que foi ignorado ou decidido num conflito, para o resumo */
  notes: z.object({
    conflicts: z.array(short(200)).max(10),
    ignored: z.array(short(40)).max(12),
  }),
};

/** CreativeBrief v1 (Fase 4, até a v0.5): sem look, sem estilo de gancho e sem "ainda não sei fazer". */
export const briefV1Schema = z.object({ version: z.literal(1), ...briefV1Fields });

export const briefSchema = z.object({
  version: z.literal(BRIEF_VERSION),
  production: creativeSetupSchema.optional(),
  ...briefV1Fields,
  /** cores, legenda, emojis, cortes, transição, cenas ligadas/desligadas (v2, ADR-0011) */
  look: lookSchema,
  /** que tipo de frase abre o vídeo; null = a melhor pela pontuação */
  hookStyle: z.enum(HOOK_STYLES).nullable(),
  /** o que foi pedido e o app ainda não sabe fazer (frases curtas) */
  unsupported: z.array(short(60)).max(UNSUPPORTED_MAX),
  /** resumo em português escrito pela IA (só para mostrar; vazio sem IA) */
  summary: short(SUMMARY_MAX),
  /** tipo de conteúdo (v0.12, ADR-0017): escolhe a receita; ausente nos pedidos antigos = nenhum */
  niche: z.enum(NICHE_IDS).nullable().optional(),
  /** linguagem dos textos fixos (v0.12); ausente = a da receita ou informal */
  register: z.enum(REGISTERS).nullable().optional(),
});

export type CreativeBrief = z.infer<typeof briefSchema>;
export type CreativeBriefV1 = z.infer<typeof briefV1Schema>;

/** v1 → v2: look vazio, gancho automático, nada em "ainda não sei fazer" (nada muda no vídeo). */
export function migrateBrief(b: CreativeBriefV1): CreativeBrief {
  return { ...b, version: BRIEF_VERSION, look: {}, hookStyle: null, unsupported: [], summary: '' };
}

export const EMPTY_BRIEF: CreativeBrief = {
  version: BRIEF_VERSION,
  prompt: '',
  source: 'regras',
  goal: null,
  audience: null,
  tone: null,
  intensity: null,
  pace: null,
  preset: null,
  forbid: [],
  emphasize: [],
  wantsHook: false,
  hook: null,
  locked: [],
  notes: { conflicts: [], ignored: [] },
  look: {},
  hookStyle: null,
  unsupported: [],
  summary: '',
};

/** O pedido mudou alguma coisa além do gancho? */
export function briefIsEmpty(b: CreativeBrief): boolean {
  return !b.niche && !b.register && !b.goal && !b.audience && !b.tone && !b.intensity && !b.pace && !b.preset && b.forbid.length === 0 && b.emphasize.length === 0 && !b.wantsHook && !b.hookStyle && lookIsEmpty(b.look);
}

const join = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);

export interface BriefSummary {
  /** o que foi aplicado, em frases curtas ("Apliquei: …") */
  understood: string[];
  /** o que a pessoa pediu e o app ainda não sabe fazer */
  unsupported: string[];
  forbidden: string[];
  conflicts: string[];
  ignored: string[];
}

/** Resumo em frases curtas do que foi entendido (para a tela). */
export function summarizeBrief(b: CreativeBrief): BriefSummary {
  const understood: string[] = [];
  if (b.niche) understood.push(`Receita para ${LABELS.niche[b.niche]}`);
  if (b.preset) understood.push(`Estilo ${LABELS.preset[b.preset]}`);
  if (b.tone) understood.push(`Tom ${LABELS.tone[b.tone]}`);
  if (b.intensity) understood.push(LABELS.intensity[b.intensity][0]!.toUpperCase() + LABELS.intensity[b.intensity].slice(1));
  if (b.pace) understood.push(LABELS.pace[b.pace][0]!.toUpperCase() + LABELS.pace[b.pace].slice(1));
  if (b.goal) understood.push(`Objetivo: ${LABELS.goal[b.goal]}`);
  if (b.audience) understood.push(`Público: ${b.audience}`);
  if (b.emphasize.length) understood.push(`Destacar ${join(b.emphasize.map((e) => LABELS.emphasis[e]))}`);
  if (b.wantsHook) understood.push(b.hookStyle && b.hookStyle !== 'auto' ? `Começar com um gancho ${HOOK_LABEL[b.hookStyle]}` : 'Começar com um gancho forte');
  if (b.register) understood.push(`Textos em ${LABELS.register[b.register]}`);
  understood.push(...describeLook(b.look));
  return {
    understood,
    unsupported: b.unsupported,
    forbidden: b.forbid.map((p) => LABELS.prohibition[p]),
    conflicts: b.notes.conflicts,
    ignored: b.notes.ignored,
  };
}

const HOOK_LABEL: Record<HookStyle, string> = { auto: 'forte', pergunta: 'em forma de pergunta', numero: 'com número', impacto: 'de impacto', criativo: 'diferente do óbvio (criativo)' };

const SIZE = (x: number) => (x >= 1.45 ? 'bem maior' : x > 1.05 ? 'maior' : x <= 0.7 ? 'bem menor' : x < 0.95 ? 'menor' : 'normal');
const CASE_LABEL = { upper: 'em maiúsculas', lower: 'em minúsculas', none: 'como foi falada (sem caixa alta)' } as const;
const POS_LABEL = { top: 'em cima', center: 'no meio da tela', bottom: 'embaixo' } as const;
const ANIM_LABEL: Record<string, string> = { auto: 'do estilo', none: 'sem animação', fade: 'aparecendo suave', pop: 'estourando (pop)', rise: 'subindo', slide: 'deslizando', bounce: 'quicando', typewriter: 'palavra por palavra, como digitando' };
const HL_LABEL = { box: 'caixa colorida', color: 'cor', underline: 'sublinhado', reveal: 'acendendo palavra a palavra', marker: 'marca-texto' } as const;
const EMOJI_POS: Record<string, string> = { auto: 'longe da legenda', top: 'em cima', middle: 'no meio', bottom: 'embaixo', left: 'à esquerda', right: 'à direita' };
const EMOJI_ANIM: Record<string, string> = { pop: 'estourando', bounce: 'quicando', float: 'flutuando', spin: 'girando', fade: 'aparecendo suave', none: 'parados' };
const TOGGLE_LABEL: Record<string, string> = { titulo: 'título de abertura', barra: 'barra de progresso', destaques: 'palavras-chave em destaque', zoom: 'zoom', numeros: 'números grandes', listas: 'listas', perguntas: 'perguntas em destaque', nome: 'nome na tela', chamada: 'chamada final', transicoes: 'transições' };

/** Frases curtas para o que o look muda (cores aparecem com o código). */
export function describeLook(l: Look): string[] {
  const out: string[] = [];
  const c = l.captions ?? {};
  const colors: string[] = [];
  if (c.text) colors.push(`texto ${c.text}`);
  if (c.highlight) colors.push(`destaque ${c.highlight}`);
  if (c.stroke) colors.push(`contorno ${c.stroke}`);
  if (c.box && c.box !== 'none') colors.push(`caixa ${c.box}`);
  if (colors.length) out.push(`Cores da legenda: ${join(colors)}`);
  if (c.box === 'none') out.push('Legenda sem caixa atrás');
  if (c.strokeWidth === 0) out.push('Legenda sem contorno');
  if (c.scale !== undefined) out.push(`Legenda ${SIZE(c.scale)}`);
  if (c.position) out.push(`Legenda ${POS_LABEL[c.position]}`);
  if (c.y !== undefined && !c.position) out.push(`Legenda a ${Math.round(c.y * 100)}% da altura`);
  if (c.case) out.push(`Legenda ${CASE_LABEL[c.case]}`);
  if (c.font) out.push(`Fonte da legenda: ${c.font}`);
  if (c.animation) out.push(`Entrada da legenda: ${ANIM_LABEL[c.animation]}`);
  if (c.highlightMode) out.push(`Palavra falada em ${HL_LABEL[c.highlightMode]}`);
  if (c.wordsPerLine) out.push(`${c.wordsPerLine} ${c.wordsPerLine === 1 ? 'palavra' : 'palavras'} por linha`);
  if (c.wordsAtOnce) out.push(`${c.wordsAtOnce} ${c.wordsAtOnce === 1 ? 'palavra' : 'palavras'} por vez na legenda`);
  const e = l.emoji ?? {};
  if (e.mode === 'off') out.push('Sem emojis');
  else if (e.mode === 'interval') out.push(`Emojis a cada ${String(e.everySec ?? 3).replace('.', ',')} s, escolhidos pela fala`);
  else if (e.mode === 'keywords') out.push('Emojis nas palavras importantes da fala');
  if (e.mode !== 'off') {
    if (e.scale !== undefined) out.push(`Emojis ${SIZE(e.scale)}`);
    if (e.position) out.push(`Emojis ${EMOJI_POS[e.position]}`);
    if (e.animation) out.push(`Emojis ${EMOJI_ANIM[e.animation]}`);
    if (e.prefer?.length) out.push(`Emojis preferidos: ${e.prefer.join(' ')}`);
  }
  if (c.avoidFace === true) out.push('Legenda e título longe do rosto');
  if (c.avoidFace === false) out.push('Legenda na posição do estilo (sem olhar o rosto)');
  if (c.keyword) out.push(`Palavras-chave da legenda em ${c.keyword}`);
  if (l.accent) out.push(`Cor das animações: ${l.accent}`);
  if (l.title) out.push(`Título de abertura: “${l.title}”`);
  if (l.cta) out.push(`Chamada final: “${l.cta}”`);
  if (l.handle) out.push(`Seu ${l.handle} no canto do vídeo`);
  if (l.cuts === 'agressivo') out.push('Cortes mais rápidos (pausas curtas também saem)');
  if (l.cuts === 'suave') out.push('Cortes mais suaves (pausas curtas voltam)');
  if (l.transition) out.push(l.transition === 'none' ? 'Sem transições' : `Transição: ${{ zoom: 'zoom', flash: 'flash', dip: 'escurecer' }[l.transition]}`);
  if (l.motion !== undefined) out.push(`Intensidade das animações: ${Math.round(l.motion * 100)}%`);
  const on = Object.entries(l.scenes ?? {}).filter(([, v]) => v).map(([k]) => TOGGLE_LABEL[k]!);
  const off = Object.entries(l.scenes ?? {}).filter(([, v]) => v === false).map(([k]) => TOGGLE_LABEL[k]!);
  if (on.length) out.push(`Com ${join(on)}`);
  if (off.length) out.push(`Sem ${join(off)}`);
  return out;
}
