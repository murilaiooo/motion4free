import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CircleAlert, Download, HardDrive, Pause, Play, Scissors, SquarePen, Sparkles, WandSparkles } from 'lucide-react';
import './clips.css';
import { DEFAULT_LLM } from '../core/llm-models';
import { AppError, toAppError } from '../core/errors';
import { FORMAT_IDS, OUTPUT_FORMATS, profileFor, type OutputFormatId } from '../core/formats';
import { DEFAULT_STYLE, presetById } from '../core/presets';
import { listTemplates } from '../core/template-gallery';
import { CLIP_COUNTS, CLIP_LENGTHS, CLIP_LENGTH_IDS, MAX_MOMENTS, clock, findMoments, nudgeMoment, type ClipLength, type Moment } from '../editorial/highlights';
import { rankMomentsWithAi } from '../editorial/moments-ai';
import { loadKey } from '../ai/own-key';
import { VERSION_LABEL } from '../version';
import { AiOptions, prepareAi, type AiSettings } from './AiOptions';
import { ErrorBox } from './ErrorBox';
import { ProgressPanel } from './ProgressPanel';
import { clipJobFraction, type Progress } from '../core/progress';
import { TemplateThumb } from './Templates';
import { Logo, ThemeToggle } from './TopBar';
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
function buildItems(long: LongAnalysis, length: ClipLength, count: number): ClipItem[] {
  const pool = Math.min(MAX_MOMENTS, Math.max(count * 2, count + 3));
  return findMoments(long.words, long.durationSec, { length, count: pool, energy: long.energy, energyStep: long.energyStep }).map((m): ClipItem => ({
    uid: `c${++uidSeq}`,
    m,
    checked: m.rank <= count,
    job: { kind: 'idle' },
  }));
}

export function newClipWork(long: LongAnalysis): ClipWork {
  const length: ClipLength = 'medio';
  const count = 5;
  return { long, length, count, templateId: DEFAULT_STYLE.id, format: 'vertical', items: buildItems(long, length, count), notices: long.warnings, aiUsed: false };
}

/** Libera os MP4 gerados (quando a lista é refeita ou o trabalho é fechado). */
export function releaseWork(work: ClipWork | null): void {
  for (const it of work?.items ?? []) if (it.job.kind === 'done') URL.revokeObjectURL(it.job.url);
}

