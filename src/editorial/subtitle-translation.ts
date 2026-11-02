import { AppError } from '../core/errors';
import type { Caption, EditPlan } from '../core/types';
import { checkPortugueseTranslation, describeTranslationProblem } from './translation-check';

/** Grupos de fala completos para não traduzir palavras soltas fora de contexto. */
export interface TranslationGroup {
  source: string;
  start: number;
  end: number;
}

export function translationGroups(captions: readonly Caption[]): TranslationGroup[] {
  const result: TranslationGroup[] = [];
  let current: TranslationGroup | null = null;
  let count = 0;
  const flush = () => {
    if (current) result.push(current);
    current = null;
    count = 0;
  };
  for (const caption of [...captions].sort((a, b) => a.start - b.start)) {
    const text = caption.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (current && (caption.start - current.end > 0.65 || current.source.length + text.length + 1 > 110 || caption.end - current.start > 9 || count >= 6)) flush();
    if (current) {
      current.source += ` ${text}`;
      current.end = caption.end;
    } else current = { source: text, start: caption.start, end: caption.end };
    count++;
    if (/[.!?…]["'”’)]?$/.test(text)) flush();
  }
  flush();
  return result;
}

/**
 * Quebra a tradução em frases legíveis; não associa palavras traduzidas a palavras faladas.
 * Confere TODOS os trechos antes de montar qualquer legenda: um trecho em outro idioma, vazio ou com
 * código interno (`>>pt_BR<<`) recusa a faixa inteira (M4F-318), e a legenda original fica como está.
 */
export function translatedCaptions(groups: readonly TranslationGroup[], translations: readonly string[], maxChars = 55): Caption[] {
  if (groups.length !== translations.length) throw new AppError('TRADUCAO_FALHOU', 'quantidade de traduções diferente dos trechos de fala');
  groups.forEach((group, i) => {
    const problem = checkPortugueseTranslation(group.source, translations[i] ?? '');
    if (problem) throw new AppError('TRADUCAO_INVALIDA', `trecho ${i + 1} de ${groups.length}: ${describeTranslationProblem(problem)}`);
  });
  const result: Caption[] = [];
  groups.forEach((group, groupIndex) => {
    const text = translations[groupIndex]!.replace(/\s+/g, ' ').trim();
    const chunks: string[] = [];
    for (const word of text.split(' ')) {
      if (word.length > 120) throw new AppError('TRADUCAO_INVALIDA', `trecho ${groupIndex + 1}: palavra longa demais`);
      const last = chunks.length - 1;
      // frase terminada (. ! ? ;) fecha a legenda mesmo com espaço sobrando: leitura por ideia, não por régua
      if (last >= 0 && chunks[last]!.length + word.length + 1 <= maxChars && !/[.!?;…]$/.test(chunks[last]!)) chunks[last] += ` ${word}`;
      else chunks.push(word);
    }
    const weights = chunks.map((s) => s.length);
    const total = weights.reduce((n, x) => n + x, 0);
    let cumulative = 0;
    chunks.forEach((chunk, i) => {
      const start = group.start + ((group.end - group.start) * cumulative) / total;
      cumulative += weights[i]!;
      const end = i === chunks.length - 1 ? group.end : group.start + ((group.end - group.start) * cumulative) / total;
      result.push({ id: `translation-${groupIndex}-${i}`, text: chunk, start, end, wordIds: [], wordStarts: [], translationCue: true });
    });
  });
  return result;
}

/**
 * Tamanho de cada legenda traduzida parecido com o das legendas originais do estilo atual
 * (estilos de Reels mostram poucas palavras por vez); entre 18 e 42 caracteres.
 */
export function translatedCueLength(captions: readonly Caption[]): number {
  const texts = captions.map((c) => c.text.trim()).filter(Boolean);
  if (texts.length === 0) return 42;
  const avg = texts.reduce((n, t) => n + t.length, 0) / texts.length;
  return Math.round(Math.min(42, Math.max(18, avg * 1.2)));
}

/** Mantém ambas as faixas no projeto e escolhe qual é mostrada/exportada. */
export function applySubtitleTranslation(plan: EditPlan, translated: Caption[]): EditPlan {
  const original = plan.subtitleTranslation?.original ?? plan.captions;
  return {
    ...plan,
    captions: translated,
    subtitleTranslation: { sourceLanguage: 'en', targetLanguage: 'pt-BR', active: 'pt-BR', original, translated },
  };
}

export function selectSubtitleLanguage(plan: EditPlan, active: 'original' | 'pt-BR'): EditPlan {
  const track = plan.subtitleTranslation;
  if (!track || track.active === active) return plan;
  return { ...plan, captions: active === 'original' ? track.original : track.translated, subtitleTranslation: { ...track, active } };
}

/** Reconstruir tempos/cortes invalida a tradução; as legendas originais nunca são perdidas. */
export function sourcePlanForRebuild(plan: EditPlan): EditPlan {
  return plan.subtitleTranslation ? { ...plan, captions: plan.subtitleTranslation.original, subtitleTranslation: undefined } : plan;
}
