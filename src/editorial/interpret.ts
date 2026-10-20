import { AppError } from '../core/errors';
import {
  BRIEF_VERSION,
  LABELS,
  PROMPT_MAX,
  UNSUPPORTED_MAX,
  type CreativeBrief,
  type Emphasis,
  type Goal,
  type Level,
  type Pace,
  type PresetId,
  type Prohibition,
  type Tone,
} from '../core/brief';
import { STOPWORDS } from './detect';
import { lookIsEmpty } from '../core/look';
import { parseLookRules } from './look-rules';
import { stripAccents, tokenize, type Token } from './tokens';

export { stripAccents, tokenize } from './tokens';

/**
 * Intérprete do pedido por regras (português). Sempre disponível, sem rede e sem IA.
 * Lê só o texto que a pessoa escreveu; a transcrição do vídeo nunca passa por aqui
 * (é dado, não instrução).
 *
 * Como decide:
 * - frases conhecidas viram campos do brief (estilo, tom, intensidade, ritmo, objetivo, público,
 *   proibições, destaques, gancho);
 * - "sem X", "nada de X", "não use X", "evite X", "tire X" → proibição (aceita listas: "sem efeitos, emojis ou números");
 * - "destaque/realce/foco em X" → destaque;
 * - negação antes de um tom ("nada animado", "não muito agitado") inverte a intensidade;
 * - conflitos: pedido explícito ("estilo pop", "muito movimento") vale mais que o que vem do tom;
 *   entre pedidos do mesmo peso vale o primeiro; proibição sempre vence. Tudo vira nota no resumo.
 */

export interface Interpretation {
  /** brief sem gancho escolhido (o gancho depende das palavras do vídeo) */
  brief: CreativeBrief;
  /** entendeu pelo menos um pedido */
  understood: boolean;
  /** pedidos conhecidos que o app ainda não faz (sem as palavras soltas que sobraram) */
  knownUnsupported: string[];
}


type Effect =
  | { f: 'preset'; v: PresetId; strong: boolean }
  | { f: 'tone'; v: Tone }
  | { f: 'intensity'; v: Level; strong: boolean }
  | { f: 'pace'; v: Pace; strong: boolean }
  | { f: 'goal'; v: Goal }
  | { f: 'hook' };

interface Entry {
  phrase: string[];
  effects: Effect[];
  /** família para a negação: energia negada vira pouco movimento e vice-versa */
  energy?: 'up' | 'down';
}

const words = (s: string) => s.split(' ');
const entry = (phrases: string, effects: Effect[], energy?: 'up' | 'down'): Entry[] =>
  phrases.split('|').map((p) => ({ phrase: words(p), effects, energy }));

const TONE_ENERGETIC: Effect[] = [
  { f: 'tone', v: 'energetico' },
  { f: 'intensity', v: 'alta', strong: false },
  { f: 'preset', v: 'pop', strong: false },
];
const TONE_CALM: Effect[] = [
  { f: 'tone', v: 'calmo' },
  { f: 'intensity', v: 'baixa', strong: false },
  { f: 'pace', v: 'lento', strong: false },
];

