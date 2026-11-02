/**
 * Limites de importação do editor (#154), num lugar só: tela inicial, preparo, "Adicionar clipes",
 * perguntas frequentes e erros M4F-104/106/107 leem daqui. O modo Clipes (vídeo longo) tem os
 * próprios limites (2 min a 2 h, ADR-0023) e não passa por aqui.
 */
export const IMPORT_LIMITS = {
  /** máximo de vídeos num projeto (ADR-0019) */
  maxFiles: 30,
  /** duração máxima de cada vídeo, em segundos */
  maxClipSec: 180,
  /** duração máxima dos vídeos somados, em segundos */
  maxTotalSec: 600,
  /**
   * Folga para arredondamento dos metadados: um arquivo de "3:00" pode dizer 180,02 s.
   * 10:00 exatos passam; 10:01 não.
   */
  toleranceSec: 0.5,
} as const;

/** "até 30 vídeos, 3 min cada, 10 min somados" */
export function importLimitsText(): string {
  const { maxFiles, maxClipSec, maxTotalSec } = IMPORT_LIMITS;
  return `até ${maxFiles} vídeos, ${maxClipSec / 60} min cada, ${maxTotalSec / 60} min somados`;
}

/** 0:00 / 10:00 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface ImportItem {
  name: string;
  /** null quando o arquivo não pôde ser lido */
  durationSec: number | null;
}

export type ImportProblemKind = 'excess-file' | 'clip-too-long' | 'over-total' | 'unreadable';

export interface ImportProblem {
  index: number;
  name: string;
  kind: ImportProblemKind;
  durationSec: number | null;
}

export interface ImportCheck {
  /** índices (na ordem escolhida) que cabem nos limites */
  accepted: number[];
  problems: ImportProblem[];
  /** soma dos aceitos + o que já está no projeto */
  totalSec: number;
  remainingSec: number;
  ok: boolean;
}

/**
 * Confere um lote antes de qualquer trabalho caro (transcrição, download de modelo). Mantém a ordem
 * escolhida: os primeiros que cabem ficam; cada arquivo que não cabe recebe o próprio motivo.
 * `existing` = clipes e duração já no projeto (para "Adicionar clipes").
 */
export function checkImportBatch(items: readonly ImportItem[], existing: { count: number; durationSec: number } = { count: 0, durationSec: 0 }): ImportCheck {
  const { maxFiles, maxClipSec, maxTotalSec, toleranceSec } = IMPORT_LIMITS;
  const accepted: number[] = [];
  const problems: ImportProblem[] = [];
  let total = existing.durationSec;
  let count = existing.count;
  items.forEach((item, index) => {
    const d = item.durationSec;
    const base = { index, name: item.name, durationSec: d };
    if (d === null || !Number.isFinite(d) || d <= 0) return void problems.push({ ...base, kind: 'unreadable' });
    if (d > maxClipSec + toleranceSec) return void problems.push({ ...base, kind: 'clip-too-long' });
    if (count >= maxFiles) return void problems.push({ ...base, kind: 'excess-file' });
    if (total + d > maxTotalSec + toleranceSec) return void problems.push({ ...base, kind: 'over-total' });
    accepted.push(index);
    total += d;
    count += 1;
  });
  return { accepted, problems, totalSec: total, remainingSec: Math.max(0, maxTotalSec - total), ok: problems.length === 0 };
}

/** Motivo de um arquivo recusado, em linguagem simples. */
export function importProblemText(p: ImportProblem): string {
  const { maxFiles, maxClipSec, maxTotalSec } = IMPORT_LIMITS;
  switch (p.kind) {
    case 'unreadable': return 'não deu para ler a duração deste arquivo (M4F-105)';
    case 'clip-too-long': return `tem ${formatClock(p.durationSec ?? 0)}; cada vídeo pode ter até ${formatClock(maxClipSec)} (M4F-104)`;
    case 'excess-file': return `passa de ${maxFiles} vídeos no projeto (M4F-106)`;
    case 'over-total': return `com ele a soma passaria de ${formatClock(maxTotalSec)} (M4F-107)`;
  }
}
