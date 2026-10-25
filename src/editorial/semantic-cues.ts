import type { Segment, Word } from '../core/types';

/**
 * Pequeno agendador de eventos visuais ancorados em IDs de palavras.
 * Implementação própria do Motion4Free; não importa código ou dependências do Hypit.
 *
 * A palavra vive no tempo da mídia de origem. Cada ocorrência íntegra dessa palavra
 * em um segmento mantido produz uma janela no tempo editado, inclusive em cópias
 * e reordenações. O resultado usa frames e intervalos [início, fim).
 *
 * Esta camada não decide que palavras destacar nem executa renderizações.
 */
export interface SemanticCue {
  id: string;
  wordId: string;
  edge: 'start' | 'end';
  /** Deslocamento assinado, em frames da composição. */
  offsetFrames: number;
  /** Duração desejada, em frames, antes do recorte na borda do segmento. */
  durationFrames: number;
}

export interface ScheduledSemanticCue {
  id: string;
  cueId: string;
  wordId: string;
  /** Índice da ocorrência do trecho na timeline editada. */
  segmentIndex: number;
  startFrame: number;
  endFrameExclusive: number;
}

const EPS = 1e-6;

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function frame(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/**
 * Gera janelas sem ler arquivos, chamar IA ou modificar o EditPlan.
 * Palavras cortadas parcialmente não recebem evento; palavras removidas somem.
 * Não usa sourceToOutput(), que retorna apenas a primeira ocorrência da palavra.
 */
export function scheduleSemanticCues(
  words: readonly Pick<Word, 'id' | 'start' | 'end'>[],
  segments: readonly Pick<Segment, 'srcStart' | 'srcEnd'>[],
  cues: readonly SemanticCue[],
  fps: number,
): ScheduledSemanticCue[] {
  if (!Number.isSafeInteger(fps) || fps < 1 || fps > 240) {
    throw new RangeError('fps deve ser um inteiro de 1 a 240');
  }

  const byId = new Map<string, (typeof words)[number]>();
  for (const word of words) {
    if (!word.id || byId.has(word.id) || !finiteNonNegative(word.start)
      || !Number.isFinite(word.end) || word.end <= word.start) {
      throw new RangeError('Palavras devem ter IDs únicos e tempos válidos');
    }
    byId.set(word.id, word);
  }

  const ids = new Set<string>();
  for (const cue of cues) {
    if (!cue.id || ids.has(cue.id) || !cue.wordId || !['start', 'end'].includes(cue.edge)
      || !Number.isSafeInteger(cue.offsetFrames) || !Number.isSafeInteger(cue.durationFrames)
      || cue.durationFrames < 1) {
      throw new RangeError('Evento semântico inválido');
    }
    ids.add(cue.id);
  }

  const result: ScheduledSemanticCue[] = [];
  let outSeconds = 0;
  segments.forEach((segment, segmentIndex) => {
    if (!finiteNonNegative(segment.srcStart) || !Number.isFinite(segment.srcEnd)
      || segment.srcEnd <= segment.srcStart) {
      throw new RangeError('Segmento inválido');
    }
    const startBound = frame(outSeconds, fps);
    const endBound = frame(outSeconds + segment.srcEnd - segment.srcStart, fps);

    for (const cue of cues) {
      const word = byId.get(cue.wordId);
      if (!word || word.start < segment.srcStart - EPS || word.end > segment.srcEnd + EPS) continue;
      const sourceAnchor = cue.edge === 'end' ? word.end : word.start;
      const instant = frame(outSeconds + sourceAnchor - segment.srcStart, fps) + cue.offsetFrames;
      const startFrame = Math.max(startBound, instant);
      const endFrameExclusive = Math.min(endBound, instant + cue.durationFrames);
      if (startFrame >= endFrameExclusive) continue;
      result.push({
        id: `${cue.id}@segment-${segmentIndex}`,
        cueId: cue.id,
        wordId: cue.wordId,
        segmentIndex,
        startFrame,
        endFrameExclusive,
      });
    }
    outSeconds += segment.srcEnd - segment.srcStart;
  });

  return result.sort((a, b) => a.startFrame - b.startFrame
    || a.segmentIndex - b.segmentIndex || a.cueId.localeCompare(b.cueId));
}
