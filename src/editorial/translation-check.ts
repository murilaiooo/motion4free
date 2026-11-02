import { LANGUAGES, arabicOrUrdu, dominantScript, scriptCounts, visualLength, type LanguageCode, type Script } from '../core/languages';

/**
 * Conferência de cada trecho traduzido (#175; qualquer par das 10 línguas desde a v0.45.0).
 *
 * O tradutor local é multilíngue (OPUS-MT en-ROMANCE): se o código de idioma não chega ao modelo,
 * ele devolve francês, espanhol ou o próprio código (`>>pt_BR<<`). Este módulo recusa essas saídas
 * ANTES de a faixa traduzida substituir qualquer legenda. Não "limpa" o texto: um trecho ruim é falha.
 *
 * A detecção de idioma usa palavras e sinais exclusivos de cada língua. Em frases muito curtas ela é
 * fraca de propósito: só recusa quando há evidência clara de outro idioma, nunca por falta de prova.
 */

export type TranslationProblem = 'vazia' | 'marcador' | 'outro-idioma' | 'ingles' | 'original' | 'repeticao' | 'tamanho';

/** Códigos de controle e tokens internos que nunca podem aparecer numa legenda. */
const CONTROL = /(>>\s*[\w-]+\s*<<)|(__[a-z]{2,3}__)|(&gt;&gt;)|(<\/?s>)|(<unk>)|(<pad>)|▁/i;

