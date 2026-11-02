/**
 * Conferência de cada trecho traduzido para português do Brasil (#175).
 *
 * O tradutor local é multilíngue (OPUS-MT en-ROMANCE): se o código de idioma não chega ao modelo,
 * ele devolve francês, espanhol ou o próprio código (`>>pt_BR<<`). Este módulo recusa essas saídas
 * ANTES de a faixa traduzida substituir qualquer legenda. Não "limpa" o texto: um trecho ruim é falha.
 *
 * A detecção de idioma usa palavras e sinais exclusivos de cada língua. Em frases muito curtas ela é
 * fraca de propósito: só recusa quando há evidência clara de outro idioma, nunca por falta de prova.
 */

export type TranslationProblem = 'vazia' | 'marcador' | 'outro-idioma' | 'ingles' | 'repeticao' | 'tamanho';

/** Códigos de controle e tokens internos que nunca podem aparecer numa legenda. */
const CONTROL = /(>>\s*[\w-]+\s*<<)|(&gt;&gt;)|(<\/?s>)|(<unk>)|(<pad>)|▁/i;

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

/** Explicação curta (para o detalhe do erro) do problema encontrado num trecho. */
export function describeTranslationProblem(problem: TranslationProblem): string {
  switch (problem) {
    case 'vazia': return 'tradução vazia';
    case 'marcador': return 'código interno do tradutor no texto';
    case 'outro-idioma': return 'saiu em outro idioma (não português)';
    case 'ingles': return 'voltou em inglês, sem tradução';
    case 'repeticao': return 'texto repetido sem parar';
    case 'tamanho': return 'texto muito maior que a fala original';
  }
}
