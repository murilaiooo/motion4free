/** Histórico de desfazer/refazer, imutável. Cada estado é guardado inteiro (planos são pequenos). */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  limit: number;
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T, limit = HISTORY_LIMIT): History<T> {
  return { past: [], present, future: [], limit };
}

/** Registra um novo estado; o mesmo objeto (operação sem efeito) não cria entrada. */
export function pushHistory<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = [...h.past, h.present].slice(-h.limit);
  return { past, present: next, future: [], limit: h.limit };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future], limit: h.limit };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  return { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1), limit: h.limit };
}
