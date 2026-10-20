import { stylesOf } from '../editorial/ranges';
import { AudioSample, AudioSampleSource, BufferTarget, CanvasSink, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import { toAppError } from '../core/errors';
import type { EditPlan } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { drawFrame } from '../render/frame';
import type { DecodedAudio } from './audio';
import { chooseCodecs } from './codecs';
import { ensureEmojiFont, ensureFonts } from './fonts';
import { planUsesEmoji } from '../core/emoji';
import type { OpenedMedia } from './input';
import { spliceAudio } from './splice';
import { ClipFrames, EXPORT_MAX_SIDE, type ClipSource } from './sources';
import { outputToClip } from '../engine/clips';

export interface ExportOptions {
  maxDurationSec?: number;
  scale?: number;
  onProgress?: (fraction: number) => void;
}

export interface ExportResult {
  blob: Blob;
  degraded: boolean;
  codec: string;
  fontWarning: string;
  emojiWarning: string;
}

// Keep single-media export for backward compat, but also support multi via clipSources
export async function exportPlan(media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, opts: ExportOptions = {}): Promise<ExportResult> {
  try {
    return await exportPlanUnsafe(media, audio, plan, opts);
  } catch (err) {
    throw toAppError(err, 'EXPORTACAO_FALHOU');
  }
}

// New multi-clip export: pass map of clip sources and optional combined audio
export async function exportPlanMulti(
  clipSources: Map<string, ClipSource>,
  audio: DecodedAudio | null,
  plan: EditPlan,
  opts: ExportOptions = {},
): Promise<ExportResult> {
  try {
    return await exportPlanUnsafeMulti(clipSources, audio, plan, opts);
  } catch (err) {
    throw toAppError(err, 'EXPORTACAO_FALHOU');
  }
}

async function exportPlanUnsafe(media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, opts: ExportOptions): Promise<ExportResult> {
  const scale = opts.scale ?? 1;
  const width = even(plan.output.width * scale);
  const height = even(plan.output.height * scale);
  const fps = plan.output.fps;
  const duration = Math.min(outputDuration(plan.segments), opts.maxDurationSec ?? Infinity);
  const frames = Math.floor(duration * fps);
  const codecs = await chooseCodecs(width, height);
  const fonts = await ensureFonts(stylesOf(plan));
  const emoji = planUsesEmoji(plan) ? await ensureEmojiFont() : { ok: true, detail: '' };

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = audio ? new AudioSampleSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const sink = new CanvasSink(media.video, { width: plan.output.width, height: plan.output.height, fit: 'cover', poolSize: 2 });
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const { outputToSource } = await import('../engine/timeline');
    const src = outputToSource(plan.segments, t) ?? 0;
    const wrapped = await sink.getCanvas(src);
    drawFrame(ctx as any, plan, t, (wrapped?.canvas as any) ?? null);
    await videoSource.add(t, 1 / fps);
    if (f % 10 === 0) opts.onProgress?.((f / frames) * 0.95);
  }

  if (audio && audioSource) {
    const trimmed = trimSegments(plan.segments, duration);
    const spliced = spliceAudio(audio.channels, audio.sampleRate, trimmed);
    const len = spliced[0]!.length;
    const planar = new Float32Array(len * spliced.length);
    spliced.forEach((ch, c) => planar.set(ch, c * len));
    const sample = new AudioSample({ data: planar, format: 'f32-planar', numberOfChannels: spliced.length, sampleRate: audio.sampleRate, timestamp: 0 });
    await audioSource.add(sample);
    sample.close();
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video, fontWarning: fonts.ok ? '' : fonts.detail, emojiWarning: emoji.ok ? '' : emoji.detail };
}

async function exportPlanUnsafeMulti(
  clipSources: Map<string, ClipSource>,
  audio: DecodedAudio | null,
  plan: EditPlan,
  opts: ExportOptions,
): Promise<ExportResult> {
  const scale = opts.scale ?? 1;
  const width = even(plan.output.width * scale);
  const height = even(plan.output.height * scale);
  const fps = plan.output.fps;
  const duration = Math.min(outputDuration(plan.segments), opts.maxDurationSec ?? Infinity);
  const frames = Math.floor(duration * fps);
  const codecs = await chooseCodecs(width, height);
  const fonts = await ensureFonts(stylesOf(plan));
  const emoji = planUsesEmoji(plan) ? await ensureEmojiFont() : { ok: true, detail: '' };

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = audio ? new AudioSampleSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const clipFrames = new ClipFrames(clipSources, { maxSide: EXPORT_MAX_SIDE, poolSize: 2 });
  // Build layout for quick mapping
  let layout = new Map<string, { start: number; end: number }>();
  let acc = 0;
  for (const c of plan.clips) { layout.set(c.id, { start: acc, end: acc + c.duration }); acc += c.duration; }

  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const info = outputToClip(plan.segments, plan.clips, t);
    let frame: any = null;
    if (info) {
      const sink = clipFrames.sink(info.clipId);
      if (sink) {
        const wrapped = await sink.getCanvas(info.local);
        if (wrapped?.canvas) frame = clipFrames.frame(plan, info.clipId, wrapped.canvas as any, info.local);
      }
    }
    drawFrame(ctx as any, plan, t, frame);
    await videoSource.add(t, 1 / fps);
    if (f % 10 === 0) opts.onProgress?.((f / frames) * 0.95);
  }

  if (audio && audioSource) {
    const trimmed = trimSegments(plan.segments, duration);
    const spliced = spliceAudio(audio.channels, audio.sampleRate, trimmed);
    const len = spliced[0]!.length;
    const planar = new Float32Array(len * spliced.length);
    spliced.forEach((ch, c) => planar.set(ch, c * len));
    const sample = new AudioSample({ data: planar, format: 'f32-planar', numberOfChannels: spliced.length, sampleRate: audio.sampleRate, timestamp: 0 });
    await audioSource.add(sample);
    sample.close();
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video, fontWarning: fonts.ok ? '' : fonts.detail, emojiWarning: emoji.ok ? '' : emoji.detail };
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function trimSegments(segments: EditPlan['segments'], maxOut: number): EditPlan['segments'] {
  const out: EditPlan['segments'] = [];
  let acc = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (acc + len <= maxOut) out.push(s);
    else {
      if (maxOut - acc > 0) out.push({ srcStart: s.srcStart, srcEnd: s.srcStart + (maxOut - acc) });
      break;
    }
    acc += len;
  }
  return out;
}
