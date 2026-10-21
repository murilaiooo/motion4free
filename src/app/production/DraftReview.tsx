import { Download, SlidersHorizontal } from 'lucide-react';
import type { EditorialPlan } from '../../core/production';

export function DraftReview({ editorial, onCustomize, onExport, onRevise, disabled }: { editorial: EditorialPlan; onCustomize: () => void; onExport: () => void; onRevise: () => void; disabled: boolean }) {
  return <section className="draft-review" data-testid="draft-review" aria-label="Seu primeiro rascunho">
    <p className="eyebrow">PRIMEIRO RASCUNHO</p><h2>Seu vídeo está pronto para revisar.</h2><p className="muted">Assista à prévia, confira as legendas e escolha seu próximo passo.</p>
    <div className="draft-paths"><button className="primary" onClick={onExport} disabled={disabled} data-testid="draft-export"><Download size={16} aria-hidden /> Exportar vídeo</button><button onClick={onCustomize} data-testid="draft-customize"><SlidersHorizontal size={16} aria-hidden /> Personalizar vídeo</button></div>
    <button className="ghost sm" onClick={onRevise} disabled={disabled}>Rever direção criativa</button>
    <div className="draft-metrics"><span><b>{editorial.metrics.outputSeconds.toFixed(1)} s</b>de vídeo</span><span><b>{editorial.metrics.captionCount}</b>legendas</span><span><b>{editorial.metrics.removedSeconds.toFixed(1)} s</b>removidos</span></div>
    <details className="draft-limits" open><summary>O que foi editado</summary><ul className="draft-decisions">{editorial.decisions.map(decision => <li key={decision.kind}>{decision.description}</li>)}</ul></details>
    {editorial.warnings.length > 0 && <details className="draft-limits" open><summary>Revisar antes de publicar · {editorial.warnings.length} observações</summary><ul>{editorial.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
  </section>;
}
