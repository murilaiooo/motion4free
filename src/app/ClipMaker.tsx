import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, Download, Scissors, Sparkles } from 'lucide-react';
import './clips.css';
import { AppError, toAppError } from '../core/errors';
import { FORMAT_IDS, OUTPUT_FORMATS, profileFor, type OutputFormatId } from '../core/formats';
import { DEFAULT_STYLE, presetById } from '../core/presets';
import { listTemplates } from '../core/template-gallery';
import { CLIP_COUNTS, CLIP_LENGTHS, CLIP_LENGTH_IDS, MAX_MOMENTS, clock, findMoments, type ClipLength, type Moment } from '../editorial/highlights';
import { discoverContextualMoments } from '../editorial/clip-discovery';
import { findContextualMoments, nudgeContextMoment } from '../editorial/clip-candidates';
import { buildTranscriptIndex } from '../editorial/clip-context';
import { ClipReviewWorkspace } from './ClipReviewWorkspace';
import { useEditRequest } from './use-edit-request';
import { VERSION_LABEL } from '../version';
import { fingerprint } from '../ai/routing';
import { AiStatusLine, prepareAi, useAiSettings, setAiSettings } from './AiOptions';
import { openSettings } from './settings/route';
import { ErrorBox } from './ErrorBox';
import { ProgressPanel } from './ProgressPanel';
import { clipJobFraction, type Progress } from '../core/progress';
import { TemplateThumb } from './Templates';
import { Logo, SettingsButton } from './TopBar';
import { downloadBlob, prepareClip, renderClip, type ClipSettings, type LongAnalysis, type PreparedClip } from './clip-pipeline';

/**
 * Criador de clipes (v0.22, ADR-0023): mostra os melhores momentos do vídeo longo, deixa ajustar e
 * entrega cada clipe pronto (baixar) ou como projeto no editor. O estado fica no App (`ClipWork`) para
 * continuar igual ao voltar do editor.
 */

export type ClipJobState =
  | { kind: 'idle' }
  | { kind: 'working'; progress: Progress }
  | { kind: 'done'; url: string; name: string; degraded: boolean }
  | { kind: 'error'; error: AppError };

export interface ClipItem {
  uid: string;
  m: Moment;
  checked: boolean;
  selectionEdited?: boolean;
  job: ClipJobState;
}

export interface ClipWork {
  long: LongAnalysis;
  length: ClipLength;
  count: number;
  templateId: string;
  format: OutputFormatId;
  items: ClipItem[];
  notices: AppError[];
  /** a ordem atual veio da IA */
  aiUsed: boolean;
}

let uidSeq = 0;

/** Sugestões: as pedidas já marcadas e algumas reservas desmarcadas. */
function buildItems(long: LongAnalysis, length: ClipLength, count: number, baseline = false): ClipItem[] {
  const pool = Math.min(MAX_MOMENTS, Math.max(count * 2, count + 3));
  const finder = baseline ? findMoments : findContextualMoments;
  return finder(long.words, long.durationSec, { length, count: pool, energy: long.energy, energyStep: long.energyStep }).map((m): ClipItem => ({
    uid: `c${++uidSeq}`,
    m,
    checked: !baseline && m.rank <= count && !m.sourceEvidence?.review.length,
    job: { kind: 'idle' },
  }));
}

export function newClipWork(long: LongAnalysis): ClipWork {
  const length: ClipLength = 'medio';
  const count = 5;
  return { long, length, count, templateId: DEFAULT_STYLE.id, format: 'vertical', items: buildItems(long, length, count), notices: long.warnings, aiUsed: false };
}

/** Refresh suggestions without discarding selections, manual bounds/titles or generated downloads. */
function preserveCuration(previous: readonly ClipItem[], proposed: readonly ClipItem[], keepAutomatic = false): ClipItem[] {
  const byBounds = new Map(previous.map(item => [`${item.m.start}-${item.m.end}`, item]));
  const curated = (item: ClipItem) => item.selectionEdited || item.m.userTitle || item.m.userBounds || item.job.kind === 'done';
  const items = proposed.map(item => {
    const old = byBounds.get(`${item.m.start}-${item.m.end}`);
    return old ? { ...old, checked: keepAutomatic || curated(old) ? old.checked : item.checked,
      m: old.m.userBounds || old.job.kind === 'done' ? old.m : old.m.userTitle ? { ...item.m, title: old.m.title, userTitle: true } : item.m } : item;
  });
  return [...items, ...previous.filter(item => (curated(item) || (keepAutomatic && item.checked)) && !items.some(next => next.uid === item.uid))];
}

