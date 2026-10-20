import { useEffect, useMemo, useRef, useState } from 'react';
import { FAKE_CHUNKS, FAKE_DEMO_CHUNKS, FakeTranscriber, WhisperTranscriber } from '../asr/transcriber';
import { waveformPeaks } from '../analysis/waveform';
import { AppError, toAppError } from '../core/errors';
import { makeProject, restoreHistory, sameVideo, type SavedProject } from '../core/project';
import type { EditPlan } from '../core/types';
import { createHistory, type History } from '../engine/history';
import type { PlanVersion } from '../core/versions';
import { APP_VERSION, VERSION_LABEL } from '../version';
import { Editor, type Session } from './Editor';
import { ErrorBox } from './ErrorBox';
import { Gallery } from './Gallery';
import { Landing, Processing } from './Landing';
import { Logo, type SaveState } from './TopBar';
import { analyze, openWithAudio } from './pipeline';
import { useAsrPrecision } from './asr-precision';
import { AsrPrecisionOption } from './AsrPrecisionOption';
import { Evaluate } from './Evaluate';
import { clearProject, loadProject, saveProject, saveVideoCopy, storageAvailable } from './project-store';

type Status = { kind: 'idle' } | { kind: 'working'; label: string; fraction: number } | { kind: 'ready' } | { kind: 'error'; error: AppError };
type CopyState = 'pending' | 'done' | 'failed';

const PEAK_COLUMNS = 1200;

function peaksOf(audio: Session['audio']): Float32Array | null {
  return audio ? waveformPeaks(audio.channels[0]!, PEAK_COLUMNS, true) : null;
}

const GALLERY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('galeria');
/** `?avaliar`: página de desenvolvimento que mede o acerto da legenda num vídeo real (docs/ai/avaliar-legenda.md). */
const EVALUATE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('avaliar');

export function App() {
  if (GALLERY) {
    return (
      <div className="gallery-page">
        <header className="land-nav">
          <a className="brand" href="./" aria-label="Motion4Free">
            <Logo />
            <span className="brand-name">Motion4Free</span>
          </a>
          <nav className="land-links">
            <a href="./">Voltar ao editor</a>
          </nav>
        </header>
        <main className="gallery-main">
          <h1>Modelos, cena por cena</h1>
          <Gallery />
        </main>
        <footer className="land-foot">
          <span data-testid="version">Motion4Free {VERSION_LABEL}</span>
        </footer>
      </div>
    );
  }
  if (EVALUATE) return <Evaluate />;
  return <EditorApp />;
}

