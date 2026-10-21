import { useSyncExternalStore } from 'react';

/** Seções da tela Configurações (issue #73), na ordem do menu. */
export const SETTINGS_SECTIONS = ['ia', 'transcricao', 'armazenamento', 'editor', 'privacidade', 'sobre'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

let state: { open: boolean; section: SettingsSection } = { open: false, section: 'ia' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Abre Configurações por cima da tela atual: o projeto, a análise e a linha do tempo continuam como estavam. */
export function openSettings(section: SettingsSection = state.section): void {
  state = { open: true, section };
  emit();
}

export function closeSettings(): void {
  state = { ...state, open: false };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useSettingsRoute(): { open: boolean; section: SettingsSection } {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