/** Libera os MP4 gerados (quando a lista é refeita ou o trabalho é fechado). */
export function releaseWork(work: ClipWork | null): void {
  for (const it of work?.items ?? []) if (it.job.kind === 'done') URL.revokeObjectURL(it.job.url);
}

/** Avisos da IA (preparar ou ordenar): saem quando a IA é pedida de novo ou a lista é refeita. */
const notAiNotice = (n: AppError) => !n.key.startsWith('IA_') && !n.key.startsWith('PROVEDOR_') && n.key !== 'CLIPES_IA_CONTEXTO' && n.key !== 'CLIPES_CONTEXTO_INVALIDO';

const seconds = (m: Moment) => Math.round(m.end - m.start);

export function ClipMaker({
  work,
  onWork,
  onOpenInEditor,
  onBack,
  onStorage,
}: {
  work: ClipWork;
  onWork: (update: (w: ClipWork) => ClipWork) => void;
  onOpenInEditor: (clip: PreparedClip, title: string) => void;
  onBack: () => void;
  onStorage: () => void;
}) {
  const { long } = work;
  const templates = useMemo(listTemplates, []);
  const ai = useAiSettings();
  const [aiBusy, setAiBusy] = useState<Progress | null>(null);
  const requestScope = useEditRequest(work, '', () => { setAiBusy(null); });
  const index = useMemo(() => buildTranscriptIndex(long.words, long.durationSec), [long.words, long.durationSec]);
  const previewLimit = useRef<number | null>(null);
  const [contextPreview, setContextPreview] = useState(false);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [opening, setOpening] = useState<{ uid: string; progress: Progress } | null>(null);
  const [openingError, setOpeningError] = useState<{ uid: string; error: AppError } | null>(null);
  const stopBatch = useRef(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(() => typeof window === 'undefined' || !window.matchMedia('(max-width: 560px)').matches);
  const video = useRef<HTMLVideoElement>(null);
  const videoUrl = useMemo(() => URL.createObjectURL(long.file), [long.file]);
  useEffect(() => () => URL.revokeObjectURL(videoUrl), [videoUrl]);

  const working = work.items.some((it) => it.job.kind === 'working') || batch !== null || opening !== null || aiBusy !== null;
  // lote: um relógio só para todos os clipes (o "falta" é do lote inteiro, não só do clipe atual)
  const rendering = work.items.find((it) => it.job.kind === 'working');
  const batchProgress = useMemo((): Progress | null => {
    if (!batch) return null;
    const cj = rendering?.job;
    const job = cj && cj.kind === 'working' ? cj.progress : null;
    const now = Math.min(batch.done + 1, batch.total);
    return {
      label: `Gerando o clipe ${now} de ${batch.total}`,
      phase: 'lote',
      fraction: (batch.done + (job ? clipJobFraction(job) : 0)) / batch.total,
      detail: job ? `${job.label} · pode deixar a aba aberta e fazer outra coisa` : 'pode deixar a aba aberta e fazer outra coisa',
    };
  }, [batch, rendering]);
  const selected = work.items.filter((it) => it.checked);
  const settings = (): ClipSettings => ({ style: presetById(work.templateId) ?? DEFAULT_STYLE, output: profileFor(work.format) });

  const setItem = (uid: string, patch: (it: ClipItem) => Partial<ClipItem>) =>
    onWork((w) => ({ ...w, items: w.items.map((it) => {
      if (it.uid !== uid) return it;
      const delta = patch(it);
      if (it.job.kind === 'done' && delta.job && delta.job !== it.job) URL.revokeObjectURL(it.job.url);
      return { ...it, ...delta };
    }) }));
  const nudgeItem = (uid: string, edge: 'start' | 'end', direction: -1 | 1) => setItem(uid, item => {
    const next = nudgeContextMoment(item.m, long.words, long.durationSec, edge, direction);
    return next === item.m ? {} : { m: next, job: item.job.kind === 'done' ? { kind: 'idle' } : item.job };
  });
  const setJob = (uid: string, job: ClipJobState) =>
    setItem(uid, (it) => {
      return { job };
    });

  function regenerate(length: ClipLength, count: number, baseline = false) {
    if (working) return;
    onWork((w) => ({ ...w, length, count, items: preserveCuration(w.items, buildItems(w.long, length, count, baseline)), aiUsed: false, notices: w.notices.filter(notAiNotice) }));
  }

  /** Muda modelo ou formato: os MP4 já gerados ficam com o visual antigo, então voltam a "não gerado". */
  function changeLook(patch: Partial<Pick<ClipWork, 'templateId' | 'format'>>) {
    if (working) return;
    releaseWork(work);
    onWork((w) => ({ ...w, ...patch, items: w.items.map((it): ClipItem => ({ ...it, job: { kind: 'idle' } })) }));
  }

  async function askAi() {
    if (working) return;
    const request = requestScope.begin();
    const progress = (value: Progress) => { if (request.current()) setAiBusy(value); };
    progress({ label: 'Preparando análise de toda a transcrição', phase: 'ia-preparar', fraction: null });
    try {
      const source = work.long.file;
      const project = `clips-${await fingerprint({ name: source.name, size: source.size, modified: source.lastModified })}`;
      if (!request.current()) return;
      const { ai: choice, warning } = await prepareAi(ai, progress, 'moment-ranking', project, request.signal);
      if (!request.current()) return;
      const pool = Math.min(MAX_MOMENTS, Math.max(work.count * 2, work.count + 3));
      const options = { length: work.length, count: pool, energy: long.energy, energyStep: long.energyStep };
      const result = choice ? await discoverContextualMoments(long.words, long.durationSec, options, choice, request.signal, (done, total) => progress({ label: `Analisando contexto: janela ${Math.min(done + 1, total)} de ${total}`, phase: 'ia-ler', fraction: total ? done / total : 1 }))
        : { moments: findContextualMoments(long.words, long.durationSec, options), warning, covered: 0, total: 0 };
      if (!request.current()) return;
      onWork((current) => {
        const items = preserveCuration(current.items, result.moments.map((moment): ClipItem => ({ uid: `c${++uidSeq}`, m: moment, checked: false, job: { kind: 'idle' } })), true);
        return { ...current, items, aiUsed: !!choice && result.covered > 0,
          notices: [...current.notices.filter(notAiNotice), ...(result.warning ? [result.warning] : [])] };
      });
    } catch (error) {
      if (request.current()) onWork((current) => ({ ...current, notices: [...current.notices, toAppError(error, 'CLIPES_IA_CONTEXTO')] }));
    } finally {
      if (request.current()) setAiBusy(null);
      request.finish();
    }
  }

  async function renderOne(it: ClipItem, index: number): Promise<boolean> {
    setJob(it.uid, { kind: 'working', progress: { label: 'Começando', phase: 'recortar', fraction: 0 } });
    try {
      const out = await renderClip(long, it.m, index, settings(), (progress) => setJob(it.uid, { kind: 'working', progress }));
      const url = URL.createObjectURL(out.blob);
      setJob(it.uid, { kind: 'done', url, name: out.name, degraded: out.result.degraded });
      downloadBlob(url, out.name);
      return true;
    } catch (err) {
      setJob(it.uid, { kind: 'error', error: toAppError(err, 'CORTE_FALHOU') });
      return false;
    }
  }

  async function renderSelected() {
    if (working) return;
    const todo = selected.filter((it) => it.job.kind !== 'done');
    if (todo.length === 0) return;
    stopBatch.current = false;
    setBatch({ done: 0, total: todo.length });
    const failed: string[] = [];
    for (const [k, it] of todo.entries()) {
      if (stopBatch.current) break;
      const ok = await renderOne(it, work.items.indexOf(it) + 1);
      if (!ok) failed.push(`clipe ${work.items.indexOf(it) + 1}`);
      setBatch({ done: k + 1, total: todo.length });
    }
    setBatch(null);
    if (failed.length) onWork((w) => ({ ...w, notices: [...w.notices.filter((n) => n.key !== 'CLIPE_LOTE_FALHOU'), new AppError('CLIPE_LOTE_FALHOU', failed.join(', '))] }));
  }

  async function openInEditor(it: ClipItem, index: number) {
    if (working) return;
    setOpeningError(null);
    setOpening({ uid: it.uid, progress: { label: 'Preparando para o editor', phase: 'recortar', fraction: 0 } });
    try {
      const p = await prepareClip(long, it.m, index, settings(), (progress) => setOpening({ uid: it.uid, progress }));
      onOpenInEditor(p, it.m.title);
    } catch (err) {
      setOpeningError({ uid: it.uid, error: toAppError(err, 'CORTE_FALHOU') });
    } finally {
      setOpening(null);
    }
  }

  function preview(it: ClipItem, withContext = false) {
    const v = video.current;
    if (!v) return;
    if (!withContext && previewing === it.uid && playing) {
      v.pause();
      return;
    }
    setPreviewing(it.uid);
    setContextPreview(withContext);
    previewLimit.current = withContext ? Math.min(long.durationSec, it.m.end + 6) : it.m.end;
    v.currentTime = withContext ? Math.max(0, it.m.start - 6) : it.m.start;
    void v.play().catch(() => undefined);
    v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const current = work.items.find((it) => it.uid === previewing);
  const doneCount = work.items.filter((it) => it.job.kind === 'done').length;

  return (
    <div className="land clips-page" data-testid="clip-maker">
      <header className="land-nav">
        <a className="brand" href="./" aria-label="Motion4Free">
          <Logo />
          <span className="brand-name">Motion4Free</span>
        </a>
        <nav className="land-links">
          <button className="ghost" onClick={onBack} disabled={working} data-testid="clips-back">
            <ArrowLeft size={16} aria-hidden /> Início
          </button>
          <SettingsButton />
        </nav>
      </header>

      <main className="clips-main">
        <section className="clips-head">
          <p className="lp-kicker">
            <Scissors size={14} aria-hidden /> Criador de clipes
          </p>
          <h1>Melhores momentos de “{long.file.name}”</h1>
          <p className="hint" data-testid="clips-meta">
            {clock(long.durationSec)} de vídeo · {long.words.length.toLocaleString('pt-BR')} palavras transcritas
            {long.asrModel ? ` · legenda: ${long.asrModel}` : ''}
            {long.reused ? ' · análise reaproveitada (este arquivo já tinha sido analisado)' : ''}
          </p>
        </section>

        {work.notices.length > 0 && (
          <div className="clips-notices">
            {work.notices.map((n) => (
              <div key={n.code}>
                <ErrorBox error={n} kind="warning" onDismiss={() => onWork((w) => ({ ...w, notices: w.notices.filter((x) => x.code !== n.code) }))} />
                {(n.key === 'IA_SEM_ESPACO' || n.key === 'IA_MODELO_GRANDE') && (
                  <div className="notice-row" data-testid="clips-ai-recovery">
                    <button className="sm primary" disabled={working} onClick={() => { setAiSettings({ model: 'padrao' }); onWork((w) => ({ ...w, notices: w.notices.filter(notAiNotice) })); }} data-testid="clips-ai-smaller">Escolher IA Padrão e tentar novamente</button>
                    <button className="sm" onClick={() => openSettings('armazenamento')}>Gerenciar armazenamento</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <section className="clips-configuration" aria-label="Configuração dos clipes">
          <button className="clips-settings-toggle" type="button" aria-expanded={settingsExpanded}
            onClick={() => setSettingsExpanded(value => !value)} data-testid="clips-settings-toggle">
            <span><strong>01 / Como ficam seus clipes</strong>
              <small>{CLIP_LENGTHS[work.length].label} · {work.count} clipes · {OUTPUT_FORMATS[work.format].ratio}</small></span>
            <span>{settingsExpanded ? 'Ocultar opções' : 'Alterar opções'}</span>
          </button>
          {settingsExpanded && <section className="clips-options card" aria-label="Como fazer os clipes">
          <div className="clips-opt">
            <span className="clips-label">Tamanho</span>
            <div className="segmented" role="group" aria-label="Tamanho dos clipes">
              {CLIP_LENGTH_IDS.map((id) => (
                <button key={id} aria-pressed={work.length === id} disabled={working} onClick={() => regenerate(id, work.count)} data-testid={`clips-length-${id}`}>
                  {CLIP_LENGTHS[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="clips-opt">
            <span className="clips-label">Quantos</span>
            <div className="segmented" role="group" aria-label="Quantos clipes">
              {CLIP_COUNTS.map((n) => (
                <button key={n} aria-pressed={work.count === n} disabled={working} onClick={() => regenerate(work.length, n)} data-testid={`clips-count-${n}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="clips-opt">
            <span className="clips-label">Formato</span>
            <div className="chips">
              {FORMAT_IDS.map((id) => (
                <button key={id} className="chip" aria-pressed={work.format === id} disabled={working} onClick={() => changeLook({ format: id })} data-testid={`clips-format-${id}`}>
                  {OUTPUT_FORMATS[id].label} {OUTPUT_FORMATS[id].ratio}
                </button>
              ))}
            </div>
          </div>
          <div className="clips-opt clips-style">
            <span className="clips-label">Modelo</span>
            <TemplateThumb styleId={work.templateId} t={1.3} width={64} />
            <select value={work.templateId} disabled={working} onChange={(e) => changeLook({ templateId: e.target.value })} aria-label="Modelo de legenda e animação" data-testid="clips-template">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.tags.slice(0, 2).join(', ')}
                </option>
              ))}
            </select>
          </div>
          <div className="clips-ai">
            <AiStatusLine />
            <button className="sm" onClick={() => void askAi()} disabled={working} data-testid="clips-ask-ai">
                <Sparkles size={15} aria-hidden /> Reanalisar toda a transcrição
              </button>
            {long.words.length <= 20000 && <button className="sm ghost" disabled={working} onClick={() => regenerate(work.length, work.count, true)}>Usar método heurístico anterior (revisar antes de selecionar)</button>}
            {aiBusy && <button className="sm ghost" onClick={requestScope.cancel}>Cancelar análise</button>}
            <p className="hint">Regras locais por padrão; IA só se escolhida. Fronteiras e contexto são estimativas. Novas propostas ficam desmarcadas para sua revisão.</p>
            <ProgressPanel progress={aiBusy} compact testId="clips-ai-progress" />
          </div>
          </section>}
        </section>

        <ClipReviewWorkspace
          work={work} video={video} videoUrl={videoUrl} index={index}
          working={working} playing={playing} previewing={previewing}
          contextPreview={contextPreview} opening={opening} openingError={openingError}
          onVideoPlay={() => setPlaying(true)}
          onVideoPause={() => setPlaying(false)}
          onVideoTime={target => { if (previewLimit.current !== null && target.currentTime >= previewLimit.current) target.pause(); }}
          onSelect={(uid, checked) => setItem(uid, () => ({ checked, selectionEdited: true }))}
          onBulkSelect={checked => onWork(w => ({ ...w, items: w.items.map(it => ({
            ...it, checked, selectionEdited: true,
          })) }))}
          onTitle={(uid, title) => setItem(uid, item => ({
            m: { ...item.m, title, userTitle: true },
            job: item.job.kind === 'done' ? { kind: 'idle' } : item.job,
          }))}
          onPreview={preview} onNudge={nudgeItem}
          onRender={(it, n) => { void renderOne(it, n); }}
          onEditor={(it, n) => { void openInEditor(it, n); }}
          onJobDismiss={uid => setJob(uid, { kind: 'idle' })}
          onOpeningDismiss={() => setOpeningError(null)}
        />
      </main>

      <footer className="clips-bar">
        {batch ? (
          <div className="clips-bar-progress">
            <ProgressPanel progress={batchProgress} compact testId="clips-batch-progress" />
          </div>
        ) : (
          <span className="hint">
            {selected.length} escolhido{selected.length === 1 ? '' : 's'}
            {doneCount > 0 ? ` · ${doneCount} pronto${doneCount === 1 ? '' : 's'}` : ''} · use vídeos seus ou com autorização do dono
          </span>
        )}
        {batch ? (
          <button className="sm" onClick={() => (stopBatch.current = true)} data-testid="clips-stop">
            Parar depois deste
          </button>
        ) : (
          <button className="primary" disabled={working || selected.filter((it) => it.job.kind !== 'done').length === 0} onClick={() => void renderSelected()} data-testid="clips-render-all">
            <Download size={16} aria-hidden /> {work.items.length === 0 ? 'Nenhum clipe para gerar' : selected.length === 0 ? 'Selecione clipes para gerar' : `Gerar e baixar os ${selected.filter((it) => it.job.kind !== 'done').length} escolhidos`}
          </button>
        )}
        <span className="clips-version hint" data-testid="version">
          Motion4Free {VERSION_LABEL}
        </span>
      </footer>
      {work.items.some((it) => it.job.kind === 'error') && !batch && (
        <p className="sr-only" role="alert">
          <CircleAlert aria-hidden /> Um clipe teve erro; veja o código no cartão.
        </p>
      )}
    </div>
  );
}
