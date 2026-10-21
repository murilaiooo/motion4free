import { useEffect, useMemo, useRef, useState } from 'react';
import { FAKE_CHUNKS, FAKE_DEMO_CHUNKS, FakeTranscriber, WhisperTranscriber } from '../asr/transcriber';
import { waveformPeaks } from '../analysis/waveform';
import { ASR_CANDIDATES, asrLadder } from '../core/asr-models';
import { MB, formatBytes } from '../core/bytes';
import { AppError, describeError, toAppError } from '../core/errors';
import { makeProject, referencedClips, restoreHistory, sameVideo, type SavedProject } from '../core/project';
import {
  PROJECTS_DIR,
  THUMB,
  deleteProject,
  duplicateProject,
  getCurrent,
  listProjects,
  loadProject,
  migrateLegacy,
  nameFromFile,
  newProjectId,
  readMeta,
  renameProject,
  saveProjectData,
  saveThumb,
  saveVideo,
  setCurrent,
  type ProjectSummary,
} from '../core/project-library';
import { dirSize } from '../core/storage-fs';
import { cachedRepos, spaceCheck } from '../core/storage-report';
import type { EditPlan } from '../core/types';
import { createHistory, pushHistory, type History } from '../engine/history';
import { appendClipsToPlan } from '../editorial/clip-append';
import { placeWords, placeRanges, unplaceWords, unplaceRanges, totalDuration } from '../engine/clips';
import type { PlanVersion } from '../core/versions';
import type { OpenedMedia } from '../media/input';
import { makeThumbnail } from '../media/thumbnail';
import { APP_VERSION, VERSION_LABEL } from '../version';
import { DeleteProjectDialog, type DeleteTarget } from './DeleteProjectDialog';
import { Editor, type Session } from './Editor';
import { ErrorBox } from './ErrorBox';
import { Gallery } from './Gallery';
import { Landing, Processing } from './Landing';
import { ProjectMenu } from './ProjectMenu';
import { ProjectsList } from './Projects';
import { StorageScreen } from './Storage';
import { Logo, type SaveState } from './TopBar';
import { analyze, openWithAudio } from './pipeline';
import { useAsrPrecision } from './asr-precision';
import { AsrPrecisionOption } from './AsrPrecisionOption';
import { Evaluate } from './Evaluate';
import { projectFs, storage, storageAvailable } from './project-store';

const fs = projectFs;

type Status = { kind: 'idle' } | { kind: 'working'; label: string; fraction: number } | { kind: 'ready' } | { kind: 'error'; error: AppError };
type CopyState = 'pending' | 'done' | 'failed';

const PEAK_COLUMNS = 1200;
/** Lista vazia única: projeto novo começa com "versões salvas" === "versões" (comparação por identidade). */
const noVersions: PlanVersion[] = [];

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

/**
 * Abertura do app: migra o projeto único da v0.10 (uma vez) e diz qual projeto estava aberto.
 * Fica fora do componente para não rodar duas vezes (React StrictMode monta efeitos duas vezes).
 */
