import { planSummary } from '../core/text';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Captions, ChevronRight, Download, History, LayoutTemplate, Magnet, MousePointerClick, Palette, Pause, Play, Scan, Scissors, SkipBack, Sparkles, SquareDashedMousePointer, X } from 'lucide-react';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, TimeRange } from '../core/types';
import { PRESETS } from '../core/presets';
import { adjustCut, applyBrief, applyHook, applyRange, applyReferencePalette, applyStyle, editCaptionText, listCuts, restoreCut, type EditContext } from '../editorial/ops';
import type { RangeRequest } from '../editorial/range-interpret';
import { stylesOf } from '../editorial/ranges';
import { addVersion, removeVersion, type PlanVersion } from '../core/versions';
import { canRedo, canUndo, pushHistory, redo, undo, type History as EditHistory } from '../engine/history';
import { outputDuration, outputToSource } from '../engine/timeline';
import type { DecodedAudio } from '../media/audio';
import { exportInBackground } from '../media/export-client';
import { ensureEmojiFont, ensureFonts } from '../media/fonts';
import { planUsesEmoji } from '../core/emoji';
import { DEFAULT_LLM } from '../core/llm-models';
import { reelsSafeArea } from '../render/layout';
import { loadKey } from '../ai/own-key';
import type { AiSettings } from './AiOptions';
import type { OpenedMedia } from '../media/input';
import { PlanPlayer } from '../media/player';
import { PreviewOverlay } from './PreviewOverlay';
import { setElementPlacement, deleteElement, duplicateElement, setElementText } from '../editorial/manual';
import type { ElementRef } from '../editorial/elements';
import { elementName, resolvePlan, sceneText, sameRef as sameEl } from '../editorial/elements';
import { ErrorBox } from './ErrorBox';
import { BriefPanel, HookPanel } from './BriefPanel';
import { TemplateGallery } from './Templates';
import { Timeline } from './Timeline';
import { RangePanel } from './RangePanel';
import { ChangesPanel, ReferencePicker, VersionsPanel, type CompareView } from './Panels';
import { Transcript } from './Transcript';
import { TopBar, type SaveState } from './TopBar';
import { VERSION_LABEL, APP_BUILT_AT } from '../version';
import { FormatSelector } from './FormatSelector';
import { placeWords, totalDuration } from '../engine/clips';
import { reorderClipPlan } from '../editorial/clip-ops';
import { combineAudios } from '../media/multi';
import { waveformPeaks } from '../analysis/waveform';
import { ClipList } from './ClipList';

export interface Session {
  file: Blob;
  fileName: string;
  media: OpenedMedia;
  audio: DecodedAudio | null;
  ctx: EditContext;
  silences: TimeRange[];
  warnings: AppError[];
  peaks: Float32Array | null;
  /** multi-clip: mapa de fontes por clipId e áudio combinado */
  clipSources?: Map<string, import('../media/sources').ClipSource> | null;
  clipAudios?: Map<string, DecodedAudio> | null;
  openedClips?: import('../media/multi').OpenedClip[] | null;
  clipWords?: Record<string, import('../core/types').Word[]>;
  clipSilences?: Record<string, TimeRange[]>;
  originalVideo?: { name: string; size: number; durationSec: number };
}

interface Result {
  url: string;
  name: string;
  degraded: boolean;
  codec: string;
  where: 'worker' | 'main';
  style: string;
  fontWarning: string;
  emojiWarning: string;
}

const SCENE_NAMES: Partial<Record<EditPlan['scenes'][number]['kind'], [string, string]>> = {
  'kinetic-title': ['título', 'títulos'],
  'big-number': ['número grande', 'números grandes'],
  list: ['lista', 'listas'],
  quote: ['pergunta em destaque', 'perguntas em destaque'],
  'lower-third': ['nome na tela', 'nomes na tela'],
  'highlight-word': ['palavra-chave', 'palavras-chave'],
  'emphasis-zoom': ['zoom', 'zooms'],
  'cut-transition': ['transição', 'transições'],
  'end-cta': ['chamada final', 'chamadas finais'],
  emoji: ['emoji', 'emojis'],
};

/** "1 número grande, 3 palavras-chave e 2 transições" */
export function describeScenes(scenes: EditPlan['scenes']): string {
  const counts = new Map<string, number>();
  for (const s of scenes) if (SCENE_NAMES[s.kind]) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const parts = [...counts].map(([k, n]) => `${n} ${SCENE_NAMES[k as keyof typeof SCENE_NAMES]![n === 1 ? 0 : 1]}`);
  if (parts.length === 0) return 'nenhuma';
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}

