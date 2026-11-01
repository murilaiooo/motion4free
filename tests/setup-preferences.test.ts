import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasCompletedSetup, markSetupCompleted, SETUP_DONE_KEY } from '../src/app/production/preferences';

function fakeStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('v0.32: quem já respondeu as perguntas começa no resumo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('começa como primeira vez e lembra depois de concluir', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    expect(hasCompletedSetup()).toBe(false);
    markSetupCompleted();
    expect(storage.data.get(SETUP_DONE_KEY)).toBe('1');
    expect(hasCompletedSetup()).toBe(true);
  });

  it('sem armazenamento disponível, trata como primeira vez e não quebra', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } });
    expect(hasCompletedSetup()).toBe(false);
    expect(() => markSetupCompleted()).not.toThrow();
  });
});
