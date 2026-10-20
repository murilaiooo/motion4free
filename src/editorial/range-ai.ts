import { UNSUPPORTED_MAX } from '../core/brief';
import type { AppError } from '../core/errors';
import { lookIsEmpty, mergeLook, rangeLook } from '../core/look';
import type { Word } from '../core/types';
import { BLOCKS, askAi, buildAiMessages, enforceForbid, type AiChoice } from './ai-brief';
import { interpretRangePrompt, type RangeRequest } from './range-interpret';

/**
 * Pedido de trecho pelo mesmo intérprete do pedido geral (ADR-0011). As regras rodam sempre e são as
 * únicas que travam, destravam, voltam ao normal ou trocam a animação (comandos, não estilo). A IA, se
 * escolhida, lê o resto com o escopo "trecho": só tom, intensidade, ritmo, proibições, destaques e o
 * look do trecho (cortes, gancho, estilo, objetivo e público ficam de fora). Proibições só se somam.
 * Trecho travado continua protegido por applyRangeRequest.
 */
export async function interpretRangeLayered(prompt: string, words: Word[], ai: AiChoice | null): Promise<{ req: RangeRequest; warning: AppError | null }> {
  const rules = interpretRangePrompt(prompt);
  if (!ai) return { req: rules, warning: null };
  // comandos puros (travar, voltar ao normal) não precisam de IA
  const commandOnly = (rules.lock !== null || rules.reset) && !rules.tone && !rules.intensity && !rules.pace && rules.forbid.length === 0 && rules.emphasize.length === 0 && lookIsEmpty(rules.look);
  if (commandOnly) return { req: rules, warning: null };

  const r = await askAi(ai, buildAiMessages(rules.prompt, words, [], 'trecho'), 0, 'trecho');
  if (!r.ok) return { req: rules, warning: r.warning };
  const p = r.proposal;
  const req: RangeRequest = structuredClone(rules);
  req.tone ??= p.tone ?? null;
  req.intensity ??= p.intensity ?? null;
  req.pace ??= p.pace ?? null;
  for (const f of p.forbid) if (!req.forbid.includes(f)) req.forbid.push(f);
  for (const e of p.emphasize) if (!req.emphasize.includes(e) && !BLOCKS[e].some((x) => req.forbid.includes(x))) req.emphasize.push(e);
  // regras valem mais no mesmo campo; depois só campos de trecho; proibição vence
  const { look: scoped } = rangeLook(mergeLook(p.look, rules.look));
  const { look, removed } = enforceForbid(scoped, req.forbid);
  if (removed.length) req.notes.push(`A IA pediu ${removed.join(', ')}, mas você proibiu: a proibição vale mais.`);
  if (req.quiet && look.emoji) delete look.emoji;
  req.look = look;
  for (const u of p.unsupported) if (!req.unsupported.includes(u) && req.unsupported.length < UNSUPPORTED_MAX) req.unsupported.push(u);
  if (req.quiet && (req.accent || req.swap || req.emphasize.length > 0)) {
    req.accent = false;
    req.swap = false;
    req.emphasize = [];
  }
  req.understood = req.lock !== null || req.reset || req.swap || req.accent || req.quiet || !!req.tone || !!req.intensity || !!req.pace || req.forbid.length > 0 || req.emphasize.length > 0 || !lookIsEmpty(req.look);
  return { req, warning: null };
}