/** Léxico (sem acentos). Frases mais longas têm prioridade sobre as curtas. */
const LEXICON: Entry[] = [
  ...entry('pop|estilo pop', [{ f: 'preset', v: 'pop', strong: true }]),
  ...entry('editorial|estilo editorial|estilo revista|revista', [{ f: 'preset', v: 'editorial', strong: true }]),
  ...entry('documental|estilo documental|documentario', [{ f: 'preset', v: 'documental', strong: true }, { f: 'tone', v: 'serio' }]),
  ...entry('animado|animada|energetico|energetica|energia|agitado|agitada|vibrante|empolgante|eletrico|eletrica|impactante|chamativo|chamativa|intenso|intensa|explosivo', TONE_ENERGETIC, 'up'),
  ...entry('calmo|calma|tranquilo|tranquila|suave|sereno|serena|relaxante|zen|leve|sem pressa|sossegado', TONE_CALM, 'down'),
  ...entry('minimalista|minimalismo|minimo|elegante|sofisticado|sofisticada|clean|limpo|limpa|discreto|discreta|chique|refinado|refinada|delicado', [
    { f: 'tone', v: 'elegante' },
    { f: 'preset', v: 'editorial', strong: false },
  ]),
  ...entry('serio|seria|jornalistico|jornalistica|sobrio|sobria|formal|profissional|corporativo|corporativa|institucional|neutro|neutra', [
    { f: 'tone', v: 'serio' },
    { f: 'preset', v: 'documental', strong: false },
  ]),
  ...entry('divertido|divertida|engracado|engracada|descontraido|descontraida|humor|zoeira|brincalhao|alegre|bem humorado', [
    { f: 'tone', v: 'divertido' },
    { f: 'preset', v: 'pop', strong: false },
  ]),
  ...entry('muito movimento|mais movimento|bastante movimento|mais animacao|muita animacao|bem dinamico|intensidade alta', [{ f: 'intensity', v: 'alta', strong: true }], 'up'),
  ...entry('pouco movimento|menos movimento|quase parado|sutil|sutis|pouca animacao|menos animacao|intensidade baixa|parado', [{ f: 'intensity', v: 'baixa', strong: true }], 'down'),
  ...entry('moderado|moderada|equilibrado|equilibrada|intensidade media|meio termo', [{ f: 'intensity', v: 'media', strong: true }]),
  ...entry('rapido|rapida|dinamico|dinamica|acelerado|acelerada|agil|ritmo rapido|frenetico|ritmado', [{ f: 'pace', v: 'rapido', strong: true }], 'up'),
  ...entry('lento|lenta|devagar|pausado|pausada|ritmo lento|cadenciado', [{ f: 'pace', v: 'lento', strong: true }], 'down'),
  ...entry('ritmo normal|ritmo medio', [{ f: 'pace', v: 'normal', strong: true }]),
  ...entry('vender|venda|vendas|vendendo|produto|oferta|promocao|comprar|compra|lancamento|converter|conversao', [{ f: 'goal', v: 'vender' }]),
  ...entry('ensinar|ensino|tutorial|aula|explicar|explicativo|explicativa|didatico|didatica|dicas|dica|passo a passo|educativo|educativa', [{ f: 'goal', v: 'ensinar' }]),
  ...entry('inspirar|inspirador|inspiradora|motivar|motivacional|motivacao|emocionante|emocionar', [{ f: 'goal', v: 'inspirar' }]),
  ...entry('entreter|entretenimento|divertir', [{ f: 'goal', v: 'entreter' }]),
  ...entry('informar|informativo|informativa|noticia|noticias|informacao', [{ f: 'goal', v: 'informar' }]),
  ...entry('gancho|gancho forte|comeco forte|abertura forte|inicio forte|prender a atencao|prenda a atencao|chamar atencao|chame atencao|prender atencao', [{ f: 'hook' }]),
];

const AUDIENCES: Record<string, string> = {
  iniciantes: 'iniciantes', jovens: 'jovens', adolescentes: 'adolescentes', criancas: 'crianças', empresarios: 'empresários', empreendedores: 'empreendedores',
  empreendedoras: 'empreendedoras', maes: 'mães', pais: 'pais', estudantes: 'estudantes', profissionais: 'profissionais', leigos: 'leigos', idosos: 'idosos',
  mulheres: 'mulheres', homens: 'homens', medicos: 'médicos', advogados: 'advogados', professores: 'professores', clientes: 'clientes', seguidores: 'seguidores',
  investidores: 'investidores', atletas: 'atletas', gestores: 'gestores', vendedores: 'vendedores', criadores: 'criadores', programadores: 'programadores',
};
const AUDIENCE_ADJ: Record<string, string> = { jovem: 'público jovem', adulto: 'público adulto', feminino: 'público feminino', masculino: 'público masculino', infantil: 'público infantil', geral: 'público geral', leigo: 'público leigo' };