const words = (s: string) => s.toLowerCase().normalize('NFC').match(/[\p{L}']+/gu) ?? [];

// Palavras que existem numa língua e NÃO são palavras comuns do português.
const ES = new Set(['el', 'los', 'las', 'del', 'un', 'una', 'unos', 'unas', 'y', 'es', 'muy', 'pero', 'usted', 'ustedes', 'yo', 'tú', 'eres', 'soy', 'estoy', 'hay', 'algunos', 'algunas', 'también', 'ellos', 'ellas', 'nosotros', 'cuando', 'donde', 'dónde', 'eso', 'esto', 'qué', 'porqué', 'señor', 'mí', 'aquí', 'ahora', 'cosa', 'gracias', 'sí', 'bueno', 'hacer', 'tiene', 'tienen', 'puedo', 'puede', 'quiero', 'nada', 'luego', 'siempre', 'nunca', 'mucho', 'mucha', 'muchos', 'muchas', 'hasta', 'desde', 'ese', 'esa', 'estos', 'estas', 'ya', 'al', 'lo', 'le', 'les', 'su', 'sus', 'con', 'sin', 'pues', 'entonces', 'creo', 'vamos', 'están', 'somos', 'fue', 'era']);
const FR = new Set(['le', 'les', 'des', 'est', "c'est", 'vous', 'nous', 'je', "j'ai", 'pas', 'une', 'et', 'qui', 'dans', 'pour', 'avec', 'ce', 'cette', 'très', 'sont', 'suis', 'être', 'au', 'aux', 'du', 'il', 'elle', 'ils', 'elles', 'où', 'ça', 'oui', 'merci', 'bien', 'tout', 'tous', 'fait', 'faire', 'avez', 'avons', 'peut', 'mon', 'ton', 'votre', 'notre', 'leur', 'ici', 'maintenant', 'chose', 'comme', 'quand', 'parce', 'aussi', 'encore', "qu'il", "n'est", "d'un", "d'une", "l'on", "s'il", 'si', 'sur', 'ne', 'un', 'bizarre']);
const IT = new Set(['il', 'lo', 'gli', 'della', 'delle', 'degli', 'che', 'non', 'sono', 'questo', 'questa', 'molto', 'perché', 'anche', 'ma', 'però', 'ciao', 'grazie', 'siamo', 'cosa', 'adesso', 'qui', 'un', 'una', 'di', 'per', 'con', 'ho', 'hai', 'abbiamo', 'nel', 'nella', 'sul', 'sulla']);
const EN = new Set(['the', 'and', 'you', 'is', 'are', 'this', 'that', "it's", "i'm", "don't", 'what', 'with', 'have', 'of', 'to', 'was', 'were', 'they', 'we', 'he', 'she', 'it', 'be', 'not', 'your', 'my', 'just', 'like', 'so', 'but', 'for', 'on', 'in', 'at', 'if', 'how', 'why', 'there', 'here', 'can', 'will', 'would', 'some', 'very', 'really', 'know', 'think', 'do', 'does', 'did', 'about', 'because', 'when', 'where', 'which', 'who']);
// Palavras muito comuns do português (sem equivalente idêntico frequente nas outras).
const PT = new Set(['não', 'você', 'vocês', 'isso', 'isto', 'também', 'muito', 'muita', 'muitos', 'muitas', 'então', 'estou', 'são', 'é', 'uma', 'um', 'umas', 'uns', 'do', 'da', 'dos', 'das', 'no', 'na', 'nas', 'ao', 'aos', 'pra', 'para', 'pelo', 'pela', 'meu', 'minha', 'seu', 'sua', 'ele', 'ela', 'eles', 'elas', 'eu', 'tem', 'têm', 'mas', 'ainda', 'aqui', 'agora', 'coisa', 'quando', 'onde', 'nós', 'há', 'já', 'só', 'vai', 'vou', 'fazer', 'foi', 'ter', 'estão', 'obrigado', 'obrigada', 'sim', 'até', 'com', 'sem', 'mais', 'menos', 'bem', 'bom', 'boa', 'olá', 'oi', 'que', 'de', 'em', 'o', 'a', 'os', 'as', 'e', 'como', 'se', 'por', 'esse', 'essa', 'este', 'esta', 'algum', 'alguns', 'alguma', 'algumas', 'tudo', 'nada', 'estranho', 'acho', 'sei', 'pode', 'posso', 'quero', 'temos', 'somos', 'era', 'está', 'estava', 'lá', 'aí', 'sempre', 'nunca', 'depois', 'antes', 'porque', 'qual', 'quem', 'ou']);

export interface LanguageEvidence { pt: number; es: number; fr: number; it: number; en: number }

/** Conta sinais de cada idioma num texto. Sinais gráficos exclusivos valem como uma palavra. */
export function languageEvidence(text: string): LanguageEvidence {
  const e: LanguageEvidence = { pt: 0, es: 0, fr: 0, it: 0, en: 0 };
  for (const w of words(text)) {
    const inPt = PT.has(w);
    if (inPt) e.pt++;
    // palavra que também é portuguesa não prova outro idioma ("como", "com", "se"…)
    if (!inPt && ES.has(w)) e.es++;
    if (!inPt && FR.has(w)) e.fr++;
    if (!inPt && IT.has(w)) e.it++;
    if (!inPt && EN.has(w)) e.en++;
    if (/(ção|ções|ões|ãe|ão)$/.test(w) || /[ãõ]/.test(w)) e.pt++;
    if (/ñ/.test(w) || /ción$|ciones$/.test(w)) e.es++;
    if (/[èùœîûëï]/.test(w) || /^[jldnsc]'/.test(w)) e.fr++;
  }
  if (/[¿¡]/.test(text)) e.es++;
  return e;
}

/** Idioma com mais evidência, ou null se o texto não traz sinal claro (frase curta, nome, número). */
export function dominantLanguage(text: string): keyof LanguageEvidence | null {
  const e = languageEvidence(text);
  const ranked = (Object.entries(e) as [keyof LanguageEvidence, number][]).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first || first[1] === 0) return null;
  if (second && second[1] === first[1]) return null;
  return first[0];
}

/**
 * Confere um trecho traduzido para PT-BR. Devolve o problema encontrado ou null se o texto pode ser usado.
 * `source` é o inglês original (para medir tamanho e detectar texto que voltou sem tradução).
 */
export function checkPortugueseTranslation(source: string, translated: string): TranslationProblem | null {
  const text = translated.replace(/\s+/g, ' ').trim();
  if (!text || !/\p{L}|\d/u.test(text)) return 'vazia';
  if (CONTROL.test(text)) return 'marcador';
  // letras de outro alfabeto (ex.: russo copiado sem traduzir) nunca são português
  if (/[\u0400-\u04FF\u0370-\u03FF\u0590-\u06FF\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) return 'outro-idioma';

  const out = words(text);
  const src = words(source);
  // laço de geração: a mesma palavra 4 vezes seguidas, ou texto muito maior que o original
  for (let i = 3; i < out.length; i++) if (out[i] === out[i - 1] && out[i] === out[i - 2] && out[i] === out[i - 3]) return 'repeticao';
  if (out.length > src.length * 3 + 8 || text.length > source.length * 3 + 40) return 'tamanho';

  const e = languageEvidence(text);
  const foreign = Math.max(e.es, e.fr, e.it);
  // texto que voltou em inglês: mais sinais de inglês que de português
  if (e.en >= 2 && e.en > e.pt) return 'ingles';
  if (text.toLowerCase() === source.replace(/\s+/g, ' ').trim().toLowerCase() && src.length >= 3 && e.pt === 0) return 'ingles';
  // espanhol/francês/italiano: qualquer sinal claro que empate ou supere o português
  if (foreign >= 1 && foreign >= e.pt) return 'outro-idioma';
  return null;
}

/**
 * A fala original parece inglês? O tradutor local só sabe inglês → português; com fala em russo,
 * português ou espanhol ele devolveria lixo. Usa o texto inteiro (sinal forte), não legenda por legenda.
 */
export function sourceLooksEnglish(text: string): boolean {
  if (/[\u0400-\u04FF]/.test(text)) return false;
  const e = languageEvidence(text);
  return e.en >= 2 && e.en > Math.max(e.pt, e.es, e.fr, e.it);
}

/**
 * Palavras frequentes que só existem numa das quatro línguas latinas (as que existem em duas, como "de", "que",
 * "no", "nada", "a", ficam de fora). Contagem equilibrada, sem favorecer o português, para reconhecer a origem.
 */
const MARKERS: Record<'en' | 'es' | 'fr' | 'pt', Set<string>> = {
  en: new Set(['the', 'and', 'you', 'is', 'are', 'this', 'that', 'of', 'to', 'it', "it's", 'with', 'have', 'was', 'what', 'for', 'not', 'be', 'do', "don't", 'we', 'they', 'your', 'my', 'just', 'can', 'will', 'would', 'there', 'about', 'because', 'when', 'which', 'who', 'need', 'anything', 'else', 'first', 'tip']),
  es: new Set(['el', 'y', 'es', 'los', 'las', 'del', 'muy', 'pero', 'más', 'qué', 'yo', 'tú', 'usted', 'está', 'están', 'también', 'cuando', 'ahora', 'aquí', 'hay', 'eso', 'esto', 'lo', 'le', 'su', 'sus', 'con', 'sin', 'una', 'necesitas', 'puedes', 'tienes', 'hacer', 'gracias', 'bueno', 'consejo', 'verdad', 'primer', 'siempre', 'mucho', 'ellos', 'nosotros', 'cómo', 'dónde', 'porque']),
  fr: new Set(['le', 'les', 'des', 'est', 'et', 'vous', 'nous', 'je', 'pas', 'une', 'qui', 'dans', 'pour', 'avec', 'ce', 'cette', 'très', 'sont', 'du', 'il', 'elle', 'ne', 'au', 'aux', "c'est", "n'est", "n'avez", 'rien', "d'autre", 'besoin', 'premier', 'conseil', 'merci', 'oui', 'mais', 'tout', 'faire', 'avez', 'peut', 'aussi', 'ici', 'maintenant', 'comme', 'quand', 'parce']),
  pt: new Set(['não', 'você', 'vocês', 'é', 'uma', 'um', 'do', 'da', 'dos', 'das', 'em', 'com', 'isso', 'isto', 'também', 'mais', 'muito', 'ele', 'ela', 'eu', 'mas', 'já', 'só', 'está', 'são', 'então', 'aqui', 'agora', 'precisa', 'dica', 'primeira', 'obrigado', 'obrigada', 'coisa', 'fazer', 'tem', 'pra', 'nós', 'eles', 'elas', 'porque', 'como', 'onde', 'sempre']),
};

/** Pontos de cada língua latina (palavras exclusivas e sinais gráficos: ñ ¿ ¡ ção ã õ ç è). */
export function latinScores(text: string): Record<'en' | 'es' | 'fr' | 'pt', number> {
  const score = { en: 0, es: 0, fr: 0, pt: 0 };
  for (const w of words(text)) {
    for (const k of ['en', 'es', 'fr', 'pt'] as const) if (MARKERS[k].has(w) && !(['en', 'es', 'fr', 'pt'] as const).some((o) => o !== k && MARKERS[o].has(w))) score[k]++;
    if (/(ção|ções|ões)$/.test(w) || /[ãõç]/.test(w)) score.pt++;
    if (/ñ/.test(w) || /(ción|ciones)$/.test(w)) score.es++;
    if (/[èùœîûëêà]/.test(w) && !/[ãõ]/.test(w)) score.fr++;
  }
  if (/[¿¡]/.test(text)) score.es++;
  return score;
}

/** Línguas de escrita latina que a contagem de palavras sabe reconhecer. */
const LATIN_EVIDENCE: Partial<Record<LanguageCode, 'en' | 'es' | 'fr' | 'pt'>> = { pt: 'pt', es: 'es', fr: 'fr', en: 'en' };

/**
 * Em qual das 10 línguas o texto está (para saber de onde traduzir). A escrita decide chinês, hindi, bengali,
 * russo e árabe/urdu; nas latinas, a contagem de palavras (inglês, espanhol, francês, português).
 * null quando não há sinal claro: aí a pessoa escolhe.
 */
export function detectTextLanguage(text: string): LanguageCode | null {
  const script = dominantScript(text);
  if (script === 'han') return 'zh';
  if (script === 'devanagari') return 'hi';
  if (script === 'bengali') return 'bn';
  if (script === 'cyrillic') return 'ru';
  if (script === 'arabic') return arabicOrUrdu(text);
  if (script !== 'latin') return null;
  const e = latinScores(text);
  const ranked = (['en', 'pt', 'es', 'fr'] as const).map((k) => [k, e[k]] as const).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first || first[1] < 2 || first[1] === second![1]) return null;
  return first[0];
}

const SHARE_SCRIPTS: Exclude<Script, 'latin'>[] = ['cyrillic', 'han', 'devanagari', 'bengali', 'arabic'];

/**
 * Confere um trecho traduzido de `from` para `to`. Devolve o problema encontrado ou null se pode ser usado.
 * Recusa: texto vazio, código interno do tradutor, escrita errada (chinês saindo em latim, português com letras
 * russas), texto que voltou no idioma de origem, laço de repetição e texto muito maior que a fala.
 */
export function checkTranslation(source: string, translated: string, to: LanguageCode, from: LanguageCode): TranslationProblem | null {
  if (to === 'pt' && from === 'en') return checkPortugueseTranslation(source, translated);
  const text = translated.replace(/\s+/g, ' ').trim();
  if (!text || !/\p{L}|\d/u.test(text)) return 'vazia';
  if (CONTROL.test(text)) return 'marcador';

  const target = LANGUAGES[to].script;
  const counts = scriptCounts(text);
  const letters = Object.values(counts).reduce((a, b) => a + b, 0);
  if (target === 'latin') {
    // letras de outra escrita nunca são inglês, espanhol, francês ou português
    if (SHARE_SCRIPTS.some((sc) => counts[sc] > 0) || /[\u0370-\u03FF\u0590-\u05FF\u3040-\u30FF]/.test(text)) return 'outro-idioma';
  } else if (letters > 0 && counts[target] / letters < 0.6) {
    // nomes próprios em latim podem aparecer; a maior parte tem de estar na escrita do destino
    return LANGUAGES[from].script !== target && counts[LANGUAGES[from].script] / letters >= 0.6 ? 'original' : 'outro-idioma';
  }
  if (target === 'arabic' && counts.arabic >= 15 && arabicOrUrdu(text) !== to) return 'outro-idioma';

  // laço de geração: o mesmo pedaço repetido seguido (chinês: caracteres; outras: palavras)
  const units = target === 'han' ? [...text].filter((ch) => /\p{L}/u.test(ch)) : words(text);
  const run = target === 'han' ? 6 : 4;
  for (let i = run - 1; i < units.length; i++) if (units.slice(i - run + 1, i + 1).every((u) => u === units[i])) return 'repeticao';
  if (visualLength(text) > visualLength(source) * 3 + 40) return 'tamanho';

  // voltou sem traduzir: igual à origem, ou com mais sinais da língua de origem que da de destino
  if (text.toLowerCase() === source.replace(/\s+/g, ' ').trim().toLowerCase() && [...source].length >= 8) return 'original';
  const fromKey = LATIN_EVIDENCE[from];
  const toKey = LATIN_EVIDENCE[to];
  if (fromKey && toKey) {
    const e = latinScores(text);
    if (e[fromKey] >= 3 && e[fromKey] > e[toKey] * 2) return 'original';
  }
  return null;
}

/** Explicação curta (para o detalhe do erro) do problema encontrado num trecho. */
export function describeTranslationProblem(problem: TranslationProblem): string {
  switch (problem) {
    case 'vazia': return 'tradução vazia';
    case 'marcador': return 'código interno do tradutor no texto';
    case 'outro-idioma': return 'saiu em outro idioma ou outra escrita';
    case 'ingles': return 'voltou em inglês, sem tradução';
    case 'original': return 'voltou no idioma original, sem tradução';
    case 'repeticao': return 'texto repetido sem parar';
    case 'tamanho': return 'texto muito maior que a fala original';
  }
}
