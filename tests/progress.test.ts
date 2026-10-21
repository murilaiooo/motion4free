import { describe, expect, it } from 'vitest';
import { ProgressClock, clipJobFraction, exportProgress, formatDuration, formatEta, phaseOf, progressFacts } from '../src/core/progress';
import { localAiProgress } from '../src/core/llm-models';
import { processingStep } from '../src/core/steps';
import { MB } from '../src/core/bytes';

/** Relógio controlado pelo teste (ms). */
function fakeClock() {
  let t = 0;
  const clock = new ProgressClock(() => t);
  return { clock, at: (ms: number) => (t = ms) };
}

describe('relógio de progresso', () => {
  it('conta o tempo passado desde o começo da tarefa, mesmo trocando de etapa', () => {
    const { clock, at } = fakeClock();
    clock.update({ label: 'Abrindo o vídeo', phase: 'abrir', fraction: null });
    at(4_000);
    clock.update({ label: 'Transcrevendo', phase: 'transcrever-x', fraction: 0 });
    at(10_000);
    const s = clock.snapshot()!;
    expect(s.elapsedSec).toBe(10);
    expect(s.phaseElapsedSec).toBe(6);
  });

  it('estima o que falta pela velocidade medida', () => {
    const { clock, at } = fakeClock();
    clock.update({ label: 'Gerando', phase: 'exportar', fraction: 0 });
    at(10_000);
    clock.update({ label: 'Gerando', phase: 'exportar', fraction: 0.25 });
    // 25% em 10 s → faltam 30 s
    expect(clock.snapshot()!.etaSec).toBeCloseTo(30, 5);
    // sem atualização, o "falta" continua descendo com o tempo
    at(15_000);
    expect(clock.snapshot()!.etaSec).toBeCloseTo(25, 5);
  });

  it('sem total (fração null) não inventa tempo restante', () => {
    const { clock, at } = fakeClock();
    clock.update({ label: 'Procurando silêncios', fraction: null });
    at(3_000);
    const s = clock.snapshot()!;
    expect(s.etaSec).toBeNull();
    expect(progressFacts(s)).toEqual(['Passou 3 s']);
  });

  it('nova etapa recomeça a estimativa', () => {
    const { clock, at } = fakeClock();
    clock.update({ label: 'Baixando', phase: 'modelo', fraction: 0 });
    at(10_000);
    clock.update({ label: 'Baixando', phase: 'modelo', fraction: 0.5 });
    expect(clock.snapshot()!.etaSec).not.toBeNull();
    clock.update({ label: 'Transcrevendo', phase: 'transcrever', fraction: 0 });
    expect(clock.snapshot()!.etaSec).toBeNull();
  });

  it('usa a previsão até medir e para de usar quando passa dela', () => {
    const { clock, at } = fakeClock();
    clock.update({ label: 'Transcrevendo', phase: 'transcrever', fraction: 0, expectedSec: 60 });
    at(20_000);
    let s = clock.snapshot()!;
    expect(s.etaSec).toBe(40);
    expect(s.etaGuess).toBe(true);
    expect(progressFacts(s)[1]).toContain('(previsão)');
    at(70_000);
    s = clock.snapshot()!;
    expect(s.etaSec).toBeNull();
  });

  it('velocidade de download pelos bytes dos últimos segundos', () => {
    const { clock, at } = fakeClock();
    clock.update({ label: 'Baixando', phase: 'modelo', fraction: 0, bytes: { loaded: 0, total: 100 * MB } });
    at(2_000);
    clock.update({ label: 'Baixando', phase: 'modelo', fraction: 0.1, bytes: { loaded: 10 * MB, total: 100 * MB } });
    const s = clock.snapshot()!;
    expect(s.bytesPerSec).toBeCloseTo(5 * MB, 0);
    expect(progressFacts(s)).toContain('10 MB de 100 MB');
    expect(progressFacts(s)).toContain('5 MB/s');
    // nada chega por mais de 5 s: velocidade zero
    at(9_000);
    expect(clock.snapshot()!.bytesPerSec).toBe(0);
  });

  it('a etapa padrão ignora números do texto (trecho 3 de 20 não vira outra etapa)', () => {
    expect(phaseOf({ label: 'trecho 3 de 20', fraction: 0 })).toBe(phaseOf({ label: 'trecho 4 de 20', fraction: 0 }));
  });
});

describe('textos de tempo', () => {
  it('duração', () => {
    expect(formatDuration(8)).toBe('8 s');
    expect(formatDuration(185)).toBe('3 min 05 s');
    expect(formatDuration(3720)).toBe('1 h 02 min');
  });
  it('tempo restante sem falsa precisão', () => {
    expect(formatEta(null)).toBe('calculando…');
    expect(formatEta(3)).toBe('quase pronto');
    expect(formatEta(37)).toBe('cerca de 40 s');
    expect(formatEta(80)).toBe('cerca de 1,5 min');
    expect(formatEta(1500)).toBe('cerca de 25 min');
  });
});

describe('etapas especiais', () => {
  it('exportação: o fim é "fechando o arquivo" na mesma etapa', () => {
    expect(exportProgress(0.5).label).toBe('Gerando o vídeo');
    expect(exportProgress(0.95).label).toBe('Fechando o arquivo MP4');
    expect(exportProgress(0.95).phase).toBe(exportProgress(0.1).phase);
  });
  it('clipe do lote: recortar vale 20%, gerar 80%', () => {
    expect(clipJobFraction({ label: '', phase: 'recortar', fraction: 1 })).toBeCloseTo(0.2);
    expect(clipJobFraction({ label: '', phase: 'exportar', fraction: 0.5 })).toBeCloseTo(0.6);
  });
  it('IA no navegador: lê os MB do texto do WebLLM', () => {
    const p = localAiProgress('leve', 0.3, 'Fetching param cache[5/38]: 120MB fetched. 30% completed, 12 secs elapsed.');
    expect(p.label).toContain('Baixando');
    expect(p.bytes?.loaded).toBe(120 * MB);
    expect(localAiProgress('leve', 0.3, 'Loading model from cache[5/38]: 120MB loaded. 30% completed').label).toContain('já guardada');
    expect(localAiProgress('leve', 0.9, 'Loading GPU shader modules[3/40]: 7% completed').label).toContain('placa de vídeo');
  });
  it('passo da tela de processamento pela etapa', () => {
    expect(processingStep('Leve não funcionou aqui; tentando Rápida', 'reserva-small-wasm')).toBe(2);
    expect(processingStep('Preparando o modelo', 'preparar-x')).toBe(2);
    expect(processingStep('Procurando silêncios', 'silencios')).toBe(1);
    expect(processingStep('Montando a edição', 'montar')).toBe(3);
  });
});
