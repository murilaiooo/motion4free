import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/core/errors';

let store: Map<string, string>;
let storageListener: ((event: { key: string | null }) => void) | null;

beforeEach(() => {
  vi.resetModules();
  store = new Map();
  storageListener = null;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  });
  vi.stubGlobal('window', {
    addEventListener: (name: string, handler: (event: { key: string | null }) => void) => {
      if (name === 'storage') storageListener = handler;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('issue #73: encrypted vault lifecycle, revocation and concurrent tabs', () => {
  it('persists ciphertext only; lock, unlock and forget one key without losing other providers', async () => {
    const keys = await import('../src/ai/credentials/keys');
    keys.setSessionKey('groq', 'gsk_synthetic_a');
    keys.setSessionKey('gemini', 'AIza-synthetic-b');
    await keys.createVault('test-passphrase-123');
    await keys.rememberKey('groq', true);
    await keys.rememberKey('gemini', true);
    expect(store.get('m4f-cofre')).not.toContain('gsk_synthetic_a');
    expect(store.get('m4f-cofre')).not.toContain('AIza-synthetic-b');
    keys.lockVault();
    expect(keys.getKey('groq')).toBeNull();
    expect(keys.getKey('gemini')).toBeNull();
    await keys.unlockVault('test-passphrase-123');
    expect(keys.getKey('groq')).toBe('gsk_synthetic_a');
    await keys.forgetKey('groq');
    keys.lockVault();
    await keys.unlockVault('test-passphrase-123');
    expect(keys.getKey('groq')).toBeNull();
    expect(keys.getKey('gemini')).toBe('AIza-synthetic-b');
  });

  it('another tab changing vault immediately locks keys owned by that vault', async () => {
    const keys = await import('../src/ai/credentials/keys');
    keys.setSessionKey('groq', 'gsk_vault');
    keys.setSessionKey('openrouter', 'sk-or-session');
    await keys.createVault('test-passphrase-123');
    await keys.rememberKey('groq', true);
    expect(storageListener).toBeTypeOf('function');
    storageListener!({ key: 'm4f-cofre' });
    expect(keys.getKey('groq')).toBeNull();
    expect(keys.getKey('openrouter')).toBe('sk-or-session');
    expect(keys.vaultState()).toBe('trancado');
  });

  it('delete vault during asynchronous unlock never restores revoked credentials', async () => {
    const keys = await import('../src/ai/credentials/keys');
    keys.setSessionKey('groq', 'gsk_unsafe');
    await keys.createVault('test-passphrase-123');
    await keys.rememberKey('groq', true);
    keys.lockVault();
    const unlocking = keys.unlockVault('test-passphrase-123');
    keys.deleteVault();
    const err = await unlocking.catch(error => error as Error);
    expect(err).toMatchObject({ key: 'COFRE_INDISPONIVEL' });
    expect(keys.getKey('groq')).toBeNull();
    expect(keys.vaultState()).toBe('nenhum');
  });

  it('delete vault during asynchronous encryption cannot resurrect the vault', async () => {
    const keys = await import('../src/ai/credentials/keys');
    keys.setSessionKey('groq', 'gsk_unsafe');
    await keys.createVault('test-passphrase-123');
    const persisting = keys.rememberKey('groq', true);
    keys.deleteVault();
    await expect(persisting).rejects.toMatchObject({ key: 'COFRE_INDISPONIVEL' });
    expect(keys.vaultState()).toBe('nenhum');
    expect(store.has('m4f-cofre')).toBe(false);
  });
});
