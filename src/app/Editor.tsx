import { originalOutputSpans } from '../editorial/clip-source-map';
import { planSummary } from '../core/text';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Captions, FileText, Music, ChevronRight, Copy, CopyPlus, Download, Film, History, LayoutTemplate, Clapperboard, MousePointerClick, Palette, Smile, Type, Pause, Play, Scan, Scissors, SkipBack, Sparkles, SquareDashedMousePointer, SquareSplitHorizontal, Trash2, X } from 'lucide-react';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, Segment, TimeRange } from '../core/types';
import { PRESETS } from '../core/presets';
import { adjustCut, applyBrief, applyHook, applyRange, applyReferencePalette, applyStyle, editCaptionText, listCuts, restoreCut, type EditContext } from '../editorial/ops';
import type { RangeRequest } from '../editorial/range-interpret';
import { stylesOf } from '../editorial/ranges';
import { addVersion, removeVersion, type PlanVersion } from '../core/versions';
import { makeVariants } from '../editorial/variants';
import { keywordScore } from '../editorial/detect';
import { canRedo, canUndo, redo, undo, type History as EditHistory } from '../engine/history';
import { commitEdit } from '../editorial/commands';
import { outputDuration, outputToSource } from '../engine/timeline';
import type { DecodedAudio } from '../media/audio';
import { exportInBackground } from '../media/export-client';
import { ensureEmojiFont, ensureFonts } from '../media/fonts';
import { planUsesEmoji } from '../core/emoji';
import { ZOOM_LIMITS } from '../core/edits';
import { useAiSettings } from './AiOptions';
import { PROVIDERS } from '../ai/providers/registry';
import type { OpenedMedia } from '../media/input';
import { PlanPlayer } from '../media/player';
import { PreviewOverlay } from './PreviewOverlay';
import { addElement, copyElement, deleteElement, deleteMany, deleteSegment, duplicateElement, pasteElement, retimeElement, setElementTrack, segmentZoom, setElementText, setSegmentZoom, splitAt, trimSegment, type AddSpec, type ElementClip } from '../editorial/manual';
import { deleteOutRange, duplicateSegment, insertSegments, moveSegment, segmentOffsets } from '../editorial/sequence';
import type { ElementRef } from '../editorial/elements';
import { elementName, findElement, resolvePlan, sceneText, sameRef as sameEl } from '../editorial/elements';
import { ErrorBox } from './ErrorBox';
import { StageNotices } from './StageNotices';
import { ProgressView, useProgressClock } from './ProgressPanel';
import { exportProgress } from '../core/progress';
import { BriefPanel, HookPanel } from './BriefPanel';
import { TemplateGallery } from './Templates';
import { Timeline } from './Timeline';
import { EditTimeline, type TimelineActions } from './EditTimeline';
import { RangePanel } from './RangePanel';
import { ChangesPanel, ReferencePicker, VersionsPanel, type CompareView } from './Panels';
import { Transcript } from './Transcript';
import { SemanticCuePanel } from './SemanticCuePanel';
import { suggestSemanticWords, addSemanticWord, removeSemanticWord, reanchorSemanticWord, offsetSemanticWord, setSemanticWordEffect } from '../editorial/semantic-word-edits';
import { TopBar, type SaveState } from './TopBar';
import { VERSION_LABEL, APP_BUILT_AT } from '../version';
import { FormatSelector } from './FormatSelector';
import { formatOf } from '../core/formats';
import { FramingPanel } from './FramingPanel';
import { clipAt, placeWords, totalDuration } from '../engine/clips';
import { reorderClipPlan } from '../editorial/clip-ops';
import { combineAudios } from '../media/multi';
import { buildPeakIndex, waveformPeaks } from '../analysis/waveform';
import { ClipList } from './ClipList';
import { CaptionStylePanel, ElementsPanel, TextPanel } from './SidePanels';
import { AudioPanel } from './AudioPanel';
import { KeyframePanel } from './KeyframePanel';
import { MaskPanel } from './MaskPanel';
import { planCues, toSrt } from '../editorial/subtitles';
import { DEFAULT_SETUP, type CreativeSetup } from '../core/production';
import { StoryboardReview } from './production/StoryboardReview';
import { applyCreativeFinding } from '../editorial/creative-plan';
import { evaluateDraft, reviseCreativeDirection } from '../editorial/production';
import { CreativeSetupScreen } from './production/CreativeSetup';
import { DraftReview } from './production/DraftReview';
import { Dialog } from './Dialog';
import { EditorWorkspace, WorkspaceControls } from './workbench/EditorWorkspace';
import { MediaLibrary } from './workbench/MediaLibrary';
import { buildExportPreflight } from '../editorial/export-preflight';
import { CompositionGuideControls, GuideOverlay, useCompositionGuide } from './workbench/CompositionGuides';

export interface Session {
  sourceMaps?: import('../editorial/clip-source-map').ClipOrigins;
  file: Blob;
  fileName: string;
  media: OpenedMedia;
  audio: DecodedAudio | null;
  ctx: EditContext;
  silences: TimeRange[];
  warnings: AppError[];
  peaks: Float32Array | null;
  /** multi-clip: mapa de fontes por clipId e áudio combinado */
  faceTracks?: import('../media/face-analysis').FaceTracks;
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

type TabId = 'modelos' | 'texto' | 'elementos' | 'legendas' | 'midia' | 'audio' | 'ia' | 'cores' | 'versoes';
/** Menu da esquerda (v0.19), na ordem de CapCut/Canva: o visual pronto, o que se adiciona, a mídia, a IA e o histórico. */
const TABS: { id: TabId; label: string; title: string; about: string; Icon: typeof Play }[] = [
  { id: 'modelos', label: 'Modelos', title: 'Modelos', about: 'O visual do vídeo inteiro: letras, cores e animações. Um clique aplica; dá para desfazer.', Icon: LayoutTemplate },
  { id: 'texto', label: 'Texto', title: 'Texto', about: 'Títulos e frases na tela, onde está a agulha.', Icon: Type },
  { id: 'elementos', label: 'Elementos', title: 'Elementos', about: 'Emojis, setas e formas para chamar atenção.', Icon: Smile },
  { id: 'legendas', label: 'Legendas', title: 'Legendas', about: 'Posição, tamanho e cores das legendas, e o texto falado para corrigir.', Icon: Captions },
  { id: 'midia', label: 'Mídia', title: 'Mídia e formato', about: 'Seus vídeos, o formato de saída (Reels, quadrado, horizontal) e o enquadramento.', Icon: Clapperboard },
  { id: 'audio', label: 'Áudio', title: 'Música de fundo', about: 'Uma música por baixo da fala, com volume e abaixamento automático quando alguém fala.', Icon: Music },
  { id: 'ia', label: 'IA', title: 'Pedir com palavras', about: 'Diga o que quer mudar. Funciona sem IA; a IA é opcional.', Icon: Sparkles },
  { id: 'cores', label: 'Cores', title: 'Cores e marca', about: 'As cores do vídeo, ou as de uma imagem sua (logo, foto).', Icon: Palette },
  { id: 'versoes', label: 'Versões', title: 'Versões e variações', about: 'Crie variações para comparar, guarde versões e volte quando quiser.', Icon: History },
];


/** O que o Copiar/Recortar guardou: pedaços do vídeo ou um elemento (v0.17). */
type Clipboard = { kind: 'video'; segments: Segment[] } | { kind: 'element'; clip: ElementClip };
/** Seleção múltipla (v0.26): vários pedaços e elementos escolhidos com Ctrl/Shift + clique ou o botão Vários. */
export interface MultiSel {
  segs: number[];
  els: ElementRef[];
}
const NO_MULTI: MultiSel = { segs: [], els: [] };
type TlView = 'edicao' | 'original';
const TL_VIEW_KEY = 'm4f.timeline-view';
function loadTlView(): TlView {
  try {
    return localStorage.getItem(TL_VIEW_KEY) === 'original' ? 'original' : 'edicao';
  } catch {
    return 'edicao';
  }
}

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable || !!t.closest('[role="separator"]'));
};

