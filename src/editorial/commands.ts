import { AppError } from '../core/errors';
import { editPlanSchema } from '../core/schema';
import type { EditPlan } from '../core/types';
import { pushHistory, type History } from '../engine/history';

/**
 * Toda edição passa por aqui antes de entrar no histórico: um plano inválido é recusado e o desfazer/refazer
 * fica intacto. Guarda o próprio plano (não a cópia do zod), para não perder campos nem trocar a
 * identidade de partes que não mudaram.
 */
export function commitEdit(history: History<EditPlan>, candidate: EditPlan): History<EditPlan> {
  if (candidate === history.present) return history;
  const checked = editPlanSchema.safeParse(candidate);
  if (!checked.success) throw new AppError('EDICAO_INVALIDA', checked.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return pushHistory(history, candidate);
}
