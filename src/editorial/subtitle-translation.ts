import { AppError } from '../core/errors';
import type { Caption, EditPlan, TranslationModelRevision } from '../core/types';
import { SENTENCE_END, isHanChar, readableText, visualLength, type LanguageCode } from '../core/languages';
import { checkTranslation, describeTranslationProblem } from './translation-check';

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
    const text = readableText(caption.text);
    if (!text) continue;
    if (current && (caption.start - current.end > 0.65 || visualLength(current.source) + visualLength(text) + 1 > 110 || caption.end - current.start > 9 || count >= 6)) flush();
    if (current) {
      // chinês não leva espaço entre legendas
      current.source += isHanChar([...current.source].pop()!) && isHanChar([...text][0]!) ? text : ` ${text}`;
      current.end = caption.end;
    } else current = { source: text, start: caption.start, end: caption.end };
    count++;
    if (SENTENCE_END.test(text)) flush();
  }
  flush();
  return result;
}

/** Pedaços que podem ir para a próxima legenda: palavras, ou um caractere chinês por vez (pontuação grudada). */
function cueUnits(text: string): string[] {
  const out: string[] = [];
  for (const word of text.split(' ')) {
    if ([...word].filter(isHanChar).length < 2) {
      out.push(word);
      continue;
    }
    let cur = '';
    for (const ch of word) {
      if (cur && isHanChar(ch) && !/[\u3000-\u303F\uFF00-\uFFEF]/.test(ch)) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) out.push(cur);
  }
  return out.filter(Boolean);
}

/**
 * Quebra a tradução em frases legíveis; não associa palavras traduzidas a palavras faladas.
 * Confere TODOS os trechos antes de montar qualquer legenda: um trecho em outro idioma, vazio ou com
 * código interno (`>>pt_BR<<`, `__pt__`) recusa a faixa inteira (M4F-318), e a legenda original fica como está.
 * `maxChars` é medido como aparece na tela (um caractere chinês ocupa duas letras).
 */
export function translatedCaptions(groups: readonly TranslationGroup[], translations: readonly string[], maxChars = 55, to: LanguageCode = 'pt', from: LanguageCode = 'en'): Caption[] {
  if (groups.length !== translations.length) throw new AppError('TRADUCAO_FALHOU', 'quantidade de traduções diferente dos trechos de fala');
  groups.forEach((group, i) => {
    const problem = checkTranslation(group.source, translations[i] ?? '', to, from);
    if (problem) throw new AppError('TRADUCAO_INVALIDA', `trecho ${i + 1} de ${groups.length}: ${describeTranslationProblem(problem)}`);
  });
  const result: Caption[] = [];
  groups.forEach((group, groupIndex) => {
    const text = translations[groupIndex]!.replace(/\s+/g, ' ').trim();
    const chunks: string[] = [];
    for (const unit of cueUnits(text)) {
      if (visualLength(unit) > 120) throw new AppError('TRADUCAO_INVALIDA', `trecho ${groupIndex + 1}: palavra longa demais`);
      const last = chunks.length - 1;
      const glue = last >= 0 && isHanChar([...chunks[last]!].pop()!) && isHanChar([...unit][0]!) ? '' : ' ';
      // frase terminada (. ! ? ; 。 ।…) fecha a legenda mesmo com espaço sobrando: leitura por ideia, não por régua
      if (last >= 0 && visualLength(chunks[last]! + glue + unit) <= maxChars && !SENTENCE_END.test(chunks[last]!) && !/[;；]$/.test(chunks[last]!)) chunks[last] += glue + unit;
      else chunks.push(unit);
    }
    const weights = chunks.map((c) => visualLength(c));
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
  const avg = texts.reduce((n, t) => n + visualLength(t), 0) / texts.length;
  return Math.round(Math.min(42, Math.max(18, avg * 1.2)));
}

/** Mantém ambas as faixas no projeto e escolhe qual é mostrada/exportada. */
export function applySubtitleTranslation(plan: EditPlan, translated: Caption[], from: LanguageCode = 'en', to: LanguageCode = 'pt', model?: TranslationModelRevision): EditPlan {
  const original = plan.subtitleTranslation?.original ?? plan.captions;
  return {
    ...plan,
    captions: translated,
    subtitleTranslation: { ...(model && { model }), sourceLanguage: from, targetLanguage: to, active: 'translated', original, translated },
  };
}

export function selectSubtitleLanguage(plan: EditPlan, active: 'original' | 'translated'): EditPlan {
  const track = plan.subtitleTranslation;
  if (!track || track.active === active) return plan;
  return { ...plan, captions: active === 'original' ? track.original : track.translated, subtitleTranslation: { ...track, active } };
}

/** Reconstruir tempos/cortes invalida a tradução; as legendas originais nunca são perdidas. */
export function sourcePlanForRebuild(plan: EditPlan): EditPlan {
  return plan.subtitleTranslation ? { ...plan, captions: plan.subtitleTranslation.original, subtitleTranslation: undefined } : plan;
}