interface EditorProps {
  session: Session;
  history: EditHistory<EditPlan>;
  onHistory: (h: EditHistory<EditPlan>) => void;
  onFaceTracks: (tracks: import('../media/face-analysis').FaceTracks) => void;
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
  noticeCount?: number;
  /** menu do projeto na barra do topo (v0.11: renomear, fechar, apagar, armazenamento) */
  projectMenu?: ReactNode;
  initialReview?: boolean;
  /** música de fundo decodificada (v0.26), ou null */
  music?: DecodedAudio | null;
  /** lê e guarda a música escolhida; lança AppError se não der */
  onPickMusic?: (file: File) => Promise<void>;
  /** a música salva do projeto ainda está sendo lida */
  musicLoading?: boolean;
}

export function Editor({ session, history, onHistory, onFaceTracks, versions, onVersions, disabled, saveState, asrModel, onReplaceFile, onAddClips, notices, noticeCount = 0, projectMenu, initialReview = false, music = null, onPickMusic, musicLoading = false }: EditorProps) {
  const plan = history.present;
  const latestFaceContext = useRef({ history, session, onFaceTracks, onHistory });
  latestFaceContext.current = { history, session, onFaceTracks, onHistory };
  const [faceProgress, setFaceProgress] = useState<number | null>(null);
  const [faceError, setFaceError] = useState<AppError | null>(null);
  const faceAbort = useRef<AbortController | null>(null);
  useEffect(() => () => { faceAbort.current?.abort(); }, [session.media]);
  const [reviewOpen, setReviewOpen] = useState(initialReview);
  const [directionDraft, setDirectionDraft] = useState<CreativeSetup | null>(null);
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
    return combineAudios(shown.clips, Object.fromEntries(session.clipAudios), session.clipSilences);
  }, [session, shown.clips]);
  const peaks = useMemo(() => shownAudio ? waveformPeaks(shownAudio.channels[0]!, 1200, true) : null, [shownAudio]);
  // onda real da linha do tempo Edição (v0.18): lida das amostras, nítida em qualquer zoom
  const peakIndex = useMemo(() => (shownAudio?.channels[0] ? buildPeakIndex(shownAudio.channels[0], shownAudio.sampleRate) : null), [shownAudio]);
  const range = selectedRange ? (plan.ranges.find((r) => r.id === selectedRange) ?? null) : null;
  const activeSelection = range ? range.out : selection;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PlanPlayer | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const guide = useCompositionGuide(plan.brief.production?.platform);
  const [selectedCut, setSelectedCut] = useState<number | null>(null);
  const [selectedEl, setSelectedEl] = useState<ElementRef | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [multi, setMulti] = useState<MultiSel>(NO_MULTI);
  const multiCount = multi.segs.length + multi.els.length;
  useEffect(() => {
    if (selectedCut !== null || selectedEl || selectedSeg !== null || activeSelection) setReviewOpen(false);
  }, [selectedCut, selectedEl, selectedSeg, activeSelection]);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [tlView, setTlViewState] = useState<TlView>(loadTlView);
  const setTlView = (v: TlView) => {
    setTlViewState(v);
    try {
      localStorage.setItem(TL_VIEW_KEY, v);
    } catch {
      /* sem armazenamento: a escolha vale só nesta aba */
    }
  };
  const [editingEl, setEditingEl] = useState<ElementRef | null>(null);
  const [editError, setEditError] = useState<AppError | null>(null);
  const [playerError, setPlayerError] = useState<AppError | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const exportProgressInfo = useMemo(() => (exporting === null ? null : exportProgress(exporting, 'Gerando o vídeo final')), [exporting]);
  // relógio aqui (não no painel): fechar e abrir o painel não zera o "passou"/"falta"
  const exportSnap = useProgressClock(exportProgressInfo);
  const [exportError, setExportError] = useState<AppError | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fontError, setFontError] = useState<AppError | null>(null);
  const [emojiError, setEmojiError] = useState<AppError | null>(null);
  // escolha de IA: vale para o pedido geral e para o pedido de trecho
  const ai = useAiSettings();
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
    const player = new PlanPlayer(session.media, shownAudio, canvasRef.current!, shownRef.current, 0.5, session.clipSources ?? undefined, session.faceTracks);
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

  // música de fundo (v0.26): o player mistura igual ao MP4
  useEffect(() => {
    playerRef.current?.setMusic(music);
  }, [music, session]);

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
        onHistory(commitEdit(history, next));
      } catch (err) {
        setEditError(toAppError(err));
      }
    },
    [history, onHistory],
  );

  /** Como apply, mas a operação também diz o que selecionar depois (pedaço colado, elemento novo...). */
  const run = useCallback(
    (op: (p: EditPlan) => { plan: EditPlan; seg?: number | null; el?: ElementRef | null }) => {
      try {
        const r = op(history.present);
        setEditError(null);
        if (r.plan !== history.present) onHistory(commitEdit(history, r.plan));
        if (r.seg !== undefined) setSelectedSeg(r.seg);
        if (r.el !== undefined) setSelectedEl(r.el);
        return true;
      } catch (err) {
        setEditError(toAppError(err));
        return false;
      }
    },
    [history, onHistory],
  );

  // pedaço selecionado que sumiu (desfazer, outro corte): solta a seleção
  useEffect(() => {
    if (selectedSeg !== null && selectedSeg >= plan.segments.length) setSelectedSeg(null);
  }, [plan.segments.length, selectedSeg]);
  useEffect(() => {
    if (selectedEl && !findElement(plan, selectedEl)) setSelectedEl(null);
  }, [plan, selectedEl]);
  useEffect(() => {
    setMulti((m) => {
      const segs = m.segs.filter((i) => i < plan.segments.length);
      const els = m.els.filter((r) => !!findElement(plan, r));
      return segs.length === m.segs.length && els.length === m.els.length ? m : { segs, els };
    });
  }, [plan]);

  const selectSeg = (i: number | null) => {
    if (i !== null) setReviewOpen(false);
    setMulti(NO_MULTI);
    setSelectedSeg(i);
    if (i !== null) {
      setSelectedCut(null);
      setSelectedEl(null);
    }
  };
  const selectEl = (ref: ElementRef | null) => {
    if (ref) setReviewOpen(false);
    setMulti(NO_MULTI);
    setSelectedEl(ref);
    if (ref) {
      setSelectedCut(null);
      setSelectedSeg(null);
    }
  };

  /**
   * Ctrl/Shift + clique (ou o modo Vários): põe ou tira um item da seleção. O que já estava escolhido
   * entra junto; com um item só, volta a ser a seleção normal (com os detalhes à direita).
   */
  const toggleMulti = (item: { seg: number } | { el: ElementRef }) => {
    setReviewOpen(false);
    setSelectedCut(null);
    setSelection(null);
    setSelectedRange(null);
    const segs = [...multi.segs];
    const els = [...multi.els];
    if (multiCount === 0) {
      if (selectedSeg !== null) segs.push(selectedSeg);
      if (selectedEl) els.push(selectedEl);
    }
    if ('seg' in item) {
      const k = segs.indexOf(item.seg);
      if (k >= 0) segs.splice(k, 1);
      else segs.push(item.seg);
    } else {
      const k = els.findIndex((r) => sameEl(r, item.el));
      if (k >= 0) els.splice(k, 1);
      else els.push(item.el);
    }
    const one = segs.length + els.length === 1;
    setSelectedSeg(one && segs.length ? segs[0]! : null);
    setSelectedEl(one && els.length ? els[0]! : null);
    setMulti(one ? NO_MULTI : { segs: segs.sort((a, b) => a - b), els });
  };

  /** Copiar: o pedaço selecionado (com a fala, legendas e animações dele) ou o elemento selecionado. */
  const copySel = (p: EditPlan): Clipboard => {
    if (multiCount > 0) {
      if (multi.els.length > 0) throw new AppError('VARIOS_SELECIONADOS', `${multi.els.length} elemento(s)`);
      return { kind: 'video', segments: multi.segs.flatMap((i) => (p.segments[i] ? [{ ...p.segments[i]! }] : [])) };
    }
    if (selectedEl) return { kind: 'element', clip: copyElement(p, selectedEl) };
    const seg = selectedSeg !== null ? p.segments[selectedSeg] : undefined;
    if (seg) return { kind: 'video', segments: [{ ...seg }] };
    throw new AppError('NADA_SELECIONADO');
  };
  const removeSel = (p: EditPlan): { plan: EditPlan; seg?: null; el?: null } => {
    if (multiCount > 0) {
      const next = deleteMany(p, ctx, multi.segs, multi.els);
      setMulti(NO_MULTI);
      return { plan: next, seg: null, el: null };
    }
    // trecho marcado na faixa Trechos (ainda sem pedido): apaga só ele e o resto encosta
    if (!selectedEl && selectedSeg === null && selection && !selectedRange) {
      const next = deleteOutRange(p, ctx, selection);
      setSelection(null);
      return { plan: next, seg: null, el: null };
    }
    if (selectedEl) return { plan: deleteElement(p, selectedEl), el: null };
    if (selectedSeg !== null && p.segments[selectedSeg]) return { plan: deleteSegment(p, ctx, selectedSeg), seg: null };
    throw new AppError('NADA_SELECIONADO');
  };
  const tl: TimelineActions = {
    split: () => run((p) => ({ plan: splitAt(p, ctx, playerRef.current?.currentTime ?? time), seg: null })),
    copy: () => {
      try {
        setClipboard(copySel(history.present));
        setEditError(null);
      } catch (err) {
        setEditError(toAppError(err));
      }
    },
    cut: () => {
      try {
        const c = copySel(history.present);
        if (run(removeSel)) setClipboard(c);
      } catch (err) {
        setEditError(toAppError(err));
      }
    },
    paste: () =>
      run((p) => {
        if (!clipboard) throw new AppError('NADA_COPIADO');
        const at = playerRef.current?.currentTime ?? time;
        if (clipboard.kind === 'video') {
          const r = insertSegments(p, ctx, clipboard.segments, at);
          return { plan: r.plan, seg: r.index, el: null };
        }
        const r = pasteElement(p, ctx, clipboard.clip, at);
        return { plan: r.plan, el: { type: 'added', id: r.id }, seg: null };
      }),
    duplicate: () =>
      run((p) => {
        if (multiCount > 0) throw new AppError('VARIOS_SELECIONADOS', `${multiCount} itens`);
        if (selectedEl) {
          if (selectedEl.type === 'caption') throw new AppError('LEGENDA_NAO_COPIA');
          const r = duplicateElement(p, selectedEl);
          if (!r) throw new AppError('ELEMENTO_SUMIU', elementName(p, selectedEl));
          return { plan: r.plan, el: { type: 'added', id: r.id } };
        }
        if (selectedSeg === null) throw new AppError('NADA_SELECIONADO');
        const r = duplicateSegment(p, ctx, selectedSeg);
        return { plan: r.plan, seg: r.index };
      }),
    remove: () => run(removeSel),
    canPaste: !!clipboard,
  };

  /** Adiciona texto, emoji ou forma na agulha (3 s) e já deixa escolhido para mover. */
  const addAt = (spec: AddSpec) =>
    run((p) => {
      const r = addElement(p, ctx, spec, playerRef.current?.currentTime ?? time);
      return { plan: r.plan, el: { type: 'added', id: r.id }, seg: null };
    });

  /** Pedido de trecho: devolve o erro para o painel do trecho mostrar. */
  const requestRange = (req: RangeRequest): AppError | null => {
    if (!activeSelection) return null;
    try {
      const target = selectedRange ? { id: selectedRange } : activeSelection;
      const r = applyRange(history.present, ctx, target, req);
      onHistory(commitEdit(history, r.plan));
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

  /** #118: três variações do vídeo atual, guardadas como versões para comparar e escolher. */
  const createVariants = (): { error: AppError | null; notes: string[] } => {
    try {
      const variants = makeVariants(plan, ctx);
      let list = versions;
      const now = new Date();
      for (const v of variants) list = addVersion(list, v.name, v.plan, now);
      onVersions(list);
      return { error: null, notes: variants.map((v) => `${v.name}: ${v.why}`) };
    } catch (err) {
      return { error: toAppError(err), notes: [] };
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

  async function trackFaces(target: string | null): Promise<void> {
    if (faceAbort.current) return;
    const ctrl = new AbortController();
    faceAbort.current = ctrl;
    setFaceProgress(0); setFaceError(null);
    try {
      const { analyzeFaces } = await import('../media/face-analysis');
      const available = session.clipSources ?? new Map([[plan.clips[0]!.id, { id: plan.clips[0]!.id, video: session.media.video, width: session.media.width, height: session.media.height }]]);
      const refs = plan.clips.filter((clip) => !target || clip.id === target);
      const ids = new Set(refs.map((clip) => clip.id));
      const sources = new Map([...available].filter(([id]) => ids.has(id)));
      const result = await analyzeFaces(sources, new Map(refs.map((clip) => [clip.id, clip.duration])), ctrl.signal, setFaceProgress);
      if (ctrl.signal.aborted) return;
      const latest = latestFaceContext.current;
      if (latest.session.media !== session.media) return;
      const tracks = { ...latest.session.faceTracks };
      for (const id of ids) delete tracks[id];
      Object.assign(tracks, result.tracks);
      if (result.withoutFaces.length) setFaceError(new AppError('ROSTOS_AUSENTES', result.withoutFaces.join(', ')));
      const current = latest.history.present;
      const nextHistory = commitEdit(latest.history, { ...current, clips: current.clips.map((clip) => {
        if (!ids.has(clip.id)) return clip;
        return { ...clip, framing: { ...(clip.framing ?? current.framing), mode: result.tracks[clip.id] ? 'smart' as const : 'fill' as const } };
      }) });
      latest.onFaceTracks(tracks);
      latest.onHistory(nextHistory);
    } catch (err) {
      if (!ctrl.signal.aborted) setFaceError(toAppError(err, 'ROSTOS_FALHOU'));
    } finally {
      if (faceAbort.current === ctrl) { faceAbort.current = null; setFaceProgress(null); }
    }
  }

  const doUndo = useCallback(() => onHistory(undo(history)), [history, onHistory]);
  const doRedo = useCallback(() => onHistory(redo(history)), [history, onHistory]);
  const seek = useCallback((t: number) => playerRef.current?.seek(t), []);
  const togglePlay = useCallback(() => (playerRef.current?.isPlaying ? playerRef.current.pause() : playerRef.current?.play()), []);

  // Atalhos: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; espaço toca/pausa; J e L voltam e avançam 1 s; K pausa;
  // ← e → andam um quadro (com Shift, 1 s); Home e End vão ao início e ao fim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.isComposing || document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        // enquanto o app trabalha (clipes entrando, exportação), desfazer misturaria o histórico
        if (disabled) return;
        // texto selecionado na página (ex.: detalhes de um erro): Ctrl+C copia o texto, como sempre
        const textSelected = !!window.getSelection?.()?.toString();
        if (k === 'z' && !e.shiftKey) doUndo();
        else if ((k === 'z' && e.shiftKey) || k === 'y') doRedo();
        // sem nada escolhido (ou nada copiado), o atalho fica com o navegador, sem aviso de erro
        else if (k === 'c' && !textSelected && !e.shiftKey && keys.current.hasSel) keys.current.copy();
        else if (k === 'x' && !textSelected && !e.shiftKey && keys.current.hasSel) keys.current.cut();
        else if (k === 'v' && !e.shiftKey && keys.current.canPaste) keys.current.paste();
        else if (k === 'd' && !e.shiftKey && keys.current.hasSel) keys.current.duplicate();
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      const onControl = (e.target as HTMLElement)?.closest?.('button, a, summary, [role="button"], [role="tab"], label');
      if (!disabled && k === 's' && !e.shiftKey) {
        e.preventDefault();
        keys.current.split();
        return;
      }
      if (!disabled && (k === 'delete' || k === 'backspace') && keys.current.hasDel) {
        e.preventDefault();
        keys.current.remove();
        return;
      }
      // Esc tira qualquer seleção: pedaço, elemento, corte ou trecho (uma seleção só para prévia e linha do tempo)
      if (k === 'escape' && keys.current.hasAny) {
        keys.current.clear();
        return;
      }
      if (k === ' ' && !onControl) {
        e.preventDefault();
        togglePlay();
      } else if (k === 'k') playerRef.current?.pause();
      else if (k === 'j') seek((playerRef.current?.currentTime ?? 0) - 1);
      else if (k === 'l') seek((playerRef.current?.currentTime ?? 0) + 1);
      else if ((k === 'arrowleft' || k === 'arrowright') && !onControl && !(e.target as HTMLElement)?.closest?.('[role="slider"], [role="listbox"], [role="tablist"]')) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / Math.max(1, history.present.output.fps);
        playerRef.current?.pause();
        seek((playerRef.current?.currentTime ?? 0) + (k === 'arrowleft' ? -step : step));
      } else if ((k === 'home' || k === 'end') && !onControl) {
        e.preventDefault();
        seek(k === 'home' ? 0 : (playerRef.current?.duration ?? 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo, togglePlay, seek, disabled, history.present.output.fps]);

  // os atalhos leem sempre as ações e a seleção atuais (o ouvinte do teclado não é refeito a cada mudança)
  const keys = useRef({ ...tl, hasSel: false, hasDel: false, hasAny: false, clear: () => {} });
  keys.current = {
    ...tl,
    hasSel: selectedSeg !== null || !!selectedEl || multiCount > 0,
    hasDel: selectedSeg !== null || !!selectedEl || multiCount > 0 || (!!selection && !selectedRange),
    hasAny: selectedSeg !== null || !!selectedEl || selectedCut !== null || !!activeSelection || selectedRange !== null || multiCount > 0,
    clear: () => {
      setMulti(NO_MULTI);
      setSelectedSeg(null);
      setSelectedEl(null);
      setSelectedCut(null);
      setSelection(null);
      setSelectedRange(null);
    },
  };

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
      const multiAudio = session.clipAudios ? combineAudios(plan.clips, Object.fromEntries(session.clipAudios), session.clipSilences) : session.audio;
      const available = multiSources ? new Set(multiSources.keys()) : new Set([plan.clips[0]!.id]);
      buildExportPreflight(plan, available, multiAudio !== null || (!!music && !!plan.music));
      const out = isMulti
        ? await (await import('../media/export')).exportPlanMulti(multiSources!, multiAudio, plan, { music, faceTracks: session.faceTracks, onProgress: (f) => setExporting(f) }).then(r => ({ ...r, where: 'main' as const }))
        : await exportInBackground(session.file, session.media, session.audio, plan, (f) => setExporting(f), music, session.faceTracks);
      if (result) URL.revokeObjectURL(result.url);
      const base = session.fileName.replace(/\.[^.]+$/, '');
      setResult({ url: URL.createObjectURL(out.blob), name: `${base}-${plan.style.id}-motion4free.mp4`, degraded: out.degraded, codec: out.codec, where: out.where, style: plan.style.name, fontWarning: out.fontWarning, emojiWarning: out.emojiWarning });
    } catch (err) {
      setExportError(toAppError(err, 'EXPORTACAO_FALHOU'));
    } finally {
      setExporting(null);
    }
  }

  // legenda em arquivo (v0.26): o mesmo texto e tempo do vídeo editado
  const [srtError, setSrtError] = useState<AppError | null>(null);
  function downloadSrt() {
    const cues = planCues(plan);
    if (!cues.length) {
      setSrtError(new AppError('LEGENDA_SEM_TEXTO'));
      return;
    }
    setSrtError(null);
    const url = URL.createObjectURL(new Blob([toSrt(cues)], { type: 'application/x-subrip;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.fileName.replace(/\.[^.]+$/, '')}-legendas.srt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const openDirection = () => {
    playerRef.current?.pause();
    setDirectionDraft({ ...structuredClone(plan.brief.production ?? DEFAULT_SETUP), prompt: plan.brief.prompt, format: formatOf(plan.output), preset: plan.style.id as CreativeSetup['preset'], font: plan.style.type.text.family, motion: plan.style.motion.intensity, transition: plan.style.transition, accent: plan.style.palette.accent.slice(0, 7).toUpperCase() });
  };

  return (
    <EditorWorkspace inspectionKey={selectedEl ? JSON.stringify(selectedEl) : selectedSeg !== null ? `segment-${selectedSeg}` : selectedCut !== null ? `cut-${selectedCut}` : reviewOpen ? 'review' : ''}>
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
        workspaceControls={<WorkspaceControls />}
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
          <div role="tabpanel" id="panel-texto" aria-labelledby="tab-texto" hidden={tab !== 'texto'}>
            <TextPanel onAdd={addAt} disabled={off} />
          </div>
          <div role="tabpanel" id="panel-elementos" aria-labelledby="tab-elementos" hidden={tab !== 'elementos'}>
            <ElementsPanel onAdd={addAt} disabled={off} />
          </div>
          <div role="tabpanel" id="panel-legendas" aria-labelledby="tab-legendas" hidden={tab !== 'legendas'} className="stack">
            <details className="fold" open>
              <summary>Estilo das legendas</summary>
              <CaptionStylePanel plan={plan} onApply={apply} disabled={off} />
            </details>
            <details className="fold" open>
              <summary>Texto falado</summary>
              {asrModel && (
                <p className="asr-model" data-testid="asr-model">
                  <Captions size={14} aria-hidden /> Legenda feita com {asrModel}.
                </p>
              )}
              <SemanticCuePanel plan={plan} words={ctx.words} time={time} disabled={off} onAdd={word => apply(p => addSemanticWord(p,word))} onRemove={id => apply(p => removeSemanticWord(p,id))} onReanchor={(id,word)=>apply(p=>reanchorSemanticWord(p,id,word))} onOffset={(id,frames)=>apply(p=>offsetSemanticWord(p,id,frames))} onEffect={(id,effect)=>apply(p=>setSemanticWordEffect(p,id,effect))} onSeek={seek} onSuggest={() => apply(p => suggestSemanticWords(p, ctx.words, keywordScore).reduce((acc, w) => addSemanticWord(acc, w), p))} />
              <Transcript words={ctx.words} captions={plan.captions} segments={plan.segments} time={time} playing={playing} onSeek={seek} onEdit={(id, text) => apply((p) => editCaptionText(p, id, text))} disabled={off} />
            </details>
            <details className="fold" open>
              <summary>Legenda em arquivo</summary>
              <p className="hint">Um arquivo .srt com as legendas do vídeo editado, já corrigidas, para enviar ao YouTube ou abrir em outro editor.</p>
              <button type="button" className="sm" disabled={off} onClick={downloadSrt} data-testid="download-srt">
                <FileText size={14} aria-hidden /> Baixar legenda (.srt)
              </button>
              {srtError && <ErrorBox error={srtError} kind="warning" onDismiss={() => setSrtError(null)} />}
            </details>
          </div>
          <div role="tabpanel" id="panel-midia" aria-labelledby="tab-midia" hidden={tab !== 'midia'} className="stack" data-testid="clip-and-format">
            <MediaLibrary assets={plan.clips.map(clip => {
              const opened = session.openedClips?.find(source => source.id === clip.id);
              const single = plan.clips.length === 1 && !session.clipSources;
              return { id: clip.id, name: clip.name || session.fileName, duration: clip.duration, file: opened?.file ?? (single ? session.file : null), media: opened?.media ?? (single ? session.media : null) };
            })} disabled={off || disabled} onSelect={(id) => {
              let offset = 0;
              for (const [index, segment] of plan.segments.entries()) {
                if (clipAt(plan.clips, segment.srcStart + 0.000001)?.id === id) { selectSeg(index); seek(offset); break; }
                offset += segment.srcEnd - segment.srcStart;
              }
            }} />
            <ClipList
              disabled={off || disabled}
              clips={plan.clips.map((c) => ({ id: c.id, name: c.name || c.id, duration: c.duration, file: new File([], c.name) }))}
              onReorder={(next) => {
                const ordered = next.map((n) => plan.clips.find((c) => c.id === n.id)!).filter(Boolean);
                apply((p) => reorderClipPlan(p, ordered, session.clipWords ?? {}));
              }}
              onRemove={(id) => {
                const remaining = plan.clips.filter((c) => c.id !== id);
                if (remaining.length > 0) apply((p) => reorderClipPlan(p, remaining, session.clipWords ?? {}));
              }}
              onAdd={onAddClips}
            />
            {session.sourceMaps && <details className="fold"><summary>Onde este clipe aparece na gravação original</summary>
              <p className="hint">A gravação original não foi alterada. Para ampliar além deste arquivo derivado, volte ao Criador de Clipes com a gravação original.</p>
              {originalOutputSpans(plan, session.sourceMaps).map((span, i) => <p className="hint" key={i}>{fmt(span.sourceStart)}–{fmt(span.sourceEnd)} no original → {fmt(span.outputStart)}–{fmt(span.outputEnd)} nesta edição.</p>)}
            </details>}
            <FormatSelector plan={plan} onChange={(n) => apply(() => n)} disabled={off || disabled} />
            <FramingPanel plan={plan} multi={!!session.clipSources && session.clipSources.size > 0} onChange={(n) => apply(() => n)} hasFaceTracks={!!session.faceTracks && Object.keys(session.faceTracks).length > 0} onTrackFaces={(target) => void trackFaces(target)} faceProgress={faceProgress} onCancelFaces={() => faceAbort.current?.abort()} disabled={off || disabled || faceProgress !== null} />
            {faceError && <ErrorBox error={faceError} kind="warning" onDismiss={() => setFaceError(null)} />}
            <MaskPanel plan={plan} onApply={apply} disabled={off || disabled} />
          </div>
          <div role="tabpanel" id="panel-audio" aria-labelledby="tab-audio" hidden={tab !== 'audio'} className="stack">
            <AudioPanel plan={plan} loaded={!!music} loading={musicLoading} onPick={onPickMusic ?? (async () => { throw new AppError('MUSICA_NAO_SALVA', 'sem projeto'); })} onApply={apply} disabled={off || disabled} />
          </div>
          <div role="tabpanel" id="panel-ia" aria-labelledby="tab-ia" hidden={tab !== 'ia'} className="stack">
            <BriefPanel plan={plan} words={ctx.words} onBrief={(b) => apply((p) => applyBrief(p, ctx, b))} onHook={(h) => apply((p) => applyHook(p, ctx, h))} onStyle={(id) => apply((p) => applyStyle(p, ctx, id))} disabled={off} />
            <details className="fold" open data-testid="fold-gancho">
              <summary>Gancho: a frase que abre o vídeo</summary>
              <HookPanel plan={plan} words={ctx.words} onHook={(h) => apply((p) => applyHook(p, ctx, h))} disabled={off} />
            </details>
            <details className="fold" open data-testid="fold-trechos">
              <summary>Mudar só um pedaço do vídeo</summary>
              <p className="hint">Arraste na faixa Trechos da linha do tempo, ou use o botão. O pedido do pedaço aparece à direita.</p>
              <button type="button" onClick={selectFromNow} data-testid="range-new" disabled={off}>
                <SquareDashedMousePointer size={15} aria-hidden /> Escolher 3 s a partir de agora ({fmt(time)})
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
            </details>
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
              onVariants={createVariants}
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
          {plan.brief.production && <button className="ghost sm" onClick={() => setReviewOpen(value => !value)} data-testid="review-draft">{reviewOpen ? 'Ocultar resumo' : 'Revisar rascunho'}</button>}
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
        <StageNotices count={noticeCount + Number(!!playerError) + Number(!!fontError) + Number(!!emojiError) + Number(!!editError)}>
          {notices}
          {playerError && <ErrorBox error={playerError} kind="warning" />}
          {fontError && <ErrorBox error={fontError} kind="warning" />}
          {emojiError && <ErrorBox error={emojiError} kind="warning" />}
          {editError && <ErrorBox error={editError} kind="error" />}
        </StageNotices>
        <div className="viewer">
          <div className="canvas-box" style={{ ['--ar' as string]: plan.output.width / plan.output.height }} data-format={`${plan.output.width}x${plan.output.height}`}>
            <canvas ref={canvasRef} data-testid="player-canvas" onClick={togglePlay} />
            <PreviewOverlay
              plan={plan}
              time={time}
              selected={selectedEl}
              onSelect={selectEl}
              onChange={(next) => apply(() => next)}
              onPreview={(next) => playerRef.current?.setPlan(next ?? shownRef.current, shownAudio)}
              onError={setEditError}
              onEmptyClick={togglePlay}
              canvasRef={canvasRef}
              onEditText={setEditingEl}
              disabled={off || view === 'antes'}
            />
            <GuideOverlay state={guide} portrait={plan.output.height > plan.output.width} />
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
          <CompositionGuideControls state={guide} />
        </div>
      </main>

      <aside className="inspector" ref={inspectorRef} aria-label="Detalhes">
        {reviewOpen && <DraftReview editorial={evaluateDraft(plan, ctx)} onCustomize={() => setReviewOpen(false)} onExport={() => void onExport()} onRevise={openDirection} disabled={disabled || off} />}
        {reviewOpen && <StoryboardReview plan={plan} onSeek={seek} onApply={id => apply(p => applyCreativeFinding(p, id))} disabled={disabled || off} />}
        {!reviewOpen && plan.brief.production && <button className="sm" onClick={openDirection} disabled={off}>Direção criativa</button>}
        <div hidden={reviewOpen}>
        <h2 className="insp-title">Detalhes</h2>
        {selectedEl ? (
          <ElementInspector
            plan={plan}
            refEl={selectedEl}
            onApply={apply}
            actions={tl}
            onClose={() => setSelectedEl(null)}
            onEditText={(t) => apply((p) => setElementText(p, selectedEl!, t))}
            editing={editingEl}
            setEditing={setEditingEl}
            onSeek={seek}
            time={time}
            disabled={off}
          />
        ) : selectedSeg !== null && plan.segments[selectedSeg] ? (
          <SegmentInspector
            plan={plan}
            ctx={ctx}
            index={selectedSeg}
            time={time}
            multi={plan.clips.length > 1}
            onApply={apply}
            onMove={(to) => run((p) => ({ plan: moveSegment(p, ctx, selectedSeg, to), seg: Math.max(0, Math.min(p.segments.length - 1, to)) }))}
            actions={tl}
            onSeek={seek}
            onClose={() => setSelectedSeg(null)}
            disabled={off}
          />
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
            revision={plan}
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
            <p className="hint">
              Clique num pedaço do vídeo, numa legenda ou num elemento da linha do tempo para editar. Arraste para mudar de lugar, puxe as pontas para aparar, e use <b>S</b> para dividir na agulha. A tesoura entre dois pedaços abre o corte para restaurar.
            </p>

          </div>
        )}
        <ChangesPanel before={before} beforeLabel={beforeLabel} plan={plan} view={view} onView={setView} onSeek={seek} time={time} />
        </div>
      </aside>

      <div className="tl-area">
        {tlView === 'edicao' ? (
          <EditTimeline
            plan={plan}
            peakIndex={peakIndex}
            time={time}
            playing={playing}
            cuts={cuts}
            selectedSeg={selectedSeg}
            selectedEl={selectedEl}
            onSeek={seek}
            onSelectSeg={selectSeg}
            onSelectEl={selectEl}
            multi={multi}
            onToggle={toggleMulti}
            canRemove={selectedSeg !== null || !!selectedEl || multiCount > 0 || (!!selection && !selectedRange)}
            onSelectCut={(i) => {
              setSelectedSeg(null);
              setSelectedEl(null);
              setSelectedCut(i);
            }}
            onTrim={(i, edge, src) => apply((p) => trimSegment(p, ctx, i, edge, src))}
            onMoveSeg={(from, to) => run((p) => ({ plan: moveSegment(p, ctx, from, to), seg: to }))}
            onRetime={(ref, out, track) =>
              apply((p) => {
                let n = out ? retimeElement(p, ref, out) : p;
                if (track !== null && ref.type === 'added') n = setElementTrack(n, ref.id, track);
                return n;
              })
            }
            selection={activeSelection}
            selectedRange={selectedRange}
            onSelection={(out) => {
              setSelectedCut(null);
              setSelectedSeg(null);
              setSelectedEl(null);
              setSelectedRange(null);
              setSelection(out);
            }}
            onPickRange={(id) => {
              setSelectedCut(null);
              setSelectedSeg(null);
              setSelectedEl(null);
              setSelectedRange(id);
              setSelection(null);
            }}
            actions={tl}
            viewSwitch={<ViewSwitch view={tlView} onView={setTlView} />}
            disabled={off || disabled}
          />
        ) : (
        <Timeline
          viewSwitch={<ViewSwitch view={tlView} onView={setTlView} />}
          durationSec={ctx.durationSec}
          plan={plan}
          cuts={cuts}
          peaks={peaks}
          time={time}
          playing={playing}
          selectedCut={selectedCut}
          onSeek={seek}
          onSelectCut={(i) => {
            setSelectedSeg(null);
            setSelectedEl(null);
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
        )}
      </div>

      <footer className="statusbar">
        <span data-testid="version" title={`Gerado em ${APP_BUILT_AT}`}>
          Motion4Free {VERSION_LABEL}
        </span>
        <span className="status-keys" aria-label="Atalhos de teclado">
          <span className="kbd">Espaço</span> tocar/pausar <span className="kbd">J</span>
          <span className="kbd">L</span> −1 s/+1 s <span className="kbd">←</span>
          <span className="kbd">→</span> um quadro <span className="kbd">S</span> dividir <span className="kbd">Ctrl</span>+<span className="kbd">C</span>/<span className="kbd">X</span>/<span className="kbd">V</span> copiar/recortar/colar <span className="kbd">Del</span> apagar <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> desfazer <span className="kbd">Esc</span> tirar seleção <span className="kbd">+</span><span className="kbd">−</span><span className="kbd">0</span> zoom
        </span>
        <span className="status-privacy" data-testid="status-privacy">{ai.mode === 'provedor' && ai.provider ? `Vídeo no seu aparelho · pedidos por texto vão para ${PROVIDERS[ai.provider].name}` : 'Tudo no seu aparelho · nada é enviado'}</span>
      </footer>

      {directionDraft && <Dialog title="Rever direção criativa" onClose={() => setDirectionDraft(null)} wide testId="direction-dialog"><div className="direction-dialog"><CreativeSetupScreen revision value={directionDraft} onChange={setDirectionDraft} onBack={() => setDirectionDraft(null)} onComplete={(setup) => { apply(currentPlan => reviseCreativeDirection(currentPlan, ctx, setup)); setDirectionDraft(null); setReviewOpen(true); }} /></div></Dialog>}
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
          {exportSnap && (
            <div className="export-progress">
              <ProgressView snap={exportSnap} testId="export-progress" />
              <p className="hint">Você pode continuar mexendo na página.</p>
            </div>
          )}
          {exportError && <ErrorBox error={exportError} kind="error" />}
          {!shownAudio && <p className="hint">Este vídeo será exportado sem áudio.</p>}
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
    </EditorWorkspace>
  );
}

/** Edição | Original: a linha do tempo do vídeo final (editar) ou a da gravação inteira, com os cortes. */
function ViewSwitch({ view, onView }: { view: TlView; onView: (v: TlView) => void }) {
  return (
    <div className="segmented tl-view" role="group" aria-label="Vista da linha do tempo">
      <button className="sm" aria-pressed={view === 'edicao'} onClick={() => onView('edicao')} data-testid="tl-view-edit" data-tip="O vídeo final, para editar: dividir, mover, aparar, copiar e colar">
        Edição
      </button>
      <button className="sm" aria-pressed={view === 'original'} onClick={() => onView('original')} data-testid="tl-view-original" data-tip="A gravação inteira, com o que foi cortado (listrado)">
        Original
      </button>
    </div>
  );
}

/** Campo de segundos que só aplica ao sair dele ou com Enter (não cria uma entrada do desfazer por tecla). */
function SecondsField({ label, value, onCommit, testId, disabled }: { label: string; value: number; onCommit: (v: number) => void; testId: string; disabled?: boolean }) {
  return (
    <label>
      {label}
      <input
        key={`${testId}${value}`}
        type="number"
        step="0.05"
        min={0}
        defaultValue={Math.round(value * 100) / 100}
        data-testid={testId}
        disabled={disabled}
        onBlur={(e) => Number.isFinite(e.target.valueAsNumber) && Math.abs(e.target.valueAsNumber - value) > 1e-3 && onCommit(e.target.valueAsNumber)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

/** Painel do pedaço do vídeo escolhido na linha do tempo: tempos, zoom, dividir, mover, duplicar, apagar. */
function SegmentInspector({ plan, ctx, index, time, multi, onApply, onMove, actions, onSeek, onClose, disabled }: { plan: EditPlan; ctx: EditContext; index: number; time: number; multi: boolean; onApply: (op: (p: EditPlan) => EditPlan) => void; onMove: (to: number) => void; actions: TimelineActions; onSeek: (t: number) => void; onClose: () => void; disabled: boolean }) {
  const s = plan.segments[index]!;
  const at = segmentOffsets(plan.segments)[index]!;
  const len = s.srcEnd - s.srcStart;
  const zoom = segmentZoom(plan, index);
  const inside = time >= at && time < at + len;
  const home = multi ? clipAt(plan.clips, s.srcStart) : null;
  const clip = home ? plan.clips[home.index] : null;
  return (
    <div className="card seg-panel" data-testid="segment-panel">
      <div className="card-head">
        <h3 className="section-title">
          <Film size={15} aria-hidden /> Pedaço {index + 1} de {plan.segments.length}
        </h3>
        <button className="icon sm ghost" onClick={onClose} aria-label="Fechar">
          <X size={15} />
        </button>
      </div>
      <p className="hint">
        No vídeo final: de {fmt(at)} a {fmt(at + len)} ({fmt(len)}). Da gravação{clip ? ` “${clip.name}”` : ''}: {fmt(s.srcStart)} a {fmt(s.srcEnd)}.
      </p>
      <div className="row wrap">
        <button className="sm" onClick={() => onSeek(at)} data-testid="seg-goto">
          <Play size={13} aria-hidden /> Ir para o início
        </button>
        <button className="sm" onClick={actions.split} disabled={disabled || !inside} title={inside ? 'Divide este pedaço na agulha' : 'Coloque a agulha dentro deste pedaço para dividir'} data-testid="seg-split">
          <SquareSplitHorizontal size={13} aria-hidden /> Dividir na agulha
        </button>
      </div>
      <div className="edges">
        <SecondsField label="Começa na gravação (s)" value={s.srcStart} testId="seg-start" disabled={disabled} onCommit={(v) => onApply((p) => trimSegment(p, ctx, index, 'start', v))} />
        <SecondsField label="Termina na gravação (s)" value={s.srcEnd} testId="seg-end" disabled={disabled} onCommit={(v) => onApply((p) => trimSegment(p, ctx, index, 'end', v))} />
      </div>
      <label className="seg-zoom">
        <span className="row-between">
          <span>Zoom neste pedaço</span>
          <b className="tnum">{zoom === null ? 'nenhum' : `${zoom.toFixed(2).replace('.', ',')}×`}</b>
        </span>
        <input
          type="range"
          min={1}
          max={ZOOM_LIMITS.max}
          step={0.05}
          defaultValue={zoom ?? 1}
          key={`z${index}-${zoom}`}
          disabled={disabled}
          aria-label="Zoom neste pedaço"
          data-testid="seg-zoom"
          onPointerUp={(e) => onApply((p) => setSegmentZoom(p, index, e.currentTarget.valueAsNumber <= 1.001 ? null : e.currentTarget.valueAsNumber))}
          onKeyUp={(e) => onApply((p) => setSegmentZoom(p, index, e.currentTarget.valueAsNumber <= 1.001 ? null : e.currentTarget.valueAsNumber))}
        />
      </label>
      <div className="row wrap">
        <button className="sm" onClick={() => onMove(index - 1)} disabled={disabled || index === 0} data-testid="seg-move-left">
          <ArrowLeft size={13} aria-hidden /> Mover para antes
        </button>
        <button className="sm" onClick={() => onMove(index + 1)} disabled={disabled || index === plan.segments.length - 1} data-testid="seg-move-right">
          Mover para depois <ArrowRight size={13} aria-hidden />
        </button>
      </div>
      <div className="row wrap">
        <button className="sm" onClick={actions.copy} disabled={disabled} data-testid="seg-copy">
          <Copy size={13} aria-hidden /> Copiar
        </button>
        <button className="sm" onClick={actions.duplicate} disabled={disabled} data-testid="seg-duplicate">
          <CopyPlus size={13} aria-hidden /> Duplicar
        </button>
        <button className="sm danger" onClick={actions.remove} disabled={disabled || plan.segments.length === 1} data-testid="seg-delete">
          <Trash2 size={13} aria-hidden /> Apagar pedaço
        </button>
      </div>
      <p className="hint">Apagar faz o resto do vídeo encostar. Na linha do tempo: arraste o pedaço para mudar a ordem e puxe as pontas para aparar.</p>
    </div>
  );
}

/** Painel do elemento escolhido (na prévia ou na linha do tempo): texto, quando aparece, copiar, duplicar, apagar. */
function ElementInspector({ plan, refEl, onApply, actions, onClose, onEditText, editing, setEditing, onSeek, time, disabled }: { plan: EditPlan; refEl: ElementRef; onApply: (op: (p: EditPlan) => EditPlan) => void; actions: TimelineActions; onClose: () => void; onEditText: (t: string) => void; editing: ElementRef | null; setEditing: (r: ElementRef | null) => void; onSeek: (t: number) => void; time: number; disabled: boolean }) {
  const name = (() => {
    try {
      return elementName(plan, refEl);
    } catch {
      return 'Elemento';
    }
  })();
  const [draft, setDraft] = useState('');
  const isEditing = !!editing && sameEl(editing, refEl);
  const at = findElement(plan, refEl);
  const R = resolvePlan(plan);
  const currentText = (() => {
    if (refEl.type === 'added') return R.added.find((x) => x.el.id === refEl.id)?.el.text ?? '';
    if (refEl.type === 'scene') {
      const sc = R.scenes.find((x) => x.key === refEl.key);
      return sc ? (sceneText(sc.scene) ?? '') : '';
    }
    const c = R.captions.find((x) => x.key === refEl.key);
    return c?.caption.text ?? '';
  })();
  const hasText = refEl.type === 'caption' || refEl.type === 'scene' ? currentText !== '' : R.added.find((x) => x.el.id === refEl.id)?.el.kind === 'text';
  useEffect(() => {
    if (isEditing) setDraft(currentText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, refEl]);
  return (
    <div className="card" data-testid="element-panel">
      <div className="card-head">
        <h3 className="section-title">{name}</h3>
        <button className="icon sm ghost" onClick={onClose} aria-label="Fechar">
          <X size={15} />
        </button>
      </div>
      <p className="hint">Arraste direto no vídeo para mover; duplo clique edita o texto; Shift trava o eixo. Na linha do tempo, arraste para mudar quando aparece.</p>
      {hasText &&
        (isEditing ? (
          <div className="edit-text">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} data-testid="element-text-input" />
            <div className="row">
              <button
                className="primary sm"
                onClick={() => {
                  onEditText(draft);
                  setEditing(null);
                }}
              >
                Salvar
              </button>
              <button className="sm" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button className="sm" onClick={() => setEditing(refEl)} disabled={disabled} data-testid="edit-text-btn">
            Editar texto
          </button>
        ))}
      {at && (
        <div className="edges">
          <SecondsField label="Aparece em (s)" value={at.start} testId="el-start" disabled={disabled} onCommit={(v) => onApply((p) => retimeElement(p, refEl, { start: v, end: at.end }))} />
          <SecondsField label="Some em (s)" value={at.end} testId="el-end" disabled={disabled} onCommit={(v) => onApply((p) => retimeElement(p, refEl, { start: at.start, end: v }))} />
        </div>
      )}
      {refEl.type === 'added' && (
        <div className="row wrap" style={{ marginTop: 8 }} data-testid="el-layer">
          <span className="hint">Camada {(plan.edits.added.find((x) => x.id === refEl.id)?.track ?? 0) + 1}</span>
          <button className="sm" disabled={disabled} onClick={() => onApply((p) => setElementTrack(p, refEl.id, (p.edits.added.find((x) => x.id === refEl.id)?.track ?? 0) + 1))} data-testid="el-layer-up">
            <ArrowUp size={13} aria-hidden /> Para cima
          </button>
          <button className="sm" disabled={disabled || (plan.edits.added.find((x) => x.id === refEl.id)?.track ?? 0) === 0} onClick={() => onApply((p) => setElementTrack(p, refEl.id, (p.edits.added.find((x) => x.id === refEl.id)?.track ?? 0) - 1))} data-testid="el-layer-down">
            <ArrowDown size={13} aria-hidden /> Para baixo
          </button>
        </div>
      )}
      <div className="row wrap" style={{ marginTop: 8 }}>
        {at && (
          <button className="sm" onClick={() => onSeek(at.start + 0.01)} data-testid="el-goto">
            <Play size={13} aria-hidden /> Ir até ele
          </button>
        )}
        {refEl.type !== 'caption' && (
          <>
            <button className="sm" onClick={actions.copy} disabled={disabled} data-testid="copy-el">
              <Copy size={13} aria-hidden /> Copiar
            </button>
            <button className="sm" onClick={actions.duplicate} disabled={disabled} data-testid="duplicate-el">
              <CopyPlus size={13} aria-hidden /> Duplicar
            </button>
          </>
        )}
        <button className="sm danger" onClick={actions.remove} disabled={disabled} data-testid="delete-el">
          <Trash2 size={13} aria-hidden /> Apagar
        </button>
      </div>
      {refEl.type === 'added' && <KeyframePanel plan={plan} id={refEl.id} time={time} onApply={onApply} onSeek={onSeek} disabled={disabled} />}
    </div>
  );
}
