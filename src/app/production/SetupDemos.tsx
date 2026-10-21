import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Scissors } from 'lucide-react';
import { OUTPUT_FORMATS, type OutputFormatId } from '../../core/formats';
import type { CreativeSetup } from '../../core/production';
import { TemplateThumb } from '../Templates';

/*
 * Exemplos animados das escolhas da configuração (funcionam como um GIF em loop, sem arquivo pesado).
 * Quem pede menos movimento no sistema vê um quadro parado que ainda mostra a diferença.
 */

function prefersStill(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Tempo dentro de um ciclo de `periodMs`, atualizado a cada `stepMs`; parado em `stillMs` se o sistema pede menos movimento. */
function useLoop(periodMs: number, stillMs: number, stepMs = 100): number {
  const [t, setT] = useState(stillMs);
  useEffect(() => {
    if (prefersStill()) return setT(stillMs);
    const t0 = performance.now();
    const id = setInterval(() => setT((performance.now() - t0) % periodMs), stepMs);
    return () => clearInterval(id);
  }, [periodMs, stillMs, stepMs]);
  return t;
}

/** Uma telinha com a proporção do formato, com uma cena e uma legenda passando. */
export function FormatDemo({ format }: { format: OutputFormatId }) {
  const { width, height } = OUTPUT_FORMATS[format];
  return <span className={`demo-screen demo-format ${format}`} style={{ aspectRatio: `${width} / ${height}` }}>
    <span className="demo-scene" /><span className="demo-person" />
    <span className="demo-format-caption">Olha <em>isso</em></span>
  </span>;
}

export type CutMode = 'preserve' | 'natural' | 'direct' | 'dynamic';
/** Uma gravação de exemplo: trechos de fala e pausas, em segundos. */
const RECORDING: { kind: 'fala' | 'pausa'; sec: number }[] = [
  { kind: 'fala', sec: 3 }, { kind: 'pausa', sec: 2.4 }, { kind: 'fala', sec: 2 }, { kind: 'pausa', sec: 0.7 },
  { kind: 'fala', sec: 2.6 }, { kind: 'pausa', sec: 1.8 }, { kind: 'fala', sec: 1.6 },
];
/** Quanto sobra de cada pausa depois do corte (mesmas regras de editorial/production.ts). */
function pauseAfter(mode: CutMode, sec: number): number {
  if (mode === 'preserve') return sec;
  if (mode === 'natural') return sec >= 0.9 ? 0.44 : sec;
  return sec >= 0.45 ? 0.24 : sec;
}
const MARKS: Record<CutMode, number> = { preserve: 1, natural: 1, direct: 2, dynamic: 4 };
const clock = (sec: number) => `0:${String(Math.round(sec)).padStart(2, '0')}`;

/** A gravação antes e depois: as pausas encolhem conforme o modo e os destaques aparecem. */
export function CutDemo({ mode }: { mode: CutMode }) {
  const t = useLoop(5200, 4000);
  const after = t >= 1900;
  const blocks = RECORDING.map(block => ({ ...block, now: block.kind === 'pausa' && after ? pauseAfter(mode, block.sec) : block.sec }));
  const total = blocks.reduce((sum, block) => sum + block.now, 0);
  let speech = -1;
  return <span className={`demo-cut ${after ? 'after' : ''}`}>
    <span className="demo-cut-label"><b>{after ? 'Depois' : 'Gravação'}</b><span>{clock(total)}</span></span>
    <span className="demo-cut-track">{blocks.map((block, index) => {
      if (block.kind === 'fala') speech += 1;
      const cut = block.kind === 'pausa' && pauseAfter(mode, block.sec) < block.sec;
      return <span key={index} className={`demo-cut-block ${block.kind}`} style={{ flexGrow: block.now }}>
        {cut && <Scissors className="demo-cut-scissors" size={14} aria-hidden />}
        {block.kind === 'fala' && speech < MARKS[mode] && <span className="demo-cut-mark" style={{ '--delay': `${speech * 120}ms` } as CSSProperties}>✦</span>}
      </span>;
    })}</span>
    <span className="demo-cut-legend"><span><i className="fala" /> fala</span><span><i className="pausa" /> pausa</span><span><i className="mark">✦</i> destaque</span></span>
  </span>;
}

const EXAMPLE_SEC = 200;
/** A gravação de exemplo (3:20) com a parte que entra no vídeo e a que fica de fora. */
export function DurationDemo({ seconds }: { seconds: number | null }) {
  const kept = seconds ? Math.min(1, seconds / EXAMPLE_SEC) : 1;
  return <span className="demo-duration">
    <span className="demo-duration-track">
      <span className="demo-duration-kept" style={{ width: `${kept * 100}%` }}><span className="demo-duration-head" /></span>
      {kept < 1 && <span className="demo-duration-out">fica de fora</span>}
    </span>
    <span className="demo-duration-scale"><span>0:00</span><span>gravação de 3:20</span></span>
  </span>;
}

/** O modelo animado sempre; com menos movimento no sistema, só ao passar o mouse ou quando escolhido. */
export function StyleDemo({ styleId, selected }: { styleId: string; selected: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [still] = useState(prefersStill);
  useEffect(() => {
    const card = ref.current?.closest('button');
    if (!card) return;
    const on = () => setHover(true);
    const off = () => setHover(false);
    card.addEventListener('pointerenter', on);
    card.addEventListener('pointerleave', off);
    card.addEventListener('focus', on);
    card.addEventListener('blur', off);
    return () => {
      card.removeEventListener('pointerenter', on);
      card.removeEventListener('pointerleave', off);
      card.removeEventListener('focus', on);
      card.removeEventListener('blur', off);
    };
  }, []);
  return <span ref={ref} className="demo-style"><TemplateThumb styleId={styleId} t={1.3} width={170} playing={!still || hover || selected} plain /></span>;
}

const WORDS = ['Uma', 'dica', 'muito', 'importante', 'pra', 'você'];
const WORD_MS = 430;
/** A mesma frase falada: palavra por palavra com pulo, ou a frase inteira só trocando a cor. */
export function CaptionDemo({ style, accent }: { style: CreativeSetup['captionStyle']; accent: string }) {
  const t = useLoop(WORDS.length * WORD_MS + 1100, 3 * WORD_MS + 100);
  const spoken = Math.floor(t / WORD_MS);
  const highlight = style === 'highlight';
  return <span className={`demo-screen demo-caption ${style}`}>
    <span className="demo-scene" /><span className="demo-person" />
    <span className="demo-caption-line">{WORDS.map((word, index) => {
      const shown = !highlight || index <= spoken;
      const active = index === spoken;
      return <span key={word} className={`demo-word ${shown ? 'shown' : ''} ${active ? 'active' : ''}`} style={active ? { color: accent } : undefined}>{word}</span>;
    })}</span>
    <span className="demo-caption-note"><span className={`demo-voice ${spoken < WORDS.length ? 'on' : ''}`} aria-hidden><i /><i /><i /></span>{highlight ? 'Entra palavra por palavra e a falada pula' : 'Frase inteira parada, só a falada muda de cor'}</span>
  </span>;
}

/** Título entrando com a intensidade de movimento escolhida. */
export function MotionDemo({ motion }: { motion: number }) {
  const level = motion === 0 ? 'none' : motion < 0.5 ? 'subtle' : 'strong';
  return <span className={`demo-screen demo-motion ${level}`}><span className="demo-scene" /><span className="demo-person" /><span className="demo-motion-title">Título</span></span>;
}

/** Passagem entre dois trechos com a transição escolhida. */
export function TransitionDemo({ transition }: { transition: CreativeSetup['transition'] }) {
  return <span className={`demo-screen demo-transition ${transition}`}><span className="demo-transition-a">Trecho 1</span><span className="demo-transition-b">Trecho 2</span><span className="demo-transition-fx" /></span>;
}

/** Abertura com ou sem a frase em destaque. */
export function HookDemo({ hook }: { hook: boolean }) {
  return <span className={`demo-screen demo-hook ${hook ? 'on' : 'off'}`}><span className="demo-scene" /><span className="demo-person" />{hook && <span className="demo-hook-title">“O erro que todo mundo comete”</span>}</span>;
}
