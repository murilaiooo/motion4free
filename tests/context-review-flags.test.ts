import { describe, expect, it } from 'vitest';
import type { Word } from '../src/core/types';
import { CONTEXT_LABELS, contextFlags } from '../src/editorial/context-policy';
import { buildTranscriptIndex } from '../src/editorial/clip-context';
import { groundedMoment, rankContextualMoments } from '../src/editorial/clip-candidates';

const words = (text: string): Word[] => text.split(' ').map((word, i) => ({
  id: 'w' + i, text: word, start: i, end: i + 0.7,
}));
const option = { length: 'curto' as const, count: 4 };

describe('issue #102: revisão de contexto sem mudar o sentido da gravação', () => {
  it('sinaliza negação, condição e comparação PT/EN sem classificar erroneamente "no vídeo" como negação', () => {
    expect(contextFlags('Se não for possível, escolha outro modelo mais leve.')).toEqual(['negation', 'conditional', 'comparison']);
    expect(contextFlags('If it is not better, do not choose the expensive version.')).toEqual(['negation', 'conditional', 'comparison']);
    expect(contextFlags('No vídeo, o apresentador apresenta o projeto.')).not.toContain('negation');
    expect(contextFlags('No discount is available')).toContain('negation');
  });

  it('informa risco factual nos motivos, preserva os timestamps, a negação e a nota editorial', () => {
    const transcript = words('Se você não comprar agora o desconto deixa de valer pois o preço pode ser maior amanhã então confira todos os detalhes antes de decidir hoje.');
    const index = buildTranscriptIndex(transcript, 30);
    const baseline = groundedMoment(index, 0, transcript.length - 1, option)!;
    expect(baseline).not.toBeNull();
    expect(baseline.text).toContain('não');
    expect(baseline.reasons).toContain(CONTEXT_LABELS.negation);
    expect(baseline.reasons).toContain(CONTEXT_LABELS.conditional);
    expect(baseline.reasons).toContain(CONTEXT_LABELS.comparison);
    expect(baseline.start).toBeGreaterThanOrEqual(0);
    expect(baseline.end).toBeLessThanOrEqual(30);
    expect(baseline.sourceEvidence?.review).toEqual([]);
    const other = groundedMoment(buildTranscriptIndex(words('Este exemplo apresenta uma dica útil para comparar duas opções simples e escolher corretamente quando os dados estão disponíveis e existem escolhas claras hoje.'), 30), 0, 24, option);
    if (other) {
      const ranked = rankContextualMoments([baseline, other], 2);
      expect(ranked.find(m => m.id === baseline.id)?.score).toBe(baseline.score);
    }
  });

  it('avisos são contexto lexical, não classificação de sentimento/certeza e não inventam transcrição', () => {
    const transcript = words('Isso depende da situação e pode mudar conforme seu plano de uso portanto confira o resultado e procure confirmação antes de divulgar esta informação.');
    const index = buildTranscriptIndex(transcript, 30);
    const clip = groundedMoment(index, 0, transcript.length - 1, option)!;
    expect(clip).not.toBeNull();
    expect(clip.reasons).toContain(CONTEXT_LABELS.reference);
    expect(clip.reasons).toContain(CONTEXT_LABELS.conditional);
    expect(clip.title).toMatch(/Trecho em/);
    expect(clip.text).toBe(transcript.map(w => w.text).join(' '));
  });
});