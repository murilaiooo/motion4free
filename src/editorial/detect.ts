/**
 * Detecção por regras sobre as palavras transcritas (português). Funções puras e pequenas,
 * usadas pelo seletor de cenas. Nada aqui depende de IA: é previsível e testável.
 */

export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}$]+/u, '')
    .replace(/[^\p{L}\p{N}%$]+$/u, '');
}

const SMALL: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};
const BIG: Record<string, number> = { mil: 1e3, milhão: 1e6, milhao: 1e6, milhões: 1e6, milhoes: 1e6, bilhão: 1e9, bilhao: 1e9, bilhões: 1e9, bilhoes: 1e9 };
const isNumberWord = (t: string | undefined) => t !== undefined && (t in SMALL || t in BIG);

export interface ParsedNumber {
  /** como aparece na tela (ex.: "25", "50%", "R$ 300", "1 milhão") */
  value: string;
  n: number;
  /** quantos tokens o número ocupa */
  consumed: number;
}

const DIGITS = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(%|x)?$/;

function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function decimal(x: number): string {
  return String(Math.round(x * 10) / 10).replace('.', ',');
}

/** Número escrito por extenso em formato curto e legível. */
export function formatPtNumber(n: number): string {
  if (n >= 1e9) return `${decimal(n / 1e9)} ${n / 1e9 >= 2 ? 'bilhões' : 'bilhão'}`;
  if (n >= 1e6) return `${decimal(n / 1e6)} ${n / 1e6 >= 2 ? 'milhões' : 'milhão'}`;
  if (n >= 1e4 && n % 1000 === 0) return `${thousands(n / 1000)} mil`;
  return thousands(n);
}

/** Número começando no token `i` (algarismos, por extenso, %, R$, "reais"). "um"/"uma" sozinhos são artigo. */
export function parseNumberAt(tokens: string[], i: number): ParsedNumber | null {
  const norm = (k: number) => (tokens[k] === undefined ? undefined : normalizeToken(tokens[k]!));
  let j = i;
  let currency = false;
  if (norm(j) === 'r$' && norm(j + 1) !== undefined && DIGITS.test(norm(j + 1)!)) {
    currency = true;
    j++;
  }
  let value: string;
  let n: number;
  let percent = false;
  const first = norm(j);
  if (first === undefined) return null;
  const digits = DIGITS.exec(first);
  if (digits) {
    n = Number(digits[1]!.replace(/\./g, '') + (digits[2] ? `.${digits[2]}` : ''));
    value = first;
    percent = digits[3] === '%';
    j++;
  } else {
    if (!isNumberWord(first) || first in BIG) return null;
    let total = 0;
    let current = 0;
    let onlyArticle = true;
    while (isNumberWord(norm(j))) {
      const t = norm(j)!;
      if (t in SMALL) {
        current += SMALL[t]!;
        if (t !== 'um' && t !== 'uma') onlyArticle = false;
      } else {
        total += (current || 1) * BIG[t]!;
        current = 0;
        onlyArticle = false;
      }
      j++;
      if (norm(j) === 'e' && isNumberWord(norm(j + 1))) j++;
    }
    if (onlyArticle) return null;
    n = total + current;
    value = formatPtNumber(n);
  }
  if (norm(j) === 'por' && norm(j + 1) === 'cento') {
    percent = true;
    j += 2;
  } else if (!percent && (norm(j) === 'reais' || norm(j) === 'real')) {
    currency = true;
    j++;
  }
  if (percent && !value.endsWith('%')) value = `${value}%`;
  if (currency) value = `R$ ${value}`;
  return { value, n, consumed: j - i };
}

const ORDINALS: Record<string, number> = {
  primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3, quarto: 4, quarta: 4, quinto: 5, quinta: 5,
  '1º': 1, '1ª': 1, '2º': 2, '2ª': 2, '3º': 3, '3ª': 3, '4º': 4, '4ª': 4, '5º': 5, '5ª': 5,
};

/** Número de ordem de um marcador de enumeração ("primeiro", "segunda", "2.", "3)", "1º"). */
export function ordinalOf(raw: string): number | null {
  const trimmed = raw.trim().replace(/^["'“(]+/, '');
  const marker = /^([1-9])[.)]$/.exec(trimmed);
  if (marker) return Number(marker[1]);
  if (trimmed.includes('-')) return null;
  const t = trimmed.toLowerCase().replace(/[,.:;!?…]+$/, '');
  return ORDINALS[t] ?? null;
}

const isDigitMarker = (raw: string) => /^[1-9][.)]$/.test(raw.trim());

