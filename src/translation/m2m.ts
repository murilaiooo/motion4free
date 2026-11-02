/**
 * Entrada do M2M100 (tradução entre 100 línguas, Meta, MIT) montada à mão, como no Python (v0.45.0).
 *
 * No Python, o tokenizer põe o código da língua de origem (`__en__`) no começo e `</s>` no fim, e a geração
 * força o código da língua de destino (`__pt__`) como primeiro token da resposta. No transformers.js 4.x esse
 * caminho depende de mexer na configuração do pós-processador, o mesmo tipo de atalho que quebrou o OPUS-MT
 * (#175). Aqui os ids são montados direto: [id da origem, ...peças do texto, </s>], e o destino vai em
 * `forced_bos_token_id`.
 */
export interface M2MTokenizerLike {
  convert_tokens_to_ids(token: string): number | null | undefined;
  encode(text: string, options?: { add_special_tokens?: boolean }): number[];
  unk_token_id?: number | null;
}

/** Id do código de língua (`__pt__`) no vocabulário, ou null se o modelo não conhece a língua. */
export function m2mLanguageId(tokenizer: M2MTokenizerLike, code: string): number | null {
  const id = tokenizer.convert_tokens_to_ids(`__${code}__`);
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && id !== tokenizer.unk_token_id ? id : null;
}

/** Ids de entrada: [língua de origem, ...texto, </s>]. */
export function m2mInputIds(tokenizer: M2MTokenizerLike, sourceId: number, text: string): number[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (/__[a-z]{2,3}__/.test(clean)) throw new Error('O texto de origem não pode trazer código de língua');
  const eos = tokenizer.convert_tokens_to_ids('</s>');
  if (typeof eos !== 'number') throw new Error('O tradutor não tem o token de fim de frase');
  return [sourceId, ...tokenizer.encode(clean, { add_special_tokens: false }), eos];
}