/** Avisos da IA (preparar ou ordenar): saem quando a IA é pedida de novo ou a lista é refeita. */
const notAiNotice = (n: AppError) => !n.key.startsWith('IA_');

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
  const [ai, setAi] = useState<AiSettings>(() => ({ mode: 'regras', model: DEFAULT_LLM, key: loadKey() }));
  const [aiBusy, setAiBusy] = useState<Progress | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [opening, setOpening] = useState(false);
  const stopBatch = useRef(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const videoUrl = useMemo(() => URL.createObjectURL(long.file), [long.file]);
  useEffect(() => () => URL.revokeObjectURL(videoUrl), [videoUrl]);

  const working = work.items.some((it) => it.job.kind === 'working') || batch !== null || opening || aiBusy !== null;
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
    onWork((w) => ({ ...w, items: w.items.map((it) => (it.uid === uid ? { ...it, ...patch(it) } : it)) }));
  const setJob = (uid: string, job: ClipJobState) =>
    setItem(uid, (it) => {
      if (it.job.kind === 'done' && job.kind !== 'done') URL.revokeObjectURL(it.job.url);
      return { job };
    });

  function regenerate(length: ClipLength, count: number) {
    if (working) return;
    releaseWork(work);
    onWork((w) => ({ ...w, length, count, items: buildItems(w.long, length, count), aiUsed: false, notices: w.notices.filter(notAiNotice) }));
  }

  /** Muda modelo ou formato: os MP4 já gerados ficam com o visual antigo, então voltam a "não gerado". */
  function changeLook(patch: Partial<Pick<ClipWork, 'templateId' | 'format'>>) {
    if (working) return;
    releaseWork(work);
    onWork((w) => ({ ...w, ...patch, items: w.items.map((it): ClipItem => ({ ...it, job: { kind: 'idle' } })) }));
  }

  async function askAi() {
    if (working) return;
    setAiBusy({ label: 'Preparando a IA', phase: 'ia-preparar', fraction: null });
    try {
      const { ai: choice, warning } = await prepareAi(ai, setAiBusy);
      if (!choice) {
        if (warning) onWork((w) => ({ ...w, notices: [...w.notices.filter(notAiNotice), warning] }));
        return;
      }
      setAiBusy({ label: 'A IA está lendo os trechos e escolhendo os melhores', phase: 'ia-ler', fraction: null });
      const r = await rankMomentsWithAi(
        work.items.map((it) => it.m),
        work.count,
        choice,
      );
      onWork((w) => {
        // a IA devolve os mesmos momentos em outra ordem: reencaixa cada um no item que já existia
        const byStart = new Map(w.items.map((it) => [`${it.m.start}-${it.m.end}`, it]));
        const items = r.moments.map((m): ClipItem => {
          const old = byStart.get(`${m.start}-${m.end}`);
          return { uid: old?.uid ?? `c${++uidSeq}`, m, checked: m.rank <= w.count, job: old?.job ?? { kind: 'idle' } };
        });
        const notices = w.notices.filter(notAiNotice);
        return { ...w, items: r.warning ? w.items : items, aiUsed: !r.warning, notices: r.warning ? [...notices, r.warning] : notices };
      });
    } finally {
      setAiBusy(null);
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
    setOpening(true);
    setJob(it.uid, { kind: 'working', progress: { label: 'Preparando para o editor', phase: 'recortar', fraction: 0 } });
    try {
      const p = await prepareClip(long, it.m, index, settings(), (progress) => setJob(it.uid, { kind: 'working', progress }));
      setJob(it.uid, { kind: 'idle' });
      onOpenInEditor(p, it.m.title);
    } catch (err) {
      setJob(it.uid, { kind: 'error', error: toAppError(err, 'CORTE_FALHOU') });
    } finally {
      setOpening(false);
    }
  }

  function preview(it: ClipItem) {
    const v = video.current;
    if (!v) return;
    if (previewing === it.uid && playing) {
      v.pause();
      return;
    }
    setPreviewing(it.uid);
    v.currentTime = it.m.start;
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
          <button className="ghost" onClick={onStorage} aria-label="Armazenamento">
            <HardDrive size={16} aria-hidden /> <span className="hide-sm">Armazenamento</span>
          </button>
          <ThemeToggle />
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
              <ErrorBox key={n.code} error={n} kind="warning" onDismiss={() => onWork((w) => ({ ...w, notices: w.notices.filter((x) => x.code !== n.code) }))} />
            ))}
          </div>
        )}

        <section className="clips-options card" aria-label="Como fazer os clipes">
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
            <AiOptions settings={ai} onChange={setAi} />
            {ai.mode !== 'regras' && (
              <button className="sm" onClick={() => void askAi()} disabled={working || work.items.length < 2} data-testid="clips-ask-ai">
                <Sparkles size={15} aria-hidden /> Pedir para a IA escolher e dar títulos
              </button>
            )}
            <ProgressPanel progress={aiBusy} compact testId="clips-ai-progress" />
          </div>
        </section>

        <div className="clips-body">
          <aside className="clips-preview">
            <video ref={video} src={videoUrl} controls playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => current && e.currentTarget.currentTime >= current.m.end && e.currentTarget.pause()} data-testid="clips-video" />
            <p className="hint">
              {current ? (
                <>
                  Tocando o clipe {work.items.indexOf(current) + 1}: {clock(current.m.start)}–{clock(current.m.end)}. A prévia mostra o vídeo original; o clipe pronto sai no formato e no modelo escolhidos.
                </>
              ) : (
                'Clique em “Ver trecho” para assistir um momento aqui.'
              )}
            </p>
          </aside>

          <section className="clips-list" aria-label="Momentos encontrados">
            {work.items.length === 0 && <ErrorBox error={new AppError('SEM_MOMENTOS', `${CLIP_LENGTHS[work.length].label} em ${clock(long.durationSec)}`)} kind="warning" />}
            {work.items.map((it, i) => (
              <article key={it.uid} className={`clip-card ${it.checked ? 'on' : ''}`} data-testid="clip-card">
                <label className="clip-check">
                  <input type="checkbox" checked={it.checked} disabled={working} onChange={(e) => setItem(it.uid, () => ({ checked: e.target.checked }))} data-testid="clip-check" />
                  <span className="clip-rank tnum">{i + 1}</span>
                </label>
                <div className="clip-info">
                  <h3>{it.m.title}</h3>
                  <p className="clip-time tnum">
                    {clock(it.m.start)} – {clock(it.m.end)} · {seconds(it.m)} s · nota {Math.round(it.m.score)}
                  </p>
                  <ul className="clip-reasons">
                    {it.m.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <details className="clip-text">
                    <summary>Ler a fala do trecho</summary>
                    <p>{it.m.text}</p>
                  </details>
                  <div className="clip-edges" role="group" aria-label="Ajustar começo e fim">
                    <span className="hint">Começo</span>
                    <button className="sm ghost" disabled={working} onClick={() => setItem(it.uid, (x) => ({ m: nudgeMoment(x.m, long.words, long.durationSec, 'start', -1), job: x.job.kind === 'done' ? { kind: 'idle' } : x.job }))} title="Começar uns 3 s antes">
                      −3 s
                    </button>
                    <button className="sm ghost" disabled={working} onClick={() => setItem(it.uid, (x) => ({ m: nudgeMoment(x.m, long.words, long.durationSec, 'start', 1), job: x.job.kind === 'done' ? { kind: 'idle' } : x.job }))} title="Começar uns 3 s depois">
                      +3 s
                    </button>
                    <span className="hint">Fim</span>
                    <button className="sm ghost" disabled={working} onClick={() => setItem(it.uid, (x) => ({ m: nudgeMoment(x.m, long.words, long.durationSec, 'end', -1), job: x.job.kind === 'done' ? { kind: 'idle' } : x.job }))} title="Terminar uns 3 s antes">
                      −3 s
                    </button>
                    <button className="sm ghost" disabled={working} onClick={() => setItem(it.uid, (x) => ({ m: nudgeMoment(x.m, long.words, long.durationSec, 'end', 1), job: x.job.kind === 'done' ? { kind: 'idle' } : x.job }))} title="Terminar uns 3 s depois">
                      +3 s
                    </button>
                  </div>
                  {it.job.kind === 'working' && <ProgressPanel progress={it.job.progress} compact testId="clip-progress" />}
                  {it.job.kind === 'error' && <ErrorBox error={it.job.error} kind="error" onDismiss={() => setJob(it.uid, { kind: 'idle' })} />}
                  {it.job.kind === 'done' && (
                    <p className="clip-done" data-testid="clip-done">
                      <Check size={15} aria-hidden /> Pronto: <b>{it.job.name}</b>
                      {it.job.degraded && <span className="hint"> (formato VP9/AV1: veja o aviso M4F-403 no editor)</span>}
                    </p>
                  )}
                </div>
                <div className="clip-actions">
                  <button className="sm" onClick={() => preview(it)} data-testid="clip-preview">
                    {previewing === it.uid && playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />} Ver trecho
                  </button>
                  {it.job.kind === 'done' ? (
                    <a className="btn sm primary" href={it.job.url} download={it.job.name} data-testid="clip-download">
                      <Download size={15} aria-hidden /> Baixar de novo
                    </a>
                  ) : (
                    <button className="sm primary" disabled={working} onClick={() => void renderOne(it, i + 1)} data-testid="clip-render">
                      <WandSparkles size={15} aria-hidden /> Baixar pronto
                    </button>
                  )}
                  <button className="sm" disabled={working} onClick={() => void openInEditor(it, i + 1)} data-testid="clip-edit">
                    <SquarePen size={15} aria-hidden /> Abrir no editor
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
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
            <Download size={16} aria-hidden /> Gerar e baixar os {selected.filter((it) => it.job.kind !== 'done').length} escolhidos
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
