import type { Register } from '../core/brief';
import { commentCta, ctaText, type CtaKind } from '../core/cta';
import { CTA_RE, HANDLE_RE, TITLE_RE, cleanShortText, type HookStyle } from '../core/look';
import { NICHES, type NicheId } from '../core/niches';
import { isBoundary, longestAt, numberAt, stripAccents, tokenize, type Token } from './tokens';

/**
 * Regras do pedido da v0.12 (ADR-0017), sem IA: chamada final ("link na bio", "comenta QUERO"), @ no
 * canto, título escrito pela pessoa (entre aspas ou "título: …"), linguagem formal/informal,
 * "pronto pra postar", legenda longe do rosto, listas ("3 dicas", "numera"), aberturas ("começa com o
 * preço") e o tipo de conteúdo (nicho: "sou corretor", "vídeo pra minha loja").
 * Textos que vão para a tela vêm só do próprio pedido ou das frases fixas de `core/cta.ts`.
 */

export interface ExtraResult {
  cta: string | null;
  handle: string | null;
  title: string | null;
  register: Register | null;
  wantsHook: boolean;
  hookStyle: HookStyle | null;
  /** "pronto pra postar", "coloca a chamada" sem texto */
  ctaScene: boolean;
  avoidFace: boolean;
  lists: boolean;
  notes: string[];
}

const NEG = new Set(['sem', 'nao', 'nada', 'nenhum', 'nenhuma', 'tira', 'tire', 'tirar', 'evite', 'nunca']);

