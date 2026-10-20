import type { Word } from '../../src/core/types';

/** Palavras com tempos sintéticos: 0,35 s por palavra e pausa de 0,4 s depois de cada frase. */
export function wordsFrom(text: string, start = 0, perWord = 0.35, pause = 0.4): Word[] {
  let t = start;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw, i) => {
      const w = { id: `w${i + 1}`, text: raw, start: t, end: t + perWord * 0.9 };
      t += perWord + (/[.!?]$/.test(raw) ? pause : 0);
      return w;
    });
}

/** Transcrição de exemplo realista (~40 s) com número, enumeração, pergunta, nome e palavras-chave. */
export const SAMPLE_TEXT =
  'Oi, meu nome é Ana Souza. Você sabe por que a maioria das pessoas desiste da academia? ' +
  'Noventa por cento desistem antes de três meses. Hoje eu vou te mostrar três dicas simples. ' +
  'Primeiro, comece pequeno. Dez minutos por dia já bastam. ' +
  'Segundo, durma bem. Sem sono não existe resultado! ' +
  'Terceiro, acompanhe o seu progresso toda semana. ' +
  'O segredo é a consistência, não a intensidade. Isso muda tudo. ' +
  'Gastei dois mil reais antes de entender isso. Não cometa o mesmo erro. Siga para mais dicas.';
