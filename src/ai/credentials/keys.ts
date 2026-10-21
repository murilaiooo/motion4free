import { useSyncExternalStore } from 'react';
import { AppError } from '../../core/errors';
import { isProviderId, type ProviderId } from '../providers/registry';
import { MIN_PASSWORD, VAULT_ITERATIONS, deriveKey, newSalt, parseVault, seal, unseal } from './vault';

/**
 * Onde as chaves de API ficam (issue #73, ADR-0028):
 * - padrão: só na memória desta aba. Fechar ou recarregar a aba apaga.
 * - "Lembrar neste navegador": cofre cifrado com a senha da pessoa (vault.ts), em localStorage `m4f-cofre`.
 * Nunca em projeto salvo, URL, log, histórico ou relatório de erro. A chave antiga do Gemini
 * (`m4f-gemini-key`, em texto puro até a v0.26) só muda de lugar com o OK da pessoa.
 */

const VAULT_KEY = 'm4f-cofre';
export const LEGACY_GEMINI_KEY = 'm4f-gemini-key';

const session = new Map<ProviderId, string>();
/** serviços cuja chave está no cofre */
let remembered = new Set<ProviderId>();
/** chave derivada da senha, só na memória, enquanto o cofre está aberto */
let unlocked: { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; iterations: number } | null = null;
let version = 0;
// Token opaco por provedor: invalida catálogos de outra conta sem guardar hashes ou segredos fora do cofre.
const credentialVersions = new Map<ProviderId, number>();
export function credentialRevision(id: ProviderId): number {
  return credentialVersions.get(id) ?? 0;
}
const listeners = new Set<() => void>();

function changed(ids?: Iterable<ProviderId>) {
  version++;
  for (const id of ids ?? []) credentialVersions.set(id, credentialRevision(id) + 1);
  for (const l of listeners) l();
}

function readRaw(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

export type VaultState = 'nenhum' | 'trancado' | 'aberto' | 'danificado';

export function vaultState(): VaultState {
  const raw = readRaw(VAULT_KEY);
  if (!raw) return 'nenhum';
  try {
    parseVault(raw);
  } catch {
    return 'danificado';
  }
  return unlocked ? 'aberto' : 'trancado';
}

export function getKey(id: ProviderId): string | null {
  return session.get(id) ?? null;
}

export function isRemembered(id: ProviderId): boolean {
  return remembered.has(id);
}

/** Usa a chave nesta aba (só memória). */
export function setSessionKey(id: ProviderId, key: string): void {
  const k = key.trim();
  if (k) session.set(id, k);
  else session.delete(id);
  changed([id]);
}

async function writeVault(): Promise<void> {
  if (!unlocked) throw new AppError('COFRE_INDISPONIVEL', 'cofre trancado');
  const secrets: Record<string, string> = {};
  for (const id of remembered) {
    const k = session.get(id);
    if (k) secrets[id] = k;
  }
  const v = await seal(secrets, unlocked.key, unlocked.salt, unlocked.iterations);
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(v));
  } catch (err) {
    throw new AppError('COFRE_INDISPONIVEL', `localStorage recusou: ${err instanceof Error ? err.name : String(err)}`);
  }
}

/** Cria o cofre com uma senha nova (apaga um cofre antigo que esteja danificado ou esquecido). */
export async function createVault(password: string): Promise<void> {
  if (password.length < MIN_PASSWORD) throw new AppError('COFRE_SENHA_CURTA');
  const salt = newSalt();
  const key = await deriveKey(password, salt);
  unlocked = { key, salt, iterations: VAULT_ITERATIONS };
  remembered = new Set();
  await writeVault();
  changed();
}

/** Destranca o cofre: as chaves guardadas passam a valer nesta aba. */
export async function unlockVault(password: string): Promise<number> {
  const v = parseVault(readRaw(VAULT_KEY));
  if (!v) throw new AppError('COFRE_INDISPONIVEL', 'não há cofre');
  const { secrets, key, salt } = await unseal(v, password);
  unlocked = { key, salt, iterations: v.kdf.iterations };
  remembered = new Set();
  const newlyOpened: ProviderId[] = [];
  for (const [id, k] of Object.entries(secrets)) {
    if (!isProviderId(id)) continue;
    remembered.add(id);
    if (!session.has(id)) { session.set(id, k); newlyOpened.push(id); }
  }
  changed(newlyOpened);
  return remembered.size;
}

/** Tranca: esquece a senha e as chaves do cofre nesta aba (as que não estão no cofre continuam até fechar a aba). */
export function lockVault(): void {
  for (const id of remembered) session.delete(id);
  unlocked = null;
  changed(remembered);
}

/** Guarda (ou tira) a chave deste serviço no cofre aberto. */
export async function rememberKey(id: ProviderId, yes: boolean): Promise<void> {
  const before = new Set(remembered);
  if (yes) remembered.add(id);
  else remembered.delete(id);
  try {
    await writeVault();
  } catch (err) {
    remembered = before;
    throw err;
  } finally {
    changed();
  }
}

/** Esquece a chave deste serviço: na aba e no cofre (se estiver aberto). */
export async function forgetKey(id: ProviderId): Promise<void> {
  session.delete(id);
  if (remembered.has(id) && unlocked) await rememberKey(id, false);
  changed([id]);
}

export function deleteVault(): void {
  try {
    localStorage.removeItem(VAULT_KEY);
  } catch {
    // nada guardado
  }
  for (const id of remembered) session.delete(id);
  const removed = remembered;
  remembered = new Set();
  unlocked = null;
  changed(removed);
}

/** "Apagar tudo do Motion4Free": nenhuma chave sobra nesta aba. */
export function forgetAllKeys(): void {
  const removed = [...session.keys()];
  session.clear();
  remembered = new Set();
  unlocked = null;
  changed(removed);
}

export function vaultAvailable(): boolean {
  try {
    return !!globalThis.crypto?.subtle && typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/* ---------- chave antiga do Gemini (texto puro, até a v0.26) ---------- */

export function legacyGeminiKey(): string | null {
  const k = readRaw(LEGACY_GEMINI_KEY)?.trim();
  return k ? k : null;
}

export function removeLegacyGeminiKey(): void {
  try {
    localStorage.removeItem(LEGACY_GEMINI_KEY);
  } catch {
    // sem armazenamento
  }
  changed();
}

/** Move a chave antiga para a memória da aba (e para o cofre, se ele estiver aberto e a pessoa quiser). Só apaga a cópia antiga depois. */
export async function migrateLegacyGemini(toVault: boolean): Promise<void> {
  const k = legacyGeminiKey();
  if (!k) return;
  setSessionKey('gemini', k);
  if (toVault) await rememberKey('gemini', true);
  removeLegacyGeminiKey();
}

/** Quantas chaves estão abertas nesta aba (para os textos de status). */
export function openKeys(): ProviderId[] {
  return [...session.keys()];
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Redesenha quem mostra o estado das chaves quando algo muda (sem expor as chaves). */
export function useKeysVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
