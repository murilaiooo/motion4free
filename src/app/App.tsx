import { useEffect, useMemo, useRef, useState } from 'react';
import { FAKE_CHUNKS, FakeTranscriber, WhisperTranscriber } from '../asr/transcriber';
import { waveformPeaks } from '../analysis/waveform';
import { AppError, toAppError } from '../core/errors';
import { makeProject, restoreHistory, sameVideo, type SavedProject } from '../core/project';
import type { EditPlan } from '../core/types';
import { createHistory, type History } from '../engine/history';
import type { PlanVersion } from '../core/versions';
import { APP_BUILT_AT, APP_VERSION, VERSION_LABEL } from '../version';
import { Editor, type Session } from './Editor';
import { ErrorBox } from './ErrorBox';
import { Gallery } from './Gallery';
import { analyze, openWithAudio } from './pipeline';
import { clearProject, loadProject, saveProject, saveVideoCopy, storageAvailable } from './project-store';

type Status = { kind: 'idle' } | { kind: 'working'; label: string; fraction: number } | { kind: 'ready' } | { kind: 'error'; error: AppError };
type CopyState = 'pending' | 'done' | 'failed';

const PEAK_COLUMNS = 1200;

function peaksOf(audio: Session['audio']): Float32Array | null {
  return audio ? waveformPeaks(audio.channels[0]!, PEAK_COLUMNS, true) : null;
}

const GALLERY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('galeria');

export function App() {
  if (GALLERY) {
    return (
      <main className="app">
        <h1>Motion4Free · estilos</h1>
        <p className="sub">
          <a href="./">Voltar ao editor</a>
        </p>
        <Gallery />
        <footer className="version" data-testid="version">
          Motion4Free {VERSION_LABEL}
        </footer>
      </main>
    );
  }
  return <EditorApp />;
}

function EditorApp() {
  const transcriber = useMemo(
    () =>
      import.meta.env.VITE_FAKE_ASR === '1'
        ? new FakeTranscriber(FAKE_CHUNKS, new URLSearchParams(location.search).get('asr') === 'falha')
        : new WhisperTranscriber(),
    [],
  );
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<History<EditPlan> | null>(null);
  const [pending, setPending] = useState<SavedProject | null>(null); // projeto salvo esperando o vídeo
  const [notices, setNotices] = useState<AppError[]>([]);
  const [savedFor, setSavedFor] = useState<History<EditPlan> | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [versionsSaved, setVersionsSaved] = useState<PlanVersion[]>([]);
  const [copy, setCopy] = useState<CopyState>('pending');
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
    step('Abrindo o projeto salvo', 0);
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
    if (pending) {
      try {
        await resume(pending, f, false);
      } catch (err) {
        fail(err);
      }
      return;
    }
    setSession(null);
    setHistory(null);
    setNotices([]);
    try {
      const a = await analyze(f, transcriber, step);
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

  return (
    <main className="app">
      <h1>Motion4Free</h1>
      <p className="sub">
        Versão de teste: tudo acontece no seu computador. Nenhum vídeo é enviado para a internet. <a href="?galeria">Ver os 3 estilos lado a lado</a>
      </p>

      {pending && (
        <div className="notice warning" role="status" data-testid="warning-M4F-604">
          <p>
            <b>Aviso M4F-604</b>: Para continuar o projeto salvo, escolha de novo o vídeo original (<b>{pending.video.name}</b>). Suas edições estão guardadas.
          </p>
          <button onClick={startOver} data-testid="start-over">
            Começar outro vídeo
          </button>
        </div>
      )}

      <label className={`drop ${busy ? 'disabled' : ''}`}>
        <input type="file" accept="video/*" disabled={busy} data-testid="file-input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {pending ? `Escolher o vídeo original (${pending.video.name})` : session ? `Vídeo: ${session.fileName} · clique para trocar (o projeto atual será substituído)` : 'Clique para escolher um vídeo seu falando (até 3 minutos)'}
      </label>

      {status.kind === 'working' && (
        <div className="status" role="status">
          <span>{status.label}…</span>
          <progress value={status.fraction} max={1} />
        </div>
      )}
      {status.kind === 'error' && <ErrorBox error={status.error} kind="error" />}
      {notices.map((n) => (
        <ErrorBox key={n.code} error={n} kind="warning" />
      ))}
      {session?.warnings.map((w) => <ErrorBox key={w.code} error={w} kind="warning" />)}

      {session && history && (
        <>
          <p className="saved" data-testid={saved ? 'saved' : 'saving'}>
            {saved ? 'Projeto salvo neste navegador.' : storageAvailable() ? 'Salvando o projeto…' : ''}
          </p>
          <Editor session={session} history={history} onHistory={setHistory} versions={versions} onVersions={setVersions} disabled={busy} />
        </>
      )}

      <footer className="version" data-testid="version" title={`Gerado em ${APP_BUILT_AT}`}>
        Motion4Free {VERSION_LABEL}
      </footer>
    </main>
  );
}
