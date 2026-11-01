import type { ClipWork } from './ClipMaker';

/** Libera os MP4 já gerados de um trabalho de clipes (fica fora do ClipMaker para a tela inicial não carregá-lo, #156). */
export function releaseWork(work: ClipWork | null): void {
  for (const it of work?.items ?? []) if (it.job.kind === 'done') URL.revokeObjectURL(it.job.url);
}
