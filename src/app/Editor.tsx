import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, TimeRange } from '../core/types';
import { PRESETS } from '../core/presets';
import { adjustCut, applyBrief, applyHook, applyRange, applyReferencePalette, applyStyle, editCaptionText, listCuts, restoreCut, type EditContext } from '../editorial/ops';
import type { RangeRequest } from '../editorial/range-interpret';
import { stylesOf } from '../editorial/ranges';
import { addVersion, removeVersion, type PlanVersion } from '../core/versions';
import { canRedo, canUndo, pushHistory, redo, undo, type History } from '../engine/history';
import { outputDuration, outputToSource } from '../engine/timeline';
import type { DecodedAudio } from '../media/audio';
import { exportInBackground } from '../media/export-client';
import { ensureEmojiFont, ensureFonts } from '../media/fonts';
import { planUsesEmoji } from '../core/emoji';
import { DEFAULT_LLM } from '../core/llm-models';
import { loadKey } from '../ai/own-key';
import type { AiSettings } from './AiOptions';
import type { OpenedMedia } from '../media/input';
import { PlanPlayer } from '../media/player';
import { ErrorBox } from './ErrorBox';
import { BriefPanel } from './BriefPanel';
import { StylePicker } from './StylePicker';
import { Timeline } from './Timeline';
import { RangePanel } from './RangePanel';
import { ChangesPanel, ReferencePicker, VersionsPanel, type CompareView } from './Panels';

export interface Session {
  file: Blob;
  fileName: string;
  media: OpenedMedia;
  audio: DecodedAudio | null;
  ctx: EditContext;
  silences: TimeRange[];
  warnings: AppError[];
  peaks: Float32Array | null;
}