/** Alvos das proibições. */
const FORBID_TARGETS: { phrase: string[]; v: Prohibition | 'legenda' }[] = [
  ...'efeito|efeitos|efeitos especiais|animacao|animacoes|firula|firulas|exagero|exageros'.split('|').map((p) => ({ phrase: words(p), v: 'efeitos' as const })),
  ...'emoji|emojis|emoticon|emoticons|figurinha|figurinhas'.split('|').map((p) => ({ phrase: words(p), v: 'emojis' as const })),
  ...'numero|numeros|numero grande|numeros grandes|estatistica|estatisticas|dados|porcentagem|porcentagens'.split('|').map((p) => ({ phrase: words(p), v: 'numeros' as const })),
  ...'zoom|zooms|aproximacao|aproximacoes|zoom in'.split('|').map((p) => ({ phrase: words(p), v: 'zoom' as const })),
  ...'transicao|transicoes|flash|flashes|piscada|piscadas'.split('|').map((p) => ({ phrase: words(p), v: 'transicoes' as const })),
  ...'titulo|titulos|titulo de abertura|titulo inicial'.split('|').map((p) => ({ phrase: words(p), v: 'titulo' as const })),
  ...'lista|listas|topicos'.split('|').map((p) => ({ phrase: words(p), v: 'listas' as const })),
  ...'pergunta|perguntas|pergunta em destaque|perguntas em destaque'.split('|').map((p) => ({ phrase: words(p), v: 'perguntas' as const })),
  ...'nome|nome na tela|meu nome'.split('|').map((p) => ({ phrase: words(p), v: 'nome' as const })),
  ...'destaque|destaques|palavra chave|palavras chave|palavra em destaque|palavras em destaque|palavras destacadas'.split('|').map((p) => ({ phrase: words(p), v: 'destaques' as const })),
  ...'barra|barrinha|barra de progresso|progresso'.split('|').map((p) => ({ phrase: words(p), v: 'barra' as const })),
  ...'chamada|chamada final|cta|siga|segue|call to action'.split('|').map((p) => ({ phrase: words(p), v: 'chamada' as const })),
  ...'texto|textos|texto na tela|textos na tela|letreiro|letreiros|escrita|escritas|textos animados|texto animado'.split('|').map((p) => ({ phrase: words(p), v: 'textos' as const })),
  ...'legenda|legendas'.split('|').map((p) => ({ phrase: words(p), v: 'legenda' as const })),
];

const FORBID_TRIGGERS = 'sem|nada de|nenhum|nenhuma|zero|nao use|nao usar|nao uses|nao coloque|nao coloca|nao colocar|nao ponha|nao por|nao quero|nao precisa de|nao precisa|nao tenha|nao inclua|nao incluir|nao mostre|nao mostrar|evite|evitar|evita|tire|tira|tirar|retire|remova|remover|proibido|dispenso'
  .split('|')
  .map(words);

/** Alvos dos destaques. */
const EMPHASIS_TARGETS: { phrase: string[]; v: Emphasis }[] = [
  ...'numero|numeros|dados|valores|valor|estatistica|estatisticas|porcentagem|porcentagens|precos|preco|resultados'.split('|').map((p) => ({ phrase: words(p), v: 'numeros' as const })),
  ...'palavra chave|palavras chave|palavras|termos|palavras importantes|pontos importantes|ideias principais'.split('|').map((p) => ({ phrase: words(p), v: 'palavras' as const })),
  ...'pergunta|perguntas'.split('|').map((p) => ({ phrase: words(p), v: 'perguntas' as const })),
  ...'lista|listas|topicos|passos|etapas|itens'.split('|').map((p) => ({ phrase: words(p), v: 'listas' as const })),
  ...'nome|meu nome'.split('|').map((p) => ({ phrase: words(p), v: 'nome' as const })),
];
const EMPHASIS_TRIGGERS = 'destaque|destaca|destacar|destacando|destacado|destacados|realce|realca|realcar|enfatize|enfatiza|enfatizar|enfase|foco|focar|foque|valorize|valoriza|valorizar|ressalte|ressaltar|evidencie|evidenciar|aumente|grandes'
  .split('|')
  .map(words);

