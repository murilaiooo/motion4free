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
