import { AppError } from '../../core/errors';

/**
 * Cofre de chaves cifrado (issue #73, ADR-0028). Só existe se a pessoa marcar "Lembrar neste navegador".
 * AES-GCM 256 com chave derivada da senha dela (PBKDF2-SHA-256, 600 mil rodadas, sal aleatório).
 * A senha nunca é guardada; sem ela, o conteúdo guardado é ilegível. Isso protege a chave em disco
 * (alguém copiando os dados do navegador), não contra um programa malicioso rodando na página aberta.
 * Usa só Web Crypto (existe no navegador e no Node 20+, por isso é testado em tests/vault.test.ts).
 */

export const VAULT_VERSION = 1;
export const VAULT_ITERATIONS = 600_000;
export const MIN_PASSWORD = 8;

export interface SealedVault {
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  data: string;
}

/** Conteúdo do cofre: uma chave por serviço. */
export type VaultSecrets = Record<string, string>;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new AppError('COFRE_INDISPONIVEL', 'crypto.subtle ausente (página fora de HTTPS?)');
  return s;
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations = VAULT_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Sal novo para um cofre novo. */
export function newSalt(): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(16));
}

export function parseVault(raw: string | null): SealedVault | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new AppError('COFRE_CORROMPIDO', 'não é JSON');
  }
  const s = v as SealedVault;
  if (s?.v !== VAULT_VERSION || s.kdf?.name !== 'PBKDF2' || s.kdf.hash !== 'SHA-256' || typeof s.kdf.salt !== 'string' || typeof s.iv !== 'string' || typeof s.data !== 'string' || !(s.kdf.iterations >= 100_000))
    throw new AppError('COFRE_CORROMPIDO', 'campos fora do formato');
  return s;
}

/** Cifra as chaves com um IV novo a cada gravação. */
export async function seal(secrets: VaultSecrets, key: CryptoKey, salt: Uint8Array<ArrayBuffer>, iterations = VAULT_ITERATIONS): Promise<SealedVault> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(secrets))));
  return { v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(salt) }, iv: b64(iv), data: b64(data) };
}

/** Abre o cofre com a senha. Senha errada → M4F-1213. Devolve também a chave derivada, para gravar de novo sem pedir a senha. */
export async function unseal(vault: SealedVault, password: string): Promise<{ secrets: VaultSecrets; key: CryptoKey; salt: Uint8Array<ArrayBuffer> }> {
  const salt = unb64(vault.kdf.salt);
  const key = await deriveKey(password, salt, vault.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.data));
  } catch {
    throw new AppError('COFRE_SENHA_ERRADA');
  }
  let secrets: unknown;
  try {
    secrets = JSON.parse(dec.decode(plain));
  } catch {
    throw new AppError('COFRE_CORROMPIDO', 'conteúdo decifrado não é JSON');
  }
  if (!secrets || typeof secrets !== 'object') throw new AppError('COFRE_CORROMPIDO', 'conteúdo não é uma lista de chaves');
  const clean: VaultSecrets = {};
  for (const [k, v] of Object.entries(secrets)) if (typeof v === 'string') clean[k] = v;
  return { secrets: clean, key, salt };
}
