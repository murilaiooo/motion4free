/** Tokens do pedido (minúsculas; `norm` sem acentos). Compartilhado pelas regras do pedido. */
export interface Token {
  raw: string;
  norm: string;
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '');
}

/** Palavras, números, códigos de cor (#abc123) e pontuação que separa frases. */
export function tokenize(text: string): Token[] {
  const raws = text.toLowerCase().match(/#[0-9a-f]{3,6}\b|[\p{L}\p{N}%$]+|[,.;!?]/gu) ?? [];
  return raws.map((raw) => ({ raw, norm: stripAccents(raw) }));
}

export const isBoundary = (t: Token | undefined) => !!t && /^[,.;!?]$/.test(t.norm);

/** Uma frase (palavras separadas por espaço) começa no token i? */
export function phraseAt(toks: Token[], i: number, phrase: string): boolean {
  const ws = phrase.split(' ');
  return ws.every((w, k) => toks[i + k]?.norm === w);
}

/** A frase mais longa da lista que começa em i (ou null). */
export function longestAt(toks: Token[], i: number, phrases: readonly string[]): string | null {
  let best: string | null = null;
  for (const p of phrases) if (phraseAt(toks, i, p) && (!best || p.split(' ').length > best.split(' ').length)) best = p;
  return best;
}

const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30, meio: 0.5, meia: 0.5 };

/** Número no token i ("3", "3s", "1,5", "três"). Devolve o valor e quantos tokens usou. */
export function numberAt(toks: Token[], i: number): { value: number; used: number; unitS: boolean } | null {
  const t = toks[i]?.norm;
  if (!t) return null;
  const m = /^(\d+)(s|seg|segs)?$/.exec(t);
  if (m) {
    if (!m[2] && toks[i + 1]?.norm === ',' && /^\d+$/.test(toks[i + 2]?.norm ?? '')) return { value: Number(`${m[1]}.${toks[i + 2]!.norm}`), used: 3, unitS: false };
    return { value: Number(m[1]), used: 1, unitS: !!m[2] };
  }
  if (NUMBER_WORDS[t] !== undefined) return { value: NUMBER_WORDS[t]!, used: 1, unitS: false };
  return null;
}
