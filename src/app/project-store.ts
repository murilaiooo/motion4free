import { browserStorage, opfsAvailable } from './browser-storage';

/**
 * Projetos salvos no armazenamento privado do navegador (OPFS), só neste aparelho.
 * A lógica (vários projetos, migração da v0.10, medição) fica em `src/core/project-library.ts` e
 * `src/core/storage-report.ts`; aqui só se escolhe o armazenamento do navegador (ADR-0016).
 */
export const storage = browserStorage();
export const projectFs = storage.fs;

export function storageAvailable(): boolean {
  return opfsAvailable();
}
