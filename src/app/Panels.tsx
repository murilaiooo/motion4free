import { useMemo, useState } from 'react';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, ReferencePalette } from '../core/types';
import type { PlanVersion } from '../core/versions';
import { diffPlans } from '../editorial/diff';
import { referenceFromPixels } from '../editorial/reference';
import { History, ImageUp, RotateCcw, Save, Trash2 } from 'lucide-react';
import { ErrorBox } from './ErrorBox';

const fmt = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;

export type CompareView = 'depois' | 'antes';

/**
 * "O que mudou": lista das diferenças entre o plano atual e um anterior (a última mudança ou uma versão
 * guardada) e um botão para ver, na prévia, como era antes no mesmo instante.
 */
export function ChangesPanel({
  before,
  beforeLabel,
  plan,
  view,
  onView,
  onSeek,
  time,
}: {
  before: EditPlan | null;
  beforeLabel: string;
  plan: EditPlan;
  view: CompareView;
  onView: (v: CompareView) => void;
  onSeek: (t: number) => void;
  time: number;
}) {
  const diff = useMemo(() => (before ? diffPlans(before, plan) : null), [before, plan]);
  const [at, setAt] = useState<number | null>(null);
  if (!before || !diff) {
    return (
      <section className="changes" data-testid="changes">
        <h2 className="section-title">
          <History size={15} aria-hidden /> O que mudou
        </h2>
        <p className="hint">Nenhuma mudança ainda. Cada mudança aparece aqui, com Antes e Depois.</p>
      </section>
    );
  }
  const go = (t: number) => {
    setAt(t);
    onSeek(t + 0.01);
  };
  return (
    <section className="changes" aria-label="O que mudou" data-testid="changes">
      <h2 className="section-title">
        <History size={15} aria-hidden /> O que mudou
      </h2>
      <p className="hint">Comparando com: {beforeLabel}.</p>
      {diff.changes.length === 0 ? (
        <p data-testid="changes-none">Nada mudou no vídeo.</p>
      ) : (
        <ul data-testid="changes-list">
          {diff.changes.map((c, i) => (
            <li key={`${i}-${c.text}`}>
              {c.at !== null ? (
                <button className="link" onClick={() => go(c.at!)} title="Ver na prévia">
                  {c.text}
                </button>
              ) : (
                c.text
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="ab-row">
        <span className="hint">Prévia:</span>
        <div className="segmented" role="group" aria-label="Prévia mostrando">
          <button aria-pressed={view === 'antes'} onClick={() => onView('antes')} data-testid="view-before">
            Antes
          </button>
          <button aria-pressed={view === 'depois'} onClick={() => onView('depois')} data-testid="view-after">
            Depois
          </button>
        </div>
        <span className="hint tnum">agora em {fmt(time)}</span>
      </div>
      {diff.span && (
        <button className="sm" onClick={() => go(at ?? diff.span!.start)} data-testid="view-span">
          Ir para a mudança ({fmt(at ?? diff.span.start)})
        </button>
      )}
    </section>
  );
}

/** Versões com nome: guardar, restaurar (entra no desfazer), comparar e apagar. */
export function VersionsPanel({
  versions,
  onSave,
  onRestore,
  onCompare,
  onDelete,
  comparing,
  disabled,
}: {
  versions: PlanVersion[];
  onSave: (name: string) => AppError | null;
  onRestore: (v: PlanVersion) => void;
  onCompare: (v: PlanVersion | null) => void;
  onDelete: (v: PlanVersion) => void;
  comparing: string | null;
  disabled: boolean;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  return (
    <section className="versions stack" aria-label="Versões" data-testid="versions">
      <p className="hint">Guarde como o vídeo está agora para voltar depois. Fica salvo neste navegador junto com o projeto.</p>
      <div className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nome (ex.: versão calma)" aria-label="Nome da versão" data-testid="version-name" />
        <button
          onClick={() => {
            const err = onSave(name);
            setError(err);
            if (!err) setName('');
          }}
          disabled={disabled}
          data-testid="version-save"
        >
          <Save size={15} aria-hidden /> Guardar
        </button>
      </div>
      {error && <ErrorBox error={error} kind="error" />}
      {versions.length > 0 && (
        <ul className="version-list" data-testid="version-list">
          {versions.map((v) => (
            <li key={v.id} className={`card version ${comparing === v.id ? 'comparing' : ''}`} data-testid={`version-${v.id}`}>
              <div className="version-head">
                <b>{v.name}</b>
                <small className="hint">{new Date(v.savedAt).toLocaleString('pt-BR')}</small>
              </div>
              <div className="version-actions">
                <button className="sm" onClick={() => onRestore(v)} disabled={disabled} data-testid={`version-restore-${v.id}`}>
                  <RotateCcw size={13} aria-hidden /> Restaurar
                </button>
                <button className="sm" aria-pressed={comparing === v.id} onClick={() => onCompare(comparing === v.id ? null : v)} data-testid={`version-compare-${v.id}`}>
                  {comparing === v.id ? 'Parar de comparar' : 'Comparar'}
                </button>
                <button className="sm ghost danger" onClick={() => onDelete(v)} disabled={disabled} data-testid={`version-delete-${v.id}`} aria-label={`Apagar a versão ${v.name}`}>
                  <Trash2 size={13} aria-hidden /> Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SAMPLE = 64;

/** Lê a imagem só neste aparelho e devolve as cores (a imagem não é guardada nem enviada). */
async function paletteOf(file: File): Promise<ReferencePalette | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new AppError('IMAGEM_FALHOU', `${file.type || 'tipo desconhecido'}: ${String(err)}`);
  }
  const canvas = new OffscreenCanvas(SAMPLE, SAMPLE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('IMAGEM_FALHOU', 'canvas 2D indisponível');
  ctx.drawImage(bitmap, 0, 0, SAMPLE, SAMPLE);
  bitmap.close();
  return referenceFromPixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
}

export function ReferencePicker({ reference, onReference, disabled }: { reference: ReferencePalette | null; onReference: (r: ReferencePalette | null) => void; disabled: boolean }) {
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState(false);
  async function onFile(f: File) {
    setError(null);
    setBusy(true);
    try {
      const ref = await paletteOf(f);
      if (!ref) setError(new AppError('IMAGEM_SEM_CORES', f.name));
      else onReference(ref);
    } catch (err) {
      setError(toAppError(err, 'IMAGEM_FALHOU'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reference stack" aria-label="Cores de uma imagem" data-testid="reference">
      <h3 className="section-title">Cores de uma imagem sua (opcional)</h3>
      <p className="hint">Escolha uma foto ou logo: as cores de destaque do vídeo passam a ser as dela, sempre com contraste para a legenda continuar legível. A imagem fica só no seu aparelho.</p>
      <div className="inline-form">
        <label className={`btn ${disabled || busy ? 'disabled' : ''}`}>
          <ImageUp size={15} aria-hidden /> {busy ? 'Lendo a imagem…' : 'Escolher imagem'}
          <input className="sr-only" type="file" accept="image/*" disabled={disabled || busy} data-testid="reference-input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {reference && (
          <button className="ghost" onClick={() => onReference(null)} disabled={disabled} data-testid="reference-clear">
            Voltar às cores do estilo
          </button>
        )}
      </div>
      {reference && (
        <div className="palette-row" data-testid="reference-colors" aria-label="Cores tiradas da imagem">
          {reference.colors.map((c) => (
            <span key={c} style={{ background: c }} title={c} />
          ))}
        </div>
      )}
      {error && <ErrorBox error={error} kind={error.key === 'IMAGEM_SEM_CORES' ? 'warning' : 'error'} />}
    </section>
  );
}
