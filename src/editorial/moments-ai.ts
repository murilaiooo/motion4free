import { AppError, describeError, type ErrorKey } from '../core/errors';
import { cleanText, escapeData, extractJsonObject, type AiChoice, type AiMessages } from './ai-brief';
import type { Moment } from './highlights';
import { shortTitle } from './highlights';

/**
 * IA opcional no criador de clipes (v0.22, ADR-0023). As regras acham os candidatos; a IA só reordena e
 * dá um título curto. Nada da resposta é executado: só números de candidatos que existem e títulos limpos
 * e curtos passam. Falha ou resposta sem nada aproveitável = ordem das regras, com aviso M4F-1106.
 * A IA nunca escolhe trecho fora da lista nem muda onde o corte começa ou termina.
 */

export const MOMENT_TEXT_MAX = 280;
export const MOMENT_TITLE_MAX = 60;

const SYSTEM = [
  'Você escolhe os melhores cortes de um vídeo longo para virar Reels/TikTok.',
  'Recebe trechos numerados da fala (português do Brasil). Escolha os que funcionam sozinhos, prendem a atenção nos primeiros segundos e têm começo, meio e fim.',
  'Responda SOMENTE com um objeto JSON, sem texto antes ou depois, sem ```:',
  '{"clipes":[{"n":<número do trecho>,"titulo":"<título curto e chamativo, até 60 caracteres>"}]}',
  'Coloque do melhor para o pior. Use só números da lista. Não invente fatos no título: ele resume o que é dito.',
].join('\n');

const EXAMPLE_USER = '<quantos>2</quantos>\n<trechos>\n1: Bom dia a todos, obrigado por estarem aqui hoje.\n2: Você sabia que 90% das pessoas erram isso no primeiro emprego? O erro é aceitar sem negociar.\n3: Eu perdi tudo em 2019. E foi a melhor coisa que me aconteceu, porque aprendi a recomeçar.\n</trechos>';
const EXAMPLE_ASSISTANT = '{"clipes":[{"n":2,"titulo":"O erro de 90% no primeiro emprego"},{"n":3,"titulo":"Perdi tudo e aprendi a recomeçar"}]}';

export function momentsAiMessages(moments: Moment[], count: number): AiMessages {
  const lines = moments.map((m, i) => `${i + 1}: ${escapeData(m.text.length > MOMENT_TEXT_MAX ? `${m.text.slice(0, MOMENT_TEXT_MAX)}…` : m.text)}`);
  return {
    system: SYSTEM,
    examples: [{ user: EXAMPLE_USER, assistant: EXAMPLE_ASSISTANT }],
    user: `<quantos>${count}</quantos>\n<trechos>\n${lines.join('\n')}\n</trechos>`,
  };
}

export type MomentsParse = { ok: true; picks: { index: number; title: string }[] } | { ok: false; detail: string };

/** Lê a resposta: só índices 1..N sem repetição; título limpo e curto (vazio = fica o título das regras). */
export function parseMomentsReply(raw: string, total: number): MomentsParse {
  const ex = extractJsonObject(raw);
  if (!ex.ok) return ex;
  const obj = ex.value as { clipes?: unknown };
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.clipes)) return { ok: false, detail: 'sem a lista "clipes"' };
  const seen = new Set<number>();
  const picks: { index: number; title: string }[] = [];
  for (const item of obj.clipes) {
    if (!item || typeof item !== 'object') continue;
    const n = Number((item as { n?: unknown }).n);
    if (!Number.isInteger(n) || n < 1 || n > total || seen.has(n)) continue;
    seen.add(n);
    picks.push({ index: n - 1, title: cleanText((item as { titulo?: unknown }).titulo, 200) });
  }
  if (picks.length === 0) return { ok: false, detail: 'nenhum número de trecho válido' };
  return { ok: true, picks };
}

/**
 * Nova ordem: os escolhidos pela IA primeiro (com o título dela), depois os outros na ordem das regras.
 * `rank` e `id` são refeitos; início, fim, texto e nota continuam os das regras.
 */
export function applyPicks(moments: Moment[], picks: { index: number; title: string }[]): Moment[] {
  const chosen = picks.map((p) => ({ ...moments[p.index]!, title: p.title ? shortTitle(p.title, MOMENT_TITLE_MAX) : moments[p.index]!.title, reasons: ['escolhido pela IA', ...moments[p.index]!.reasons.slice(0, 3)] }));
  const rest = moments.filter((_, i) => !picks.some((p) => p.index === i));
  return [...chosen, ...rest].map((m, k) => ({ ...m, id: `m${k + 1}`, rank: k + 1 }));
}

/** Pergunta à IA e devolve a lista reordenada, ou a das regras com o aviso M4F-1106. */
export async function rankMomentsWithAi(moments: Moment[], count: number, ai: AiChoice): Promise<{ moments: Moment[]; warning: AppError | null }> {
  if (moments.length < 2) return { moments, warning: null };
  const fallback: ErrorKey = 'IA_MOMENTOS_FALHOU';
  let raw: string;
  try {
    raw = await ai.complete(momentsAiMessages(moments, count));
  } catch (err) {
    const why = err instanceof AppError ? `${err.code} ${err.detail}` : describeError(err);
    return { moments, warning: new AppError(fallback, why.slice(0, 200)) };
  }
  const parsed = parseMomentsReply(raw, moments.length);
  if (!parsed.ok) return { moments, warning: new AppError(fallback, parsed.detail) };
  return { moments: applyPicks(moments, parsed.picks), warning: null };
}
