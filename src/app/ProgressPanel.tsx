import { useEffect, useRef, useState } from 'react';
import { ProgressClock, STALL_SEC, formatDuration, progressFacts, type Progress, type ProgressSnapshot } from '../core/progress';

/**
 * Relógio de uma tarefa (v0.23, ADR-0024): recebe cada atualização de progresso e redesenha a cada
 * segundo, para o "passou"/"falta" andarem mesmo quando a etapa demora a mandar notícia.
 * `progress` null = nada rodando (o relógio zera para a próxima tarefa).
 */
export function useProgressClock(progress: Progress | null): ProgressSnapshot | null {
  const clock = useRef<ProgressClock | null>(null);
  const fed = useRef<Progress | null>(null);
  const [, setTick] = useState(0);
  if (!progress) {
    clock.current = null;
    fed.current = null;
  } else {
    clock.current ??= new ProgressClock();
    if (fed.current !== progress) {
      clock.current.update(progress);
      fed.current = progress;
    }
  }
  const running = progress !== null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return clock.current?.snapshot() ?? null;
}

interface Props {
  progress: Progress | null;
  /** título acima da barra; sem ele, o próprio texto da etapa vira o título */
  title?: string;
  /** versão de uma linha (cartões, rodapé, painéis estreitos) */
  compact?: boolean;
  testId?: string;
}

/**
 * Barra de progresso única do app: porcentagem (ou barra "andando" quando não dá para saber o total),
 * o que está fazendo, tempo passado, tempo restante e, em downloads, tamanho e velocidade.
 */
export function ProgressPanel({ progress, title, compact = false, testId = 'progress' }: Props) {
  const snap = useProgressClock(progress);
  if (!progress || !snap) return null;
  return <ProgressView snap={snap} title={title} compact={compact} testId={testId} />;
}

export function ProgressView({ snap, title, compact = false, testId = 'progress' }: { snap: ProgressSnapshot; title?: string; compact?: boolean; testId?: string }) {
  const p = snap.progress;
  const pct = snap.fraction === null ? null : Math.floor(snap.fraction * 100);
  const facts = progressFacts(snap);
  const stalled = snap.idleSec >= STALL_SEC;
  const heading = title ?? p.label;
  return (
    <div className={`progress-panel${compact ? ' compact' : ''}`} role="status" aria-live="polite" data-testid={testId}>
      <div className="progress-head">
        <span className="progress-title">
          {heading}
          {title && <small className="hint progress-step">{p.label}</small>}
        </span>
        <b className="tnum progress-pct" data-testid={`${testId}-pct`}>
          {pct === null ? '' : `${pct}%`}
        </b>
      </div>
      <div
        className={`bar${pct === null ? ' indeterminate' : ''}`}
        role="progressbar"
        aria-label={heading}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={pct === null ? `${p.label}, ${facts[0]}` : `${pct}%, ${facts.join(', ')}`}
      >
        <span style={pct === null ? undefined : { width: `${Math.max(2, snap.fraction! * 100)}%` }} />
      </div>
      <p className="progress-facts hint tnum" data-testid={`${testId}-facts`}>
        {p.detail && <span>{p.detail}</span>}
        {facts.map((f, i) => (
          <span key={i}>{f}</span>
        ))}
      </p>
      {stalled && (
        <p className="hint progress-stall">
          Sem novidade há {formatDuration(snap.idleSec)}. Etapas grandes às vezes ficam um tempo sem dar notícia; deixe a aba aberta.
        </p>
      )}
    </div>
  );
}
