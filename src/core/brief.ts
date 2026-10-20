import { z } from 'zod';

/**
 * CreativeBrief: o que a pessoa pediu, já entendido e em campos fechados.
 * É a única coisa que o intérprete (regras ou IA) devolve; o motor nunca lê o texto livre.
 * Guardado no plano (EditPlan v3), então entra no desfazer e no projeto salvo.
 */
export const BRIEF_VERSION = 1;

export const PROMPT_MAX = 500;

export const PRESET_IDS = ['pop', 'editorial', 'documental'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const GOALS = ['ensinar', 'vender', 'inspirar', 'entreter', 'informar'] as const;
export type Goal = (typeof GOALS)[number];

export const TONES = ['calmo', 'energetico', 'elegante', 'serio', 'divertido'] as const;
export type Tone = (typeof TONES)[number];

export const LEVELS = ['baixa', 'media', 'alta'] as const;
export type Level = (typeof LEVELS)[number];

export const PACES = ['lento', 'normal', 'rapido'] as const;
export type Pace = (typeof PACES)[number];

/**
 * Proibições. Cada uma remove tipos de cena ou ajusta o estilo (ver editorial/brief-apply.ts).
 * - efeitos: sem zoom, sem transições e movimento contido;
 * - emojis: o app não desenha emojis; fica registrado para quando houver;
 * - textos: nenhum texto animado na tela além da legenda.
 */
export const PROHIBITIONS = ['efeitos', 'emojis', 'numeros', 'zoom', 'transicoes', 'titulo', 'listas', 'perguntas', 'nome', 'destaques', 'barra', 'chamada', 'textos'] as const;
export type Prohibition = (typeof PROHIBITIONS)[number];

export const EMPHASES = ['numeros', 'palavras', 'perguntas', 'listas', 'nome'] as const;
export type Emphasis = (typeof EMPHASES)[number];

export const BRIEF_SOURCES = ['regras', 'ia-local', 'ia-chave'] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];

/** Nomes em português simples, para o resumo "o que entendi". */
export const LABELS = {
  preset: { pop: 'Pop', editorial: 'Editorial', documental: 'Documental' } satisfies Record<PresetId, string>,
  goal: { ensinar: 'ensinar', vender: 'vender', inspirar: 'inspirar', entreter: 'entreter', informar: 'informar' } satisfies Record<Goal, string>,
  tone: { calmo: 'calmo', energetico: 'animado', elegante: 'elegante', serio: 'sério', divertido: 'divertido' } satisfies Record<Tone, string>,
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

export const briefSchema = z.object({
  version: z.literal(BRIEF_VERSION),
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
});

export type CreativeBrief = z.infer<typeof briefSchema>;

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
};

/** O pedido mudou alguma coisa além do gancho? */
export function briefIsEmpty(b: CreativeBrief): boolean {
  return !b.goal && !b.audience && !b.tone && !b.intensity && !b.pace && !b.preset && b.forbid.length === 0 && b.emphasize.length === 0 && !b.wantsHook;
}

const join = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);

export interface BriefSummary {
  understood: string[];
  forbidden: string[];
  conflicts: string[];
  ignored: string[];
}

/** Resumo em frases curtas do que foi entendido (para a tela). */
export function summarizeBrief(b: CreativeBrief): BriefSummary {
  const understood: string[] = [];
  if (b.preset) understood.push(`Estilo ${LABELS.preset[b.preset]}`);
  if (b.tone) understood.push(`Tom ${LABELS.tone[b.tone]}`);
  if (b.intensity) understood.push(LABELS.intensity[b.intensity][0]!.toUpperCase() + LABELS.intensity[b.intensity].slice(1));
  if (b.pace) understood.push(LABELS.pace[b.pace][0]!.toUpperCase() + LABELS.pace[b.pace].slice(1));
  if (b.goal) understood.push(`Objetivo: ${LABELS.goal[b.goal]}`);
  if (b.audience) understood.push(`Público: ${b.audience}`);
  if (b.emphasize.length) understood.push(`Destacar ${join(b.emphasize.map((e) => LABELS.emphasis[e]))}`);
  if (b.wantsHook) understood.push('Começar com um gancho forte');
  return {
    understood,
    forbidden: b.forbid.map((p) => LABELS.prohibition[p]),
    conflicts: b.notes.conflicts,
    ignored: b.notes.ignored,
  };
}
