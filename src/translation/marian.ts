/**
 * Entrada correta para modelos OPUS-MT (Marian) com vários idiomas de destino (#175).
 *
 * Esses modelos escolhem o idioma de saída por um token no começo da frase (ex.: `>>pt_BR<<`).
 * No Python, o MarianTokenizer separa esse código e o converte num ÚNICO token. No
 * @huggingface/transformers 4.x, `tokenizer(texto)` e o pipeline de tradução não passam mais por esse
 * tratamento (`MarianTokenizer._encode_text` não é chamado), então `>>pt_BR<<` vira pedaços de texto
 * comum: o modelo não recebe o idioma, copia os pedaços para a saída e escolhe francês ou espanhol.
 *
 * Aqui montamos os ids na mesma forma do Python: [id do idioma, ...peças do texto, </s>].
 */

/** O mínimo do tokenizer do transformers.js que usamos (facilita testar sem baixar o modelo). */
export interface MarianTokenizerLike {
  convert_tokens_to_ids(token: string): number | null | undefined;
  encode(text: string, options?: { add_special_tokens?: boolean }): number[];
  unk_token_id?: number | null;
}

/** Variantes do português do Brasil, na ordem de preferência, como aparecem no vocabulário do en-ROMANCE. */
export const PT_BR_TOKENS = ['>>pt_BR<<', '>>pt_br<<', '>>pt<<'] as const;

/** Tokens de idioma que existem de verdade no vocabulário do modelo carregado (na ordem pedida). */
export function availableLanguageTokens(tokenizer: MarianTokenizerLike, candidates: readonly string[] = PT_BR_TOKENS): { token: string; id: number }[] {
  const found: { token: string; id: number }[] = [];
  for (const token of candidates) {
    const id = tokenizer.convert_tokens_to_ids(token);
    if (typeof id === 'number' && Number.isInteger(id) && id >= 0 && id !== tokenizer.unk_token_id) found.push({ token, id });
  }
  return found;
}

/** Ids de entrada: token do idioma + texto codificado (com o </s> final que o tokenizer acrescenta). */
export function marianInputIds(tokenizer: MarianTokenizerLike, languageId: number, text: string): number[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (/>>\s*[\w-]+\s*<</.test(clean)) throw new Error('O texto de origem não pode trazer código de idioma');
  return [languageId, ...tokenizer.encode(clean, { add_special_tokens: true })];
}
