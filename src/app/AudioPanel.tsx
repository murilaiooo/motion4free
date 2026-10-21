import { useRef, useState } from 'react';
import { Music, RefreshCw, Trash2, Upload } from 'lucide-react';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan } from '../core/types';
import { ErrorBox } from './ErrorBox';

export const DEFAULT_MUSIC_VOLUME = 0.25;

/**
 * Música de fundo (v0.26): escolher um arquivo do aparelho, volume e "abaixar na fala".
 * O arquivo nunca sai do aparelho; a mistura é a mesma na prévia e no MP4 (engine/music-mix.ts).
 */
export function AudioPanel({ plan, loaded, loading = false, onPick, onApply, disabled }: {
  plan: EditPlan;
  /** a música do plano está decodificada e pronta para tocar */
  loaded: boolean;
  /** a música salva do projeto ainda está sendo lida */
  loading?: boolean;
  /** lê e guarda o arquivo; lança AppError (M4F-203/204) se não der */
  onPick: (file: File) => Promise<void>;
  onApply: (op: (p: EditPlan) => EditPlan) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const music = plan.music ?? null;
  const shown = volume ?? music?.volume ?? DEFAULT_MUSIC_VOLUME;

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await onPick(file);
      onApply((p) => ({ ...p, music: { name: file.name.slice(0, 200), volume: p.music?.volume ?? DEFAULT_MUSIC_VOLUME, duck: p.music?.duck ?? true } }));
    } catch (err) {
      setError(toAppError(err, 'MUSICA_ILEGIVEL'));
    } finally {
      setBusy(false);
    }
  };
  const commitVolume = () => {
    if (volume === null) return;
    const v = volume;
    setVolume(null);
    if (music && Math.abs(v - music.volume) > 1e-3) onApply((p) => (p.music ? { ...p, music: { ...p.music, volume: v } } : p));
  };
  const off = disabled || busy;

  return (
    <div className="stack audio-panel" data-testid="audio-panel">
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac"
        data-testid="music-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = '';
          if (file) void pick(file);
        }}
      />
      {error && <ErrorBox error={error} kind="error" onDismiss={() => setError(null)} />}
      {!music ? (
        <>
          <button type="button" className="primary" disabled={off} onClick={() => input.current?.click()} data-testid="music-pick">
            <Upload size={16} aria-hidden /> {busy ? 'Lendo a música…' : 'Escolher música de fundo'}
          </button>
          <p className="hint">MP3, M4A, WAV ou OGG, até 60 MB. A música toca por baixo da fala, entra e sai suave, e fica só neste aparelho.</p>
        </>
      ) : (
        <>
          <div className="music-card" data-testid="music-card">
            <Music size={18} aria-hidden />
            <span className="music-name" title={music.name}>{music.name}</span>
          </div>
          {!loaded && loading && <p className="hint" role="status">Carregando a música salva…</p>}
          {!loaded && !loading && <ErrorBox error={new AppError('MUSICA_SUMIU', music.name)} kind="warning" />}
          <label className="field">
            <span className="row-between">
              <span className="field-label">Volume da música</span>
              <b className="tnum">{Math.round(shown * 100)}%</b>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={shown} disabled={off} onChange={(e) => setVolume(e.target.valueAsNumber)} onPointerUp={commitVolume} onKeyUp={commitVolume} onBlur={commitVolume} data-testid="music-volume" />
          </label>
          <label className="check">
            <input type="checkbox" checked={music.duck} disabled={off} onChange={(e) => { const duck = e.target.checked; onApply((p) => (p.music ? { ...p, music: { ...p.music, duck } } : p)); }} data-testid="music-duck" />
            Abaixar a música quando alguém fala
          </label>
          <div className="row-wrap">
            <button type="button" className="sm" disabled={off} onClick={() => input.current?.click()} data-testid="music-replace">
              <RefreshCw size={14} aria-hidden /> {busy ? 'Lendo…' : 'Trocar música'}
            </button>
            <button type="button" className="sm ghost" disabled={off} onClick={() => onApply((p) => ({ ...p, music: null }))} data-testid="music-remove">
              <Trash2 size={14} aria-hidden /> Tirar música
            </button>
          </div>
        </>
      )}
      <p className="hint">Use músicas que você tem direito de usar: o Instagram e o TikTok podem silenciar vídeos com música protegida. Nas próprias redes dá para pôr música da biblioteca delas depois.</p>
    </div>
  );
}