/** [frases, tipo, linguagem que a frase sugere] — "siga" é formal, "segue" é informal. */
const CTA_PHRASES: [string, CtaKind, Register | null][] = [
  ...'siga para mais|siga pra mais|siga o perfil|siga a pagina|siga|sigam'.split('|').map((p) => [p, 'siga', 'formal'] as [string, CtaKind, Register]),
  ...'me segue|me siga|segue pra mais|segue para mais|segue o perfil|seguir o perfil|pra seguir|para seguir|pede pra seguir|pedir pra seguir|segue a gente'.split('|').map((p) => [p, 'siga', p.includes('siga') ? 'formal' : null] as [string, CtaKind, Register | null]),
  ...'link na bio|link da bio|link no perfil|link na descricao|clica no link|clique no link|link'.split('|').map((p) => [p, 'link-bio', null] as [string, CtaKind, null]),
  ...'salve|salve esse video|salve para|salve pra|salvem'.split('|').map((p) => [p, 'salve', 'formal'] as [string, CtaKind, Register]),
  ...'salva|salva esse|salva o video|salva pra|salvar o video|pede pra salvar'.split('|').map((p) => [p, 'salve', 'informal'] as [string, CtaKind, Register]),
  ...'compartilhe|compartilhem'.split('|').map((p) => [p, 'compartilhe', 'formal'] as [string, CtaKind, Register]),
  ...'compartilha|manda pra|manda esse video pra|envia pra'.split('|').map((p) => [p, 'compartilhe', 'informal'] as [string, CtaKind, Register]),
  ...'marque alguem|marque um amigo|marque uma amiga|marque quem'.split('|').map((p) => [p, 'marque', 'formal'] as [string, CtaKind, Register]),
  ...'marca aquele amigo|marca aquela amiga|marca um amigo|marca uma amiga|marca alguem|marca quem|marca o amigo|marca a amiga'.split('|').map((p) => [p, 'marque', 'informal'] as [string, CtaKind, Register]),
  ...'chama no direct|me chama no direct|direct|dm|inbox|no privado|manda mensagem|mande mensagem|envie uma mensagem'.split('|').map((p) => [p, 'direct', null] as [string, CtaKind, null]),
  ...'whatsapp|whats|zap|wpp|zapzap|whatsap|watsapp'.split('|').map((p) => [p, 'whatsapp', null] as [string, CtaKind, null]),
  ...'agende|agende sua consulta|agende seu horario|agende uma consulta|marque sua consulta|marque seu horario'.split('|').map((p) => [p, 'agende', 'formal'] as [string, CtaKind, Register]),
  ...'agenda seu horario|agenda sua consulta|agenda um horario|agenda ja|marca seu horario|marca sua consulta|pra agendar|para agendar'.split('|').map((p) => [p, 'agende', 'informal'] as [string, CtaKind, Register]),
  ...'agende sua visita|agende uma visita|agendar visita|agendar uma visita|pra visitar|para visitar|marque uma visita'.split('|').map((p) => [p, 'visita', null] as [string, CtaKind, null]),
  ...'garanta o seu|garanta a sua|garanta ja|compre ja|compre agora|compra ja|garante o seu|garante ja'.split('|').map((p) => [p, 'compre', p.startsWith('garanta') || p.startsWith('compre') ? 'formal' : 'informal'] as [string, CtaKind, Register]),
  ...'inscreva se|se inscreve|inscrevam se|se inscreva|inscreva'.split('|').map((p) => [p, 'inscreva', null] as [string, CtaKind, null]),
  ...'episodio completo|ep completo|video completo no canal|episodio inteiro|completo no canal'.split('|').map((p) => [p, 'episodio', null] as [string, CtaKind, null]),
  ...'pedir pelo delivery|pede pelo delivery|peca pelo delivery|peca ja|pede ja|faca seu pedido|faz seu pedido|peca pelo ifood|pede no ifood|pedir pelo ifood'.split('|').map((p) => [p, 'delivery', p.startsWith('peca') || p.startsWith('faca') ? 'formal' : 'informal'] as [string, CtaKind, Register]),
  ...'curte e segue|curta e siga'.split('|').map((p) => [p, 'curta', null] as [string, CtaKind, null]),
  ...'comente|comentem|comenta|comentar|deixa nos comentarios|escreve nos comentarios|pede pra comentar'.split('|').map((p) => [p, 'comente', p === 'comente' || p === 'comentem' ? 'formal' : null] as [string, CtaKind, Register | null]),
];
const CTA_LIST = CTA_PHRASES.map(([p]) => p);
const CTA_OF = new Map(CTA_PHRASES.map(([p, k, r]) => [p, { kind: k, register: r }]));
/** Palavras em volta da chamada que também foram entendidas. */
const CTA_CONTEXT = 'no final|no fim|final|ao final|cta|chamada final|chamada|termina com|terminar com|termine com|encerra com|encerrar com|fecha com|pede pra|pedindo pra|pede para|call to action|e no final|chama pro|chama pra|manda pro'.split('|');
/** Explicação depois da chamada ("comenta QUERO que eu mando o link"): o resto da parte foi entendido. */
const CTA_EXPLAINS = new Set<CtaKind>(['comente', 'marque', 'compartilhe', 'siga', 'salve', 'direct', 'whatsapp', 'agende', 'visita', 'link-bio']);

const REGISTER_PHRASES: [string, Register][] = [
  ['linguagem formal', 'formal'], ['mais formal', 'formal'], ['tom formal', 'formal'], ['formal', 'formal'], ['linguagem culta', 'formal'],
  ['linguagem informal', 'informal'], ['mais informal', 'informal'], ['informal', 'informal'], ['com girias', 'informal'], ['girias', 'informal'], ['giria', 'informal'], ['mais solto', 'informal'], ['linguagem do dia a dia', 'informal'], ['linguagem simples', 'informal'],
];

