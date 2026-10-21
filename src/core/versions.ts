import { AppError } from './errors';
import type { EditPlan } from './types';

/**
 * Versões com nome ("versões"): fotografias do plano que a pessoa guarda e pode restaurar.
 * Ficam no projeto salvo, por cima do desfazer/refazer (restaurar entra no desfazer).
 */
export const MAX_VERSIONS = 20;
export const VERSION_NAME_MAX = 40;

export interface PlanVersion {
  id: string;
  name: string;
  savedAt: string;
  plan: EditPlan;
}

export function addVersion(list: PlanVersion[], name: string, plan: EditPlan, now: Date): PlanVersion[] {
  if (list.length >= MAX_VERSIONS) throw new AppError('VERSAO_LIMITE', `${list.length} versões`);
  const n = Math.max(0, ...list.map((v) => Number(v.id.slice(1)) || 0)) + 1;
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, VERSION_NAME_MAX) || `Versão ${n}`;
  // Uma versão é um snapshot independente, não uma referência ao objeto ainda editável.
  return [...list, { id: `v${n}`, name: clean, savedAt: now.toISOString(), plan: structuredClone(plan) }];
}

export function removeVersion(list: PlanVersion[], id: string): PlanVersion[] {
  return list.filter((v) => v.id !== id);
}
