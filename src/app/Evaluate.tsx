import { useState } from 'react';
import { cleanTranscript } from '../analysis/asr-merge';
import { planAsr } from '../analysis/asr-windows';
import { findSilences } from '../analysis/silence';
import { topErrors, wordErrorRate, type AlignOp, type WerResult } from '../analysis/wer';
import { WhisperTranscriber } from '../asr/transcriber';
import { ASR_CANDIDATES, type AsrCandidateId, type AsrMode } from '../core/asr-models';
import { toAppError, type AppError } from '../core/errors';
import { toMono16k } from '../media/audio';
import { VERSION_LABEL } from '../version';
import { ErrorBox } from './ErrorBox';
import { ProgressPanel } from './ProgressPanel';
import type { Progress } from '../core/progress';
import { openWithAudio } from './pipeline';

type Choice = AsrMode | AsrCandidateId;
const CHOICES: { value: Choice; label: string }[] = [
  { value: 'precisa', label: 'Precisa (escolha automática do app)' },
  { value: 'rapida', label: 'Rápida (escolha automática do app)' },
  ...(Object.keys(ASR_CANDIDATES) as AsrCandidateId[]).map((id) => ({ value: id as Choice, label: `Só ${ASR_CANDIDATES[id].label}` })),
];

interface Outcome {
  model: string;
  seconds: number;
  durationSec: number;
  windows: number;
  clean: WerResult;
  raw: WerResult;
  noAccents: WerResult;
  text: string;
  timing: string;
  notices: AppError[];
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')}%`;

function Diff({ ops }: { ops: AlignOp[] }) {
  return (
    <p data-testid="eval-diff" style={{ lineHeight: 1.8 }}>
      {ops.map((o, i) =>
        o.op === 'ok' ? (
          <span key={i}>{o.ref} </span>
        ) : o.op === 'troca' ? (
          <span key={i} title={`dito: ${o.ref}`} style={{ background: '#fd4', color: '#000' }}>
            <s>{o.ref}</s>→{o.hyp}{' '}
          </span>
        ) : o.op === 'falta' ? (
          <span key={i} title="faltou na legenda" style={{ background: '#f88', color: '#000' }}>
            <s>{o.ref}</s>{' '}
          </span>
        ) : (
          <span key={i} title="sobrou na legenda" style={{ background: '#8cf', color: '#000' }}>
            +{o.hyp}{' '}
          </span>
        ),
      )}
    </p>
  );
}

/**
 * `?avaliar`: mede o acerto da legenda num vídeo real. A pessoa escolhe o vídeo e cola o que foi dito de
 * verdade; a página transcreve com o modelo escolhido (tudo no aparelho) e mostra a taxa de erro (WER),
 * os erros mais comuns e o tempo gasto. Ver docs/ai/avaliar-legenda.md.
 */
export function Evaluate() {
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [choice, setChoice] = useState<Choice>('precisa');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  async function run() {
    if (!file) return;
    setOutcome(null);
    setError(null);
    const t0 = performance.now();
    try {
      const step = (p: Progress) => setProgress(p);
      const { media, audio } = await openWithAudio(file, step);
      if (!audio) throw toAppError(new Error('vídeo sem áudio'), 'SEM_AUDIO');
      const mono = await toMono16k(audio);
      const silences = findSilences(mono, 16000);
      const windows = planAsr(silences, media.durationSec);
      const mode = choice === 'precisa' || choice === 'rapida' ? choice : [choice];
      const r = await new WhisperTranscriber().transcribe(mono.slice(), media.durationSec, windows, step, mode);
      const cleaned = cleanTranscript(r.words, silences);
      const text = cleaned.map((w) => w.text).join(' ');
      setOutcome({
        model: r.model,
        seconds: (performance.now() - t0) / 1000,
        durationSec: media.durationSec,
        windows: windows.filter((w) => !w.skip).length,
        clean: wordErrorRate(reference, text),
        raw: wordErrorRate(reference, r.words.map((w) => w.text).join(' ')),
        noAccents: wordErrorRate(reference, text, { ignoreAccents: true }),
        text,
        timing: cleaned.map((w) => `${w.start.toFixed(2)}\t${w.end.toFixed(2)}\t${w.text}`).join('\n'),
        notices: r.notices,
      });
    } catch (err) {
      setError(toAppError(err, 'TRANSCRICAO_FALHOU'));
    } finally {
      setProgress(null);
    }
  }

  return (
    <main className="app">
      <h1>Motion4Free · avaliar a legenda</h1>
      <p className="sub">
        Página de teste: mede quantas palavras a legenda acerta num vídeo seu. Nada é enviado; o vídeo fica no seu computador. <a href="./">Voltar ao editor</a>
      </p>
      <label className="drop">
        <input type="file" accept="video/*" data-testid="eval-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? `Vídeo: ${file.name}` : 'Clique para escolher o vídeo'}
      </label>
      <label>
        <b>O que foi dito de verdade</b> (digite ou cole o texto exato da fala; pontuação e maiúsculas não importam)
        <textarea data-testid="eval-reference" rows={8} style={{ width: '100%' }} value={reference} onChange={(e) => setReference(e.target.value)} />
      </label>
      <p>
        <label>
          Modelo:{' '}
          <select data-testid="eval-model" value={choice} onChange={(e) => setChoice(e.target.value as Choice)}>
            {CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>{' '}
        <button data-testid="eval-run" disabled={!file || !reference.trim() || !!progress} onClick={run}>
          Transcrever e medir
        </button>
      </p>
      <ProgressPanel progress={progress} />
      {error && <ErrorBox error={error} kind="error" />}
      {outcome && (
        <section data-testid="eval-result">
          {outcome.notices.map((n) => (
            <ErrorBox key={n.code} error={n} kind="warning" />
          ))}
          <h2>
            Acerto: {pct(outcome.clean.accuracy)} (erro por palavra, WER: {pct(outcome.clean.wer)})
          </h2>
          <p>
            {outcome.model} · {outcome.durationSec.toFixed(0)} s de vídeo em {outcome.windows} trechos · levou {outcome.seconds.toFixed(0)} s (contando o download, se foi a primeira vez) ·{' '}
            {outcome.clean.refWords} palavras ditas, {outcome.clean.hypWords} na legenda · trocas {outcome.clean.substitutions}, faltas {outcome.clean.deletions}, sobras{' '}
            {outcome.clean.insertions}
          </p>
          <p>
            Sem a limpeza de alucinações: {pct(outcome.raw.accuracy)} · Ignorando acentos: {pct(outcome.noAccents.accuracy)}
          </p>
          <h3>Erros mais comuns (dito → legenda)</h3>
          <ul>
            {topErrors(outcome.clean.ops).map((e) => (
              <li key={e.pair}>
                {e.pair} ({e.count}×)
              </li>
            ))}
          </ul>
          <h3>Comparação palavra a palavra</h3>
          <Diff ops={outcome.clean.ops} />
          <h3>Tempo de cada palavra (início, fim, palavra)</h3>
          <textarea readOnly rows={8} style={{ width: '100%', fontFamily: 'monospace' }} value={outcome.timing} />
        </section>
      )}
      <footer className="version" data-testid="version">
        Motion4Free {VERSION_LABEL}
      </footer>
    </main>
  );
}