/** Índices dos tokens de cada frase (quebra em . ! ? …, menos marcadores como "2."). */
export function splitSentences(tokens: string[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  tokens.forEach((raw, i) => {
    cur.push(i);
    if (/[.!?…]["”']?$/.test(raw.trim()) && !isDigitMarker(raw)) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

const QUESTION_STARTS = new Set(['qual', 'quais', 'quem', 'quando', 'onde', 'quanto', 'quantos', 'quantas', 'será', 'sabia']);

export function isQuestion(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  if (/\?["”']?$/.test(tokens[tokens.length - 1]!.trim())) return true;
  const a = normalizeToken(tokens[0]!);
  const b = tokens[1] ? normalizeToken(tokens[1]) : '';
  if (a === 'por' && (b === 'que' || b === 'quê')) return true;
  if (a === 'você' && b === 'sabe') return true;
  return QUESTION_STARTS.has(a);
}

export const STOPWORDS = new Set(
  (
    'a o as os um uma uns umas de do da dos das em no na nos nas por para pra pro com sem que e ou mas se é foi ser ter tem tinha eu você voce ' +
    'ele ela nós eles elas isso isto esse essa este esta esses essas aquilo aquele aquela meu minha meus minhas seu sua seus suas teu tua muito muita ' +
    'muitos muitas mais menos bem já também quando onde como porque então aqui ali lá só ainda até sobre entre depois antes coisa coisas gente tipo ' +
    'assim aí né tá está estou estão estava vou vai vamos fazer faz feito pode posso podem quer querer sabe olha pessoa pessoas vez vezes dia dias ' +
    'ano anos parte forma jeito nada tudo todo toda todos todas alguém algum alguma qualquer cada outro outra outros outras mesmo mesma sim não nao ' +
    'agora hoje ontem amanhã sempre dica dicas primeiro primeira segundo segunda terceiro terceira lugar'
  ).split(' '),
);

/** Palavras que costumam carregar a ideia principal de uma frase em vídeos de dicas/opinião. */
const EMPHASIS = new Set(
  (
    'nunca jamais segredo segredos erro erros grátis gratuito importante essencial melhor pior simples fácil difícil rápido rápida dinheiro ' +
    'resultado resultados verdade mentira cuidado atenção problema solução ninguém chave proibido perigo perigoso incrível absurdo sucesso ' +
    'fracasso lucro saúde medo coragem único única truque método estratégia mudar muda transformar crescer vender poder liberdade foco ' +
    'disciplina hábito hábitos tempo errado certo garantido obrigatório'
  ).split(' '),
);

/** Quanto uma palavra merece destaque (0 = nunca). */
export function keywordScore(raw: string): number {
  const t = normalizeToken(raw);
  if (t.length < 4 || STOPWORDS.has(t) || /\d/.test(t)) return 0;
  let score = Math.min(1, (t.length - 3) / 8);
  if (EMPHASIS.has(t)) score += 1;
  if (/!["”']?$/.test(raw.trim())) score += 0.5;
  return score;
}

const NAME_INTROS = [
  ['meu', 'nome', 'é'],
  ['eu', 'me', 'chamo'],
  ['eu', 'sou', 'o'],
  ['eu', 'sou', 'a'],
  ['aqui', 'é', 'o'],
  ['aqui', 'é', 'a'],
];

/** Nome próprio logo depois de "meu nome é", "eu sou o/a", "eu me chamo"... */
export function findName(tokens: string[]): { index: number; name: string } | null {
  const norm = tokens.map(normalizeToken);
  for (let i = 0; i < tokens.length; i++) {
    for (const intro of NAME_INTROS) {
      if (!intro.every((w, k) => norm[i + k] === w)) continue;
      const start = i + intro.length;
      const parts: string[] = [];
      for (let k = start; k < tokens.length && parts.length < 3; k++) {
        const raw = tokens[k]!.trim();
        const clean = raw.replace(/^[^\p{L}]+/u, '').replace(/[^\p{L}]+$/u, '');
        if (!/^\p{Lu}/u.test(clean)) break;
        parts.push(clean);
        if (/[,.!?;:]$/.test(raw)) break;
      }
      if (parts.length > 0) return { index: start, name: parts.join(' ') };
    }
  }
  return null;
}