interface Result {
  url: string;
  name: string;
  degraded: boolean;
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

interface EditorProps {
  session: Session;
  history: History<EditPlan>;
  onHistory: (h: History<EditPlan>) => void;
  versions: PlanVersion[];
  onVersions: (v: PlanVersion[]) => void;
  disabled: boolean;
}

export function Editor({ session, history, onHistory, versions, onVersions, disabled }: EditorProps) {
  const plan = history.present;
  const [selection, setSelection] = useState<TimeRange | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [view, setView] = useState<CompareView>('depois');
  const comparedVersion = versions.find((v) => v.id === compareWith) ?? null;
  const before = comparedVersion?.plan ?? history.past.at(-1) ?? null;
  const beforeLabel = comparedVersion ? `a versão “${comparedVersion.name}”` : 'antes da última mudança';
  const shown = view === 'antes' && before ? before : plan;
  const range = selectedRange ? (plan.ranges.find((r) => r.id === selectedRange) ?? null) : null;
  const activeSelection = range ? range.out : selection;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PlanPlayer | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedCut, setSelectedCut] = useState<number | null>(null);
  const [editError, setEditError] = useState<AppError | null>(null);
  const [playerError, setPlayerError] = useState<AppError | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [exportError, setExportError] = useState<AppError | null>(null);
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
    const player = new PlanPlayer(session.media, session.audio, canvasRef.current!, shownRef.current);
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
    playerRef.current?.setPlan(shown);
    setTime((t) => Math.min(t, outputDuration(shown.segments)));
  }, [shown]);

  const cuts = listCuts(plan.segments, session.ctx.durationSec);
  // palavras faladas no trecho selecionado (vão para a IA, se escolhida, junto com o pedido do trecho)
  const rangeWords = (() => {
    if (!activeSelection) return [];
    const a = outputToSource(plan.segments, activeSelection.start) ?? 0;
    const b = outputToSource(plan.segments, Math.max(activeSelection.start, activeSelection.end - 0.001)) ?? a;
    return session.ctx.words.filter((w) => w.end > a && w.start < b);
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
      const r = applyRange(history.present, session.ctx, target, req);
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

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y fora dos campos de texto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) doUndo();
      else if ((k === 'z' && e.shiftKey) || k === 'y') doRedo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo]);

  useEffect(() => {
    if (selectedCut !== null && selectedCut >= cuts.length) setSelectedCut(null);
  }, [cuts.length, selectedCut]);

  async function onExport() {
    playerRef.current?.pause();
    setExportError(null);
    setExporting(0);
    try {
      const out = await exportInBackground(session.file, session.media, session.audio, plan, (f) => setExporting(f));
      if (result) URL.revokeObjectURL(result.url);
      const base = session.fileName.replace(/\.[^.]+$/, '');
      setResult({ url: URL.createObjectURL(out.blob), name: `${base}-${plan.style.id}-motion4free.mp4`, degraded: out.degraded, where: out.where, style: plan.style.name, fontWarning: out.fontWarning, emojiWarning: out.emojiWarning });
    } catch (err) {
      setExportError(toAppError(err, 'EXPORTACAO_FALHOU'));
    } finally {
      setExporting(null);
    }
  }

  const cut = selectedCut !== null ? cuts[selectedCut] : undefined;
  const nudge = (which: 'start' | 'end', delta: number) => {
    if (!cut || selectedCut === null) return;
    const range = which === 'start' ? { start: cut.start + delta, end: cut.end } : { start: cut.start, end: cut.end + delta };
    apply((p) => adjustCut(p, session.ctx, selectedCut, range));
  };
  const setEdge = (which: 'start' | 'end', value: number) => {
    if (!cut || selectedCut === null || !Number.isFinite(value)) return;
    apply((p) => adjustCut(p, session.ctx, selectedCut, which === 'start' ? { start: value, end: cut.end } : { start: cut.start, end: value }));
  };

  return (
    <section className="editor">
      <section className="summary" data-testid="summary">
        <p>
          Original: <b>{session.ctx.durationSec.toFixed(1)} s</b> · Editado: <b data-testid="out-duration">{total.toFixed(1)} s</b> · {plan.segments.length} trechos · {plan.captions.length} legendas · {session.ctx.words.length} palavras reconhecidas
        </p>
      </section>

      <div className="player">
        <canvas ref={canvasRef} data-testid="player-canvas" />
        <div className="player-bar">
          <button onClick={() => (playing ? playerRef.current?.pause() : playerRef.current?.play())} data-testid="play" disabled={exporting !== null}>
            {playing ? 'Pausar' : 'Assistir'}
          </button>
          <span data-testid="player-time">
            {fmt(time)} / {fmt(total)}
          </span>
        </div>
      </div>
      {playerError && <ErrorBox error={playerError} kind="warning" />}
      {fontError && <ErrorBox error={fontError} kind="warning" />}
      {emojiError && <ErrorBox error={emojiError} kind="warning" />}

      <BriefPanel plan={plan} words={session.ctx.words} onBrief={(b) => apply((p) => applyBrief(p, session.ctx, b))} onHook={(h) => apply((p) => applyHook(p, session.ctx, h))} disabled={exporting !== null} ai={ai} onAi={setAi} />

      <StylePicker current={plan.style.id} onPick={(id) => apply((p) => applyStyle(p, session.ctx, id))} disabled={exporting !== null} />
      <ReferencePicker reference={plan.reference} onReference={(r) => apply((p) => applyReferencePalette(p, session.ctx, r))} disabled={exporting !== null} />
      <p className="scene-summary" data-testid="scene-summary">
        Animações neste estilo: {describeScenes(plan.scenes)}.
      </p>

      <div className="actions">
        <button onClick={doUndo} disabled={!canUndo(history)} data-testid="undo" title="Ctrl+Z">
          Desfazer
        </button>
        <button onClick={doRedo} disabled={!canRedo(history)} data-testid="redo" title="Ctrl+Shift+Z">
          Refazer
        </button>
      </div>

      <Timeline
        durationSec={session.ctx.durationSec}
        plan={plan}
        cuts={cuts}
        peaks={session.peaks}
        time={time}
        selectedCut={selectedCut}
        onSeek={(t) => playerRef.current?.seek(t)}
        onSelectCut={setSelectedCut}
        selection={activeSelection}
        selectedRange={selectedRange}
        onSelection={(out) => {
          setSelectedRange(null);
          setSelection(out);
        }}
        onPickRange={(id) => {
          setSelectedRange(id);
          setSelection(null);
        }}
      />
      {!activeSelection && (
        <p className="hint">
          Para mudar só um pedaço: arraste na faixa “Trechos” acima ou{' '}
          <button type="button" onClick={() => setSelection({ start: Math.min(time, Math.max(0, total - 0.5)), end: Math.min(total, Math.max(time, 0) + 3) })} data-testid="range-new">
            selecione a partir de agora ({fmt(time)})
          </button>
          .
        </p>
      )}
      {activeSelection && (
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
          onSeek={(t) => playerRef.current?.seek(t)}
          disabled={exporting !== null}
        />
      )}

      <ChangesPanel before={before} beforeLabel={beforeLabel} plan={plan} view={view} onView={setView} onSeek={(t) => playerRef.current?.seek(t)} time={time} />
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
        disabled={exporting !== null}
      />

      {cut && selectedCut !== null && (
        <div className="cut-panel" data-testid="cut-panel">
          <p>
            <b>Trecho cortado</b>: de {fmt(cut.start)} até {fmt(cut.end)} ({fmt(cut.end - cut.start)}) do vídeo original.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => apply((p) => restoreCut(p, session.ctx, selectedCut))} data-testid="restore-cut">
              Restaurar este trecho
            </button>
            <button onClick={() => setSelectedCut(null)}>Fechar</button>
          </div>
          <div className="edges">
            <label>
              Início do corte (s)
              <input key={`s${cut.start}`} type="number" step="0.05" min={0} defaultValue={cut.start} data-testid="cut-start" onBlur={(e) => setEdge('start', e.target.valueAsNumber)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            </label>
            <span>
              <button onClick={() => nudge('start', -0.1)} data-testid="cut-start-minus">
                −0,1 s
              </button>
              <button onClick={() => nudge('start', 0.1)} data-testid="cut-start-plus">
                +0,1 s
              </button>
            </span>
            <label>
              Fim do corte (s)
              <input key={`e${cut.end}`} type="number" step="0.05" min={0} defaultValue={cut.end} data-testid="cut-end" onBlur={(e) => setEdge('end', e.target.valueAsNumber)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            </label>
            <span>
              <button onClick={() => nudge('end', -0.1)} data-testid="cut-end-minus">
                −0,1 s
              </button>
              <button onClick={() => nudge('end', 0.1)} data-testid="cut-end-plus">
                +0,1 s
              </button>
            </span>
          </div>
        </div>
      )}
      {editError && <ErrorBox error={editError} kind="error" />}

      {plan.captions.length > 0 && (
        <section className="captions">
          <h2>Legendas</h2>
          <p className="hint">Clique no texto para corrigir. Enter ou clicar fora confirma.</p>
          {plan.captions.map((c) => (
            <div className="caption-row" key={c.id}>
              <button className="time" onClick={() => playerRef.current?.seek(c.start + 0.01)} title="Ir para esta legenda">
                {fmt(c.start)}
              </button>
              <input
                key={`${c.id}:${c.text}`}
                defaultValue={c.text}
                maxLength={140}
                data-testid={`caption-input-${c.id}`}
                aria-label={`Legenda em ${fmt(c.start)}`}
                onBlur={(e) => {
                  if (e.target.value !== c.text) apply((p) => editCaptionText(p, c.id, e.target.value));
                  e.target.value = c.text;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    e.currentTarget.value = c.text;
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
          ))}
        </section>
      )}

      <div className="actions">
        <button disabled={disabled || exporting !== null} className="primary" onClick={onExport} data-testid="export">
          Gerar vídeo final
        </button>
      </div>
      {exporting !== null && (
        <div className="status" role="status">
          <span>Gerando o vídeo final (você pode continuar mexendo na página)…</span>
          <progress value={exporting} max={1} />
        </div>
      )}
      {exportError && <ErrorBox error={exportError} kind="error" />}

      {result && (
        <section className="result">
          <video src={result.url} controls playsInline data-testid="result-video" />
          {result.degraded && <p className="warn">Seu navegador não gera H.264. O vídeo funciona aqui, mas o Instagram pode recusar. Para o arquivo final, use Chrome ou Edge no computador.</p>}
          {result.fontWarning && <ErrorBox error={new AppError('FONTE_FALHOU', result.fontWarning)} kind="warning" />}
          {result.emojiWarning && <ErrorBox error={new AppError('EMOJI_FALHOU', result.emojiWarning)} kind="warning" />}
          <a href={result.url} download={result.name} data-testid="download" data-export-where={result.where} data-style={result.style}>
            Baixar vídeo ({result.name})
          </a>
        </section>
      )}
    </section>
  );
}
