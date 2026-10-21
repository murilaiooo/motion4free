import { FORMAT_IDS, OUTPUT_FORMATS, type OutputFormatId } from '../core/formats';
import type { EditPlan } from '../core/types';

interface Props {
  plan: EditPlan;
  onChange: (next: EditPlan) => void;
  disabled?: boolean;
}

const LABELS: Record<OutputFormatId, string> = {
  vertical: '9:16 Vertical (Reels)',
  retrato: '4:5 Retrato (Feed)',
  quadrado: '1:1 Quadrado',
  horizontal: '16:9 Horizontal (YouTube)',
};

export function FormatSelector({ plan, onChange, disabled }: Props) {
  const current = (plan.output.width === 1080 && plan.output.height === 1920) ? 'vertical'
    : (plan.output.width === 1080 && plan.output.height === 1350) ? 'retrato'
    : (plan.output.width === 1080 && plan.output.height === 1080) ? 'quadrado'
    : 'horizontal';

  const setFormat = (id: OutputFormatId) => {
    const profile = OUTPUT_FORMATS[id];
    const next: EditPlan = {
      ...plan,
      output: { width: profile.width, height: profile.height, fps: 30 },
      // reset framing to default when switching format to avoid stale zoom
      framing: { ...plan.framing },
    };
    onChange(next);
  };

  return (
    <div className="format-selector" data-testid="format-selector">
      <label htmlFor="format-select" className="hint" style={{ display: 'block', marginBottom: 4 }}>
        Formato de saída
      </label>
      <select
        id="format-select"
        value={current}
        onChange={(e) => setFormat(e.target.value as OutputFormatId)}
        disabled={disabled}
        data-testid="format-select"
        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)' }}
      >
        {FORMAT_IDS.map((id) => (
          <option key={id} value={id}>
            {LABELS[id]} — {OUTPUT_FORMATS[id].width}×{OUTPUT_FORMATS[id].height}
          </option>
        ))}
      </select>
      <p className="hint" style={{ marginTop: 4 }}>O preview e a exportação usam o mesmo tamanho. Letras mantêm o mesmo tamanho em todos os formatos (lado curto = 1080).</p>
    </div>
  );
}
