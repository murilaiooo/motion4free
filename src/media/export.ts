import { AudioBufferSource, BufferTarget, CanvasSink, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import { toAppError } from '../core/errors';
import type { EditPlan } from '../core/types';
import { outputDuration, outputToSource } from '../engine/timeline';
import { drawFrame } from '../render/frame';
import type { DecodedAudio } from './audio';
import { chooseCodecs } from './codecs';
import type { OpenedMedia } from './input';
import { spliceAudio } from './splice';

export interface ExportOptions {
  /** Exporta só os primeiros N segundos (prévia rápida). */
  maxDurationSec?: number;
  /** 1 = 1080x1920; 0.5 = prévia leve. */
  scale?: number;
  onProgress?: (fraction: number) => void;
}

export interface ExportResult {
  blob: Blob;
  degraded: boolean;
  codec: string;
}

export async function exportPlan(media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, opts: ExportOptions = {}): Promise<ExportResult> {
  try {
    return await exportPlanUnsafe(media, audio, plan, opts);
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

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = audio ? new AudioBufferSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const sink = new CanvasSink(media.video, { width: plan.output.width, height: plan.output.height, fit: 'cover', poolSize: 2 });
  const srcTimes = function* () {
    for (let i = 0; i < frames; i++) yield outputToSource(plan.segments, i / fps) ?? 0;
  };
  let i = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(srcTimes())) {
    const t = i / fps;
    drawFrame(ctx, plan, t, wrapped?.canvas ?? null);
    await videoSource.add(t, 1 / fps);
    i++;
    if (i % 10 === 0) opts.onProgress?.((i / frames) * 0.95);
  }

  if (audio && audioSource) {
    const trimmed = trimSegments(plan.segments, duration);
    const spliced = spliceAudio(audio.channels, audio.sampleRate, trimmed);
    const buffer = new AudioBuffer({ length: spliced[0]!.length, numberOfChannels: spliced.length, sampleRate: audio.sampleRate });
    spliced.forEach((ch, c) => buffer.copyToChannel(ch as Float32Array<ArrayBuffer>, c));
    await audioSource.add(buffer);
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video };
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
