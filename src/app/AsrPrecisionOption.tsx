import { Settings2 } from 'lucide-react';
import type { AsrMode } from '../core/asr-models';
import { openSettings } from './settings/route';
import type { AsrPrecision } from './asr-precision';

const LABELS: Record<AsrMode, string> = {
  rapida: 'Rápida',
  precisa: 'Precisa (recomendada)',
};

/** Opção "Precisão da legenda" (Configurações › Transcrição). Só lê e muda o hook useAsrPrecision. */
export function AsrPrecisionOption({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  return (
    <fieldset className="asr-precision" data-testid="asr-precision" disabled={disabled}>
      <legend>Precisão da legenda</legend>
      {(['precisa', 'rapida'] as const).map((m) => (
        <label key={m} className="asr-opt">
          <input type="radio" name="asr-precision" value={m} checked={precision.mode === m} onChange={() => precision.setMode(m)} data-testid={`asr-${m}`} />
          <span>
            <b>{LABELS[m]}</b>
            <small>{precision.describe(m)}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Resumo na área de envio do vídeo (v0.27): mostra a precisão escolhida e leva para Configurações › Transcrição,
 * onde as opções são explicadas. Assim a tela de envio fica só com o envio.
 */
export function AsrPrecisionSummary({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  return (
    <p className="asr-summary" data-testid="asr-summary">
      <span>
        Precisão da legenda: <b>{LABELS[precision.mode]}</b>
      </span>
      <button type="button" className="sm ghost" disabled={disabled} onClick={() => openSettings('transcricao')} data-testid="asr-change">
        <Settings2 size={14} aria-hidden /> Alterar
      </button>
    </p>
  );
}
