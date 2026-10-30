import { compileCreativePlan } from '../../editorial/creative-plan';
import type { EditPlan } from '../../core/types';
export function StoryboardReview({ plan, onSeek, onApply, disabled }: {
  plan: EditPlan; onSeek: (time: number) => void; onApply: (id: string) => void; disabled: boolean;
}) {
  const creative = compileCreativePlan(plan);
  return <details className="draft-limits"><summary>Storyboard e revisão de estrutura</summary>
    <p>Mapa da edição atual. Não analisa imagens, legibilidade, originalidade ou qualidade artística.</p>
    {creative.review.truncated && <p>Projeto extenso: o relatório apresenta uma seleção limitada de elementos.</p>}
    <ol>{creative.storyboard.beats.map(beat => <li key={beat.id}>
      <button className="ghost sm" onClick={() => onSeek(beat.start)} disabled={disabled}>{beat.start.toFixed(1)}–{beat.end.toFixed(1)} s</button>
      <p>{beat.why}</p>
    </li>)}</ol>
    <p>Observações estruturais: {creative.review.findings.length}. Revise a prévia e o sentido da fala antes de decidir.</p>
    <ul>{creative.review.findings.map(finding => <li key={finding.id}>{finding.message}{finding.action && <button className="sm" disabled={disabled} onClick={() => onApply(finding.id)}>Ocultar esta repetição</button>}</li>)}</ul>
    <p>Cada alteração pode ser desfeita. Nenhuma revisão visual foi aprovada automaticamente.</p>
  </details>;
}
