import { AppError, toAppError } from '../core/errors';
import type { EditPlan } from '../core/types';
import { clipSpans, outputToClip } from '../engine/clips';
import { outputDuration } from '../engine/timeline';
import { drawFrame, type SourceFrame } from '../render/frame';
import type { FaceTrack } from '../render/framing';
import { ClipFrames, PREVIEW_MAX_SIDE, type ClipSource } from './sources';
import { splicePlan, type ClipAudio } from './splice';

interface TimedFrame {
  t: number; // out
  frame: SourceFrame;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Player em tempo real do plano. Desenha com a mesma `drawFrame` da exportação e toca o
 * áudio emendado com a mesma `splicePlan`; o relógio é o do Web Audio (ou do sistema,
 * se o som não puder iniciar), então imagem e som seguem o mesmo tempo.
 * Vários clipes (v0.14): lê cada pedaço do arquivo dele; ao começar um pedaço já busca o primeiro
 * quadro do próximo clipe, para a troca de clipe não engasgar.
 */
export class PlanPlayer {
  onTime: (t: number, playing: boolean) => void = () => {};
  onError: (e: AppError) => void = () => {};

  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly frames: ClipFrames;
  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private node: AudioBufferSourceNode | null = null;
  private useAudioClock = false;
  private playing = false;
  private startClock = 0;
  private startT = 0;
  private pausedAt = 0;
  private session = 0;
  private stillSession = 0;
  private frame: SourceFrame | null = null;
  private raf = 0;
  private lastReport = 0;
  private failedClips = new Set<string>();

  constructor(
    sources: ReadonlyMap<string, ClipSource>,
    private readonly audio: ClipAudio | null,
    canvas: HTMLCanvasElement,
    private plan: EditPlan,
    tracks: Readonly<Record<string, FaceTrack | null>> = {},
    private readonly scale = 0.5,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.frames = new ClipFrames(sources, { maxSide: PREVIEW_MAX_SIDE, poolSize: 4 }, tracks);
    this.resize();
    void this.renderStill(0);
  }

