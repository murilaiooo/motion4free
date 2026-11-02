/** Mensagens entre o editor e o Worker do tradutor local (inglês → português do Brasil). */

/**
 * Modelo de tradução local: conversão ONNX (Xenova) do Helsinki-NLP OPUS-MT en-ROMANCE.
 * Pesos CC-BY-4.0 (atribuição em docs/licencas.md); baixados sob demanda, fora do bundle.
 */
export const TRANSLATION_MODEL = { repo: 'Xenova/opus-mt-en-ROMANCE', revision: 'main' } as const;

export interface TranslationToWorker { texts: string[] }

export type TranslationErrorCode = 'TRADUCAO_FALHOU' | 'TRADUCAO_MODELO' | 'TRADUCAO_INVALIDA';

export type TranslationFromWorker =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; texts: string[] }
  | { type: 'error'; code: TranslationErrorCode; message: string };
