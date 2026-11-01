import { useEffect, useRef } from 'react';
import './library.css';
import { IMPORT_LIMITS, formatClock, importLimitsText, importProblemText, type ImportCheck } from '../core/import-limits';

/**
 * Aviso antes de começar (#154): quais arquivos passam dos limites do editor e por quê, quanto do
 * limite de 10 min já está usado, e o que dá para fazer. Nada é descartado em silêncio e nada é
 * transcrito ou baixado até a pessoa escolher.
 */
export function ImportLimitWarning({ files, check, adding, onContinue, onLongMode, onCancel }: {
  files: File[];
  check: ImportCheck;
  /** acrescentando ao projeto aberto (o projeto continua igual se cancelar) */
  adding: boolean;
  onContinue: (kept: File[]) => void;
  /** um vídeo só, longo demais para o editor: abrir no modo Clipes */
  onLongMode?: () => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  const kept = check.accepted.map((i) => files[i]!);
  const blocked = check.problems.filter((p) => p.kind !== 'unreadable');
  const longSingle = onLongMode && blocked.length === 1 && blocked[0]!.kind === 'clip-too-long' && (blocked[0]!.durationSec ?? 0) >= 120;
  return (
    <div ref={box} tabIndex={-1} className="m4f-callout warn import-warn" role="alert" data-testid="import-limit-warning" style={{ display: 'grid', gap: 'var(--s-2)' }}>
      <p style={{ margin: 0 }}>
        <b>{blocked.length === 1 ? 'Um vídeo não cabe' : `${blocked.length} vídeos não cabem`} no editor.</b> O limite é {importLimitsText()}.{' '}
        {adding ? 'O projeto aberto continua como está.' : 'Nada foi transcrito nem baixado ainda.'}
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.2em' }} data-testid="import-limit-list">
        {blocked.map((p) => (
          <li key={p.index}><b>{p.name}</b>: {importProblemText(p)}</li>
        ))}
      </ul>
      <p className="hint" style={{ margin: 0 }} data-testid="import-limit-budget">
        {kept.length > 0
          ? `Cabem ${kept.length} de ${files.length}: ${formatClock(check.totalSec)} de ${formatClock(IMPORT_LIMITS.maxTotalSec)} usados (sobram ${formatClock(check.remainingSec)}).`
          : 'Nenhum dos vídeos escolhidos cabe do jeito que está.'}
      </p>
      <div className="notice-row">
        {kept.length > 0 && (
          <button className="sm primary" onClick={() => onContinue(kept)} data-testid="import-limit-continue">
            Continuar só com {kept.length === 1 ? 'o que cabe' : `os ${kept.length} que cabem`}
          </button>
        )}
        {longSingle && (
          <button className="sm primary" onClick={onLongMode} data-testid="import-limit-long">
            Cortar em clipes (modo vídeo longo)
          </button>
        )}
        <button className="sm ghost" onClick={onCancel} data-testid="import-limit-cancel">
          {adding ? 'Cancelar' : 'Escolher outros vídeos'}
        </button>
      </div>
    </div>
  );
}
