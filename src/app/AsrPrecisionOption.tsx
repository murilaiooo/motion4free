import type { AsrMode } from '../core/asr-models';
import type { AsrPrecision } from './asr-precision';

const LABELS: Record<AsrMode, string> = {
  rapida: 'Rápida',
  precisa: 'Precisa (recomendada)',
};

/** Opção "Precisão da legenda" na área de envio do vídeo. Só lê e muda o hook useAsrPrecision. */
export function AsrPrecisionOption({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  return (
    <fieldset className="asr-precision" data-testid="asr-precision" disabled={disabled}>
      <legend>Precisão da legenda</legend>
      {(['precisa', 'rapida'] as const).map((m) => (
        <label key={m}>
          <input type="radio" name="asr-precision" value={m} checked={precision.mode === m} onChange={() => precision.setMode(m)} data-testid={`asr-${m}`} />
          <b>{LABELS[m]}</b> — {precision.describe(m)}
        </label>
      ))}
    </fieldset>
  );
}
