import { creativeSetupSchema, DEFAULT_SETUP, migrateSetupDefaults, type CreativeSetup } from '../../core/production';
import { z } from 'zod';

export const SETUP_KEY = 'm4f.creative-setup.v1';
const MIGRATED_KEY = 'm4f.creative-setup.auto-v041';
const draftSchema = creativeSetupSchema.extend({ cta: z.string().max(32) });

export function readSetup(): CreativeSetup {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return structuredClone(DEFAULT_SETUP);
    const result = draftSchema.safeParse(JSON.parse(raw));
    if (!result.success) return structuredClone(DEFAULT_SETUP);
    // v0.41: uma vez só, os padrões antigos (Inter, amarelo...) viram "do modelo"
    if (localStorage.getItem(MIGRATED_KEY) === '1') return result.data;
    const migrated = migrateSetupDefaults(result.data);
    localStorage.setItem(SETUP_KEY, JSON.stringify(migrated));
    localStorage.setItem(MIGRATED_KEY, '1');
    return migrated;
  } catch {
    return structuredClone(DEFAULT_SETUP);
  }
}

export function saveSetup(setup: CreativeSetup): boolean {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(draftSchema.parse(setup)));
    return true;
  } catch {
    return false;
  }
}

/** v0.32: quem já concluiu as perguntas uma vez começa no resumo ("usar as mesmas escolhas"). */
export const SETUP_DONE_KEY = 'm4f.creative-setup.done';

export function hasCompletedSetup(): boolean {
  try {
    return localStorage.getItem(SETUP_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSetupCompleted(): void {
  try {
    localStorage.setItem(SETUP_DONE_KEY, '1');
  } catch {
    // sem armazenamento: só perde o atalho na próxima vez
  }
}