const READY = 'pronto pra postar|pronto para postar|pronto pra publicar|pronto para publicar|pronto pro insta|pronto pro instagram|pronto pro tiktok|pronta pra postar|caprichado|caprichada|capricha|caprichar|bem finalizado|finalizado|completinho|faz o trabalho todo|faz tudo'.split('|');
const FACE = 'longe do rosto|longe do meu rosto|longe da cara|longe da minha cara|nao tampar o rosto|nao tampe o rosto|nao cobrir o rosto|nao cubra o rosto|sem cobrir o rosto|sem tampar o rosto|fora do rosto|fora da cara|nao ficar em cima do rosto|nao fica em cima do rosto|em cima do meu rosto|em cima do rosto|nao tapar a cara|nao tampar minha cara|desvia do rosto|desviar do rosto|na frente do rosto|na frente da cara'.split('|');
const LIST_WORDS = 'numera|numerar|numere|numerada|numerado|numeradas|numerados|enumera|enumerar|enumere|em lista|em listinha|lista numerada|em topicos|por topicos|em passos|passo 1|item por item'.split('|');
const LIST_NOUNS = new Set('dicas dica passos erros mitos exercicios motivos formas maneiras segredos habitos coisas ideias apps lugares truques regras etapas topicos itens sinais beneficios cuidados alimentos produtos destinos livros ferramentas perguntas verdades licoes'.split(' '));

const HOOK_VERBS = 'comeca com|comece com|comecar com|comeca pelo|comeca pela|comece pelo|comece pela|abre com|abra com|abrir com|inicia com|inicie com|iniciar com|comeca falando|primeira coisa'.split('|');
const HOOK_TYPE: [string, HookStyle][] = [
  ['pergunta', 'pergunta'], ['perguntas', 'pergunta'], ['questionamento', 'pergunta'],
  ['preco', 'numero'], ['numero', 'numero'], ['valor', 'numero'], ['dado', 'numero'], ['estatistica', 'numero'], ['porcentagem', 'numero'], ['resultado', 'numero'],
  ['polemica', 'impacto'], ['polemico', 'impacto'], ['chocante', 'impacto'], ['impactante', 'impacto'], ['impacto', 'impacto'], ['forte', 'impacto'], ['bomba', 'impacto'], ['marcante', 'impacto'],
  ['diferente', 'criativo'], ['criativa', 'criativo'], ['criativo', 'criativo'], ['inusitada', 'criativo'], ['surpresa', 'criativo'],
];
const HOOK_ALONE: [string, HookStyle | null][] = [
  ['comeca perguntando', 'pergunta'], ['abre perguntando', 'pergunta'], ['comece perguntando', 'pergunta'], ['comecar perguntando', 'pergunta'],
  ['frase de impacto', 'impacto'], ['frase forte', 'impacto'], ['frase marcante', 'impacto'], ['frase de efeito', 'impacto'],
  ['pra prender', null], ['para prender', null], ['que prenda', null], ['prender a pessoa', null], ['segurar a atencao', null], ['nos primeiros segundos', null], ['logo no comeco', null], ['logo no inicio', null],
  ['nada obvio', 'criativo'], ['fuja do obvio', 'criativo'], ['sem cliche', 'criativo'], ['nada cliche', 'criativo'],
];

