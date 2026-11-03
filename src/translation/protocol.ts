import type { LanguageCode } from '../core/languages';

/** Mensagens entre o editor e o Worker do tradutor local (qualquer par das 10 línguas, v0.45.0). */

/**
 * Modelos de tradução locais, baixados sob demanda (fora do bundle), conversões ONNX da Xenova:
 * - `opus`: Helsinki-NLP OPUS-MT en-ROMANCE (pesos CC-BY-4.0), só inglês → português (ADR-0043);
 * - `m2m`: Meta M2M100 418M (MIT), de qualquer uma para qualquer uma das 10 línguas (ADR-0044).
 */
export const TRANSLATION_MODELS = {
  opus: { repo: 'Xenova/opus-mt-en-ROMANCE', revision: '9d2ba69ac80c8e8453c3d9a1e2323a0e7b8ca3cd' },
  m2m: { repo: 'Xenova/m2m100_418M', revision: 'main' },
} as const;
export type TranslationEngine = keyof typeof TRANSLATION_MODELS;

/** Inglês → português continua no OPUS-MT, já corrigido e conferido (#175); o resto vai pelo M2M100. */
export function translationEngine(from: LanguageCode, to: LanguageCode): TranslationEngine {
  return from === 'en' && to === 'pt' ? 'opus' : 'm2m';
}

export interface TranslationToWorker { texts: string[]; from: LanguageCode; to: LanguageCode }

export type TranslationErrorCode = 'TRADUCAO_FALHOU' | 'TRADUCAO_MODELO' | 'TRADUCAO_INVALIDA';

export type TranslationFromWorker =
  | { type: 'progress'; done: number; total: number }
  | { type: 'download'; loaded: number; total: number }
  | { type: 'done'; texts: string[] }
  | { type: 'error'; code: TranslationErrorCode; message: string };
