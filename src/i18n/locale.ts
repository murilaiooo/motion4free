/**
 * Idioma da interface (v0.40, ADR-0041): inglês ou português.
 * Primeira visita: segue o idioma do navegador (português → pt; qualquer outro → en).
 * Depois que a pessoa troca no botão, a escolha fica guardada neste navegador.
 */

export type Locale = 'pt' | 'en';
export const LOCALES: readonly Locale[] = ['en', 'pt'];
const KEY = 'm4f-idioma';

/** Decide o idioma pela lista de idiomas do navegador (pura, testável). */
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const l = lang.toLowerCase();
    if (l.startsWith('pt')) return 'pt';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

function readSaved(): Locale | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'pt' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

function initial(): Locale {
  if (typeof navigator === 'undefined') return 'pt';
  return readSaved() ?? detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language ?? 'pt']);
}

let current: Locale = initial();
const listeners = new Set<(l: Locale) => void>();

export const getLocale = (): Locale => current;

/** Etiqueta para datas e números (Intl). */
export const localeTag = (): string => (current === 'en' ? 'en-US' : 'pt-BR');

export function subscribeLocale(fn: (l: Locale) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Troca o idioma do app inteiro e guarda a escolha neste navegador. */
export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  listeners.forEach((fn) => fn(next));
}