const fmt = (s: number) => `${s.toFixed(2).replace('.', ',')} s`;
const fmt1 = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;

type TabId = 'modelos' | 'pedido' | 'legendas' | 'gancho' | 'trechos' | 'versoes' | 'cores';
const TABS: { id: TabId; label: string; title: string; about: string; Icon: typeof Play }[] = [
  { id: 'modelos', label: 'Modelos', title: 'Modelos', about: 'Letras, cores, animações e ritmo do vídeo inteiro. Clique para aplicar; dá para desfazer.', Icon: LayoutTemplate },
  { id: 'pedido', label: 'Pedido', title: 'Pedido e IA', about: 'Peça mudanças com suas palavras. Funciona sem IA; a IA é opcional.', Icon: Sparkles },
  { id: 'legendas', label: 'Legendas', title: 'Legendas', about: 'O texto falado, como um roteiro. Clique numa palavra para ir até ela e corrigir.', Icon: Captions },
  { id: 'gancho', label: 'Gancho', title: 'Gancho', about: 'A frase que abre o vídeo, sempre tirada da sua própria fala.', Icon: Magnet },
  { id: 'trechos', label: 'Trechos', title: 'Trechos', about: 'Mude ou trave só um pedaço do vídeo. O resto não muda.', Icon: SquareDashedMousePointer },
  { id: 'versoes', label: 'Versões', title: 'Versões', about: 'Guarde, compare e restaure versões do vídeo.', Icon: History },
  { id: 'cores', label: 'Cores', title: 'Cores e marca', about: 'As cores do vídeo, ou as de uma imagem sua (logo, foto).', Icon: Palette },
];

const SAFE = (() => {
  const r = reelsSafeArea(1080, 1920);
  return { top: (100 * r.y) / 1920, left: (100 * r.x) / 1080, right: (100 * (1080 - r.x - r.w)) / 1080, bottom: (100 * (1920 - r.y - r.h)) / 1920 };
})();

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
};

interface EditorProps {
  session: Session;
  history: EditHistory<EditPlan>;
  onHistory: (h: EditHistory<EditPlan>) => void;
  versions: PlanVersion[];
  onVersions: (v: PlanVersion[]) => void;
  disabled: boolean;
  saveState: SaveState;
  /** modelo que fez a legenda (v0.8), quando o vídeo acabou de ser transcrito */
  asrModel?: string | null;
  onReplaceFile: (f: File) => void;
  onAddClips: (files: File[]) => void;
  /** avisos do app (projeto, transcrição, sem áudio…) */
  notices: ReactNode;
  /** menu do projeto na barra do topo (v0.11: renomear, fechar, apagar, armazenamento) */
  projectMenu?: ReactNode;
}