let startup: Promise<{ current: string | null; problem: AppError | null }> | null = null;
function startOnce() {
  startup ??= (async () => {
    if (!fs) return { current: null, problem: new AppError('PROJETOS_INDISPONIVEIS', 'navigator.storage.getDirectory ausente') };
    const mig = await migrateLegacy(fs, newProjectId(Date.now()), new Date().toISOString()).catch((err) => ({ kind: 'failed' as const, detail: describeError(err) }));
    const current = await getCurrent(fs).catch(() => null);
    return { current, problem: mig.kind === 'failed' ? new AppError('MIGRACAO_FALHOU', mig.detail) : null };
  })();
  return startup;
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
  const [pending, setPending] = useState<{ id: string; project: SavedProject } | null>(null); // projeto salvo esperando o vídeo
  const [notices, setNotices] = useState<AppError[]>([]);
  const [savedFor, setSavedFor] = useState<History<EditPlan> | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [versionsSaved, setVersionsSaved] = useState<PlanVersion[]>([]);
  const [copy, setCopy] = useState<CopyState>('pending');
  const [fileName, setFileName] = useState<string | null>(null);
  // v0.11: vários projetos
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [storageOpen, setStorageOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [spaceWarn, setSpaceWarn] = useState<{ files: File[]; error: AppError } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const saveFailed = useRef(false);
  /** A análise e a inclusão de clipes são uma operação única; duas chamadas não podem usar o mesmo histórico inicial. */
  const addingClips = useRef(false);
  /** gravações no OPFS em fila: salvar, copiar vídeo, renomear e apagar nunca se atropelam */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.current.then(fn, fn);
    queue.current = run.catch(() => undefined);
    return run;
  }

  const step = (label: string, fraction: number) => setStatus({ kind: 'working', label, fraction });
  const fail = (err: unknown) => setStatus({ kind: 'error', error: toAppError(err) });
  const notify = (e: AppError) => setNotices((list) => (list.some((n) => n.code === e.code) ? list : [...list, e]));

  async function refreshProjects() {
    if (!fs) return;
    try {
      setProjects(await enqueue(() => listProjects(fs)));
    } catch (err) {
      notify(new AppError('LISTA_FALHOU', describeError(err)));
    }
  }

  // Ao abrir o app: migra o projeto da v0.10, mostra a lista e continua o projeto aberto por último.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { current, problem } = await startOnce();
      if (cancelled) return;
      if (problem) notify(problem);
      await refreshProjects();
      if (current && !cancelled) await openProject(current);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetSession() {
    setPending(null);
    setSession(null);
    setHistory(null);
    setSavedFor(null);
    setCopy('pending');
    setVersions([]);
    setVersionsSaved([]);
    setAsrModel(null);
    setNotices([]);
    setSpaceWarn(null);
    setProjectId(null);
    setProjectName('');
    setStatus({ kind: 'idle' });
  }

  async function openProject(id: string) {
    if (!fs) return;
    setFlash(null);
    setStatus({ kind: 'idle' });
    const loaded = await enqueue(() => loadProject(fs, id)).catch((err) => ({ kind: 'corrupt' as const, detail: describeError(err) }));
    if (loaded.kind === 'none') {
      // a pasta existe mas a primeira gravação das edições não aconteceu (aba fechada no meio da importação)
      notify(new AppError('IMPORTACAO_INTERROMPIDA', id));
      await enqueue(() => setCurrent(fs, null)).catch(() => undefined);
      await refreshProjects();
      return;
    }
    if (loaded.kind === 'corrupt') {
      notify(new AppError('PROJETO_CORROMPIDO', loaded.detail));
      await enqueue(() => setCurrent(fs, null)).catch(() => undefined);
      return;
    }
    const meta = await readMeta(fs, id).catch(() => null);
    setProjectId(id);
    setProjectName(meta?.name ?? nameFromFile(loaded.project.video.name));
    await enqueue(() => setCurrent(fs, id)).catch(() => undefined);
    const savedClips = referencedClips(loaded.project);
    const usesClipStorage = savedClips.length > 1 || (savedClips.length === 1 && savedClips[0]!.id !== 'c1');
    if (!loaded.video) {
      if (usesClipStorage) {
        try {
          const { loadProjectVideos } = await import('../core/project-library');
          const clipMap = await enqueue(() => loadProjectVideos(fs, id, loaded.project));
          if (clipMap) {
            await resumeMulti(id, loaded.project, clipMap, true);
            return;
          }
        } catch (err) {
          fail(err);
          return;
        }
      }
      setPending({ id, project: loaded.project });
      return;
    }
    try {
      await resume(id, loaded.project, loaded.video, true);
    } catch (err) {
      fail(err);
    }
  }

  async function resumeMulti(id: string, project: SavedProject, clipMap: Map<string, Blob>, copyExists: boolean): Promise<import('../media/multi').OpenedClip[]> {
    step('Abrindo o projeto salvo (multi)', 0);
    setAsrModel(null);
    const { openMedia } = await import('../media/input');
    const { decodeAudio } = await import('../media/audio');
    const { combineAudios } = await import('../media/multi');
    const h = restoreHistory(project);
    const clips: import('../media/multi').OpenedClip[] = [];
    const allRefs = referencedClips(project);
    const clipSources = new Map<string, import('../media/sources').ClipSource>();
    const audiosByClip: Record<string, import('../media/audio').DecodedAudio | null> = {};
    const audioWarnings: AppError[] = [];
    for (const [index, c] of allRefs.entries()) {
      const blob = clipMap.get(c.id);
      if (!blob) throw new AppError('CLIPES_AUSENTES', c.id);
      step(`Abrindo clipe ${index + 1}/${allRefs.length}`, index / allRefs.length);
      const media = await openMedia(blob);
      const audio = media.audio
        ? await decodeAudio(media.audio, media.durationSec).catch((err): null => {
            audioWarnings.push(new AppError('AUDIO_FALHOU', `${c.name}: ${describeError(err)}`));
            return null;
          })
        : null;
      audiosByClip[c.id] = audio;
      clips.push({ id: c.id, file: blob, name: c.name, media, durationSec: media.durationSec, words: [], silences: [], audio });
      clipSources.set(c.id, { id: c.id, video: media.video, width: media.width, height: media.height });
    }
    const oldWords = unplaceWords(h.present.clips, project.words);
    const oldSilences = unplaceRanges(h.present.clips, project.silences);
    const clipWords = Object.fromEntries(allRefs.map(c => [c.id, project.clipAnnotations?.[c.id]?.words ?? oldWords[c.id] ?? []]));
    const clipSilences = Object.fromEntries(allRefs.map(c => [c.id, project.clipAnnotations?.[c.id]?.silences ?? oldSilences[c.id] ?? []]));
    // O áudio deve ser reconstituído para o preview e o MP4, não apenas os quadros (com o mesmo volume por clipe da importação).
    const combinedAudio = combineAudios(h.present.clips, audiosByClip, clipSilences);
    const totalDur = totalDuration(h.present.clips);
    setFileName(project.video.name);
    setSession({
      file: clipMap.get(h.present.clips[0]!.id)!,
      fileName: project.video.name,
      media: clips.find(c => c.id === h.present.clips[0]!.id)!.media,
      audio: combinedAudio,
      ctx: { durationSec: totalDur, words: placeWords(h.present.clips, clipWords) },
      silences: placeRanges(h.present.clips, clipSilences),
      warnings: [...project.warnings.map((w) => new AppError(w.key, w.detail)), ...audioWarnings],
      peaks: peaksOf(combinedAudio),
      clipSources,
      clipWords,
      clipSilences,
      clipAudios: new Map(Object.entries(audiosByClip).filter((item): item is [string, import('../media/audio').DecodedAudio] => item[1] !== null)),
      originalVideo: project.video,
      openedClips: clips,
    } as any);
    setHistory(h);
    setSavedFor(h);
    setVersions(project.versions);
    setVersionsSaved(project.versions);
    setPending(null);
    setStatus({ kind: 'ready' });
    if (copyExists) setCopy('done');
    return clips;
  }

  async function resume(id: string, project: SavedProject, file: Blob, copyExists: boolean) {
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
    else storeCopy(id, file);
    // projeto migrado da v0.10 ainda sem miniatura
    if (fs && !(await fs.readFile([...PROJECTS_DIR, id, THUMB]).catch(() => null))) storeThumb(id, media, h.present);
  }

  /** Grava todos os clipes em uma fila e mostra falhas, inclusive nos clipes 2..N. */
  function storeMultiCopies(id: string, clips: import('../media/multi').OpenedClip[]) {
    if (!fs) return;
    setCopy('pending');
    void enqueue(async () => {
      const { saveClipVideo } = await import('../core/project-library');
      for (const clip of clips) {
        // c1 fica em video.bin para poupar espaço e manter projetos anteriores compatíveis.
        if (clip.id === 'c1') await saveVideo(fs, id, clip.file);
        else await saveClipVideo(fs, id, clip.id, clip.file);
      }
    }).then(() => setCopy('done')).catch((err) => {
      setCopy('failed');
      notify(new AppError('SALVAR_FALHOU', `Não foi possível guardar todos os clipes: ${describeError(err)}`));
    });
  }

  function storeCopy(id: string, file: Blob) {
    if (!fs) return;
    setCopy('pending');
    enqueue(() => saveVideo(fs, id, file))
      .then(() => setCopy('done'))
      .catch((err) => {
        // sem a cópia o projeto continua salvo; ao reabrir o app pede o vídeo de novo (M4F-604)
        console.warn('Cópia do vídeo não foi salva', err);
        setCopy('failed');
        notify(new AppError('SALVAR_FALHOU', `Cópia do vídeo original: ${describeError(err)}`));
      });
  }

  function storeThumb(id: string, media: OpenedMedia, plan: EditPlan): Promise<void> {
    if (!fs) return Promise.resolve();
    return makeThumbnail(media, plan)
      .then((b) => (b ? enqueue(() => saveThumb(fs, id, b)) : undefined))
      .catch((err) => console.warn('Miniatura do projeto não foi salva', err));
  }

  /** Cabe o vídeo (e o modelo de legenda, se ainda não foi baixado)? Senão, aviso M4F-606 antes de começar. */
  async function checkSpace(files: File[]): Promise<AppError | null> {
    const est = (await storage.quota?.estimate().catch(() => null)) ?? null;
    if (!est) return null;
    const cand = ASR_CANDIDATES[asrLadder(precision.mode, precision.capability)[0]!];
    const cached = await cachedRepos(storage.caches).catch(() => new Set<string>());
    const model = cached.has(cand.repo) ? 0 : cand.downloadMB * MB;
    const fileBytes = files.reduce((sum, file) => sum + file.size, 0);
    const check = spaceCheck(est, fileBytes + model);
    if (check.ok) return null;
    return new AppError(
      'ESPACO_INSUFICIENTE',
      `livre para o app: ${formatBytes(check.free ?? 0)}; precisa de cerca de ${formatBytes(check.needed)} (cópia dos vídeos ${formatBytes(fileBytes)}${model ? ` + modelo de legenda ${cand.label} ${formatBytes(model)}` : ''})`,
    );
  }

  async function onFile(f: File | File[], force = false) {
    setStatus({ kind: 'idle' });
    setFlash(null);
    const files = Array.isArray(f) ? f : [f];
    const primary = files[0]!;
    if (pending) {
      const savedClips = referencedClips(pending.project);
      const relinkClips = savedClips.length > 1 || (savedClips.length === 1 && savedClips[0]!.id !== 'c1');
      setFileName(primary.name);
      try {
        if (relinkClips) {
          const { openMedia } = await import('../media/input');
          const { matchOriginalClips } = await import('../core/clip-relink');
          const candidates = await Promise.all(files.map(async (file) => {
            const media = await openMedia(file);
            return { name: file.name, durationSec: media.durationSec, size: file.size };
          }));
          const assignments = matchOriginalClips(savedClips, candidates, pending.project.video);
          if (!assignments) {
            throw new AppError('CLIPES_AUSENTES', 'Selecione novamente todos os clipes originais. Os nomes e durações precisam corresponder ao projeto salvo.');
          }
          const map = new Map<string, Blob>(savedClips.map((c): [string, Blob] => [c.id, files[assignments.get(c.id)!]!]));
          const reopened = await resumeMulti(pending.id, pending.project, map, false);
          storeMultiCopies(pending.id, reopened);
        } else {
          await resume(pending.id, pending.project, primary, false);
        }
      } catch (err) {
        fail(err);
      }
      return;
    }
    if (!force) {
      const warn = await checkSpace(files);
      if (warn) {
        setSpaceWarn({ files, error: warn });
        return;
      }
    }
    setSpaceWarn(null);
    // trocar de vídeo no editor: o projeto atual fica salvo (com a miniatura atualizada)
    if (session && history && projectId) {
      await saveNow();
      void storeThumb(projectId, session.media, history.present);
    }
    setFileName(primary.name);
    setSession(null);
    setAsrModel(null);
    setHistory(null);
    setNotices([]);
    setProjectId(null);
    try {
      let a: Awaited<ReturnType<typeof analyze>>;
      if (files.length === 1) {
        a = await analyze(primary, transcriber, step, { asrMode: precision.mode });
      } else {
        const { openClips, buildClipRefs, assembledWords, assembledSilences } = await import('../media/multi');
        const { autoEdit } = await import('../editorial/auto-edit');
        const { DEFAULT_STYLE } = await import('../core/presets');
        const { clips, wordsByClip, silencesByClip, combinedAudio, warnings, asrModel } = await openClips(files, transcriber, step, precision.mode);
        const refs = buildClipRefs(clips);
        const allWords = assembledWords(refs, wordsByClip);
        const allSilences = assembledSilences(refs, silencesByClip);
        const total = refs.reduce((s, c) => s + c.duration, 0);
        const plan = autoEdit(total, allSilences, allWords, DEFAULT_STYLE, { clips: refs });
        a = { media: clips[0]!.media, audio: combinedAudio, words: allWords, silences: allSilences, warnings, asrModel, plan } as any;
        (a as any).__multi = { clips, refs, combinedAudio, wordsByClip, silencesByClip };
      }
      setAsrModel(a.asrModel);
      const id = newProjectId(Date.now());
      const h = createHistory(a.plan);
      setProjectId(id);
      setSavedFor(null);
      setVersions(noVersions);
      setVersionsSaved(noVersions);
      const multi = (a as any).__multi as { clips: import('../media/multi').OpenedClip[]; refs: import('../core/types').ClipRef[]; wordsByClip: Record<string, import('../core/types').Word[]>; silencesByClip: Record<string, import('../core/types').TimeRange[]> } | undefined;
      // O arquivo inicialmente escolhido pode ser inválido; o projeto pertence ao primeiro válido.
      const canonicalBlob = multi?.clips[0]?.file ?? primary;
      const canonicalName = multi?.clips[0]?.name ?? primary.name;
      setFileName(canonicalName);
      setProjectName(nameFromFile(canonicalName));
      // Build clipSources map for player/export from opened clips
      let clipSources: Map<string, import('../media/sources').ClipSource> | null = null;
      if (multi) {
        clipSources = new Map();
        for (const c of multi.clips) {
          clipSources.set(c.id, { id: c.id, video: c.media.video, width: c.media.width, height: c.media.height });
        }
      }
      const opened: Session = {
        file: canonicalBlob,
        fileName: canonicalName,
        media: a.media,
        audio: a.audio,
        ctx: { durationSec: (a.plan as any)?.clips ? (a.plan as any).clips.reduce((s:number,c:any)=>s+c.duration,0) : a.media.durationSec, words: a.words },
        silences: a.silences,
        warnings: a.warnings,
        peaks: peaksOf(a.audio),
        clipSources: clipSources,
        openedClips: multi?.clips ?? null,
        clipWords: multi?.wordsByClip,
        clipSilences: multi?.silencesByClip,
        clipAudios: multi ? new Map(multi.clips.filter((c) => c.audio !== null).map((c): [string, import('../media/audio').DecodedAudio] => [c.id, c.audio!])) : null,
        originalVideo: { name: canonicalName, size: canonicalBlob.size, durationSec: a.media.durationSec },
      } as any;
      setSession(opened);
      setHistory(h);
      setStatus({ kind: 'ready' });
      if (storageAvailable() && fs) {
        // Ordem que sobrevive a fechar a aba no meio (v0.16): primeiro as edições (project.json + meta.json, poucos KB),
        // depois "aberto por último", e só então a cópia do vídeo, que pode levar vários segundos ou não caber.
        // Antes a cópia ia primeiro: fechar a aba durante ela deixava uma pasta sem dados ("Projeto que não abre").
        const first = snapshot(opened, h, noVersions);
        saveFailed.current = false;
        void enqueue(() => saveProjectData(fs, id, first, nameFromFile(canonicalName), first.savedAt)).then(
          () => {
            setSavedFor((cur) => cur ?? h);
            void enqueue(() => setCurrent(fs, id)).catch(() => undefined);
            if (multi && multi.clips.length > 1) {
              storeMultiCopies(id, multi.clips);
            } else {
              void storeCopy(id, canonicalBlob);
            }
            void storeThumb(id, a.media, a.plan);
          },
          (err) => {
            // sem os dados do projeto, uma cópia do vídeo só ocuparia espaço
            saveFailed.current = true;
            setCopy('failed');
            notify(toAppError(err, 'SALVAR_FALHOU'));
          },
        );
      } else {
        setCopy('failed');
        notify(new AppError('SALVAR_FALHOU', 'navigator.storage.getDirectory indisponível'));
      }
    } catch (err) {
      fail(err);
    }
  }

  /** Acrescentar clipes no projeto aberto sem substituir as edições existentes. */
  async function onAddClips(files: File[]): Promise<void> {
    if (!session || !history || !files.length || addingClips.current) return;
    addingClips.current = true;
    step('Adicionando clipes ao projeto', 0);
    const initialSession = session;
    const initialHistory = history;
    if (initialHistory.present.clips.length + files.length > 30) {
      notify(new AppError('CLIPES_DEMAIS', `${initialHistory.present.clips.length + files.length}/30`));
      addingClips.current = false;
      setStatus({ kind: 'ready' });
      return;
    }
    try {
      const space = await checkSpace(files);
      if (space) throw space;
      const existingClips = initialHistory.present.clips;
      const currentIds = [...existingClips.map(c => c.id), ...Array.from(session.clipSources?.keys() ?? [])];
      const firstNumber = 1 + Math.max(0, ...currentIds.map(id => Number(id.slice(1)) || 0));
      const { openClips, buildClipRefs, combineAudios } = await import('../media/multi');
      const opened = await openClips(files, transcriber, step, precision.mode, firstNumber);
      const extraRefs = buildClipRefs(opened.clips);
      const oldWords = initialSession.clipWords ?? unplaceWords(existingClips, initialSession.ctx.words);
      const oldSilences = initialSession.clipSilences ?? unplaceRanges(existingClips, initialSession.silences);
      const allWords = { ...oldWords, ...opened.wordsByClip };
      const allSilences = { ...oldSilences, ...opened.silencesByClip };
      const nextPlan = appendClipsToPlan(initialHistory.present, extraRefs, allWords, allSilences);
      const sources = new Map(initialSession.clipSources ?? [
        [existingClips[0]!.id, {
          id: existingClips[0]!.id,
          video: initialSession.media.video,
          width: initialSession.media.width,
          height: initialSession.media.height,
        }],
      ]);
      const audios = new Map(initialSession.clipAudios ?? (
        initialSession.audio ? [[existingClips[0]!.id, initialSession.audio]] : []
      ));
      for (const c of opened.clips) {
        sources.set(c.id, { id: c.id, video: c.media.video, width: c.media.width, height: c.media.height });
        if (c.audio) audios.set(c.id, c.audio);
      }
      const combined = combineAudios(nextPlan.clips, Object.fromEntries(audios), allSilences);
      setSession({
        ...initialSession,
        warnings: [...initialSession.warnings, ...opened.warnings],
        clipSources: sources,
        clipAudios: audios,
        clipWords: allWords,
        clipSilences: allSilences,
        audio: combined,
        peaks: peaksOf(combined),
        originalVideo: initialSession.originalVideo ?? {
          name: initialSession.fileName, size: initialSession.file.size,
          durationSec: initialSession.media.durationSec,
        },
        openedClips: [...(initialSession.openedClips ?? []), ...opened.clips],
        ctx: { durationSec: totalDuration(nextPlan.clips), words: placeWords(nextPlan.clips, allWords) },
        silences: placeRanges(nextPlan.clips, allSilences),
      });
      setHistory(pushHistory(initialHistory, nextPlan));
      if (opened.asrModel) setAsrModel(opened.asrModel);
      setCopy('pending');
      if (fs && projectId) {
        const id = projectId;
        void enqueue(async () => {
          const { saveClipVideo } = await import('../core/project-library');
          for (const c of opened.clips) await saveClipVideo(fs, id, c.id, c.file);
        }).then(() => setCopy('done')).catch((err) => {
          setCopy('failed');
          notify(new AppError('SALVAR_FALHOU', `Novos clipes: ${describeError(err)}`));
        });
      } else {
        setCopy('failed');
        notify(new AppError('SALVAR_FALHOU', 'Armazenamento local indisponível para novos clipes.'));
      }
      setStatus({ kind: 'ready' });
    } catch (err) {
      notify(toAppError(err, 'ABRIR_FALHOU'));
      setStatus({ kind: 'ready' });
    } finally {
      addingClips.current = false;
    }
  }

  /** Tudo o que vai para project.json, a partir do que está aberto no editor. */
  function snapshot(s: Session, h: History<EditPlan>, v: PlanVersion[]): SavedProject {
    return makeProject({
      appVersion: APP_VERSION,
      savedAt: new Date().toISOString(),
      video: s.originalVideo ?? { name: s.fileName, size: s.file.size, durationSec: s.media.durationSec },
      words: s.clipWords ? placeWords(h.present.clips, s.clipWords) : s.ctx.words,
      silences: s.clipSilences ? placeRanges(h.present.clips, s.clipSilences) : s.silences,
      clipAnnotations: s.clipWords
        ? Object.fromEntries(Object.entries(s.clipWords).map(([id, words]) => [id, { words, silences: s.clipSilences?.[id] ?? [] }]))
        : undefined,
      warnings: s.warnings.map((w) => ({ key: w.key, detail: w.detail })),
      history: h,
      versions: v,
    });
  }

  /** Grava agora o que ainda não foi salvo (antes de fechar ou trocar de projeto). */
  async function saveNow(): Promise<void> {
    if (!fs || !session || !history || !projectId || (history === savedFor && versions === versionsSaved)) return;
    const project = snapshot(session, history, versions);
    const id = projectId;
    const name = projectName || nameFromFile(session.fileName);
    try {
      await enqueue(() => saveProjectData(fs, id, project, name, project.savedAt));
      setSavedFor(history);
      setVersionsSaved(versions);
    } catch (err) {
      if (saveFailed.current) return;
      saveFailed.current = true;
      notify(toAppError(err, 'SALVAR_FALHOU'));
    }
  }

  // Salva automaticamente a cada mudança (com pequena espera para agrupar edições rápidas).
  useEffect(() => {
    if (!session || !history || !projectId || !storageAvailable() || (history === savedFor && versions === versionsSaved)) return;
    const timer = setTimeout(() => void saveNow(), 300);
    return () => clearTimeout(timer);
  }, [session, history, savedFor, versions, versionsSaved, projectId]);

  /** "Fechar projeto": volta para Meus projetos; o projeto continua salvo. */
  async function closeProject() {
    if (session && history && projectId) {
      await saveNow();
      await storeThumb(projectId, session.media, history.present);
    }
    if (fs) await enqueue(() => setCurrent(fs, null)).catch(() => undefined);
    resetSession();
    await refreshProjects();
  }

  async function askDelete(target: DeleteTarget) {
    setDeleteTarget(target);
    if (target.sizeBytes === null && fs) {
      const size = await enqueue(() => dirSize(fs, [...PROJECTS_DIR, target.id])).catch(() => null);
      setDeleteTarget((t) => (t && t.id === target.id ? { ...t, sizeBytes: size } : t));
    }
  }

  async function confirmDelete(target: DeleteTarget) {
    if (!fs) return;
    try {
      const freed = await enqueue(() => deleteProject(fs, target.id));
      if (target.id === projectId) resetSession();
      setFlash(`Projeto "${target.name}" apagado. Liberou ${formatBytes(freed)}. O vídeo original continua no seu computador.`);
    } catch (err) {
      notify(new AppError('APAGAR_FALHOU', `${target.name}: ${describeError(err)}`));
    }
    setDeleteTarget(null);
    await refreshProjects();
  }

  async function rename(id: string, name: string) {
    if (!fs) return;
    try {
      const meta = await enqueue(() => renameProject(fs, id, name));
      if (meta && id === projectId) setProjectName(meta.name);
    } catch (err) {
      notify(toAppError(err, 'SALVAR_FALHOU'));
    }
    await refreshProjects();
  }

  async function duplicate(id: string) {
    if (!fs) return;
    const source = projects.find((p) => p.id === id);
    try {
      const est = await storage.quota?.estimate().catch(() => null);
      const check = spaceCheck(est ?? null, source?.sizeBytes ?? 0);
      if (!check.ok) throw new Error(`livre ${formatBytes(check.free ?? 0)}; a cópia precisa de ${formatBytes(check.needed)}`);
      const copy = await enqueue(() => duplicateProject(fs, id, newProjectId(Date.now()), new Date().toISOString()));
      if (copy) setFlash(`Projeto duplicado: "${copy.name}".`);
    } catch (err) {
      notify(new AppError('DUPLICAR_FALHOU', describeError(err)));
    }
    await refreshProjects();
  }

  /** Algo foi apagado pela tela Armazenamento. */
  async function storageChanged(deletedProject: string | null, everything: boolean) {
    if (everything || (deletedProject && deletedProject === projectId)) resetSession();
    await refreshProjects();
  }

  const busy = status.kind === 'working';
  const saved = !!history && savedFor === history && versionsSaved === versions && copy === 'done';
  const saveState: SaveState = saved ? 'saved' : storageAvailable() && copy !== 'failed' ? 'saving' : 'off';

  const pendingClips = pending ? referencedClips(pending.project) : [];
  const pendingMulti = pendingClips.length > 1 || (pendingClips.length === 1 && pendingClips[0]!.id !== 'c1');
  const pendingNotice = pending && (
    <div className="notice warning" role="status" data-testid={pendingMulti ? 'warning-M4F-615' : 'warning-M4F-604'}>
      <p>
        {pendingMulti ? (
          <><b className="code">Aviso M4F-615</b>: Selecione novamente os {pendingClips.length} arquivos originais deste projeto, de uma vez. Suas edições continuam guardadas.</>
        ) : (
          <><b className="code">Aviso M4F-604</b>: Para continuar o projeto salvo, escolha de novo o vídeo original (<b>{pending.project.video.name}</b>). Suas edições estão guardadas.</>
        )}
      </p>
      <div className="notice-row">
        <button className="sm" onClick={() => void closeProject()} data-testid="start-over">
          Voltar para Meus projetos
        </button>
      </div>
    </div>
  );
  const appNotices = (
    <>
      {status.kind === 'error' && <ErrorBox error={status.error} kind="error" />}
      {notices.map((n) => (
        <ErrorBox key={n.code} error={n} kind="warning" onDismiss={() => setNotices((list) => list.filter((x) => x.code !== n.code))} />
      ))}
      {spaceWarn && (
        <div className="space-warn" data-testid="space-warning" style={{ display: 'grid', gap: 'var(--s-2)' }}>
          <ErrorBox error={spaceWarn.error} kind="warning" />
          <div className="notice-row">
            <button className="sm primary" onClick={() => void onFile(spaceWarn.files, true)} data-testid="space-continue">
              Continuar mesmo assim
            </button>
            <button className="sm" onClick={() => setStorageOpen(true)} data-testid="space-storage">
              Liberar espaço (Armazenamento)
            </button>
            <button className="sm ghost" onClick={() => setSpaceWarn(null)} data-testid="space-cancel">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );

  const overlays = (
    <>
      {storageOpen && (
        <StorageScreen
          deps={storage}
          currentProjectId={projectId}
          onClose={() => setStorageOpen(false)}
          onProjectDeleted={(id) => void storageChanged(id, false)}
          onEverythingDeleted={() => void storageChanged(null, true)}
        />
      )}
      {deleteTarget && <DeleteProjectDialog target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => confirmDelete(deleteTarget)} />}
    </>
  );

  if (session && history) {
    return (
      <>
        <Editor
          session={session}
          history={history}
          onHistory={setHistory}
          versions={versions}
          onVersions={setVersions}
          disabled={busy}
          saveState={saveState}
          asrModel={asrModel}
          onReplaceFile={(f: File|File[]) => void onFile(f as any)}
          onAddClips={(files: File[]) => void onAddClips(files)}
          projectMenu={
            <ProjectMenu
              name={projectName || nameFromFile(session.fileName)}
              busy={busy}
              canSave={!!fs && !!projectId}
              onRename={(n) => projectId && void rename(projectId, n)}
              onReplaceFile={(f) => void onFile(Array.isArray(f) ? f : [f] as any)}
              onClose={() => void closeProject()}
              onDelete={() => projectId && void askDelete({ id: projectId, name: projectName || nameFromFile(session.fileName), videoName: session.fileName, sizeBytes: null })}
              onStorage={() => setStorageOpen(true)}
            />
          }
          notices={
            <>
              {appNotices}
              {session.warnings.map((w, index) => (
                <ErrorBox key={`${w.code}-${index}`} error={w} kind="warning" />
              ))}
            </>
          }
        />
        {overlays}
      </>
    );
  }
  if (status.kind === 'working') return <Processing label={status.label} fraction={status.fraction} fileName={fileName} />;
  return (
    <>
      <Landing
        onFile={(f) => void onFile(f)}
        busy={busy}
        pendingName={pending?.project.video.name ?? null}
        pendingClipCount={pendingMulti ? pendingClips.length : undefined}
        options={!pending && <AsrPrecisionOption precision={precision} disabled={busy} />}
        onStorage={() => setStorageOpen(true)}
        projects={
          projects.length > 0 && (
            <ProjectsList
              projects={projects}
              busy={busy}
              onOpen={(id) => void openProject(id)}
              onRename={(id, n) => void rename(id, n)}
              onDuplicate={(id) => void duplicate(id)}
              onDelete={(p) => void askDelete({ id: p.id, name: p.name, videoName: p.video.name, sizeBytes: p.sizeBytes })}
              onStorage={() => setStorageOpen(true)}
            />
          )
        }
        notices={
          (pendingNotice || flash || status.kind === 'error' || notices.length > 0 || spaceWarn) && (
            <div className="land-notices">
              {flash && (
                <p className="m4f-callout ok" role="status" data-testid="flash">
                  {flash}
                </p>
              )}
              {pendingNotice}
              {appNotices}
            </div>
          )
        }
      />
      {overlays}
    </>
  );
}