/** Palavras de ligação dentro de uma lista ("sem efeitos, emojis ou números"). */
const LIST_GLUE = new Set(['e', 'ou', 'nem', ',', 'de', 'do', 'da', 'dos', 'das', 'o', 'a', 'os', 'as', 'um', 'uma', 'nenhum', 'nenhuma', 'muito', 'muitos', 'muitas', 'qualquer', 'tipo', 'em', 'no', 'na', 'nos', 'nas', 'mais', 'tambem', 'para']);
const NEGATIONS = new Set(['nao', 'nada', 'nem', 'menos', 'sem', 'nunca', 'jamais']);
/** Não entram na lista "palavras que não usei". */
const FILLER = new Set(
  stripAccents(
    'quero queria gostaria preciso desejo vídeo video videos edição edicao editar edite edita estilo bem muito mais menos tom ritmo deixe deixa deixar faça faca faz fazer coloque coloca colocar ' +
      'favor fique ficar seja algo coisa porém porem apenas pouco quase bastante super mega reels instagram tiktok shorts youtube clima vibe jeito forma cara pegada ' +
      'quero tudo use usar uso mostre mostrar mas por isso esse essa com sem nada que para pra pro sobre meu minha nosso nossa favor obrigado obrigada oi olá ola ' +
      'legenda legendas só so final começo comeco inicio início fim parte trecho trechos frase frases fala falas tela movimento animação animacao intensidade',
  ).split(' '),
);
const STOP_NORM = new Set([...STOPWORDS].map(stripAccents));

/** Uma frase do léxico começa no token i? Devolve o tamanho casado (o mais longo) ou 0. */
function matchAt<T extends { phrase: string[] }>(toks: Token[], i: number, list: T[]): T | null {
  let best: T | null = null;
  for (const e of list) {
    if (e.phrase.length > (best?.phrase.length ?? 0) && e.phrase.every((w, k) => toks[i + k]?.norm === w)) best = e;
  }
  return best;
}

const triggerAt = (toks: Token[], i: number, triggers: string[][]): number => {
  let best = 0;
  for (const t of triggers) if (t.length > best && t.every((w, k) => toks[i + k]?.norm === w)) best = t.length;
  return best;
};

const ART = new Set(['o', 'a', 'os', 'as', 'meu', 'minha', 'meus', 'minhas', 'mais', 'bem', 'todos', 'todas', 'cada']);

/** "destaque" seguido de um alvo de destaque é verbo (pedido de destaque), não "sem destaque". */
function isEmphasisVerb(toks: Token[], i: number): boolean {
  if (!['destaque', 'destaca', 'destacar', 'realce', 'enfatize', 'valorize', 'foco'].includes(toks[i]?.norm ?? '')) return false;
  let k = i + 1;
  while (toks[k] && (ART.has(toks[k]!.norm) || toks[k]!.norm === 'em' || toks[k]!.norm === 'nos' || toks[k]!.norm === 'nas')) k++;
  return matchAt(toks, k, EMPHASIS_TARGETS) !== null;
}

