import { CanvasSink } from 'mediabunny';
import { toAppError, type AppError } from '../core/errors';
import type { EditPlan, Segment } from '../core/types';
import { outputDuration, outputToSource } from '../engine/timeline';
import { drawFrame } from '../render/frame';
import type { DecodedAudio } from './audio';
import type { OpenedMedia } from './input';
import { spliceAudio } from './splice';

interface TimedFrame {
  t: number; // out
  canvas: CanvasImageSource;
}

/** Quadros do vídeo editado, em ordem, a partir de `fromOut`, atravessando os cortes. */
async function* outputFrames(sink: CanvasSink, segments: Segment[], fromOut: number): AsyncGenerator<TimedFrame> {
  let offset = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (offset + len <= fromOut) {
      offset += len;
      continue;
    }
    const from = s.srcStart + Math.max(0, fromOut - offset);
    for await (const f of sink.canvases(from, s.srcEnd)) {
      yield { t: offset + Math.max(0, f.timestamp - s.srcStart), canvas: f.canvas };
    }
    offset += len;
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Player em tempo real do plano. Desenha com a mesma `drawFrame` da exportação e toca o
 * áudio emendado com a mesma `spliceAudio`; o relógio é o do Web Audio (ou do sistema,
 * se o som não puder iniciar), então imagem e som seguem o mesmo tempo.
 */
export class PlanPlayer {
  onTime: (t: number, playing: boolean) => void = () => {};
  onError: (e: AppError) => void = () => {};

  private readonly ctx: CanvasRenderingContext2D;
  private readonly sink: CanvasSink;
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
  private frame: CanvasImageSource | null = null;
  private raf = 0;
  private lastReport = 0;

  constructor(
    media: OpenedMedia,
    private readonly audio: DecodedAudio | null,
    canvas: HTMLCanvasElement,
    private plan: EditPlan,
    scale = 0.5,
  ) {
    const w = even(plan.output.width * scale);
    const h = even(plan.output.height * scale);
    canvas.width = w;
    canvas.height = h;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.sink = new CanvasSink(media.video, { width: w, height: h, fit: 'cover', poolSize: 4 });
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

  setPlan(plan: EditPlan): void {
    if (plan === this.plan) return;
    const sameAudio = plan.segments === this.plan.segments;
    this.plan = plan;
    if (!sameAudio) this.audioBuffer = null;
    const t = Math.min(this.currentTime, this.duration);
    if (this.playing && !sameAudio) this.restart(t);
    else if (!this.playing) {
      this.pausedAt = t;
      if (sameAudio) this.draw(t);
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
    const spliced = spliceAudio(audio.channels, audio.sampleRate, this.plan.segments);
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

  /** Busca quadros um pouco à frente do relógio e troca o quadro atual na hora certa. */
  private async pump(s: number, from: number): Promise<void> {
    const segments = this.plan.segments;
    try {
      for await (const f of outputFrames(this.sink, segments, from)) {
        while (s === this.session && this.currentTime < f.t - 0.001) await nextFrame();
        if (s !== this.session) return;
        this.frame = f.canvas;
      }
    } catch (err) {
      if (s === this.session) this.onError(toAppError(err, 'PLAYER_FALHOU'));
    }
  }

  private async renderStill(t: number): Promise<void> {
    const s = ++this.stillSession;
    const segments = this.plan.segments;
    const src = outputToSource(segments, Math.min(t, this.duration - 1e-3)) ?? 0;
    try {
      const wrapped = await this.sink.getCanvas(src);
      if (s !== this.stillSession || this.playing) return;
      this.frame = wrapped?.canvas ?? null;
      this.draw(t);
    } catch (err) {
      this.onError(toAppError(err, 'PLAYER_FALHOU'));
    }
  }

  private draw(t: number): void {
    drawFrame(this.ctx, this.plan, t, this.frame);
  }
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
