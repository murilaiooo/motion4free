import { foldAccents, normalizeWord } from './asr-merge';

/**
 * Taxa de erro por palavra (WER) entre a transcrição de referência (o que foi dito de verdade, digitado
 * por uma pessoa) e a do app. WER = (trocas + faltas + sobras) / palavras da referência.
 * "Acerto" que o responsável mede de olho ≈ 1 − WER.
 *
 * Normalização: minúsculas e sem pontuação (a legenda tem pontuação, a referência pode não ter).
 * Acentos contam por padrão ("é" ≠ "e" muda o sentido); `ignoreAccents` mostra quanto do erro é só acento.
 */
export interface WerOptions {
  ignoreAccents?: boolean;
}

export type AlignOp =
  | { op: 'ok'; ref: string; hyp: string }
  | { op: 'troca'; ref: string; hyp: string }
  | { op: 'falta'; ref: string }
  | { op: 'sobra'; hyp: string };

export interface WerResult {
  wer: number;
  /** 1 − WER, limitado a [0, 1] */
  accuracy: number;
  refWords: number;
  hypWords: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  ops: AlignOp[];
}

export function tokenize(text: string, opts: WerOptions = {}): string[] {
  return text
    .split(/[\s\-‐-―/]+/)
    .map((w) => normalizeWord(opts.ignoreAccents ? foldAccents(w) : w))
    .filter(Boolean);
}

/** Alinhamento de Levenshtein por palavra (custo 1 para troca, falta e sobra). */
export function align(ref: string[], hyp: string[]): AlignOp[] {
  const n = ref.length;
  const m = hyp.length;
  const d: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = d[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      d[i]![j] = Math.min(sub, d[i - 1]![j]! + 1, d[i]![j - 1]! + 1);
    }
  }
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      ops.push(ref[i - 1] === hyp[j - 1] ? { op: 'ok', ref: ref[i - 1]!, hyp: hyp[j - 1]! } : { op: 'troca', ref: ref[i - 1]!, hyp: hyp[j - 1]! });
      i--;
      j--;
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) {
      ops.push({ op: 'falta', ref: ref[i - 1]! });
      i--;
    } else {
      ops.push({ op: 'sobra', hyp: hyp[j - 1]! });
      j--;
    }
  }
  return ops.reverse();
}

export function wordErrorRate(reference: string, hypothesis: string, opts: WerOptions = {}): WerResult {
  const ref = tokenize(reference, opts);
  const hyp = tokenize(hypothesis, opts);
  const ops = align(ref, hyp);
  const substitutions = ops.filter((o) => o.op === 'troca').length;
  const deletions = ops.filter((o) => o.op === 'falta').length;
  const insertions = ops.filter((o) => o.op === 'sobra').length;
  const errors = substitutions + deletions + insertions;
  const wer = ref.length === 0 ? (hyp.length === 0 ? 0 : 1) : errors / ref.length;
  return { wer, accuracy: Math.max(0, Math.min(1, 1 - wer)), refWords: ref.length, hypWords: hyp.length, substitutions, deletions, insertions, ops };
}

/** Os erros mais frequentes ("referência → app"), para saber o que o modelo erra sempre. */
export function topErrors(ops: AlignOp[], limit = 10): { pair: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const o of ops) {
    const pair = o.op === 'troca' ? `${o.ref} → ${o.hyp}` : o.op === 'falta' ? `${o.ref} → (faltou)` : o.op === 'sobra' ? `(sobrou) → ${o.hyp}` : null;
    if (pair) counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair))
    .slice(0, limit);
}
