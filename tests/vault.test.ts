import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { deriveKey, newSalt, parseVault, seal, unseal } from '../src/ai/credentials/vault';

/** Poucas rodadas só no teste, para ser rápido; o app usa 600 mil. */
const FAST = 100_000;

describe('cofre de chaves cifrado (issue #73)', () => {
  it('guarda e abre com a senha certa; o texto guardado não contém a chave', async () => {
    const salt = newSalt();
    const key = await deriveKey('senha-boa-123', salt, FAST);
    const sealed = await seal({ gemini: 'AIza-segredo-123' }, key, salt, FAST);
    const raw = JSON.stringify(sealed);
    expect(raw).not.toContain('AIza-segredo-123');
    expect(raw).not.toContain('senha-boa-123');
    const opened = await unseal(parseVault(raw)!, 'senha-boa-123');
    expect(opened.secrets).toEqual({ gemini: 'AIza-segredo-123' });
  });

  it('senha errada vira M4F-1213 e não revela nada', async () => {
    const salt = newSalt();
    const sealed = await seal({ groq: 'gsk_x' }, await deriveKey('certa-12345', salt, FAST), salt, FAST);
    const err = await unseal(sealed, 'errada-12345').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('M4F-1213');
  });

  it('cada gravação usa um IV novo', async () => {
    const salt = newSalt();
    const key = await deriveKey('senha-boa-123', salt, FAST);
    const a = await seal({ x: '1' }, key, salt, FAST);
    const b = await seal({ x: '1' }, key, salt, FAST);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('cofre danificado vira M4F-1216; vazio é "sem cofre"', () => {
    expect(parseVault(null)).toBeNull();
    expect(() => parseVault('{oi')).toThrow(/M4F-1216/);
    expect(() => parseVault(JSON.stringify({ v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 10, salt: 'a' }, iv: 'b', data: 'c' }))).toThrow(/M4F-1216/);
  });
});
