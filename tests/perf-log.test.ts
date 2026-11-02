import { describe, expect, it } from 'vitest';
import { addPerfEntry, parsePerfEntries, perfLine, perfReport, speedVsRealTime, type AsrPerfEntry, type LlmPerfEntry, type PerfEntry } from '../src/core/perf-log';

const asr = (over: Partial<AsrPerfEntry> = {}): AsrPerfEntry => ({
  kind: 'asr', at: '2026-11-02T20:00:00.000Z', model: 'turbo-webgpu', device: 'webgpu', check: false, language: 'auto',
  speechSec: 120, loadSec: 8.25, inferSec: 30, cached: true, fallbacks: 0, ...over,
});
const llm = (over: Partial<LlmPerfEntry> = {}): LlmPerfEntry => ({
  kind: 'llm', at: '2026-11-02T20:01:00.000Z', model: 'forte', loadSec: 12, promptTokens: 900, replyTokens: 120,
  prefillPerSec: 450.4, decodePerSec: 38.26, totalSec: 5.1, ...over,
});
const device = { app: 'v0.44.0 · abc123', browser: 'Brave', gpu: 'NVIDIA GeForce RTX 5060 (dedicada)', webgpu: true, f16: true, memoryGB: 8 };

describe('perf log (#170)', () => {
  it('speed is speech time over listening time, and none without data or on failure', () => {
    expect(speedVsRealTime(asr())).toBe(4);
    expect(speedVsRealTime(asr({ inferSec: 0 }))).toBeNull();
    expect(speedVsRealTime(asr({ error: 'M4F-302' }))).toBeNull();
  });

  it('keeps the newest first and caps the list', () => {
    let list: PerfEntry[] = [asr({ at: 'a' })];
    list = addPerfEntry(list, asr({ at: 'b' }), 2);
    list = addPerfEntry(list, asr({ at: 'c' }), 2);
    expect(list.map((e) => e.at)).toEqual(['c', 'b']);
  });

  it('drops stored entries with the wrong shape and never throws', () => {
    expect(parsePerfEntries('x')).toEqual([]);
    expect(parsePerfEntries([asr(), { kind: 'asr', at: 1 }, null, llm(), { kind: 'llm', at: 'x', model: 'm', totalSec: 'no' }, llm({ error: 3 as unknown as string })])).toEqual([asr(), llm()]);
  });

  it('report has device, every measured field and no free text from the person', () => {
    const r = perfReport(device, [asr(), asr({ model: 'small-wasm', device: 'wasm', error: 'M4F-302', inferSec: 0 }), llm()]);
    expect(r).toContain('RTX 5060');
    expect(r).toContain('(not VRAM)');
    expect(r).toContain('turbo-webgpu | webgpu | main | auto | 120 | 8.3 | 30 | 4 | yes | 0 |');
    expect(r).toContain('| M4F-302');
    expect(r).toContain('forte | 12 | 900 | 120 | 450.4 | 38.3 | 5.1 |');
    expect(perfReport({ ...device, memoryGB: null }, [])).toContain('No measurements yet.');
  });

  it('screen line follows the interface language', () => {
    expect(perfLine(asr())).toBe('transcrição · turbo-webgpu (webgpu) · 120 s de fala em 30 s (4× o tempo real) · carregar 8.3 s');
    expect(perfLine(asr(), 'en')).toBe('transcription · turbo-webgpu (webgpu) · 120 s of speech in 30 s (4× real time) · load 8.3 s');
    expect(perfLine(llm({ loadSec: null }), 'en')).toBe('local AI · forte · 38.3 tokens/s writing · reply in 5.1 s');
    expect(perfLine(asr({ check: true, error: 'M4F-302' }))).toBe('conferência · turbo-webgpu (webgpu) · falhou M4F-302');
  });
});