  get duration(): number {
    return outputDuration(this.plan.segments);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get currentTime(): number {
    if (!this.playing) return this.pausedAt;
    return Math.min(this.duration, this.startT + (this.clock() - this.startClock));
  }

  /** Tamanho do canvas pelo formato de saída (muda quando a pessoa troca o formato). */
  private resize(): void {
    const w = even(this.plan.output.width * this.scale);
    const h = even(this.plan.output.height * this.scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  setPlan(plan: EditPlan): void {
    if (plan === this.plan) return;
    const sameAudio = plan.segments === this.plan.segments && plan.clips.map((c) => c.id).join('|') === this.plan.clips.map((c) => c.id).join('|');
    const sameFrames = sameAudio && plan.framing === this.plan.framing && plan.clips === this.plan.clips;
    this.plan = plan;
    this.resize();
    if (!sameAudio) this.audioBuffer = null;
    const t = Math.min(this.currentTime, this.duration);
    if (this.playing && (!sameAudio || !sameFrames)) this.restart(t);
    else if (!this.playing) {
      this.pausedAt = t;
      if (sameFrames) this.draw(t);
      else void this.renderStill(t);
    }
  }

  play(): void {
    if (this.playing) return;
    // AudioContext criado no clique (política de autoplay dos navegadores)
    if (this.audio && !this.audioCtx) this.audioCtx = new AudioContext();
    if (this.pausedAt >= this.duration - 0.02) this.pausedAt = 0;
    void this.start(this.pausedAt);
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedAt = this.currentTime;
    this.stop();
    this.draw(this.pausedAt);
    this.onTime(this.pausedAt, false);
  }

  seek(t: number): void {
    const target = Math.max(0, Math.min(this.duration, t));
    if (this.playing) this.restart(target);
    else {
      this.pausedAt = target;
      this.onTime(target, false);
      void this.renderStill(target);
    }
  }

  /** Redesenha o quadro parado (ex.: fontes do estilo acabaram de carregar). */
  redraw(): void {
    if (!this.playing) this.draw(this.pausedAt);
  }

  destroy(): void {
    this.stop();
    this.session++;
    this.stillSession++;
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }

  private restart(t: number): void {
    this.stop();
    this.pausedAt = t;
    void this.start(t);
  }

  private async start(t: number): Promise<void> {
    const s = ++this.session;
    this.playing = true;
    this.useAudioClock = false;
    try {
      if (this.audioCtx && this.audio) {
        if (this.audioCtx.state !== 'running') await Promise.race([this.audioCtx.resume(), wait(400)]);
        if (s !== this.session) return;
        if (this.audioCtx.state === 'running') {
          this.audioBuffer ??= this.buildAudio(this.audioCtx);
          const node = this.audioCtx.createBufferSource();
          node.buffer = this.audioBuffer;
          node.connect(this.audioCtx.destination);
          this.useAudioClock = true;
          this.startClock = this.audioCtx.currentTime;
          node.start(0, t);
          this.node = node;
        }
      }
    } catch (err) {
      // sem som, a imagem continua no relógio do sistema
      console.warn('Áudio da prévia indisponível', err);
      this.useAudioClock = false;
    }
    if (!this.useAudioClock) this.startClock = performance.now() / 1000;
    this.startT = t;
    void this.pump(s, t);
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.playing = false;
    this.session++;
    cancelAnimationFrame(this.raf);
    try {
      this.node?.stop();
    } catch {
      // já parado
    }
    this.node?.disconnect();
    this.node = null;
  }

  private clock(): number {
    return this.useAudioClock && this.audioCtx ? this.audioCtx.currentTime : performance.now() / 1000;
  }

  private buildAudio(ctx: AudioContext): AudioBuffer {
    const audio = this.audio!;
    const spliced = splicePlan(audio, this.plan);
    const buffer = ctx.createBuffer(spliced.length, Math.max(1, spliced[0]!.length), audio.sampleRate);
    spliced.forEach((ch, c) => buffer.copyToChannel(ch as Float32Array<ArrayBuffer>, c));
    return buffer;
  }

  private tick = (): void => {
    if (!this.playing) return;
    const t = this.currentTime;
    if (t >= this.duration) {
      this.pausedAt = this.duration;
      this.stop();
      this.draw(this.pausedAt);
      this.onTime(this.pausedAt, false);
      return;
    }
    this.draw(t);
    const now = performance.now();
    if (now - this.lastReport > 80) {
      this.lastReport = now;
      this.onTime(t, true);
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private clipFailed(id: string, err: unknown): void {
    if (this.failedClips.has(id)) return;
    this.failedClips.add(id);
    const app = toAppError(err, 'PLAYER_CLIPE');
    this.onError(app.key === 'PLAYER_CLIPE' ? app : new AppError('PLAYER_CLIPE', `clipe ${id}: ${app.code} ${app.detail}`));
  }

  /** Quadros do vídeo editado, em ordem, a partir de `fromOut`, atravessando cortes e clipes. */
  private async *outputFrames(fromOut: number, plan: EditPlan): AsyncGenerator<TimedFrame> {
    const spans = clipSpans(plan.segments, plan.clips);
    let warm: { id: string; local: number; p: Promise<{ canvas: HTMLCanvasElement | OffscreenCanvas } | null> } | null = null;
    for (let k = 0; k < spans.length; k++) {
      const span = spans[k]!;
      const len = span.localEnd - span.localStart;
      if (span.outStart + len <= fromOut) continue;
      const sink = this.frames.sink(span.clipId);
      if (!sink || this.failedClips.has(span.clipId)) continue;
      const from = span.localStart + Math.max(0, fromOut - span.outStart);
      // já pede o primeiro quadro do próximo clipe (a troca de arquivo não engasga)
      const next = spans[k + 1];
      const nextWarm = next && next.clipId !== span.clipId ? { id: next.clipId, local: next.localStart, p: this.frames.sink(next.clipId)?.getCanvas(next.localStart).catch(() => null) ?? Promise.resolve(null) } : null;
      if (warm && warm.id === span.clipId && Math.abs(warm.local - from) < 1e-3) {
        const first = await warm.p;
        if (first) yield { t: span.outStart + (from - span.localStart), frame: this.frames.frame(plan, span.clipId, first.canvas, from) };
      }
      warm = nextWarm;
      try {
        for await (const f of sink.canvases(from, span.localEnd)) {
          yield { t: span.outStart + Math.max(0, f.timestamp - span.localStart), frame: this.frames.frame(plan, span.clipId, f.canvas, f.timestamp) };
        }
      } catch (err) {
        this.clipFailed(span.clipId, err);
      }
    }
  }

  /** Busca quadros um pouco à frente do relógio e troca o quadro atual na hora certa. */
  private async pump(s: number, from: number): Promise<void> {
    try {
      for await (const f of this.outputFrames(from, this.plan)) {
        while (s === this.session && this.currentTime < f.t - 0.001) await nextFrame();
        if (s !== this.session) return;
        this.frame = f.frame;
      }
    } catch (err) {
      if (s === this.session) this.onError(toAppError(err, 'PLAYER_FALHOU'));
    }
  }

  private async renderStill(t: number): Promise<void> {
    const s = ++this.stillSession;
    const plan = this.plan;
    const at = outputToClip(plan.segments, plan.clips, Math.min(t, this.duration - 1e-3));
    if (!at) return;
    const sink = this.frames.sink(at.clipId);
    try {
      const wrapped = sink ? await sink.getCanvas(at.local) : null;
      if (s !== this.stillSession || this.playing) return;
      this.frame = wrapped ? this.frames.frame(plan, at.clipId, wrapped.canvas, at.local) : null;
      this.draw(t);
    } catch (err) {
      if (plan.clips.length > 1) this.clipFailed(at.clipId, err);
      else this.onError(toAppError(err, 'PLAYER_FALHOU'));
    }
  }

  private draw(t: number): void {
    // quadro de outro clipe/enquadramento (logo depois de mudar o plano) ainda vale até o novo chegar
    drawFrame(this.ctx, this.plan, t, this.frame);
  }
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
