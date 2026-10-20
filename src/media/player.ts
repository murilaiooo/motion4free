import { CanvasSink } from 'mediabunny';
import { toAppError, type AppError } from '../core/errors';
import type { EditPlan, Segment } from '../core/types';
import { outputDuration, outputToSource } from '../engine/timeline';
import { drawFrame, type SourceFrame } from '../render/frame';
import type { DecodedAudio } from './audio';
import type { OpenedMedia } from './input';
import { spliceAudio } from './splice';
import { ClipFrames, EXPORT_MAX_SIDE, PREVIEW_MAX_SIDE, type ClipSource } from './sources';
import { outputToClip } from '../engine/clips';

interface TimedFrame {
  t: number; // out
  canvas: CanvasImageSource;
  source: SourceFrame | null;
}

// Player now supports multi-clip via ClipFrames; single-clip path is preserved for backward compat.

export class PlanPlayer {
  onTime: (t: number, playing: boolean) => void = () => {};
  onError: (e: AppError) => void = () => {};

  private readonly ctx: CanvasRenderingContext2D;
  private readonly scale: number;
  private readonly canvas: HTMLCanvasElement;
  // Single mode
  private readonly sinkSingle: CanvasSink | null;
  // Multi mode
  private readonly clipFrames: ClipFrames | null;
  private readonly sources: ReadonlyMap<string, ClipSource> | null;
  private readonly clipLayouts: Map<string, { start: number; end: number }> | null;

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
  private frame: CanvasImageSource | SourceFrame | null = null;
  private raf = 0;
  private lastReport = 0;

  constructor(
    media: OpenedMedia | null,
    private readonly audio: DecodedAudio | null,
    canvas: HTMLCanvasElement,
    private plan: EditPlan,
    scale = 0.5,
    clipSources?: Map<string, ClipSource>,
  ) {
    this.canvas = canvas;
    this.scale = scale;
    const w = even(plan.output.width * scale);
    const h = even(plan.output.height * scale);
    canvas.width = w;
    canvas.height = h;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Determine mode: multi if plan has >1 clip and we have sources
    const multi = clipSources && clipSources.size > 0 && plan.clips.length > 1;
    if (multi) {
      this.sources = clipSources!;
      this.clipFrames = new ClipFrames(clipSources!, { maxSide: PREVIEW_MAX_SIDE, poolSize: 2 });
      this.sinkSingle = null;
      this.clipLayouts = this.buildLayouts(plan);
    } else if (media) {
      this.sources = null;
      this.clipFrames = null;
      this.sinkSingle = new CanvasSink(media.video, { width: w, height: h, fit: 'cover', poolSize: 4 });
      this.clipLayouts = null;
    } else {
      throw new Error('PlanPlayer: need media or clipSources');
    }
    void this.renderStill(0);
  }

  private buildLayouts(plan: EditPlan): Map<string, { start: number; end: number }> {
    const map = new Map<string, { start: number; end: number }>();
    let acc = 0;
    for (const c of plan.clips) {
      map.set(c.id, { start: acc, end: acc + c.duration });
      acc += c.duration;
    }
    return map;
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
    // Rebuild layouts if multi
    if (this.clipFrames && plan.clips.length > 1) {
      this.clipLayouts?.clear();
      let acc = 0;
      for (const c of plan.clips) {
        this.clipLayouts!.set(c.id, { start: acc, end: acc + c.duration });
        acc += c.duration;
      }
    }
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
    try { this.node?.stop(); } catch {}
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

  private async pump(s: number, from: number): Promise<void> {
    try {
      if (this.clipFrames) {
        let offset = 0;
        for (const seg of this.plan.segments) {
          const len = seg.srcEnd - seg.srcStart;
          if (offset + len <= from) { offset += len; continue; }
          const segClip = outputToClip(this.plan.segments, this.plan.clips, offset);
          if (!segClip) { offset += len; continue; }
          const layout = this.clipLayouts!.get(segClip.clipId);
          if (!layout) { offset += len; continue; }
          const segLocalStart = seg.srcStart - layout.start;
          const fromVirtual = seg.srcStart + Math.max(0, from - offset);
          const fromLocal = fromVirtual - layout.start;
          const endLocal = seg.srcEnd - layout.start;
          for await (const f of this.clipFrames.sink(segClip.clipId)!.canvases(fromLocal, endLocal)) {
            const outT = offset + (f.timestamp - segLocalStart);
            while (s === this.session && this.currentTime < outT - 0.001) await nextFrame();
            if (s !== this.session) return;
            // f.timestamp is local, info.local should equal f.timestamp; use it directly
            this.frame = this.clipFrames.frame(this.plan, segClip.clipId, f.canvas as any, f.timestamp);
          }
          offset += len;
        }
      } else if (this.sinkSingle) {
        let offset = 0;
        for (const seg of this.plan.segments) {
          const len = seg.srcEnd - seg.srcStart;
          if (offset + len <= from) { offset += len; continue; }
          const fromSrc = seg.srcStart + Math.max(0, from - offset);
          for await (const f of this.sinkSingle.canvases(fromSrc, seg.srcEnd)) {
            while (s === this.session && this.currentTime < offset + Math.max(0, f.timestamp - seg.srcStart) - 0.001) await nextFrame();
            if (s !== this.session) return;
            this.frame = f.canvas;
          }
          offset += len;
        }
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
      let frame: CanvasImageSource | SourceFrame | null = null;
      if (this.clipFrames) {
        const info = outputToClip(segments, this.plan.clips, t);
        if (info) {
          const sink = this.clipFrames.sink(info.clipId);
          if (sink) {
            const w = await sink.getCanvas(info.local);
            if (w?.canvas) frame = this.clipFrames.frame(this.plan, info.clipId, w.canvas as any, info.local);
          }
        }
      } else if (this.sinkSingle) {
        const w = await this.sinkSingle.getCanvas(src);
        frame = w?.canvas ?? null;
      }
      if (s !== this.stillSession || this.playing) return;
      this.frame = frame;
      this.draw(t);
    } catch (err) {
      this.onError(toAppError(err, 'PLAYER_FALHOU'));
    }
  }

  private draw(t: number): void {
    drawFrame(this.ctx, this.plan, t, this.frame as any);
  }
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
