import type { RawWord } from '../analysis/asr-merge';
import type { AsrWindow } from '../analysis/asr-windows';
import type { ProviderId } from '../ai/providers/registry';

/**
 * Transcrição por API (issue #127), parte pura: quais serviços transcrevem áudio de verdade direto do
 * navegador, como dividir o áudio em pedaços aceitos e como ler a resposta. Sem rede aqui.
 *
 * Verificado nas documentações oficiais (out/2026): OpenAI `/v1/audio/transcriptions` (whisper-1) e Groq
 * `/openai/v1/audio/transcriptions` (whisper-large-v3 / -turbo) aceitam multipart com
 * `response_format=verbose_json` e `timestamp_granularities[]=word`, limite de 25 MB por arquivo.
 * OpenRouter, Gemini e Claude não oferecem transcrição com tempo por palavra: não entram na lista.
 */
export interface AsrApiModel {
  id: string;
  label: string;
  note: string;
}

export interface AsrApiSpec {
  provider: ProviderId;
  url: string;
  models: AsrApiModel[];
  /** limite do arquivo enviado, com folga */
  maxBytes: number;
  cost: string;
}

export const ASR_APIS: Partial<Record<ProviderId, AsrApiSpec>> = {
  groq: {
    provider: 'groq',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    models: [
      { id: 'whisper-large-v3-turbo', label: 'Whisper Large v3 Turbo', note: 'rápido; bom para a maioria dos vídeos' },
      { id: 'whisper-large-v3', label: 'Whisper Large v3', note: 'mais preciso, um pouco mais lento' },
    ],
    maxBytes: 24 * 1024 * 1024,
    cost: 'O plano gratuito da Groq tem limite de minutos de áudio por hora e por dia; acima disso ela pede para esperar (M4F-1206). Só cobra se você ativar um plano pago.',
  },
  openai: {
    provider: 'openai',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    models: [{ id: 'whisper-1', label: 'Whisper (OpenAI)', note: 'cobra por minuto de áudio na sua conta de API' }],
    maxBytes: 24 * 1024 * 1024,
    cost: 'A API da OpenAI cobra por minuto de áudio, separado da assinatura do ChatGPT. Confira o preço atual na página da OpenAI.',
  },
};

export const isAsrProvider = (id: ProviderId | null | undefined): id is ProviderId => !!id && !!ASR_APIS[id];

const SAMPLE_RATE = 16_000;
/** WAV 16 bits mono 16 kHz: 32 000 bytes por segundo. */
export const WAV_BYTES_PER_SEC = SAMPLE_RATE * 2;

export interface AsrChunk { start: number; end: number }

/**
 * Junta as janelas (já cortadas nas pausas da fala) em pedaços que cabem no limite do serviço.
 * Os cortes caem sempre numa pausa, então nenhuma palavra é partida entre dois envios.
 */
export function planAsrChunks(windows: readonly AsrWindow[], durationSec: number, maxBytes: number): AsrChunk[] {
  const maxSec = Math.max(30, Math.floor((maxBytes - 1024) / WAV_BYTES_PER_SEC));
  const spans = windows.filter((w) => !w.skip).map((w) => ({ start: w.own.start, end: w.own.end }));
  if (spans.length === 0) return durationSec > 0 ? splitEven(0, durationSec, maxSec) : [];
  const chunks: AsrChunk[] = [];
  let current: AsrChunk | null = null;
  for (const span of spans) {
    if (current && span.end - current.start <= maxSec) { current.end = span.end; continue; }
    if (current) chunks.push(current);
    current = span.end - span.start > maxSec ? null : { ...span };
    if (!current) chunks.push(...splitEven(span.start, span.end, maxSec));
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitEven(start: number, end: number, maxSec: number): AsrChunk[] {
  const n = Math.ceil((end - start) / maxSec);
  return Array.from({ length: n }, (_, i) => ({ start: start + ((end - start) * i) / n, end: start + ((end - start) * (i + 1)) / n }));
}

/** PCM float → WAV 16 bits (o formato que todos os serviços aceitam, sem codificador extra). */
export function encodeWav(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, WAV_BYTES_PER_SEC, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return out;
}

export const sliceSamples = (audio: Float32Array, chunk: AsrChunk): Float32Array =>
  audio.subarray(Math.max(0, Math.floor(chunk.start * SAMPLE_RATE)), Math.min(audio.length, Math.ceil(chunk.end * SAMPLE_RATE)));

/**
 * Lê `verbose_json` com palavras. Tempos ficam relativos ao vídeo (somando o início do pedaço) e são
 * conferidos: fora do pedaço, negativos ou fora de ordem são corrigidos ou descartados, nunca inventados.
 * Devolve `null` quando o serviço não mandou tempo por palavra (não dá para cortar por palavra assim).
 */
export function parseVerboseWords(json: unknown, chunk: AsrChunk): RawWord[] | null {
  if (!json || typeof json !== 'object') return null;
  const words = (json as { words?: unknown }).words;
  if (!Array.isArray(words)) return null;
  const length = chunk.end - chunk.start;
  const out: RawWord[] = [];
  let last = chunk.start;
  for (const item of words) {
    if (!item || typeof item !== 'object') continue;
    const { word, start, end } = item as { word?: unknown; start?: unknown; end?: unknown };
    if (typeof word !== 'string' || typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    const text = word.trim();
    if (!text) continue;
    const s = Math.max(last, chunk.start + Math.min(Math.max(0, start), length));
    const e = Math.max(s + 0.01, chunk.start + Math.min(Math.max(0, end), length));
    out.push({ text, start: s, end: Math.min(e, chunk.end) });
    last = s;
  }
  return out;
}
