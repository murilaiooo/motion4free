import { useSyncExternalStore } from 'react';
import { addPerfEntry, parsePerfEntries, type PerfEntry } from '../core/perf-log';

/**
 * Onde as medições de desempenho ficam (#170): só neste navegador (localStorage), nunca enviadas.
 * Sem localStorage (aba privada, bloqueado) vale até fechar a aba.
 */
const KEY = 'm4f.perf.v1';
const listeners = new Set<() => void>();

function read(): PerfEntry[] {
  try {
    return parsePerfEntries(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return [];
  }
}

let entries: PerfEntry[] = typeof localStorage === 'undefined' ? [] : read();

function save(next: PerfEntry[]): void {
  entries = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* vale até fechar a aba */
  }
  listeners.forEach((l) => l());
}

export function recordPerf(entry: PerfEntry): void {
  save(addPerfEntry(entries, entry));
}

export function clearPerf(): void {
  save([]);
}

export function getPerfEntries(): PerfEntry[] {
  return entries;
}

export function usePerfEntries(): PerfEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => entries,
  );
}
