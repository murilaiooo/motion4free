import { AppError } from '../core/errors';
import { editPlanSchema } from '../core/schema';
import type { EditPlan } from '../core/types';
import { pushHistory, type History } from '../engine/history';

export function commitEdit(history: History<EditPlan>, candidate: EditPlan): History<EditPlan> {
  if (candidate === history.present) return history;
  const checked = editPlanSchema.safeParse(candidate);
  if (!checked.success) throw new AppError('PRODUCAO_INVALIDA', checked.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return pushHistory(history, checked.data as EditPlan);
}
