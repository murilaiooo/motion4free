import type { SpeechLanguage } from './asr-models';
import { LANGUAGES } from './languages';

/**
 * Vigia da transcrição (v0.45.1): um trecho que nunca termina não pode travar um vídeo de 1 h.
 *
 * - `maxNewTokens`: teto de texto que o Whisper pode escrever num trecho, pelo tamanho do trecho. Sem ele, um
 *   trecho de música ou ruído entra em laço ("you you you…") até o limite do modelo (448 pedaços), duas vezes
 *   (a segunda tentativa contra laço), e na placa de vídeo isso leva minutos sem notícia.
 * - `stallLimitSec`: quanto tempo um trecho pode levar antes de o app desistir dele e reiniciar o processo.
 * - `afterStall`: o que fazer quando um trecho passa do limite: reiniciar o mesmo modelo uma vez, depois o próximo
 *   da escada, e só então parar com M4F-321.
 */

/** Limite do Whisper: 448 posições na saída, menos os 4 marcadores do início e folga. */
export const WHISPER_MAX_TOKENS = 440;

/**
 * Pedaços de texto (tokens) por segundo de fala rápida, por escrita, com folga. O vocabulário do Whisper gasta
 * poucos pedaços em inglês, espanhol, francês, português e russo; chinês, um pouco mais; hindi, bengali, árabe e
 * urdu, bem mais (cada letra pode virar 2–3 pedaços).
 */
function tokensPerSecond(language: SpeechLanguage): number {
  if (language === 'auto') return 25;
  const script = LANGUAGES[language].script;
  if (script === 'latin' || script === 'cyrillic') return 10;
  if (script === 'han') return 12;
  return 25;
}

/** Teto de pedaços que o Whisper pode escrever para `feedSec` segundos de áudio. */
export function maxNewTokens(feedSec: number, language: SpeechLanguage): number {
  const sec = Number.isFinite(feedSec) && feedSec > 0 ? feedSec : 30;
  return Math.min(WHISPER_MAX_TOKENS, Math.ceil(sec * tokensPerSecond(language)) + 24);
}

/**
 * Quanto um trecho de `feedSec` segundos pode levar (as duas tentativas somadas) antes de contar como travado.
 * Na placa de vídeo um trecho de 30 s leva de 1 a 20 s; no processador, até 1–2 min em aparelho fraco. O limite é
 * folgado para nunca cortar um aparelho lento que está andando.
 */
export function stallLimitSec(device: string, feedSec: number): number {
  const sec = Number.isFinite(feedSec) && feedSec > 0 ? feedSec : 30;
  return device === 'webgpu' ? Math.max(150, sec * 6) : Math.max(360, sec * 20);
}

export type StallAction = 'mesmo-modelo' | 'proximo-modelo' | 'parar';

/**
 * `stallsHere`: quantas vezes este mesmo trecho já travou (contando a de agora). `step`/`ladderLength`: posição na
 * escada de modelos. Primeira trava: reinicia o mesmo modelo (a placa de vídeo pode ter só engasgado). Segunda no
 * mesmo trecho: passa para o próximo modelo. Sem próximo: para (M4F-321).
 */
export function afterStall(stallsHere: number, step: number, ladderLength: number): StallAction {
  if (stallsHere <= 1) return 'mesmo-modelo';
  return step + 1 < ladderLength ? 'proximo-modelo' : 'parar';
}
