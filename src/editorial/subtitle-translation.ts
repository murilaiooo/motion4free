import type { Caption, EditPlan } from '../core/types';

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

/** Quebra a tradução em frases legíveis; não associa palavras traduzidas a palavras faladas. */
export function translatedCaptions(groups: readonly TranslationGroup[], translations: readonly string[]): Caption[] {
  if (groups.length !== translations.length) throw new Error('Quantidade de traduções diferente dos grupos de fala');
  const result: Caption[] = [];
  groups.forEach((group, groupIndex) => {
    const text = translations[groupIndex]?.replace(/\s+/g, ' ').trim() ?? '';
    if (!text) throw new Error(`Tradução vazia no trecho ${groupIndex + 1}`);
    const chunks: string[] = [];
    for (const word of text.split(' ')) {
      if (word.length > 120) throw new Error(`Palavra traduzida longa demais no trecho ${groupIndex + 1}`);
      const last = chunks.length - 1;
      if (last >= 0 && chunks[last]!.length + word.length + 1 <= 55) chunks[last] += ` ${word}`;
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
