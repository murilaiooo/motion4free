import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF, PROHIBITIONS, type CreativeBrief } from '../src/core/brief';
import { DOCUMENTAL, EDITORIAL, POP, PRESETS } from '../src/core/presets';
import { styleSchema } from '../src/core/style';
import { FORBIDDEN_KINDS, sceneOptionsFor, styleForBrief } from '../src/editorial/brief-apply';

const brief = (b: Partial<CreativeBrief>): CreativeBrief => ({ ...EMPTY_BRIEF, ...b });

describe('styleForBrief', () => {
  it('pedido vazio devolve o preset igual (cópia)', () => {
    for (const p of PRESETS) {
      const s = styleForBrief(p, EMPTY_BRIEF);
      expect(s).toEqual(p);
      expect(s).not.toBe(p);
    }
  });

  it('calmo: menos movimento e ritmo mais lento, mesmo id e nome', () => {
    const s = styleForBrief(POP, brief({ intensity: 'baixa', pace: 'lento' }));
    expect(s.id).toBe('pop');
    expect(s.name).toBe('Pop');
    expect(s.motion.intensity).toBeLessThan(POP.motion.intensity);
    expect(s.rhythm.overlaysPer10s).toBeLessThan(POP.rhythm.overlaysPer10s);
    expect(s.rhythm.minGapSec).toBeGreaterThan(POP.rhythm.minGapSec);
    expect(s.transition).toBe('dip');
  });

  it('animado e rápido: mais movimento e mais cenas', () => {
    const s = styleForBrief(EDITORIAL, brief({ intensity: 'alta', pace: 'rapido' }));
    expect(s.motion.intensity).toBeGreaterThan(EDITORIAL.motion.intensity);
    expect(s.rhythm.overlaysPer10s).toBeGreaterThan(EDITORIAL.rhythm.overlaysPer10s);
  });

  it('proibição de efeitos vence o "muito movimento"', () => {
    const s = styleForBrief(POP, brief({ intensity: 'alta', forbid: ['efeitos'] }));
    expect(s.motion.intensity).toBeLessThanOrEqual(0.15);
    expect(s.transition).toBe('none');
    expect(s.zoomScale).toBe(1);
    expect(s.motion.enter).not.toBe('pop');
  });

  it('sem zoom troca a transição de zoom por outra', () => {
    expect(styleForBrief(EDITORIAL, brief({ forbid: ['zoom'] })).transition).toBe('dip');
    expect(styleForBrief(EDITORIAL, brief({ forbid: ['zoom', 'transicoes'] })).transition).toBe('none');
  });

  it('objetivo muda a chamada final para uma frase fixa do app', () => {
    expect(styleForBrief(POP, brief({ goal: 'vender' })).cta).toBe('Saiba mais no link');
    expect(styleForBrief(POP, brief({ goal: 'entreter' })).cta).toBe(POP.cta);
  });

  it('qualquer combinação continua dentro do esquema do StyleDNA', () => {
    for (const p of [POP, EDITORIAL, DOCUMENTAL])
      for (const intensity of [null, 'baixa', 'media', 'alta'] as const)
        for (const pace of [null, 'lento', 'normal', 'rapido'] as const)
          for (const forbid of [[], ['efeitos'], [...PROHIBITIONS]] as CreativeBrief['forbid'][]) {
            const s = styleForBrief(p, brief({ intensity, pace, forbid, emphasize: ['palavras'], goal: 'ensinar' }));
            expect(styleSchema.safeParse(s).success, `${p.id} ${intensity} ${pace} ${forbid.join()}`).toBe(true);
          }
  });
});

describe('sceneOptionsFor', () => {
  it('proibições viram tipos de cena proibidos', () => {
    const o = sceneOptionsFor(brief({ forbid: ['numeros', 'efeitos'] }));
    expect([...o.forbid].sort()).toEqual(['big-number', 'cut-transition', 'emphasis-zoom']);
  });

  it('"sem textos" tira todas as cenas de texto, mas não a legenda', () => {
    expect(FORBIDDEN_KINDS.textos).toContain('kinetic-title');
    expect(FORBIDDEN_KINDS.textos).not.toContain('progress-bar');
  });

  it('gancho vira título, a menos que título seja proibido', () => {
    const hook = { text: 'Você sabia disso?', wordIds: ['w1', 'w2', 'w3'] };
    expect(sceneOptionsFor(brief({ hook })).title).toBe('Você sabia disso?');
    expect(sceneOptionsFor(brief({ hook, forbid: ['titulo'] })).title).toBeNull();
  });
});
