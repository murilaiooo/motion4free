import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AsrWindow } from '../src/analysis/asr-windows';
import type { FromWorker, ToWorker } from '../src/asr/protocol';
import { runLadder } from '../src/asr/transcriber';
import { AppError } from '../src/core/errors';

/** Worker de mentira: guarda o que recebeu e deixa o teste mandar as mensagens. */
class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  received: ToWorker | null = null;
  terminated = false;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(m: ToWorker) {
    this.received = m;
  }
  terminate() {
    this.terminated = true;
  }
  send(m: FromWorker) {
    this.onmessage?.({ data: m } as MessageEvent<FromWorker>);
  }
}

const win = (a: number, b: number): AsrWindow => ({ own: { start: a, end: b }, feed: { start: a, end: b }, skip: false });
const windows = [win(0, 10), win(10, 20), win(20, 30)];
const chunk = (text: string) => [{ text: ` ${text}`, timestamp: [1, 2] as [number, number] }];
const started = (w: FakeWorker, index: number, model: 'turbo-webgpu' | 'small-wasm' = 'turbo-webgpu') =>
  w.send({ type: 'progress', stage: 'transcribe', fraction: index / 3, model, window: index + 1, windows: 3, doneSec: index * 10, totalSec: 30 });
const finished = (w: FakeWorker, index: number, text: string) => w.send({ type: 'window', index, result: { window: windows[index]!, chunks: chunk(text) }, retried: false });

describe('trecho travado na transcrição (v0.45.1)', () => {
  beforeEach(() => {
    FakeWorker.all = [];
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('recomeça do trecho travado com o mesmo modelo e não perde o que já foi ouvido', async () => {
    const progress = vi.fn();
    const run = runLadder(new Float32Array(16000 * 30), 30, windows, progress, ['turbo-webgpu', 'small-wasm']);
    const w1 = FakeWorker.all[0]!;
    expect(w1.received?.from).toBe(0);
    started(w1, 0);
    finished(w1, 0, 'um');
    started(w1, 1);
    vi.advanceTimersByTime(149_000);
    expect(FakeWorker.all).toHaveLength(1);
    vi.advanceTimersByTime(2_000);
    expect(w1.terminated).toBe(true);
    const w2 = FakeWorker.all[1]!;
    expect(w2.received?.from).toBe(1);
    expect(w2.received?.ladder).toEqual(['turbo-webgpu', 'small-wasm']);
    expect(w2.received?.audio.length).toBe(16000 * 30);
    expect(progress.mock.calls.at(-1)![0].label).toMatch(/recomeçando/);
    // mensagens atrasadas do processo encerrado não contam
    finished(w1, 1, 'velho');
    started(w1, 2);
    started(w2, 1);
    finished(w2, 1, 'dois');
    started(w2, 2);
    finished(w2, 2, 'três');
    w2.send({ type: 'done', model: 'turbo-webgpu', device: 'webgpu', retried: 0 });
    const r = await run;
    vi.advanceTimersByTime(1_000_000);
    expect(FakeWorker.all).toHaveLength(2);
    expect(r.words.map((w) => w.text.trim())).toEqual(['um', 'dois', 'três']);
    expect(r.fallbacks).toEqual([]);
  });

  it('o mesmo trecho trava de novo: passa para o próximo modelo da escada', async () => {
    const run = runLadder(new Float32Array(16000 * 30), 30, windows, vi.fn(), ['turbo-webgpu', 'small-wasm']);
    const w1 = FakeWorker.all[0]!;
    started(w1, 0);
    vi.advanceTimersByTime(151_000);
    const w2 = FakeWorker.all[1]!;
    started(w2, 0);
    vi.advanceTimersByTime(151_000);
    const w3 = FakeWorker.all[2]!;
    expect(w3.received?.from).toBe(0);
    expect(w3.received?.ladder).toEqual(['small-wasm']);
    for (const i of [0, 1, 2]) {
      started(w3, i, 'small-wasm');
      finished(w3, i, `p${i}`);
    }
    w3.send({ type: 'done', model: 'small-wasm', device: 'wasm', retried: 0 });
    const r = await run;
    expect(r.model).toBe('small-wasm');
    expect(r.fallbacks[0]).toMatch(/travou/);
  });

  it('sem outro modelo, para com M4F-321 em vez de esperar para sempre', async () => {
    const run = runLadder(new Float32Array(16000 * 30), 30, windows, vi.fn(), ['small-wasm']);
    const caught = run.catch((e: unknown) => e);
    started(FakeWorker.all[0]!, 2, 'small-wasm');
    vi.advanceTimersByTime(361_000);
    started(FakeWorker.all[1]!, 2, 'small-wasm');
    vi.advanceTimersByTime(361_000);
    const err = (await caught) as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('M4F-321');
    expect(err.detail).toMatch(/trecho 3 de 3/);
  });

  it('trecho que termina a tempo não dispara o vigia', async () => {
    const run = runLadder(new Float32Array(16000 * 30), 30, windows, vi.fn(), ['turbo-webgpu']);
    const w1 = FakeWorker.all[0]!;
    for (const i of [0, 1, 2]) {
      started(w1, i);
      vi.advanceTimersByTime(100_000);
      finished(w1, i, `p${i}`);
    }
    vi.advanceTimersByTime(1_000_000);
    w1.send({ type: 'done', model: 'turbo-webgpu', device: 'webgpu', retried: 0 });
    expect((await run).words).toHaveLength(3);
    expect(FakeWorker.all).toHaveLength(1);
  });
});
