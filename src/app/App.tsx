import { useMemo, useState } from 'react';
import { FAKE_CHUNKS, FakeTranscriber, WhisperTranscriber } from '../asr/transcriber';
import { toAppError, type AppError } from '../core/errors';
import { APP_BUILT_AT, VERSION_LABEL } from '../version';
import { ErrorBox } from './ErrorBox';
import { outputDuration } from '../engine/timeline';
import { exportPlan } from '../media/export';
import { analyze, type Analysis } from './pipeline';

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; label: string; fraction: number }
  | { kind: 'ready' }
  | { kind: 'error'; error: AppError };

interface Result {
  url: string;
  name: string;
  degraded: boolean;
  preview: boolean;
}

export function App() {
  const transcriber = useMemo(
    () =>
      import.meta.env.VITE_FAKE_ASR === '1'
        ? new FakeTranscriber(FAKE_CHUNKS, new URLSearchParams(location.search).get('asr') === 'falha')
        : new WhisperTranscriber(),
    [],
  );
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const step = (label: string, fraction: number) => setStatus({ kind: 'working', label, fraction });
  const fail = (err: unknown) => setStatus({ kind: 'error', error: toAppError(err) });

  async function onFile(f: File) {
    setFile(f);
    setResult(null);
    setAnalysis(null);
    try {
      const a = await analyze(f, transcriber, step);
      setAnalysis(a);
      setStatus({ kind: 'ready' });
    } catch (err) {
      fail(err);
    }
  }

  async function onExport(preview: boolean) {
    if (!analysis || !file) return;
    try {
      step(preview ? 'Gerando prévia de 10 segundos' : 'Gerando o vídeo final', 0);
      const out = await exportPlan(analysis.media, analysis.audio, analysis.plan, {
        maxDurationSec: preview ? 10 : undefined,
        scale: preview ? 0.5 : 1,
        onProgress: (f) => step(preview ? 'Gerando prévia de 10 segundos' : 'Gerando o vídeo final', f),
      });
      if (result) URL.revokeObjectURL(result.url);
      const base = file.name.replace(/\.[^.]+$/, '');
      setResult({ url: URL.createObjectURL(out.blob), name: `${base}-motion4free${preview ? '-previa' : ''}.mp4`, degraded: out.degraded, preview });
      setStatus({ kind: 'ready' });
    } catch (err) {
      fail(err);
    }
  }

  const busy = status.kind === 'working';
  const plan = analysis?.plan;

  return (
    <main className="app">
      <h1>Motion4Free</h1>
      <p className="sub">Versão de teste: tudo acontece no seu computador. Nenhum vídeo é enviado para a internet.</p>

      <label className={`drop ${busy ? 'disabled' : ''}`}>
        <input type="file" accept="video/*" disabled={busy} data-testid="file-input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {file ? `Vídeo: ${file.name}` : 'Clique para escolher um vídeo seu falando (até 3 minutos)'}
      </label>

      {status.kind === 'working' && (
        <div className="status" role="status">
          <span>{status.label}…</span>
          <progress value={status.fraction} max={1} />
        </div>
      )}
      {status.kind === 'error' && <ErrorBox error={status.error} kind="error" />}
      {analysis?.warnings.map((w) => <ErrorBox key={w.code} error={w} kind="warning" />)}

      {analysis && plan && (
        <section className="summary" data-testid="summary">
          <p>
            Original: <b>{analysis.media.durationSec.toFixed(1)} s</b> · Editado: <b data-testid="out-duration">{outputDuration(plan.segments).toFixed(1)} s</b> ·{' '}
            {plan.segments.length} trechos · {plan.captions.length} legendas · {analysis.wordCount} palavras reconhecidas
          </p>
          <div className="actions">
            <button disabled={busy} onClick={() => onExport(true)}>
              Ver prévia (10 s)
            </button>
            <button disabled={busy} className="primary" onClick={() => onExport(false)} data-testid="export">
              Gerar vídeo final
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="result">
          <video src={result.url} controls playsInline data-testid="result-video" />
          {result.degraded && <p className="warn">Seu navegador não gera H.264. O vídeo funciona aqui, mas o Instagram pode recusar. Para o arquivo final, use Chrome ou Edge no computador.</p>}
          <a href={result.url} download={result.name} data-testid="download">
            Baixar {result.preview ? 'prévia' : 'vídeo'} ({result.name})
          </a>
        </section>
      )}
      <footer className="version" data-testid="version" title={`Gerado em ${APP_BUILT_AT}`}>
        Motion4Free {VERSION_LABEL}
      </footer>
    </main>
  );
}
