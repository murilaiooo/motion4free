import { describe, expect, it } from 'vitest';
import { interpretRangePrompt } from '../src/editorial/range-interpret';

describe('interpretRangePrompt', () => {
  it('"mais calmo aqui" = tom calmo, pouco movimento e ritmo lento', () => {
    const r = interpretRangePrompt('mais calmo aqui');
    expect(r.understood).toBe(true);
    expect(r.tone).toBe('calmo');
    expect(r.intensity).toBe('baixa');
    expect(r.pace).toBe('lento');
    expect(r.quiet || r.swap || r.accent || r.lock !== null).toBe(false);
  });

  it('"sem animação aqui" = trecho limpo', () => {
    const r = interpretRangePrompt('sem animação aqui');
    expect(r.quiet).toBe(true);
    expect(r.forbid).toEqual([]);
  });

  it('"troca essa animação" e variações = trocar', () => {
    for (const t of ['troca essa animação', 'Troque a animação', 'outra animação', 'muda o efeito', 'troca isso']) {
      const r = interpretRangePrompt(t);
      expect(r.swap, t).toBe(true);
      expect(r.quiet, t).toBe(false);
    }
  });

  it('"destaque isso" = destaque do trecho; "destaque os números aqui" = destaque de números', () => {
    expect(interpretRangePrompt('destaque isso').accent).toBe(true);
    expect(interpretRangePrompt('Destaca aqui!').accent).toBe(true);
    const n = interpretRangePrompt('destaque os números aqui');
    expect(n.accent).toBe(false);
    expect(n.emphasize).toEqual(['numeros']);
  });

  it('travar e destravar', () => {
    expect(interpretRangePrompt('trava esse pedaço').lock).toBe(true);
    expect(interpretRangePrompt('não mexe mais aqui').lock).toBe(true);
    expect(interpretRangePrompt('destrava esse trecho').lock).toBe(false);
    expect(interpretRangePrompt('libera').lock).toBe(false);
  });

  it('combinações: ajuste + trava', () => {
    const r = interpretRangePrompt('sem zoom aqui e trava');
    expect(r.forbid).toEqual(['zoom']);
    expect(r.lock).toBe(true);
  });

  it('voltar ao normal', () => {
    expect(interpretRangePrompt('volta ao normal').reset).toBe(true);
    expect(interpretRangePrompt('deixa como estava').reset).toBe(true);
  });

  it('"sem animação" vence destaque e troca no mesmo pedido', () => {
    const r = interpretRangePrompt('destaque isso mas sem animação aqui');
    expect(r.quiet).toBe(true);
    expect(r.accent).toBe(false);
    expect(r.notes.join(' ')).toContain('sem animação');
  });

  it('estilo pedido no trecho vira nota (vale para o vídeo inteiro)', () => {
    const r = interpretRangePrompt('estilo editorial aqui');
    expect(r.notes.join(' ')).toContain('vídeo inteiro');
  });

  it('texto desconhecido não é entendido e lista palavras; vazio e longo dão erro com código', () => {
    const r = interpretRangePrompt('xyz banana aqui');
    expect(r.understood).toBe(false);
    expect(r.ignored).toContain('banana');
    expect(() => interpretRangePrompt('  ')).toThrow(/M4F-1001/);
    expect(() => interpretRangePrompt('a'.repeat(201))).toThrow(/M4F-1002/);
  });
});
