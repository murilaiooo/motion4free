import type { Word } from '../core/types';
import { meanDbBetween, speechMedianDb, ENERGY_STEP_SEC } from '../analysis/energy';
import { STOPWORDS, isQuestion, parseNumberAt } from './detect';

/**
 * Nota profissional de um trecho candidato a clipe (v0.37, ADR-0037). Pura, sem navegador e testada
 * (tests/clip-score.test.ts).
 *
 * Inspirada no que as ferramentas de corte automático open source fazem (ClipsAI, AI-Youtube-Shorts-Generator,
 * SupoClip, todas lidas como referência, nenhum código copiado): o clipe bom prende nos 3 primeiros segundos,
 * tem emoção ou opinião, entrega uma conclusão, fala sobre um assunto só e funciona sem o resto do vídeo.
 * Tudo aqui é regra transparente sobre a transcrição e a energia da voz; nenhuma resposta livre de IA.
 *
 * A nota é uma estimativa estrutural para ordenar sugestões, não uma previsão de visualizações.
 */

export interface ScoreBreakdown {
  /** começo forte nos primeiros ~3,5 s */
  gancho: number;
  /** emoção, opinião forte, história pessoal */
  emocao: number;
  /** tem virada/conclusão na segunda metade */
  conclusao: number;
  /** fala mais animada que a média do vídeo */
  energia: number;
  /** ritmo de fala bom para vídeo curto */
  ritmo: number;
  /** termina com a ideia fechada */
  fechamento: number;
  /** entende-se sem ter visto o resto do vídeo */
  autonomia: number;
  /** fala sobre um assunto só (coesão entre começo e fim) */
  assunto: number;
}

export const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, string> = {
  gancho: 'Gancho no começo',
  emocao: 'Emoção e opinião',
  conclusao: 'Tem conclusão',
  energia: 'Energia da voz',
  ritmo: 'Ritmo da fala',
  fechamento: 'Termina a ideia',
  autonomia: 'Funciona sozinho',
  assunto: 'Assunto único',
};

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  gancho: 26, emocao: 12, conclusao: 10, energia: 14, ritmo: 8, fechamento: 12, autonomia: 10, assunto: 8,
};

export interface SpanScore {
  /** 0–100 */
  score: number;
  parts: ScoreBreakdown;
  /** motivos em português, do mais forte para o mais fraco */
  reasons: string[];
}

