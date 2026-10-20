/**
 * Tamanho em bytes para a pessoa, em português: "0 B", "12 KB", "350 MB", "1,4 GB".
 * Base 1024 (a mesma do Explorador de Arquivos do Windows).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const digits = u === 0 || v >= 100 ? 0 : v >= 10 && u < 3 ? 0 : 1;
  const text = v.toFixed(digits).replace('.', ',').replace(/,0$/, '');
  return `${text} ${units[u]}`;
}

export const MB = 1024 * 1024;

/** Duração curta: "0:42", "2:05". */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "agora há pouco", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data (dd/mm/aaaa). */
export function formatWhen(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((now - t) / 60_000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  const date = new Date(t);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
