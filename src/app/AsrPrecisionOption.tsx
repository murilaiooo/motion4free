import { Settings2 } from 'lucide-react';
import { ASR_CANDIDATES, ASR_MENU, ASR_MENU_KEYS, accuracyLabel, checkLadder, formatMB, requestLadder, speedLabel, type AsrMode } from '../core/asr-models';
import { openSettings } from './settings/route';
import type { AsrPrecision } from './asr-precision';
import { asrProblem, asrRouteLabel, useAsrRoute } from '../asr/route';
import { useKeysVersion } from '../ai/credentials/keys';

const LABELS: Record<AsrMode, string> = {
  rapida: 'Rápida',
  precisa: 'Precisa (recomendada)',
};

/**
 * Configurações › Transcrição: cardápio "IA da legenda", conferência dupla e "Precisão da legenda" (esta só vale
 * no Automático). Só lê e muda o hook useAsrPrecision.
 */
export function AsrPrecisionOption({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  return (
    <>
      <AsrModelMenu precision={precision} disabled={disabled} />
      <AsrCrossCheckOption precision={precision} disabled={disabled} />
      {precision.model === 'auto' && <AsrModeOption precision={precision} disabled={disabled} />}
    </>
  );
}

/** "Precisão da legenda" (Rápida / Precisa) do modo Automático. */
function AsrModeOption({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
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
 * Cardápio "IA da legenda" (v0.38): Automático (padrão) ou um modelo escolhido, cada um com o acerto em
 * português, a velocidade, o download e onde roda neste aparelho. Modelo que não roda aqui aparece desligado,
 * com o motivo. Se o escolhido falhar na hora, a escada automática assume (aviso M4F-307).
 */
function AsrModelMenu({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  const c = precision.capability;
  const auto = ASR_CANDIDATES[requestLadder(precision.mode, c)[0]!];
  return (
    <fieldset className="asr-menu" data-testid="asr-menu" disabled={disabled}>
      <legend>IA da legenda</legend>
      <label className="asr-opt">
        <input type="radio" name="asr-local-model" checked={precision.model === 'auto'} onChange={() => precision.setModel('auto')} data-testid="asr-model-auto" />
        <span>
          <b>Automático (recomendado)</b>
          <small>O app escolhe pela sua placa de vídeo e pela precisão abaixo. Neste aparelho: {auto.label}, {formatMB(auto.downloadMB)} na primeira vez.</small>
        </span>
      </label>
      {ASR_MENU_KEYS.map((key) => {
        const m = ASR_MENU[key];
        const id = m.pick(c);
        const cand = id ? ASR_CANDIDATES[id] : null;
        return (
          <label key={key} className="asr-opt" data-testid={`asr-model-${key}`} aria-disabled={!id}>
            <input type="radio" name="asr-local-model" disabled={!id} checked={precision.model === key} onChange={() => precision.setModel(key)} />
            <span>
              <b>{m.title}</b>
              <small>{m.note}</small>
              <span className="asr-stats">
                <span>Acerto em português: <b>{accuracyLabel(m.ptErrorPct)}</b> (erra ~{String(Math.round(m.ptErrorPct)).replace('.', ',')} em 100 palavras)</span>
                {cand ? (
                  <span>
                    Velocidade: <b>{speedLabel(id!)}</b> · Download: <b>{formatMB(cand.downloadMB)}</b> · {cand.device === 'webgpu' ? 'placa de vídeo' : 'processador'}
                  </span>
                ) : (
                  <span className="warn">Não roda neste aparelho: {m.why}.</span>
                )}
              </span>
            </span>
          </label>
        );
      })}
      <small className="hint asr-menu-foot">
        Acerto medido em fala lida em português (teste público FLEURS); em vídeo com música, gíria ou várias pessoas falando juntas todos erram mais. Velocidade é uma estimativa para um computador comum. Tudo roda neste computador; o áudio não sai daqui.
      </small>
    </fieldset>
  );
}

/** Conferência dupla (v0.38): uma segunda IA, de outra família, ouve de novo; as palavras em que discordam ficam marcadas para revisar. */
function AsrCrossCheckOption({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  const c = precision.capability;
  const first = requestLadder(precision.request, c)[0]!;
  const second = checkLadder(first, c)[0];
  return (
    <label className="set-check" data-testid="asr-check">
      <input type="checkbox" disabled={disabled || !second} checked={precision.check && !!second} onChange={(e) => precision.setCheck(e.target.checked)} data-testid="asr-check-box" />
      <span>
        <b>Conferência dupla (para a legenda não sair errada)</b>{' '}
        {second ? (
          <>Depois da legenda, o {ASR_CANDIDATES[second].label} ouve a fala de novo. As palavras em que as duas IAs discordam ficam marcadas em Legendas para você conferir com um clique (aviso M4F-315). Demora mais e baixa também esse modelo ({formatMB(ASR_CANDIDATES[second].downloadMB)}) na primeira vez.</>
        ) : (
          <>Não disponível neste aparelho: a segunda IA precisa de pelo menos 4 GB de memória.</>
        )}
      </span>
    </label>
  );
}

/**
 * Resumo na área de envio do vídeo (v0.27): mostra a precisão escolhida e leva para Configurações › Transcrição,
 * onde as opções são explicadas. Assim a tela de envio fica só com o envio.
 */
export function AsrPrecisionSummary({ precision, disabled }: { precision: AsrPrecision; disabled?: boolean }) {
  const route = useAsrRoute();
  useKeysVersion();
  const problem = asrProblem(route);
  return (
    <p className="asr-summary" data-testid="asr-summary">
      <span>
        {route.kind === 'local' ? <>Transcrição: <b>{asrRouteLabel(route)}</b> · {precision.model === 'auto' ? <>precisão <b>{LABELS[precision.mode]}</b></> : <>IA <b>{ASR_MENU[precision.model].title}</b></>}{precision.check ? <> · <b>conferência dupla</b></> : null}</> : <>Transcrição: <b>{asrRouteLabel(route)}</b>{problem ? <> · <b className="warn">{problem}</b></> : null}</>}
      </span>
      <button type="button" className="sm ghost" disabled={disabled} onClick={() => openSettings('transcricao')} data-testid="asr-change">
        <Settings2 size={14} aria-hidden /> Alterar
      </button>
    </p>
  );
}
