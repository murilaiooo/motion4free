import { normalizeWord, type RawWord } from './asr-merge';

/** Folga de tempo para procurar a mesma palavra na outra transcrição (os dois modelos marcam tempos diferentes). */
const SLACK_SEC = 0.35;
/** Acima disso de discordância, a segunda IA provavelmente ouviu outra coisa (idioma, ruído): a conferência não vale. */
export const MAX_DISAGREEMENT = 0.4;

export interface CrossCheckResult {
  /** palavras da transcrição principal; as que a segunda IA não confirmou ganham `needsReview` */
  words: RawWord[];
  /** quantas palavras foram marcadas para revisar */
  flagged: number;
  /** fração das palavras conferidas que foram marcadas (0 a 1) */
  disagreement: number;
  /** true quando a discordância passou de MAX_DISAGREEMENT e nada foi marcado */
  ignored: boolean;
}

/**
 * Conferência dupla (v0.38): compara a transcrição principal com a de uma segunda IA de outra família.
 * Uma palavra é confirmada quando a outra IA disse a mesma palavra perto do mesmo instante (ou a mesma
 * palavra escrita junto/separado, como "fazê-lo" e "fazê lo"). Números não são marcados: os modelos
 * escrevem "10" e "dez" de jeitos diferentes. Puro e sem navegador; as palavras não mudam, só a marca.
 */
export function crossCheck(primary: readonly RawWord[], second: readonly RawWord[]): CrossCheckResult {
  const other = second.map((w) => ({ start: w.start, end: w.end, norm: normalizeWord(w.text) })).filter((w) => w.norm).sort((a, b) => a.start - b.start);
  const flags = primary.map((w) => {
    const norm = normalizeWord(w.text);
    if (!norm || /\d/.test(norm) || /\d/.test(w.text)) return false;
    const from = w.start - SLACK_SEC;
    const to = w.end + SLACK_SEC;
    // primeira palavra da outra IA que termina depois de `from` (busca binária pelo início, com folga)
    let lo = 0;
    let hi = other.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (other[mid]!.start < from - 2) lo = mid + 1;
      else hi = mid;
    }
    const near: string[] = [];
    for (let i = lo; i < other.length && other[i]!.start <= to; i++) if (other[i]!.end >= from) near.push(other[i]!.norm);
    if (near.includes(norm)) return false;
    // escrito junto ou separado: "fazê-lo" (fazêlo) contra "fazê" + "lo"; "porque" contra "por" + "que"
    for (let i = 0; i < near.length; i++) {
      let joined = near[i]!;
      for (let k = i + 1; k < near.length && joined.length < norm.length; k++) {
        joined += near[k]!;
        if (joined === norm) return false;
      }
    }
    return true;
  });
  const checked = primary.filter((w) => normalizeWord(w.text) && !/\d/.test(w.text)).length;
  const flagged = flags.filter(Boolean).length;
  const disagreement = checked > 0 ? flagged / checked : 0;
  if (disagreement > MAX_DISAGREEMENT) return { words: primary.map((w) => ({ ...w })), flagged: 0, disagreement, ignored: true };
  return { words: primary.map((w, i) => (flags[i] ? { ...w, needsReview: true } : { ...w })), flagged, disagreement, ignored: false };
}