export function interpretPrompt(text: string): Interpretation {
  const prompt = text.replace(/\s+/g, ' ').trim();
  if (!prompt) throw new AppError('PEDIDO_VAZIO');
  if (prompt.length > PROMPT_MAX) throw new AppError('PEDIDO_LONGO', `${prompt.length} caracteres`);
  const toks = tokenize(prompt);
  const used = new Array<boolean>(toks.length).fill(false);
  const mark = (from: number, n: number) => {
    for (let k = from; k < from + n; k++) used[k] = true;
  };
  const conflicts: string[] = [];
  const forbid: Prohibition[] = [];
  const emphasize: Emphasis[] = [];
  let mentionedCaptionsOff = false;

  // 0) look (cores, legenda, emojis, cortes, gancho criativo...): antes das proibições, porque
  //    "legenda sem animação" e "sem fundo" são da legenda; "sem emojis" fica para as proibições
  const lookRules = parseLookRules(prompt, toks, used);
  conflicts.push(...lookRules.notes);

  // 1) proibições (antes de tudo: "sem pressa" é tom, não proibição; o léxico de tom é testado primeiro só nessa posição)
  for (let i = 0; i < toks.length; i++) {
    if (used[i]) continue;
    const tone = matchAt(toks, i, LEXICON);
    if (tone && tone.phrase.length > 1 && tone.phrase[0] === 'sem') continue;
    const trig = triggerAt(toks, i, FORBID_TRIGGERS);
    if (!trig) continue;
    let k = i + trig;
    const found: number[] = [];
    while (k < toks.length) {
      if (isEmphasisVerb(toks, k)) break;
      const t = matchAt(toks, k, FORBID_TARGETS);
      if (t) {
        if (t.v === 'legenda') mentionedCaptionsOff = true;
        else if (!forbid.includes(t.v)) forbid.push(t.v);
        mark(k, t.phrase.length);
        found.push(k);
        k += t.phrase.length;
        continue;
      }
      if (LIST_GLUE.has(toks[k]!.norm) && k + 1 < toks.length) {
        k++;
        continue;
      }
      break;
    }
    if (found.length > 0) {
      mark(i, trig);
      // a cola entre o gatilho e o último alvo também foi usada
      mark(i, found.at(-1)! - i);
    }
  }

  // 2) destaques
  for (let i = 0; i < toks.length; i++) {
    if (used[i]) continue;
    const trig = triggerAt(toks, i, EMPHASIS_TRIGGERS);
    if (trig) {
      let k = i + trig;
      let hit = -1;
      while (k < toks.length && k <= i + trig + 6) {
        if (used[k]) break;
        const t = matchAt(toks, k, EMPHASIS_TARGETS);
        if (t) {
          if (!emphasize.includes(t.v)) emphasize.push(t.v);
          mark(k, t.phrase.length);
          hit = k;
          k += t.phrase.length;
          continue;
        }
        if (LIST_GLUE.has(toks[k]!.norm) || ART.has(toks[k]!.norm)) {
          k++;
          continue;
        }
        break;
      }
      if (hit >= 0) mark(i, hit - i);
      continue;
    }
    // "números em destaque", "números grandes"
    const t = matchAt(toks, i, EMPHASIS_TARGETS);
    if (t) {
      const after = i + t.phrase.length;
      if ((toks[after]?.norm === 'em' && toks[after + 1]?.norm === 'destaque') || toks[after]?.norm === 'grandes') {
        if (!emphasize.includes(t.v)) emphasize.push(t.v);
        mark(i, t.phrase.length + (toks[after]?.norm === 'em' ? 2 : 1));
      }
    }
  }

  // 3) público
  let audience: string | null = null;
  for (let i = 0; i < toks.length && !audience; i++) {
    if (used[i]) continue;
    const n = toks[i]!.norm;
    if ((n === 'para' || n === 'pra') && toks[i + 1]) {
      let k = i + 1;
      while (toks[k] && ART.has(toks[k]!.norm)) k++;
      const a = toks[k] && AUDIENCES[toks[k]!.norm];
      if (a) {
        audience = a;
        mark(i, k - i + 1);
      }
    }
    if (n === 'publico' && toks[i + 1]) {
      const adj = AUDIENCE_ADJ[toks[i + 1]!.norm];
      const noun = AUDIENCES[toks[i + 1]!.norm];
      if (adj || noun) {
        audience = adj ?? noun!;
        mark(i, 2);
      }
    }
  }

  // 4) tom, estilo, intensidade, ritmo, objetivo, gancho (com negação)
  type Pick<T> = { v: T; strong: boolean; word: string } | null;
  let preset: Pick<PresetId> = null;
  let intensity: Pick<Level> = null;
  let pace: Pick<Pace> = null;
  let tone: Tone | null = null;
  let goal: Goal | null = null;
  let wantsHook = lookRules.wantsHook;
  const setPick = <T extends string>(cur: Pick<T>, v: T, strong: boolean, word: string, label: (x: T) => string, what: string): Pick<T> => {
    if (!cur || (strong && !cur.strong)) {
      if (cur && cur.v !== v) conflicts.push(`${what}: "${word}" vale mais que "${cur.word}"; ficou ${label(v)}.`);
      return { v, strong, word };
    }
    if (cur.v !== v && !(cur.strong && !strong)) conflicts.push(`${what}: você pediu "${cur.word}" e "${word}"; ficou ${label(cur.v)} (o primeiro).`);
    else if (cur.v !== v) conflicts.push(`${what}: "${cur.word}" vale mais que "${word}"; ficou ${label(cur.v)}.`);
    return cur;
  };

  for (let i = 0; i < toks.length; i++) {
    if (used[i]) continue;
    const e = matchAt(toks, i, LEXICON);
    if (!e) continue;
    const word = toks
      .slice(i, i + e.phrase.length)
      .map((t) => t.raw)
      .join(' ');
    // negação até 2 palavras antes ("nada animado", "não muito agitado", "sem agitação")
    const negated = e.phrase[0] !== 'sem' && [toks[i - 1], toks[i - 2]].some((t, idx) => t && NEGATIONS.has(t.norm) && (idx === 0 || ['muito', 'tao', 'tanto', 'quero', 'tão'].includes(toks[i - 1]!.norm)));
    mark(i, e.phrase.length);
    if (negated) {
      const neg = [toks[i - 1], toks[i - 2]].findIndex((t) => t && NEGATIONS.has(t.norm));
      mark(i - 1 - neg, 1 + neg);
      const said = toks
        .slice(i - 1 - neg, i + e.phrase.length)
        .map((t) => t.raw)
        .join(' ');
      if (e.energy) {
        const v: Level = e.energy === 'up' ? 'baixa' : 'alta';
        intensity = setPick<Level>(intensity, v, true, said, (x) => LABELS.intensity[x], 'Intensidade');
        conflicts.push(`Entendi "${said}" como ${LABELS.intensity[v]}.`);
      } else {
        conflicts.push(`Ignorei "${said}" porque veio negado.`);
      }
      continue;
    }
    for (const ef of e.effects) {
      if (ef.f === 'preset') preset = setPick<PresetId>(preset, ef.v, ef.strong, word, (x) => `o estilo ${LABELS.preset[x]}`, 'Estilo');
      else if (ef.f === 'intensity') intensity = setPick<Level>(intensity, ef.v, ef.strong, word, (x) => LABELS.intensity[x], 'Intensidade');
      else if (ef.f === 'pace') pace = setPick<Pace>(pace, ef.v, ef.strong, word, (x) => LABELS.pace[x], 'Ritmo');
      else if (ef.f === 'tone') tone ??= ef.v;
      else if (ef.f === 'goal') goal ??= ef.v;
      else if (ef.f === 'hook') wantsHook = true;
    }
  }

  // 5) proibição sempre vence
  const effectsOff = forbid.some((p) => p === 'efeitos' || p === 'zoom' || p === 'transicoes');
  if (effectsOff && (intensity?.v === 'alta' || tone === 'energetico')) {
    const what = forbid.filter((p) => p === 'efeitos' || p === 'zoom' || p === 'transicoes').map((p) => `"sem ${LABELS.prohibition[p].split(' (')[0]}"`);
    conflicts.push(`Você pediu algo animado, mas também ${what.join(' e ')}: a proibição vale mais. O ritmo das cenas continua, sem esses efeitos.`);
  }
  const blocks: Record<Emphasis, Prohibition[]> = { numeros: ['numeros', 'textos'], palavras: ['destaques', 'textos'], perguntas: ['perguntas', 'textos'], listas: ['listas', 'textos'], nome: ['nome', 'textos'] };
  for (const e of [...emphasize]) {
    const p = blocks[e].find((x) => forbid.includes(x));
    if (p) {
      emphasize.splice(emphasize.indexOf(e), 1);
      conflicts.push(`Você pediu para destacar ${LABELS.emphasis[e]}, mas também proibiu ${LABELS.prohibition[p].split(' (')[0]}: a proibição vale mais.`);
    }
  }
  if (wantsHook && (forbid.includes('titulo') || forbid.includes('textos'))) {
    conflicts.push('O gancho aparece como título de abertura, que foi proibido: o gancho não será mostrado na tela.');
  }
  if (mentionedCaptionsOff) conflicts.push('A legenda não pode ser desligada nesta versão; ela continua no vídeo.');

  // proibição sempre vence o look: "sem emojis" desliga emojis pedidos; "sem barra" vence "com barra"
  const look = lookRules.look;
  if (forbid.includes('emojis') && look.emoji && look.emoji.mode !== 'off') {
    delete look.emoji;
    conflicts.push('Você pediu emojis e também "sem emojis": a proibição vale mais.');
  }
  if (look.scenes) {
    for (const k of Object.keys(look.scenes) as (keyof NonNullable<typeof look.scenes>)[]) {
      if (look.scenes[k] && (forbid.includes(k) || forbid.includes('textos'))) {
        delete look.scenes[k];
        conflicts.push(`Você pediu e proibiu ${LABELS.prohibition[k].split(' (')[0]}: a proibição vale mais.`);
      }
    }
    if (Object.keys(look.scenes).length === 0) delete look.scenes;
  }
  if (look.transition && look.transition !== 'none' && forbid.some((p) => p === 'efeitos' || p === 'transicoes')) {
    delete look.transition;
    conflicts.push('Você escolheu uma transição, mas também pediu sem transições/efeitos: a proibição vale mais.');
  }

  const ignored: string[] = [];
  toks.forEach((t, i) => {
    if (used[i] || !meaningful(t)) return;
    if (!ignored.includes(t.raw) && ignored.length < 12) ignored.push(t.raw.slice(0, 40));
  });
  const unsupported = [...lookRules.unsupported, ...leftoverPhrases(toks, used)].filter((x, i, all) => all.indexOf(x) === i).slice(0, UNSUPPORTED_MAX);

  const finalPreset = preset as Pick<PresetId>;
  const finalIntensity = intensity as Pick<Level>;
  const finalPace = pace as Pick<Pace>;
  const brief: CreativeBrief = {
    version: BRIEF_VERSION,
    prompt,
    source: 'regras',
    goal,
    audience,
    tone,
    intensity: finalIntensity?.v ?? null,
    pace: finalPace?.v ?? null,
    preset: finalPreset?.v ?? null,
    forbid,
    emphasize,
    wantsHook,
    hook: null,
    locked: [],
    notes: { conflicts: conflicts.slice(0, 10).map((c) => c.slice(0, 200)), ignored },
    look,
    hookStyle: lookRules.hookStyle,
    unsupported: unsupported.map((u) => u.slice(0, 60)),
    summary: '',
  };
  const understood = !!(goal || audience || tone || brief.intensity || brief.pace || brief.preset || forbid.length || emphasize.length || wantsHook || mentionedCaptionsOff || !lookIsEmpty(look) || lookRules.hookStyle);
  return { brief, understood, knownUnsupported: lookRules.unsupported.slice(0, UNSUPPORTED_MAX) };
}

const meaningful = (t: Token) => t.norm.length >= 3 && !/^[,.;!?]$/.test(t.norm) && !STOP_NORM.has(t.norm) && !FILLER.has(t.norm);

/**
 * Palavras que sobraram, agrupadas em pedaços ("música de fundo", "transição 3d") para a lista
 * "Ainda não sei fazer". Palavras de ligação no começo e no fim do pedaço saem.
 */
export function leftoverPhrases(toks: Token[], used: boolean[]): string[] {
  const out: string[] = [];
  let run: Token[] = [];
  const flush = () => {
    while (run.length && !meaningful(run[0]!)) run.shift();
    while (run.length && !meaningful(run.at(-1)!)) run.pop();
    if (run.some(meaningful)) out.push(run.map((t) => t.raw).join(' ').slice(0, 60));
    run = [];
  };
  toks.forEach((t, i) => {
    if (used[i] || /^[,.;!?]$/.test(t.norm)) flush();
    else run.push(t);
  });
  flush();
  return out;
}