export interface ScoreContext {
  limit: { min: number; max: number; ideal: number };
  energy?: ArrayLike<number> | null;
  energyStep?: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** minúsculas e sem acento, para comparar com as listas abaixo */
export const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tokensOf = (text: string) => plain(text).match(/[a-z0-9%$]+/g) ?? [];

/** Aberturas que prendem em Reels/TikTok/Shorts (português e inglês), sobre texto sem acento. */
const HOOK_PATTERNS: RegExp[] = [
  /\b(o|um|esse|este|meu) segredo\b/, /\bninguem (te )?(conta|fala|explica|sabe)\b/, /\b(o )?(maior|pior|primeiro) erro\b/,
  /\bpare de\b/, /\bnunca mais\b/, /\bvoce (precisa|deveria|sabia|ja|nao vai|vai)\b/, /\ba verdade (e|sobre|que)\b/,
  /\bo problema (e|de|da|do)\b/, /\bpor que (voce|a gente|ninguem|todo mundo|as pessoas)\b/, /\bcomo (eu|voce|fazer|ganhar|parar|sair)\b/,
  /\beu (perdi|ganhei|descobri|errei|aprendi|quase|larguei|fui demitido|quebrei)\b/, /\bo (dia|momento) em que\b/,
  /\b(todo mundo|a maioria (das pessoas)?)\b/, /\b(\d+|dois|duas|tres|quatro|cinco|seis|sete|dez) (dicas|passos|erros|coisas|motivos|formas|maneiras|regras|segredos|habitos|licoes)\b/,
  /\bpresta atencao\b/, /\bdeixa eu te (contar|falar|mostrar)\b/, /\bimagina (so|que|voce)\b/, /\bse voce (quer|esta|for|nao)\b/,
  /\b(atencao|cuidado)\b/, /\bnao (faca|compre|caia|cometa|acredite)\b/, /\bja pensou\b/, /\bsabe (o que|por que|qual|quanto)\b/,
  /\bolha (so|isso)\b/, /\be se eu te (disser|contar)\b/, /\bisso (mudou|vai mudar|muda)\b/, /\bfoi (a|o) (melhor|pior)\b/,
  /\b(mentira|mito)\b/, /\bvale a pena\b/, /\bo que (ninguem|acontece|aconteceu)\b/,
  /\b(the (secret|truth|problem|biggest mistake)|nobody (tells|talks)|stop doing|you need to|here'?s (why|how)|i (lost|made|quit|learned))\b/,
];

/** Aberturas fracas: saudação, chamada para ação, "como eu estava falando". */
const WEAK_OPENERS: RegExp[] = [
  /^(bom dia|boa tarde|boa noite|ola|oi|fala (galera|pessoal|ai)|e ai (galera|pessoal)|sejam bem.?vindos|bem.?vindos|hello|hi guys|what'?s up)\b/,
  /^(como (eu )?(estava|tava) (falando|dizendo)|voltando|continuando|retomando|enfim|bom,? entao|entao,? gente|deixa eu (ver|pensar|olhar|ler|abrir)|vamos (ver|la)|pergunta do chat|perguntas do chat)\b/,
];
/** Chamadas para ação e patrocínio: raramente viram um bom clipe. */
const CTA = /\b(se inscreve|se inscreva|inscreva.se|deixa (o|seu) like|ativa o sininho|link na descricao|link na bio|cupom|patrocin|subscribe|smash (that|the) like)\b/;

/** Palavras com carga emocional, opinião forte ou história pessoal (prefixos, sem acento). */
const EMOTION_PREFIXES = [
  'incrivel', 'absurd', 'louc', 'chocant', 'assust', 'medo', 'raiva', 'odei', 'odeio', 'amo', 'apaixon', 'chor', 'risad', 'vergonh', 'orgulh',
  'perdi', 'ganhei', 'milhao', 'milhoes', 'dinheiro', 'rico', 'pobre', 'falid', 'demiti', 'morte', 'morreu', 'sonho', 'fracass', 'sucesso',
  'erro', 'errei', 'mentir', 'verdade', 'segredo', 'polemic', 'ninguem', 'nunca', 'jamais', 'impossivel', 'inacreditavel', 'surreal',
  'bizarr', 'genial', 'perigo', 'grave', 'urgent', 'serio', 'odio', 'feliz', 'triste', 'desesper', 'ansiedad', 'depress', 'traum',
  'injust', 'escandal', 'insano', 'brutal', 'revolt', 'emocion', 'chocad', 'surpres', 'mudou minha', 'transform', 'proibid', 'golpe',
  'amazing', 'crazy', 'insane', 'never', 'secret', 'truth', 'hate', 'love', 'scared', 'money',
];
/** Uma regex só para as palavras emocionais (rápido em vídeos de 2 h com milhares de candidatos). */
const EMOTION_RE = new RegExp(`\\b(?:${EMOTION_PREFIXES.map((e) => e.replace(/ /g, '\\s+')).join('|')})`, 'g');
const LAUGH = /\b(ha(ha)+|kk+|rs(rs)+|risos)\b/;

/** Marcadores de virada ou conclusão: a história entrega algo. */
const PAYOFF = /\b(so que|mas ai|porem|foi quando|ai que|resultado|descobri|aprendi|a resposta|o segredo e|por isso|no final|moral da historia|conclusao|ou seja|resumindo|resumo|entao eu|a licao|o que funcionou|deu certo|that'?s why|turns out|the answer)\b/;

const BACK_REFERENCE = /^(isso|isto|esse|essa|esses|essas|ele|ela|eles|elas|aquilo|portanto|entao|e|mas|porque|como (eu )?falei|this|that|it|he|she|they|but|so)\b/;
const HANGING_END = /\b(se|porque|mas|porem|embora|que|e|ou|de|do|da|pra|para|com|o|a|um|uma|if|because|but|and|or|the)\s*[,.!?…]*$/;
const IDEAL_WPS = 2.7;

const medianCache = new WeakMap<object, number | null>();
function medianOf(env: ArrayLike<number>): number | null {
  const key = env as unknown as object;
  if (!medianCache.has(key)) medianCache.set(key, speechMedianDb(env));
  return medianCache.get(key)!;
}

/** Força do gancho de uma frase de abertura (0–1). */
export function hookStrength(text: string): number {
  const p = plain(text).trim();
  const raw = text.trim().split(/\s+/).filter(Boolean);
  if (raw.length === 0) return 0;
  let s = 0;
  const patterns = HOOK_PATTERNS.filter((re) => re.test(p)).length;
  s += Math.min(2, patterns) * 2.2;
  if (isQuestion(raw)) s += 2;
  if (raw.some((_, k) => parseNumberAt(raw, k) !== null)) s += 1.2;
  if (/\b(voce|voces|you)\b/.test(p)) s += 0.8;
  if (/!["”']?$/.test(text.trim())) s += 0.8;
  EMOTION_RE.lastIndex = 0;
  if (EMOTION_RE.test(p)) s += 0.8;
  if (raw.length >= 4 && raw.length <= 16) s += 0.6;
  if (raw.length < 3) s -= 1;
  if (WEAK_OPENERS.some((re) => re.test(p))) s -= 3;
  if (CTA.test(p)) s -= 3;
  return clamp01(s / 6);
}

/** Cada palavra é normalizada uma vez só (vídeos de 2 h geram dezenas de milhares de candidatos). */
interface WordFeat { p: string; emo: number; content: string | null }
const wordFeats = new WeakMap<Word, WordFeat>();
function feat(w: Word): WordFeat {
  let f = wordFeats.get(w);
  if (!f) {
    const p = plain(w.text.trim());
    EMOTION_RE.lastIndex = 0;
    const emo = (p.match(EMOTION_RE) ?? []).length;
    const t = p.replace(/^[^a-z0-9%$]+|[^a-z0-9%$]+$/g, '');
    f = { p, emo, content: t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t) && /^[a-z0-9]+$/.test(t) ? t : null };
    wordFeats.set(w, f);
  }
  return f;
}
const hookMemo = new Map<string, number>();
export function hookCached(text: string): number {
  let v = hookMemo.get(text);
  if (v === undefined) {
    if (hookMemo.size > 20_000) hookMemo.clear();
    v = hookStrength(text);
    hookMemo.set(text, v);
  }
  return v;
}

function setCohesion(a: Set<string>, b: Set<string>): number {
  if (a.size < 3 || b.size < 3) return 0.5;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  if (shared < 3) {
    const stems = new Set([...b].map((u) => u.slice(0, 5)));
    for (const t of a) if (!b.has(t) && stems.has(t.slice(0, 5))) shared += 0.5;
  }
  return clamp01((shared / Math.min(a.size, b.size)) * 3);
}

function emotionDensity(p: string, emoHits: number, minutes: number): number {
  let hits = emoHits;
  if (LAUGH.test(p)) hits += 3;
  // histórias em 1ª pessoa no passado ("eu perdi", "eu fui") prendem mais que explicação abstrata
  const story = (p.match(/\beu (fui|fiz|perdi|ganhei|tive|comecei|larguei|descobri|aprendi|errei|quase|nunca)\b/g) ?? []).length;
  return clamp01((hits + story * 1.5) / Math.max(0.25, minutes) / 9);
}

const contentWords = (text: string) => new Set(tokensOf(text).filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t)));

/**
 * Coesão entre a primeira e a segunda metade (ideia do TextTiling, Hearst 1997, usada pelo ClipsAI para
 * achar troca de assunto): metades que repetem palavras de conteúdo falam do mesmo assunto.
 */
export function cohesion(firstHalf: string, secondHalf: string): number {
  // sobreposição parcial também conta: "vender", "vendas", "vendendo"
  return setCohesion(contentWords(firstHalf), contentWords(secondHalf));
}

/** Nota de um trecho já com bordas em frases inteiras. `words` = só as palavras faladas do trecho. */
export function scoreSpan(words: readonly Word[], ctx: ScoreContext): SpanScore {
  const spoken = words.filter((w) => w.text.trim());
  if (spoken.length === 0) {
    const zero: ScoreBreakdown = { gancho: 0, emocao: 0, conclusao: 0, energia: 0, ritmo: 0, fechamento: 0, autonomia: 0, assunto: 0 };
    return { score: 0, parts: zero, reasons: ['sem fala reconhecida'] };
  }
  const start = spoken[0]!.start;
  const end = spoken.at(-1)!.end;
  const dur = Math.max(0.5, end - start);
  const text = spoken.map((w) => w.text.trim()).join(' ');
  const feats = spoken.map(feat);
  const plainText = feats.map((f) => f.p).join(' ');

  // Gancho: a primeira frase que se ouve. Frase muito curta ("Olha.") divide o gancho com a seguinte.
  const isEnd = (w: Word) => /[.!?…]["”')]*$/.test(w.text.trim());
  const sentenceEnd = (from: number) => {
    let k = from;
    while (k < spoken.length - 1 && !isEnd(spoken[k]!) && spoken[k]!.end - spoken[from]!.start < 6) k++;
    return k;
  };
  const e1 = sentenceEnd(0);
  const openingText = spoken.slice(0, e1 + 1).map((w) => w.text.trim()).join(' ');
  let gancho = hookCached(openingText);
  if (spoken[e1]!.end - start < 1.5 && e1 + 1 < spoken.length) {
    const e2 = sentenceEnd(e1 + 1);
    gancho = Math.max(gancho, 0.7 * hookCached(spoken.slice(e1 + 1, e2 + 1).map((w) => w.text.trim()).join(' ')));
  }

  const emocao = emotionDensity(plainText, feats.reduce((n, f) => n + f.emo, 0), dur / 60);

  const cut = start + dur * 0.55;
  let half = spoken.findIndex((w) => w.start >= cut);
  if (half < 0) half = spoken.length;
  const secondHalf = feats.slice(half).map((f) => f.p).join(' ');
  const conclusao = clamp01((PAYOFF.test(secondHalf) ? 0.7 : 0) + (/[.!]["”')]*$/.test(text) ? 0.3 : 0) + (/\b(por isso|ou seja|resumindo|a licao|moral)\b/.test(secondHalf) ? 0.2 : 0));

  let energia = 0.5;
  if (ctx.energy && ctx.energy.length) {
    const median = medianOf(ctx.energy);
    const m = median === null ? null : meanDbBetween(ctx.energy, start, end, ctx.energyStep ?? ENERGY_STEP_SEC);
    if (m !== null && median !== null) energia = clamp01(0.5 + (m - median) / 8);
  }

  const ritmo = clamp01(1 - Math.abs(spoken.length / dur - IDEAL_WPS) / 2.2);

  const last = spoken.at(-1)!.text.trim();
  let ls = feats.length - 1;
  while (ls > 0 && !/[.!?…]["”')]*$/.test(feats[ls - 1]!.p)) ls--;
  const lastSentence = feats.slice(ls).map((f) => f.p).join(' ');
  const fechamento = /\?["”')]*$/.test(last) ? 0.35 : /[.!…]["”')]*$/.test(last) ? (HANGING_END.test(lastSentence) ? 0.4 : 1) : 0.2;

  const autonomia = BACK_REFERENCE.test(plain(openingText).trim()) ? 0.25 : 1;
  const contentSet = (fs: WordFeat[]) => new Set(fs.flatMap((f) => (f.content ? [f.content] : [])));
  const assunto = setCohesion(contentSet(feats.slice(0, half)), contentSet(feats.slice(half)));

  const parts: ScoreBreakdown = { gancho, emocao, conclusao, energia, ritmo, fechamento, autonomia, assunto };
  let raw = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]) raw += WEIGHTS[k] * parts[k];

  // Silêncio morto dentro do trecho derruba a retenção.
  let dead = 0;
  for (let i = 1; i < spoken.length; i++) dead += Math.max(0, spoken[i]!.start - spoken[i - 1]!.end - 1);
  raw -= 30 * (dead / dur);
  // Tamanho perto do ideal pedido.
  raw += 4 * clamp01(1 - Math.abs(dur - ctx.limit.ideal) / Math.max(1, ctx.limit.max - ctx.limit.min)) - 2;
  if (CTA.test(plainText)) raw -= 12;

  const score = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
  return { score, parts, reasons: reasonsOf(parts, openingText, dead / dur) };
}

function reasonsOf(p: ScoreBreakdown, openingText: string, deadShare: number): string[] {
  const r: { w: number; text: string }[] = [];
  if (p.gancho >= 0.5) r.push({ w: p.gancho * WEIGHTS.gancho, text: isQuestion(openingText.split(/\s+/)) ? 'começa com uma pergunta que prende' : 'começa com um gancho forte' });
  if (p.emocao >= 0.45) r.push({ w: p.emocao * WEIGHTS.emocao, text: 'tem emoção ou opinião forte' });
  if (p.conclusao >= 0.7) r.push({ w: p.conclusao * WEIGHTS.conclusao, text: 'entrega uma conclusão' });
  if (p.energia >= 0.65) r.push({ w: p.energia * WEIGHTS.energia, text: 'voz mais animada que o resto do vídeo' });
  if (p.fechamento >= 1) r.push({ w: WEIGHTS.fechamento * 0.6, text: 'termina com a ideia fechada' });
  if (p.assunto >= 0.7) r.push({ w: p.assunto * WEIGHTS.assunto * 0.6, text: 'fala de um assunto só' });
  if (p.ritmo >= 0.8) r.push({ w: p.ritmo * WEIGHTS.ritmo * 0.5, text: 'ritmo de fala bom' });
  const out = r.sort((a, b) => b.w - a.w).map((x) => x.text).slice(0, 3);
  if (p.gancho < 0.25) out.push('começo fraco: confira se dá para começar mais à frente');
  if (p.autonomia < 1) out.push('pode depender do que foi dito antes');
  if (deadShare > 0.08) out.push('tem pausas longas');
  return out.length ? out : ['trecho de fala contínua'];
}

/** Palavras de enrolação no começo de um clipe ("é", "hum", "tipo", "bom", "então"). */
const FILLERS = new Set(['e', 'eh', 'ah', 'ahn', 'hum', 'hm', 'uh', 'um', 'tipo', 'bom', 'entao', 'ok', 'okay', 'beleza', 'enfim', 'so', 'assim', 'ne', 'olha', 'gente', 'galera', 'pessoal', 'well', 'like']);

/** Podem ser palavra de verdade ("É isso", "Um erro", "Bom produto"): só saem com vírgula ou reticências. */
const AMBIGUOUS = new Set(['e', 'so', 'assim', 'olha', 'um', 'bom', 'gente', 'like', 'well']);

/**
 * Quantas palavras do começo são só enrolação e podem ficar de fora do corte (no máximo 4, e sempre sobra
 * uma frase de verdade). "E", "mas" e "então" seguidos de vírgula também saem.
 */
export function leadingFillers(words: readonly Word[]): number {
  let k = 0;
  while (k < Math.min(4, words.length - 3)) {
    const t = plain(words[k]!.text.trim()).replace(/[^a-z]/g, '');
    if (!FILLERS.has(t)) break;
    // não pular um "é" que é verbo ("É isso que..."): só sai se tiver vírgula/reticências ou for interjeição clara
    if (AMBIGUOUS.has(t) && !/[,…]|\.\.\.$/.test(words[k]!.text)) break;
    k++;
  }
  return k;
}