function EditorApp() {
  const transcriber = useMemo(
    () =>
      import.meta.env.VITE_FAKE_ASR === '1'
        ? new FakeTranscriber(
            new URLSearchParams(location.search).get('asr') === 'vazio' ? [] : new URLSearchParams(location.search).get('asr') === 'demo' ? FAKE_DEMO_CHUNKS : FAKE_CHUNKS,
            new URLSearchParams(location.search).get('asr') === 'falha',
            new URLSearchParams(location.search).get('asr') === 'reserva',
          )
        : new WhisperTranscriber(),
    [],
  );
  const precision = useAsrPrecision();
  const [asrModel, setAsrModel] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<History<EditPlan> | null>(null);
  const [pending, setPending] = useState<SavedProject | null>(null); // projeto salvo esperando o vídeo
  const [notices, setNotices] = useState<AppError[]>([]);
  const [savedFor, setSavedFor] = useState<History<EditPlan> | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [versionsSaved, setVersionsSaved] = useState<PlanVersion[]>([]);
  const [copy, setCopy] = useState<CopyState>('pending');
  const [fileName, setFileName] = useState<string | null>(null);
  const saveFailed = useRef(false);

  const step = (label: string, fraction: number) => setStatus({ kind: 'working', label, fraction });
  const fail = (err: unknown) => setStatus({ kind: 'error', error: toAppError(err) });
  const notify = (e: AppError) => setNotices((list) => (list.some((n) => n.code === e.code) ? list : [...list, e]));

  // Ao abrir o app: continua o projeto salvo, se houver.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadProject().catch((err) => ({ kind: 'corrupt' as const, detail: String(err) }));
      if (cancelled || loaded.kind === 'none') return;
      if (loaded.kind === 'corrupt') {
        notify(new AppError('PROJETO_CORROMPIDO', loaded.detail));
        await clearProject();
        return;
      }
      if (!loaded.video) {
        setPending(loaded.project);
        return;
      }
      try {
        await resume(loaded.project, loaded.video, true);
      } catch (err) {
        if (!cancelled) fail(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function resume(project: SavedProject, file: Blob, copyExists: boolean) {
    setFileName(project.video.name);
    step('Abrindo o projeto salvo', 0);
    setAsrModel(null);
    const { media, audio } = await openWithAudio(file, step);
    if (!sameVideo(project.video, { size: file.size, durationSec: media.durationSec })) {
      throw new AppError('VIDEO_DIFERENTE', `salvo: ${project.video.name}, ${project.video.size} bytes, ${project.video.durationSec.toFixed(2)} s; escolhido: ${file.size} bytes, ${media.durationSec.toFixed(2)} s`);
    }
    const h = restoreHistory(project);
    setSession({
      file,
      fileName: project.video.name,
      media,
      audio,
      ctx: { durationSec: media.durationSec, words: project.words },
      silences: project.silences,
      warnings: project.warnings.map((w) => new AppError(w.key, w.detail)),
      peaks: peaksOf(audio),
    });
    setHistory(h);
    setSavedFor(h);
    setVersions(project.versions);
    setVersionsSaved(project.versions);
    setPending(null);
    setStatus({ kind: 'ready' });
    if (copyExists) setCopy('done');
    else storeCopy(file);
  }

  function storeCopy(file: Blob) {
    setCopy('pending');
    saveVideoCopy(file)
      .then(() => setCopy('done'))
      .catch((err) => {
        // sem a cópia o projeto continua salvo; ao reabrir o app pede o vídeo de novo (M4F-604)
        console.warn('Cópia do vídeo não foi salva', err);
        setCopy('failed');
      });
  }

  async function onFile(f: File) {
    setStatus({ kind: 'idle' });
    setFileName(f.name);
    if (pending) {
      try {
        await resume(pending, f, false);
      } catch (err) {
        fail(err);
      }
      return;
    }
    setSession(null);
    setAsrModel(null);
    setHistory(null);
    setNotices([]);
    try {
      const a = await analyze(f, transcriber, step, { asrMode: precision.mode });
      setAsrModel(a.asrModel);
      await clearProject();
      const h = createHistory(a.plan);
      setVersions([]);
      setVersionsSaved([]);
      setSession({
        file: f,
        fileName: f.name,
        media: a.media,
        audio: a.audio,
        ctx: { durationSec: a.media.durationSec, words: a.words },
        silences: a.silences,
        warnings: a.warnings,
        peaks: peaksOf(a.audio),
      });
      setHistory(h);
      setStatus({ kind: 'ready' });
      if (storageAvailable()) storeCopy(f);
      else {
        setCopy('failed');
        notify(new AppError('SALVAR_FALHOU', 'navigator.storage.getDirectory indisponível'));
      }
    } catch (err) {
      fail(err);
    }
  }

  async function startOver() {
    await clearProject();
    setPending(null);
    setSession(null);
    setAsrModel(null);
    setHistory(null);
    setNotices([]);
    setStatus({ kind: 'idle' });
  }

  // Salva automaticamente a cada mudança (com pequena espera para agrupar edições rápidas).
  useEffect(() => {
    if (!session || !history || !storageAvailable() || (history === savedFor && versions === versionsSaved)) return;
    const timer = setTimeout(() => {
      const project = makeProject({
        appVersion: APP_VERSION,
        savedAt: new Date().toISOString(),
        video: { name: session.fileName, size: session.file.size, durationSec: session.ctx.durationSec },
        words: session.ctx.words,
        silences: session.silences,
        warnings: session.warnings.map((w) => ({ key: w.key, detail: w.detail })),
        history,
        versions,
      });
      saveProject(project)
        .then(() => {
          setSavedFor(history);
          setVersionsSaved(versions);
        })
        .catch((err) => {
          if (saveFailed.current) return;
          saveFailed.current = true;
          notify(toAppError(err, 'SALVAR_FALHOU'));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [session, history, savedFor, versions, versionsSaved]);

  const busy = status.kind === 'working';
  const saved = !!history && savedFor === history && versionsSaved === versions && copy !== 'pending';
  const saveState: SaveState = saved ? 'saved' : storageAvailable() ? 'saving' : 'off';

  const pendingNotice = pending && (
    <div className="notice warning" role="status" data-testid="warning-M4F-604">
      <p>
        <b className="code">Aviso M4F-604</b>: Para continuar o projeto salvo, escolha de novo o vídeo original (<b>{pending.video.name}</b>). Suas edições estão guardadas.
      </p>
      <div className="notice-row">
        <button className="sm" onClick={startOver} data-testid="start-over">
          Começar outro vídeo
        </button>
      </div>
    </div>
  );
  const appNotices = (
    <>
      {status.kind === 'error' && <ErrorBox error={status.error} kind="error" />}
      {notices.map((n) => (
        <ErrorBox key={n.code} error={n} kind="warning" />
      ))}
    </>
  );

  if (session && history) {
    return (
      <Editor
        session={session}
        history={history}
        onHistory={setHistory}
        versions={versions}
        onVersions={setVersions}
        disabled={busy}
        saveState={saveState}
        asrModel={asrModel}
        onReplaceFile={(f) => void onFile(f)}
        notices={
          <>
            {appNotices}
            {session.warnings.map((w) => (
              <ErrorBox key={w.code} error={w} kind="warning" />
            ))}
          </>
        }
      />
    );
  }
  if (status.kind === 'working') return <Processing label={status.label} fraction={status.fraction} fileName={fileName} />;
  return (
    <Landing
      onFile={(f) => void onFile(f)}
      busy={busy}
      pendingName={pending?.video.name ?? null}
      options={!pending && <AsrPrecisionOption precision={precision} disabled={busy} />}
      notices={
        (pendingNotice || status.kind === 'error' || notices.length > 0) && (
          <div className="land-notices">
            {pendingNotice}
            {appNotices}
          </div>
        )
      }
    />
  );
}
