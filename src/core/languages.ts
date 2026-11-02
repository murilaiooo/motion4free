/**
 * As 10 línguas mais faladas do mundo (total de falantes, Ethnologue), pedido do responsável (02/11/2026):
 * reconhecimento da fala, legenda e tradução valem para todas elas. Esta tabela é a única fonte: a
 * transcrição, as fontes da legenda, a direção da escrita e a tradução leem daqui.
 *
 * - `whisper`: nome do idioma no Whisper (todas as 10 estão entre as 99 do Whisper).
 * - `parakeet`: o Parakeet TDT v3 só conhece 25 línguas europeias; nas outras ele nunca é usado.
 * - `m2m`: código do M2M100 (tradução de qualquer uma para qualquer uma, ADR-0044).
 * - `script`: a escrita, que decide a fonte de reserva e a quebra de linha.
 */
export type Script = 'latin' | 'cyrillic' | 'han' | 'devanagari' | 'bengali' | 'arabic';

export const LANGUAGES = {
  en: { label: 'Inglês', native: 'English', whisper: 'english', parakeet: true, m2m: 'en', script: 'latin', rtl: false },
  zh: { label: 'Chinês (mandarim)', native: '中文', whisper: 'chinese', parakeet: false, m2m: 'zh', script: 'han', rtl: false },
  hi: { label: 'Hindi', native: 'हिन्दी', whisper: 'hindi', parakeet: false, m2m: 'hi', script: 'devanagari', rtl: false },
  es: { label: 'Espanhol', native: 'Español', whisper: 'spanish', parakeet: true, m2m: 'es', script: 'latin', rtl: false },
  fr: { label: 'Francês', native: 'Français', whisper: 'french', parakeet: true, m2m: 'fr', script: 'latin', rtl: false },
  ar: { label: 'Árabe', native: 'العربية', whisper: 'arabic', parakeet: false, m2m: 'ar', script: 'arabic', rtl: true },
  bn: { label: 'Bengali', native: 'বাংলা', whisper: 'bengali', parakeet: false, m2m: 'bn', script: 'bengali', rtl: false },
  pt: { label: 'Português', native: 'Português', whisper: 'portuguese', parakeet: true, m2m: 'pt', script: 'latin', rtl: false },
  ru: { label: 'Russo', native: 'Русский', whisper: 'russian', parakeet: true, m2m: 'ru', script: 'cyrillic', rtl: false },
  ur: { label: 'Urdu', native: 'اردو', whisper: 'urdu', parakeet: false, m2m: 'ur', script: 'arabic', rtl: true },
} as const satisfies Record<string, { label: string; native: string; whisper: string; parakeet: boolean; m2m: string; script: Script; rtl: boolean }>;

export type LanguageCode = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export function isLanguageCode(v: unknown): v is LanguageCode {
  return typeof v === 'string' && Object.hasOwn(LANGUAGES, v);
}

/** Faixas Unicode de cada escrita (letras; números e pontuação ficam de fora). */
const SCRIPT_RE: Record<Exclude<Script, 'latin'>, RegExp> = {
  cyrillic: /[Ѐ-ӿ]/g,
  han: /[㐀-䶿一-鿿豈-﫿]/g,
  devanagari: /[ऀ-ॿ]/g,
  bengali: /[ঀ-৿]/g,
  arabic: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g,
};
const LATIN_RE = /[A-Za-zÀ-ɏ]/g;
/** letras que o urdu usa e o árabe padrão não */
const URDU_ONLY = /[ٹڈڑںھہےیکگپچ]/g;

/** Quantas letras de cada escrita o texto tem. */
export function scriptCounts(text: string): Record<Script, number> {
  const count = (re: RegExp) => text.match(re)?.length ?? 0;
  return {
    latin: count(LATIN_RE),
    cyrillic: count(SCRIPT_RE.cyrillic),
    han: count(SCRIPT_RE.han),
    devanagari: count(SCRIPT_RE.devanagari),
    bengali: count(SCRIPT_RE.bengali),
    arabic: count(SCRIPT_RE.arabic),
  };
}

/** Escrita com mais letras no texto, ou null sem letras. */
export function dominantScript(text: string): Script | null {
  const c = scriptCounts(text);
  let best: Script | null = null;
  for (const s of Object.keys(c) as Script[]) if (c[s] > 0 && (best === null || c[s] > c[best])) best = s;
  return best;
}

/** Escritas que aparecem no texto (para baixar só as fontes necessárias). */
export function scriptsIn(text: string): Set<Script> {
  const c = scriptCounts(text);
  return new Set((Object.keys(c) as Script[]).filter((s) => c[s] > 0));
}

/** Escrita da direita para a esquerda (árabe, urdu)? */
export function isRtlText(text: string): boolean {
  return dominantScript(text) === 'arabic';
}

/** Escrita sem espaço entre palavras (chinês): a linha quebra entre caracteres. */
export function isSpacelessScript(s: Script | null): boolean {
  return s === 'han';
}

/** Árabe ou urdu, pelas letras que só o urdu usa (2% das letras árabes bastam). */
export function arabicOrUrdu(text: string): 'ar' | 'ur' {
  const arabic = scriptCounts(text).arabic;
  const urdu = text.match(URDU_ONLY)?.length ?? 0;
  return arabic > 0 && urdu / arabic >= 0.02 ? 'ur' : 'ar';
}

const HAN_CHAR = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/;

/** Fim de frase em qualquer das 10 línguas: . ! ? … e 。！？ (chinês), । (hindi/bengali), ؟ ۔ (árabe/urdu). */
export const SENTENCE_END = /[.!?…。！？।؟۔]["'”’»)）」]?$/;

/**
 * Tamanho visual de um texto em "letras latinas": um caractere chinês ocupa o espaço de dois, e o espaço que o
 * app põe entre palavras chinesas (para ter o tempo de cada uma) não aparece na tela.
 */
export function visualLength(text: string): number {
  let n = 0;
  const chars = [...text];
  chars.forEach((ch, i) => {
    if (ch === ' ' && HAN_CHAR.test(chars[i - 1] ?? '') && HAN_CHAR.test(chars[i + 1] ?? '')) return;
    n += HAN_CHAR.test(ch) ? 2 : 1;
  });
  return n;
}

/** Peso de uma palavra no limite de palavras por legenda: uma palavra chinesa de um caractere vale meia. */
export function wordWeight(word: string): number {
  const t = word.trim();
  return t && [...t].every((ch) => HAN_CHAR.test(ch) || /[\p{P}]/u.test(ch)) && [...t].filter((ch) => HAN_CHAR.test(ch)).length <= 1 ? 0.5 : 1;
}

/** É um caractere chinês (ou pontuação CJK)? */
export function isHanChar(ch: string): boolean {
  return HAN_CHAR.test(ch);
}

/** Texto como se lê: tira o espaço que o app guarda entre palavras chinesas (SRT, tradução, transcrição). */
export function readableText(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const chars = [...t];
  return chars.filter((ch, i) => !(ch === ' ' && HAN_CHAR.test(chars[i - 1] ?? '') && HAN_CHAR.test(chars[i + 1] ?? ''))).join('');
}