export function Editor({ session, history, onHistory, versions, onVersions, disabled, saveState, asrModel, onReplaceFile, onAddClips, notices, projectMenu }: EditorProps) {
  const plan = history.present;
  const [tab, setTab] = useState<TabId>('modelos');
  const [selection, setSelection] = useState<TimeRange | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [view, setView] = useState<CompareView>('depois');
  const comparedVersion = versions.find((v) => v.id === compareWith) ?? null;
  const before = comparedVersion?.plan ?? history.past.at(-1) ?? null;
  const beforeLabel = comparedVersion ? `a versão “${comparedVersion.name}”` : 'antes da última mudança';
  const shown = view === 'antes' && before ? before : plan;
  const ctx = session.clipWords
    ? { durationSec: totalDuration(plan.clips), words: placeWords(plan.clips, session.clipWords) }
    : session.ctx;
  const shownAudio = useMemo(() => {
    if (!session.clipAudios) return session.audio;
    return combineAudios(shown.clips, Object.fromEntries(session.clipAudios));
  }, [session, shown.clips]);
  const peaks = useMemo(() => shownAudio ? waveformPeaks(shownAudio.channels[0]!, 1200, true) : null, [shownAudio]);
  const range = selectedRange ? (plan.ranges.find((r) => r.id === selectedRange) ?? null) : null;
  const activeSelection = range ? range.out : selection;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PlanPlayer | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [safeZone, setSafeZone] = useState(false);
  const [selectedCut, setSelectedCut] = useState<number | null>(null);
  const [selectedEl, setSelectedEl] = useState<ElementRef | null>(null);
  const [editingEl, setEditingEl] = useState<ElementRef | null>(null);
  const [editError, setEditError] = useState<AppError | null>(null);
  const [playerError, setPlayerError] = useState<AppError | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [exportError, setExportError] = useState<AppError | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fontError, setFontError] = useState<AppError | null>(null);
  const [emojiError, setEmojiError] = useState<AppError | null>(null);
  // escolha de IA: vale para o pedido geral e para o pedido de trecho
  const [ai, setAi] = useState<AiSettings>(() => ({ mode: 'regras', model: DEFAULT_LLM, key: loadKey() }));
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // gancho para os testes automáticos (só no build de teste)
  useEffect(() => {
    if (import.meta.env.VITE_FAKE_ASR === '1') (window as unknown as { __m4f: unknown }).__m4f = { plan, history, versions };
  }, [plan, history, versions]);

  // trecho desfeito (desfazer) ou removido: fecha o painel do trecho
  useEffect(() => {
    if (selectedRange && !plan.ranges.some((r) => r.id === selectedRange)) {
      setSelectedRange(null);
      setSelection(null);
    }
  }, [plan.ranges, selectedRange]);
  useEffect(() => {
    if (compareWith && !comparedVersion) setCompareWith(null);
  }, [compareWith, comparedVersion]);

  // Um player por vídeo aberto; o plano é trocado sem recriar.
  useEffect(() => {
    const player = new PlanPlayer(session.media, shownAudio, canvasRef.current!, shownRef.current, 0.5, session.clipSources ?? undefined);
    player.onTime = (t, p) => {
      setTime(t);
      setPlaying(p);
    };
    player.onError = setPlayerError;
    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [session]);

  // fontes do estilo atual antes de desenhar; as dos outros estilos ficam prontas para a troca ser instantânea
  useEffect(() => {
    let alive = true;
    void ensureFonts(stylesOf(shown)).then((r) => {
      if (!alive) return;
      setFontError(r.ok ? null : new AppError('FONTE_FALHOU', r.detail));
      playerRef.current?.redraw();
    });
    return () => {
      alive = false;
    };
  }, [shown]);
  useEffect(() => {
    for (const p of PRESETS) void ensureFonts(p);
  }, []);
  // fonte dos emojis só quando o vídeo tem emoji
  const usesEmoji = planUsesEmoji(shown);
  useEffect(() => {
    if (!usesEmoji) return;
    let alive = true;
    void ensureEmojiFont().then((r) => {
      if (!alive) return;
      setEmojiError(r.ok ? null : new AppError('EMOJI_FALHOU', r.detail));
      playerRef.current?.redraw();
    });
    return () => {
      alive = false;
    };
  }, [usesEmoji]);

  useEffect(() => {
    playerRef.current?.setPlan(shown, shownAudio);
    setTime((t) => Math.min(t, outputDuration(shown.segments)));
  }, [shown, shownAudio]);

  const cuts = listCuts(plan.segments, ctx.durationSec);
  // palavras faladas no trecho selecionado (vão para a IA, se escolhida, junto com o pedido do trecho)
  const rangeWords = (() => {
    if (!activeSelection) return [];
    const a = outputToSource(plan.segments, activeSelection.start) ?? 0;
    const b = outputToSource(plan.segments, Math.max(activeSelection.start, activeSelection.end - 0.001)) ?? a;
    return ctx.words.filter((w) => w.end > a && w.start < b);
  })();
  const total = outputDuration(plan.segments);

  const apply = useCallback(
    (op: (p: EditPlan) => EditPlan) => {
      try {
        const next = op(history.present);
        setEditError(null);
        onHistory(pushHistory(history, next));
      } catch (err) {
        setEditError(toAppError(err));
      }
    },
    [history, onHistory],
  );

  /** Pedido de trecho: devolve o erro para o painel do trecho mostrar. */
  const requestRange = (req: RangeRequest): AppError | null => {
    if (!activeSelection) return null;
    try {
      const target = selectedRange ? { id: selectedRange } : activeSelection;
      const r = applyRange(history.present, ctx, target, req);
      onHistory(pushHistory(history, r.plan));
      setView('depois');
      if (r.rangeId) setSelectedRange(r.rangeId);
      else {
        setSelectedRange(null);
        setSelection(null);
      }
      return null;
    } catch (err) {
      return toAppError(err);
    }
  };

  const saveVersion = (name: string): AppError | null => {
    try {
      onVersions(addVersion(versions, name, plan, new Date()));
      return null;
    } catch (err) {
      return toAppError(err);
    }
  };

  const doUndo = useCallback(() => onHistory(undo(history)), [history, onHistory]);
  const doRedo = useCallback(() => onHistory(redo(history)), [history, onHistory]);
  const seek = useCallback((t: number) => playerRef.current?.seek(t), []);
  const togglePlay = useCallback(() => (playerRef.current?.isPlaying ? playerRef.current.pause() : playerRef.current?.play()), []);

  // Atalhos: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; espaço toca/pausa; J e L voltam e avançam 1 s; K pausa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) doUndo();
        else if ((k === 'z' && e.shiftKey) || k === 'y') doRedo();
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      const onControl = (e.target as HTMLElement)?.closest?.('button, a, summary, [role="button"], [role="tab"], label');
      if (k === ' ' && !onControl) {
        e.preventDefault();
        togglePlay();
      } else if (k === 'k') playerRef.current?.pause();
      else if (k === 'j') seek((playerRef.current?.currentTime ?? 0) - 1);
      else if (k === 'l') seek((playerRef.current?.currentTime ?? 0) + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo, togglePlay, seek]);

  useEffect(() => {
    if (selectedCut !== null && selectedCut >= cuts.length) setSelectedCut(null);
  }, [cuts.length, selectedCut]);

  const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches;
  // no celular/tablet o painel de detalhes fica abaixo: leva até ele quando algo é selecionado
  useEffect(() => {
    if ((selectedCut !== null || activeSelection) && narrow()) inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedCut, !!activeSelection]);

  async function onExport() {
    playerRef.current?.pause();
    setExportError(null);
    setExportOpen(true);
    setExporting(0);
    try {
      // Route to multi-clip export when session has multiple sources
      const multiSources = session.clipSources;
      const isMulti = !!multiSources && multiSources.size > 0;
      const multiAudio = session.clipAudios ? combineAudios(plan.clips, Object.fromEntries(session.clipAudios)) : session.audio;
      const out = isMulti
        ? await (await import('../media/export')).exportPlanMulti(multiSources!, multiAudio, plan, { onProgress: (f) => setExporting(f) }).then(r => ({ ...r, where: 'main' as const }))
        : await exportInBackground(session.file, session.media, session.audio, plan, (f) => setExporting(f));
      if (result) URL.revokeObjectURL(result.url);
      const base = session.fileName.replace(/\.[^.]+$/, '');
      setResult({ url: URL.createObjectURL(out.blob), name: `${base}-${plan.style.id}-motion4free.mp4`, degraded: out.degraded, codec: out.codec, where: out.where, style: plan.style.name, fontWarning: out.fontWarning, emojiWarning: out.emojiWarning });
    } catch (err) {
      setExportError(toAppError(err, 'EXPORTACAO_FALHOU'));
    } finally {
      setExporting(null);
    }
  }

  const cut = selectedCut !== null ? cuts[selectedCut] : undefined;
  const nudge = (which: 'start' | 'end', delta: number) => {
    if (!cut || selectedCut === null) return;
    const r = which === 'start' ? { start: cut.start + delta, end: cut.end } : { start: cut.start, end: cut.end + delta };
    apply((p) => adjustCut(p, ctx, selectedCut, r));
  };
  const setEdge = (which: 'start' | 'end', value: number) => {
    if (!cut || selectedCut === null || !Number.isFinite(value)) return;
    apply((p) => adjustCut(p, ctx, selectedCut, which === 'start' ? { start: value, end: cut.end } : { start: cut.start, end: value }));
  };

  const pickTab = (id: TabId) => {
    setTab(id);
    if (narrow()) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const onTabKey = (e: ReactKeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = ['ArrowDown', 'ArrowRight'].includes(e.key) ? i + 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = TABS[(next + TABS.length) % TABS.length]!;
    setTab(t.id);
    document.getElementById(`tab-${t.id}`)?.focus();
  };
  const selectFromNow = () => {
    setSelectedCut(null);
    setSelectedRange(null);
    setSelection({ start: Math.min(time, Math.max(0, total - 0.5)), end: Math.min(total, Math.max(time, 0) + 3) });
  };
  const off = exporting !== null;
  const current = TABS.find((t) => t.id === tab)!;
  const P = plan.style.palette;

  return (
    <div className="ws">
      <TopBar
        fileName={session.fileName}
        saveState={saveState}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        onUndo={doUndo}
        onRedo={doRedo}
        onReplaceFile={onReplaceFile}
        busy={disabled || off}
        onExport={() => void onExport()}
        exporting={exporting}
        exportDisabled={disabled || off}
        menu={projectMenu}
      />

      <nav className="rail" role="tablist" aria-label="Ferramentas" aria-orientation="vertical" onKeyDown={onTabKey}>
        {TABS.map(({ id, label, title, Icon }) => (
          <button key={id} id={`tab-${id}`} role="tab" type="button" className="rail-tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => pickTab(id)} data-tip={title} data-tip-side="right">
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <section className="panel" ref={panelRef} aria-label={current.title}>
        <header className="panel-head">
          <h2>{current.title}</h2>
          <p className="hint">{current.about}</p>
        </header>
        <div className="panel-body">
          <div role="tabpanel" id="panel-modelos" aria-labelledby="tab-modelos" hidden={tab !== 'modelos'} className="stack">
            <p className="scene-summary" data-testid="scene-summary">
              Animações neste estilo: {describeScenes(plan.scenes)}.
            </p>
            <TemplateGallery current={plan.style.id} onPick={(id) => apply((p) => applyStyle(p, ctx, id))} disabled={off} />
            <p className="hint">
              <a href="?galeria" target="_blank" rel="noreferrer">
                Ver todos os modelos lado a lado, cena por cena
              </a>
            </p>
          </div>
          <div role="tabpanel" id="panel-pedido" aria-labelledby="tab-pedido" hidden={tab !== 'pedido'}>
            <BriefPanel plan={plan} words={ctx.words} onBrief={(b) => apply((p) => applyBrief(p, ctx, b))} disabled={off} ai={ai} onAi={setAi} />
          </div>
          <div role="tabpanel" id="panel-legendas" aria-labelledby="tab-legendas" hidden={tab !== 'legendas'} className="stack">
            {asrModel && (
              <p className="asr-model" data-testid="asr-model">
                <Captions size={14} aria-hidden /> Legenda feita com {asrModel}.
              </p>
            )}
            <Transcript words={ctx.words} captions={plan.captions} segments={plan.segments} time={time} playing={playing} onSeek={seek} onEdit={(id, text) => apply((p) => editCaptionText(p, id, text))} disabled={off} />
          </div>
          <div role="tabpanel" id="panel-gancho" aria-labelledby="tab-gancho" hidden={tab !== 'gancho'}>
            <HookPanel plan={plan} words={ctx.words} onHook={(h) => apply((p) => applyHook(p, ctx, h))} disabled={off} />
          </div>
          <div role="tabpanel" id="panel-trechos" aria-labelledby="tab-trechos" hidden={tab !== 'trechos'} className="stack">
            <div className="card how">
              <MousePointerClick size={18} aria-hidden />
              <p>
                Arraste na faixa <b>Trechos</b> da linha do tempo para escolher um pedaço, ou use o botão abaixo. Os detalhes aparecem no painel <b>Detalhes</b>.
              </p>
            </div>
            <button type="button" onClick={selectFromNow} data-testid="range-new" disabled={off}>
              <SquareDashedMousePointer size={15} aria-hidden /> Selecionar 3 s a partir de agora ({fmt(time)})
            </button>
            {plan.ranges.length > 0 && (
              <ul className="range-list" aria-label="Trechos ajustados">
                {plan.ranges.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`range-item ${r.locked ? 'locked' : ''}`}
                      aria-pressed={selectedRange === r.id}
                      onClick={() => {
                        setSelectedCut(null);
                        setSelectedRange(r.id);
                        setSelection(null);
                      }}
                    >
                      <span className="range-dot" aria-hidden />
                      <span>
                        <b>{r.locked ? 'Travado' : 'Ajustado'}</b> · {fmt1(r.out.start)} a {fmt1(r.out.end)}
                        <small className="hint">{r.prompt || 'sem pedido'}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div role="tabpanel" id="panel-versoes" aria-labelledby="tab-versoes" hidden={tab !== 'versoes'}>
            <VersionsPanel
              versions={versions}
              onSave={saveVersion}
              onRestore={(v) => {
                setCompareWith(null);
                setView('depois');
                apply(() => v.plan);
              }}
              onCompare={(v) => {
                setCompareWith(v ? v.id : null);
                setView(v ? 'antes' : 'depois');
              }}
              onDelete={(v) => onVersions(removeVersion(versions, v.id))}
              comparing={compareWith}
              disabled={off}
            />
          </div>
          <div role="tabpanel" id="panel-cores" aria-labelledby="tab-cores" hidden={tab !== 'cores'} className="stack">
            <div className="palette-now" aria-label="Cores atuais do vídeo">
              {[
                ['Texto', P.text],
                ['Destaque', P.accent],
                ['Destaque 2', P.accent2],
                ['Painel', P.panel],
              ].map(([name, color]) => (
                <span key={name} className="swatch-chip">
                  <span style={{ background: color }} aria-hidden />
                  {name}
                </span>
              ))}
            </div>
            <ReferencePicker reference={plan.reference} onReference={(r) => apply((p) => applyReferencePalette(p, ctx, r))} disabled={off} />
          </div>
        </div>
      </section>

      <main className="stage" aria-label="Prévia">
        <div className="stage-head">
          <div className="summary" data-testid="summary">
            <span className="stat">
              <span className="muted">Original</span> <b className="tnum">{ctx.durationSec.toFixed(1)} s</b>
            </span>
            <ChevronRight size={14} className="muted" aria-hidden />
            <span className="stat">
              <span className="muted">Editado</span>{' '}
              <b className="tnum accent" data-testid="out-duration">
                {total.toFixed(1)} s
              </b>
            </span>
            <span className="summary-sep" aria-hidden />
            <span className="muted summary-detail">{planSummary(plan.segments.length, plan.captions.length, ctx.words.length)}</span>
          </div>
        </div>
        <div className="stage-notices">
          {notices}
          {playerError && <ErrorBox error={playerError} kind="warning" />}
          {fontError && <ErrorBox error={fontError} kind="warning" />}
          {emojiError && <ErrorBox error={emojiError} kind="warning" />}
          {editError && <ErrorBox error={editError} kind="error" />}
        </div>
        <div className="viewer">
          <div className="canvas-box">
            <canvas ref={canvasRef} data-testid="player-canvas" onClick={togglePlay} />
            <PreviewOverlay plan={plan} time={time} selected={selectedEl} onSelect={setSelectedEl} onChange={(next)=>apply(()=>next)} canvasRef={canvasRef} onEditText={setEditingEl} disabled={off} />
            {safeZone && (
              <div className="safe-zone" style={{ top: `${SAFE.top}%`, left: `${SAFE.left}%`, right: `${SAFE.right}%`, bottom: `${SAFE.bottom}%` }} aria-hidden>
                <span>Área segura do Reels</span>
              </div>
            )}
            {view === 'antes' && before && <span className="preview-badge">Antes</span>}
          </div>
        </div>
        <div className="transport">
          <div className="transport-left">
            <button className="icon ghost" onClick={() => seek(0)} aria-label="Voltar ao início" data-tip="Início">
              <SkipBack size={17} />
            </button>
            <button className="play-btn primary" onClick={togglePlay} data-testid="play" disabled={off} aria-keyshortcuts="Space">
              {playing ? <Pause size={17} fill="currentColor" aria-hidden /> : <Play size={17} fill="currentColor" aria-hidden />}
              {playing ? 'Pausar' : 'Assistir'}
            </button>
            <span className="time tnum" data-testid="player-time">
              {fmt(time)} / {fmt(total)}
            </span>
          </div>
          <input className="scrub" type="range" min={0} max={Math.max(0.01, total)} step={0.01} value={Math.min(time, total)} onChange={(e) => seek(e.target.valueAsNumber)} aria-label="Posição na prévia" />
          <button className="icon ghost" aria-pressed={safeZone} onClick={() => setSafeZone(!safeZone)} aria-label="Mostrar área segura do Reels" data-tip="Área segura do Reels">
            <Scan size={17} />
          </button>
        </div>
      </main>

      <aside className="inspector" ref={inspectorRef} aria-label="Detalhes">
        <h2 className="insp-title">Detalhes</h2>
        <div className="card" style={{display:'grid',gap:10,marginBottom:12}} data-testid="clip-and-format">
          <FormatSelector plan={plan} onChange={(n)=>apply(()=>n)} disabled={off || disabled} />
          <ClipList
            disabled={off || disabled}
            clips={plan.clips.map(c => ({ id:c.id, name:c.name || c.id, duration:c.duration, file: new File([], c.name) }))}
            onReorder={(next) => {
              const ordered = next.map(n => plan.clips.find(c => c.id === n.id)!).filter(Boolean);
              apply(p => reorderClipPlan(p, ordered, session.clipWords ?? {}));
            }}
            onRemove={(id) => {
              const remaining = plan.clips.filter(c => c.id !== id);
              if (remaining.length > 0) apply(p => reorderClipPlan(p, remaining, session.clipWords ?? {}));
            }}
            onAdd={onAddClips}
          />
        </div>
        {selectedEl ? (
          <ElementInspector plan={plan} refEl={selectedEl} onChange={(next)=>apply(()=>next)} onClose={()=>setSelectedEl(null)} onEditText={(t)=>apply((p)=>setElementText(p, selectedEl!, t))} editing={editingEl} setEditing={setEditingEl} />
        ) : cut && selectedCut !== null ? (
          <div className="cut-panel card" data-testid="cut-panel">
            <div className="card-head">
              <h3 className="section-title">
                <Scissors size={15} aria-hidden /> Trecho cortado
              </h3>
              <button className="icon sm ghost" onClick={() => setSelectedCut(null)} aria-label="Fechar">
                <X size={15} />
              </button>
            </div>
            <p className="hint">
              De {fmt(cut.start)} até {fmt(cut.end)} ({fmt(cut.end - cut.start)}) do vídeo original.
            </p>
            <button className="primary" onClick={() => apply((p) => restoreCut(p, ctx, selectedCut))} data-testid="restore-cut">
              Restaurar este trecho
            </button>
            <div className="edges">
              <label>
                Início do corte (s)
                <input key={`s${cut.start}`} type="number" step="0.05" min={0} defaultValue={cut.start} data-testid="cut-start" onBlur={(e) => setEdge('start', e.target.valueAsNumber)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
              </label>
              <span className="nudges">
                <button className="sm" onClick={() => nudge('start', -0.1)} data-testid="cut-start-minus">
                  −0,1 s
                </button>
                <button className="sm" onClick={() => nudge('start', 0.1)} data-testid="cut-start-plus">
                  +0,1 s
                </button>
              </span>
              <label>
                Fim do corte (s)
                <input key={`e${cut.end}`} type="number" step="0.05" min={0} defaultValue={cut.end} data-testid="cut-end" onBlur={(e) => setEdge('end', e.target.valueAsNumber)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
              </label>
              <span className="nudges">
                <button className="sm" onClick={() => nudge('end', -0.1)} data-testid="cut-end-minus">
                  −0,1 s
                </button>
                <button className="sm" onClick={() => nudge('end', 0.1)} data-testid="cut-end-plus">
                  +0,1 s
                </button>
              </span>
            </div>
          </div>
        ) : activeSelection ? (
          <RangePanel
            selection={activeSelection}
            range={range}
            total={total}
            onSelection={(out) => {
              setSelectedRange(null);
              setSelection(out);
            }}
            onRequest={requestRange}
            ai={ai}
            words={rangeWords}
            onClose={() => {
              setSelection(null);
              setSelectedRange(null);
            }}
            onSeek={seek}
            disabled={off}
          />
        ) : (
          <div className="card empty-insp">
            <MousePointerClick size={18} aria-hidden />
            <p className="hint">Clique num corte (listrado) na linha do tempo para restaurar ou ajustar, ou arraste na faixa Trechos para mudar só um pedaço.</p>

          </div>
        )}
        <ChangesPanel before={before} beforeLabel={beforeLabel} plan={plan} view={view} onView={setView} onSeek={seek} time={time} />
      </aside>

      <div className="tl-area">
        <Timeline
          durationSec={ctx.durationSec}
          plan={plan}
          cuts={cuts}
          peaks={peaks}
          time={time}
          playing={playing}
          selectedCut={selectedCut}
          onSeek={seek}
          onSelectCut={(i) => {
            setSelectedCut(i);
          }}
          selection={activeSelection}
          selectedRange={selectedRange}
          onSelection={(out) => {
            setSelectedCut(null);
            setSelectedRange(null);
            setSelection(out);
          }}
          onPickRange={(id) => {
            setSelectedCut(null);
            setSelectedRange(id);
            setSelection(null);
          }}
        />
      </div>

      <footer className="statusbar">
        <span data-testid="version" title={`Gerado em ${APP_BUILT_AT}`}>
          Motion4Free {VERSION_LABEL}
        </span>
        <span className="status-keys" aria-label="Atalhos de teclado">
          <span className="kbd">Espaço</span> tocar/pausar <span className="kbd">J</span>
          <span className="kbd">L</span> −1 s/+1 s <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> desfazer <span className="kbd">Ctrl</span>+<span className="kbd">Shift</span>+<span className="kbd">Z</span> refazer
        </span>
        <span className="status-privacy">Tudo no seu aparelho · nada é enviado</span>
      </footer>

      {exportOpen && (
        <div className="export-pop card" role="dialog" aria-label="Exportar vídeo" data-testid="export-panel">
          <div className="card-head">
            <h3 className="section-title">
              <Download size={15} aria-hidden /> Vídeo final
            </h3>
            <button className="icon sm ghost" onClick={() => setExportOpen(false)} aria-label="Fechar">
              <X size={15} />
            </button>
          </div>
          {exporting !== null && (
            <div className="export-progress" role="status">
              <div className="row-between">
                <span>Gerando o vídeo final…</span>
                <b className="tnum">{Math.round(exporting * 100)}%</b>
              </div>
              <div className="bar">
                <span style={{ width: `${Math.max(2, exporting * 100)}%` }} />
              </div>
              <p className="hint">Você pode continuar mexendo na página.</p>
            </div>
          )}
          {exportError && <ErrorBox error={exportError} kind="error" />}
          {result && exporting === null && (
            <section className="result">
              <video src={result.url} controls playsInline data-testid="result-video" />
              {result.degraded && <ErrorBox error={new AppError('SEM_H264', `formato do vídeo: ${result.codec}`)} kind="warning" />}
              {result.fontWarning && <ErrorBox error={new AppError('FONTE_FALHOU', result.fontWarning)} kind="warning" />}
              {result.emojiWarning && <ErrorBox error={new AppError('EMOJI_FALHOU', result.emojiWarning)} kind="warning" />}
              <a className="btn primary lg" href={result.url} download={result.name} data-testid="download" data-export-where={result.where} data-style={result.style}>
                <Download size={16} aria-hidden /> Baixar vídeo
              </a>
              <p className="hint result-name">{result.name}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}



function ElementInspector({ plan, refEl, onChange, onClose, onEditText, editing, setEditing }: { plan: import('../core/types').EditPlan; refEl: ElementRef; onChange: (n: import('../core/types').EditPlan)=>void; onClose: ()=>void; onEditText: (t:string)=>void; editing: ElementRef|null; setEditing: (r:ElementRef|null)=>void }) {
  const name = (() => { try { return elementName(plan, refEl); } catch { return 'Elemento'; } })();
  const [draft, setDraft] = useState('');
  const isEditing = editing && sameEl(editing, refEl);
  useEffect(() => {
    if (isEditing) {
      try {
        const { resolvePlan, sceneText } = require('../editorial/elements');
        const R = resolvePlan(plan);
        if (refEl.type === 'added') {
          const a = R.added.find((x:any)=> x.el.id===refEl.id);
          setDraft(a?.el.text ?? '');
        } else if (refEl.type === 'scene') {
          const s = R.scenes.find((x:any)=> x.key===refEl.key);
          setDraft(s ? (sceneText(s.scene) ?? '') : '');
        } else {
          const c = R.captions.find((x:any)=> x.key===refEl.key);
          setDraft(c?.caption.text ?? c?.base.text ?? '');
        }
      } catch { setDraft(''); }
    }
  }, [isEditing, plan, refEl]);
  return (
    <div className="card" data-testid="element-panel">
      <div className="card-head">
        <h3 className="section-title">{name}</h3>
        <button className="icon sm ghost" onClick={onClose} aria-label="Fechar"><X size={15} /></button>
      </div>
      <p className="hint">Arraste direto no vídeo para mover. Duplo clique para editar texto. Segure Shift para travar eixo.</p>
      {isEditing ? (
        <div className="edit-text">
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={3} data-testid="element-text-input" />
          <div className="row">
            <button className="primary sm" onClick={()=>{ onEditText(draft); setEditing(null); }}>Salvar</button>
            <button className="sm" onClick={()=>setEditing(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="sm" onClick={()=>setEditing(refEl)} data-testid="edit-text-btn">Editar texto</button>
      )}
      <div className="row" style={{marginTop:8}}>
        <button className="sm" onClick={()=>{
          try { const r = duplicateElement(plan, refEl); if (r) onChange(r.plan); } catch {}
        }} data-testid="duplicate-el">Duplicar</button>
        <button className="sm danger" onClick={()=>{
          try { onChange(deleteElement(plan, refEl)); onClose(); } catch {}
        }} data-testid="delete-el">Apagar</button>
      </div>
    </div>
  );
}