const QUOTE = /["“”]([^"“”]{2,60})["“”]/g;
const TITLE_COLON = /t[ií]tulo\s*[:=]\s*([^,;!?\n"“”]{2,60})/i;
const HANDLE = /@([a-z0-9._]{2,30})/i;
const UPPER_COMMENT = /\bcoment(?:a|e|em|ar)\s+(?:a palavra\s+|com\s+)?["“]?((?:[A-ZÀ-Ú0-9]{2,16})(?:\s+[A-ZÀ-Ú0-9]{2,16})?)\b/u;

const norm = (s: string) => stripAccents(s.toLowerCase());

/** Acha a sequência de tokens de `text` dentro de `toks` (a partir de `from`) e marca. */
function markSequence(toks: Token[], used: boolean[], text: string, from = 0): number {
  const want = tokenize(text).map((t) => t.norm);
  if (!want.length) return -1;
  for (let i = from; i + want.length <= toks.length; i++) {
    if (want.every((w, k) => toks[i + k]!.norm === w)) {
      for (let k = 0; k < want.length; k++) used[i + k] = true;
      return i;
    }
  }
  return -1;
}

const clauseEnd = (toks: Token[], i: number) => {
  let k = i;
  while (k < toks.length && !isBoundary(toks[k])) k++;
  return k;
};
const negatedAt = (toks: Token[], i: number) => NEG.has(toks[i - 1]?.norm ?? '') || (NEG.has(toks[i - 2]?.norm ?? '') && ['de', 'a', 'o', 'uma', 'um', 'quero'].includes(toks[i - 1]?.norm ?? ''));

export function parseExtras(prompt: string, toks: Token[], used: boolean[]): ExtraResult {
  const mark = (from: number, n: number) => {
    for (let k = from; k < from + n; k++) if (k >= 0 && k < used.length) used[k] = true;
  };
  const free = (i: number, n: number) => {
    for (let k = i; k < i + n; k++) if (!toks[k] || used[k]) return false;
    return true;
  };
  const out: ExtraResult = { cta: null, handle: null, title: null, register: null, wantsHook: false, hookStyle: null, ctaScene: false, avoidFace: false, lists: false, notes: [] };
  const markContextBefore = (i: number) => {
    for (let back = 1; back <= 4; back++) {
      const k = i - back;
      if (k < 0 || isBoundary(toks[k])) break;
      for (const c of CTA_CONTEXT) {
        const n = c.split(' ').length;
        if (k - n + 1 >= 0 && longestAt(toks, k - n + 1, [c]) === c) mark(k - n + 1, n);
      }
    }
  };

  // 1) linguagem ("formal", "com gírias")
  for (let i = 0; i < toks.length; i++) {
    const p = longestAt(toks, i, REGISTER_PHRASES.map(([w]) => w));
    if (!p || !free(i, p.split(' ').length) || negatedAt(toks, i)) continue;
    const v = REGISTER_PHRASES.find(([w]) => w === p)![1];
    out.register ??= v;
    // "formal" sozinho também diz o tom (sério); fica livre para o léxico de tom
    if (p !== 'formal') mark(i, p.split(' ').length);
  }

  // 2) @ da pessoa ("coloca meu @ no canto, @minhaloja")
  const h = HANDLE.exec(prompt);
  if (h) {
    const handle = `@${h[1]!.toLowerCase().replace(/[.]+$/, '')}`;
    if (HANDLE_RE.test(handle)) {
      out.handle = handle;
      markSequence(toks, used, h[1]!.replace(/[.]+$/, ''));
      for (let i = 0; i < toks.length; i++) {
        const p = longestAt(toks, i, ['marca dagua', 'marca d agua', 'marca de agua', 'meu arroba', 'arroba', 'meu perfil', 'meu insta', 'meu instagram', 'no canto', 'meu usuario', 'assinatura', 'com meu', 'meu']);
        if (p && free(i, p.split(' ').length)) mark(i, p.split(' ').length);
      }
    }
  }

  // 3) textos entre aspas: título, chamada ou "comente X"
  for (const m of prompt.matchAll(QUOTE)) {
    const inner = m[1]!.trim();
    const before = norm(prompt.slice(Math.max(0, m.index! - 40), m.index!));
    const at = markSequence(toks, used, inner);
    if (/(tipo|como|exemplo|ex|estilo)\s*:?\s*$/.test(before)) {
      out.notes.push(`Entendi “${inner}” como exemplo, não como texto para a tela.`);
      continue;
    }
    if (/coment\w*\s*(a palavra|com)?\s*$/.test(before)) {
      out.cta = commentCta(inner, out.register) ?? out.cta;
      if (at > 0) markContextBefore(at);
    } else if (/(final|fim|cta|chamada|termin\w*|encerr\w*|fech\w*)\s*(com|:)?\s*$/.test(before)) {
      const t = cleanShortText(inner, CTA_RE);
      if (t) out.cta = t;
      else out.notes.push(`A chamada final pode ter até 32 letras; “${inner.slice(0, 40)}” ficou de fora.`);
      if (at > 0) markContextBefore(at);
    } else {
      const t = cleanShortText(inner, TITLE_RE);
      if (t) out.title = t;
      if (at > 0) {
        for (let back = 1; back <= 4 && at - back >= 0; back++) {
          if (['titulo', 'escrito', 'escreve', 'escrever', 'texto', 'frase', 'coloca', 'coloque', 'bota', 'com'].includes(toks[at - back]!.norm)) mark(at - back, 1);
          else break;
        }
      }
    }
  }
  const tc = TITLE_COLON.exec(prompt);
  if (tc && !out.title) {
    const t = cleanShortText(tc[1]!.replace(/[.\s]+$/, ''), TITLE_RE);
    if (t) {
      out.title = t;
      const at = markSequence(toks, used, t);
      if (at > 0 && toks[at - 1]!.norm === 'titulo') mark(at - 1, 1);
    }
  }

  // 4) "comenta QUERO" (palavra em maiúsculas, sem aspas)
  const uc = UPPER_COMMENT.exec(prompt);
  if (uc && !out.cta) {
    const word = uc[1]!;
    const c = commentCta(word, out.register);
    if (c) {
      out.cta = c;
      const at = markSequence(toks, used, word);
      if (at > 0) {
        mark(at - 1, 1);
        mark(at, clauseEnd(toks, at) - at);
        markContextBefore(at - 1);
      }
    }
  }

  // 5) chamadas conhecidas
  for (let i = 0; i < toks.length && !out.cta; i++) {
    const p = longestAt(toks, i, CTA_LIST);
    if (!p) continue;
    const n = p.split(' ').length;
    if (!free(i, n) || negatedAt(toks, i)) continue;
    // "agenda pra postar" é agendar a postagem; "marca texto" é destaque
    if (/^(agend|marc)/.test(p) && ['postar', 'postagem', 'publicar', 'texto', 'dagua'].includes(toks[i + n]?.norm ?? toks[i + 1]?.norm ?? '')) continue;
    const { kind, register } = CTA_OF.get(p)!;
    out.cta = ctaText(kind, out.register ?? register);
    mark(i, n);
    markContextBefore(i);
    if (CTA_EXPLAINS.has(kind)) mark(i + n, clauseEnd(toks, i + n) - (i + n));
  }
  // "no final", "chamada final" que sobraram junto de uma chamada
  if (out.cta) for (let i = 0; i < toks.length; i++) {
    const p = longestAt(toks, i, ['no final', 'no fim', 'ao final', 'chamada final', 'cta', 'call to action']);
    if (p && free(i, p.split(' ').length)) mark(i, p.split(' ').length);
  }

  // 6) "pronto pra postar" = gancho + chamada final
  for (let i = 0; i < toks.length; i++) {
    const p = longestAt(toks, i, READY);
    if (p && free(i, p.split(' ').length) && !negatedAt(toks, i)) {
      out.wantsHook = true;
      out.ctaScene = true;
      mark(i, p.split(' ').length);
    }
  }

  // 7) legenda longe do rosto
  for (let i = 0; i < toks.length; i++) {
    const p = longestAt(toks, i, FACE);
    if (!p || !free(i, p.split(' ').length)) continue;
    out.avoidFace = true;
    mark(i, p.split(' ').length);
    // "pra legenda não ficar ..." — o resto da parte fala da mesma coisa
    for (let k = i - 1; k >= 0 && !isBoundary(toks[k]) && i - k <= 4; k--) if (['nao', 'pra', 'para', 'ficar', 'fica', 'que'].includes(toks[k]!.norm)) mark(k, 1);
  }

  // 8) listas: "3 dicas", "numera", "em tópicos"
  for (let i = 0; i < toks.length; i++) {
    const p = longestAt(toks, i, LIST_WORDS);
    if (p && free(i, p.split(' ').length) && !negatedAt(toks, i)) {
      out.lists = true;
      mark(i, p.split(' ').length);
      if (['eles', 'elas', 'isso', 'as', 'os'].includes(toks[i + p.split(' ').length]?.norm ?? '')) mark(i + p.split(' ').length, 1);
      continue;
    }
    const num = numberAt(toks, i);
    if (num && num.value >= 2 && num.value <= 10 && Number.isInteger(num.value) && LIST_NOUNS.has(toks[i + num.used]?.norm ?? '') && free(i, num.used + 1)) {
      out.lists = true;
      mark(i, num.used + 1);
    }
    if ((toks[i]?.norm === 'top') && numberAt(toks, i + 1) && free(i, 2)) {
      out.lists = true;
      mark(i, 2);
    }
  }

  // 9) aberturas: "começa com o preço", "frase de impacto", "pra prender"
  for (let i = 0; i < toks.length; i++) {
    const alone = longestAt(toks, i, HOOK_ALONE.map(([w]) => w));
    if (alone && free(i, alone.split(' ').length)) {
      const st = HOOK_ALONE.find(([w]) => w === alone)![1];
      out.wantsHook = true;
      if (st) out.hookStyle ??= st;
      const n = alone.split(' ').length;
      mark(i, n);
      if (alone.includes('perguntando')) mark(i + n, clauseEnd(toks, i + n) - (i + n));
      continue;
    }
    const verb = longestAt(toks, i, HOOK_VERBS);
    if (!verb || !free(i, verb.split(' ').length)) continue;
    const n = verb.split(' ').length;
    const end = clauseEnd(toks, i + n);
    let st: HookStyle | null = null;
    for (let k = i + n; k < end && k <= i + n + 5 && !st; k++) {
      const t = HOOK_TYPE.find(([w]) => w === toks[k]!.norm);
      if (t) st = t[1];
    }
    out.wantsHook = true;
    if (st) out.hookStyle ??= st;
    // o resto da parte descreve a abertura ("começa com a pergunta do paciente")
    mark(i, end - i);
  }

  return out;
}

/**
 * Nicho no pedido: frase mais longa de qualquer nicho ("unboxing de produto" > "unboxing"; "clínica de
 * estética" > "clínica"), na ordem do texto; o primeiro vale e o segundo vira nota. Negado não conta.
 * `blocked` = palavras já usadas por outro pedido (cores, emojis…), que não contam como nicho.
 */
export function findNiche(toks: Token[], blocked: (i: number) => boolean): { niche: NicheId; from: number; n: number; notes: string[] } | null {
  const notes: string[] = [];
  let first: { niche: NicheId; from: number; n: number } | null = null;
  for (let i = 0; i < toks.length; i++) {
    let best: { niche: NicheId; n: number } | null = null;
    for (const nn of NICHES) {
      const p = longestAt(toks, i, nn.words);
      if (p && (!best || p.split(' ').length > best.n)) best = { niche: nn.id, n: p.split(' ').length };
    }
    if (!best) continue;
    let ok = true;
    for (let k = i; k < i + best.n; k++) if (blocked(k)) ok = false;
    if (!ok || negatedAt(toks, i)) continue;
    if (!first) first = { ...best, from: i };
    else if (first.niche !== best.niche && notes.length < 1) notes.push(`Tipo de conteúdo: entendi "${toks.slice(first.from, first.from + first.n).map((t) => t.raw).join(' ')}" (vale o primeiro que aparece).`);
    i += best.n - 1;
  }
  return first ? { ...first, notes } : null;
}

/** Todas as posições que casam com algum nicho (para marcar como entendidas). */
export function nicheSpans(toks: Token[], blocked: (i: number) => boolean): [number, number][] {
  const spans: [number, number][] = [];
  for (let i = 0; i < toks.length; i++) {
    let n = 0;
    for (const nn of NICHES) {
      const p = longestAt(toks, i, nn.words);
      if (p && p.split(' ').length > n) n = p.split(' ').length;
    }
    if (!n) continue;
    let ok = true;
    for (let k = i; k < i + n; k++) if (blocked(k)) ok = false;
    if (ok) spans.push([i, n]);
    i += n - 1;
  }
  return spans;
}
