import { AppError } from '../core/errors';
import { formatClock } from '../core/bytes';
import type { OnProgress } from '../core/progress';
import type { AsrWindow } from '../analysis/asr-windows';
import type { AsrCandidateId, AsrMode } from '../core/asr-models';
import { getKey } from '../ai/credentials/keys';
import { PROVIDERS, allowedUrl, providerErrorKey, type ProviderId } from '../ai/providers/registry';
import { ASR_APIS, encodeWav, parseVerboseWords, planAsrChunks, sliceSamples } from './remote-plan';
import { asrProblem, getAsrRoute } from './route';
import type { Transcriber, TranscriptResult } from './transcriber';

const CHUNK_TIMEOUT_MS = 5 * 60_000;

/** Envia o áudio (só o áudio, em WAV, por pedaços cortados nas pausas) direto do navegador para a API. */
export async function transcribeByApi(provider: ProviderId, model: string, audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress): Promise<TranscriptResult> {
  const spec = ASR_APIS[provider];
  const key = getKey(provider);
  if (!spec || !key) throw new AppError('ASR_API_NAO_PRONTA', 'chave fechada');
  if (!allowedUrl(provider, spec.url)) throw new AppError('PROVEDOR_BLOQUEADO', PROVIDERS[provider].host);
  const chunks = planAsrChunks(windows, durationSec, spec.maxBytes);
  const words: TranscriptResult['words'] = [];
  const name = PROVIDERS[provider].name;
  for (const [i, chunk] of chunks.entries()) {
    onProgress({
      label: `Transcrevendo por API no ${name}`,
      phase: 'transcrever-api',
      fraction: i / Math.max(1, chunks.length),
      detail: `pedaço ${i + 1} de ${chunks.length} · ${formatClock(chunk.start)}–${formatClock(chunk.end)} · enviando só o áudio`,
    });
    const form = new FormData();
    form.append('file', new Blob([encodeWav(sliceSamples(audio16k, chunk)) as BlobPart], { type: 'audio/wav' }), 'fala.wav');
    form.append('model', model);
    form.append('language', 'pt');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHUNK_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(spec.url, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    } catch {
      // nunca ecoar a exceção do fetch (pode conter cabeçalhos)
      throw new AppError(ctrl.signal.aborted ? 'PROVEDOR_DEMOROU' : 'PROVEDOR_BLOQUEADO', PROVIDERS[provider].host);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    if (res.status === 413) throw new AppError('ASR_API_GRANDE', `${PROVIDERS[provider].host} HTTP 413`);
    if (!res.ok) throw new AppError(providerErrorKey(res.status, text), `${PROVIDERS[provider].host} HTTP ${res.status}`);
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw new AppError('ASR_API_SEM_TEMPOS', 'resposta não é JSON'); }
    const parsed = parseVerboseWords(json, chunk);
    if (!parsed) throw new AppError('ASR_API_SEM_TEMPOS', `${name} ${model}`);
    words.push(...parsed);
  }
  onProgress({ label: `Transcrição por API concluída (${name})`, phase: 'transcrever-api', fraction: 1 });
  const label = spec.models.find((m) => m.id === model)?.label ?? model;
  return { words, model: `${label} por API (${name})`, notices: [] };
}

/**
 * Decide quem transcreve conforme Configurações › Transcrição. Nunca envia áudio sem autorização própria
 * de áudio; se a API escolhida não está pronta ou falha, avisa com código e só usa o Whisper local se a
 * pessoa deixou essa reserva ligada.
 */
export class RoutedTranscriber implements Transcriber {
  constructor(private local: Transcriber) {}
  async transcribe(audio16k: Float32Array, durationSec: number, windows: AsrWindow[], onProgress: OnProgress, mode?: AsrMode | AsrCandidateId[]): Promise<TranscriptResult> {
    const route = getAsrRoute();
    if (route.kind !== 'api') return this.local.transcribe(audio16k, durationSec, windows, onProgress, mode);
    const problem = asrProblem(route);
    if (problem) {
      if (!route.fallbackLocal) throw new AppError('ASR_API_BLOQUEADA', problem);
      const r = await this.local.transcribe(audio16k, durationSec, windows, onProgress, mode);
      return { ...r, notices: [new AppError('ASR_API_NAO_PRONTA', `${problem}. Nada foi enviado.`), ...r.notices] };
    }
    try {
      return await transcribeByApi(route.provider!, route.model!, audio16k, durationSec, windows, onProgress);
    } catch (err) {
      const e = err instanceof AppError ? err : new AppError('ASR_API_FALHOU');
      if (!route.fallbackLocal) throw e;
      onProgress({ label: 'A transcrição por API falhou; usando o Whisper deste computador', phase: 'reserva-local', fraction: null });
      const r = await this.local.transcribe(audio16k, durationSec, windows, onProgress, mode);
      return { ...r, notices: [new AppError('ASR_API_FALHOU', `${e.code}: ${e.title}`), ...r.notices] };
    }
  }
}
