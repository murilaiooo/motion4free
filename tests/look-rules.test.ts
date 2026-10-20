import { describe, expect, it } from 'vitest';
import { shade } from '../src/core/color-names';
import { briefSchema } from '../src/core/brief';
import { interpretPrompt } from '../src/editorial/interpret';

/**
 * Bateria de pedidos reais (português do Brasil, com e sem acento, com erro de digitação, misturados).
 * Cada linha: o pedido e o que precisa sair (comparação parcial). Roda na CI, sem IA.
 */
const VERDE = '#22C55E';
const AMARELO = '#FFD400';

type Expect = {
  look?: Record<string, unknown>;
  forbid?: string[];
  hookStyle?: string | null;
  wantsHook?: boolean;
  preset?: string | null;
  tone?: string | null;
  /** cada item precisa aparecer em "ainda não sei fazer" */
  unsupported?: string[];
  /** "ainda não sei fazer" vazio */
  allUnderstood?: boolean;
  /** entendeu algo que muda o vídeo (padrão: sim) */
  understood?: boolean;
};

const CASES: [string, Expect][] = [
  // o pedido do responsável (v0.5), exatamente como foi digitado
  ['gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos', { hookStyle: 'criativo', wantsHook: true, look: { captions: { text: VERDE, highlight: AMARELO }, emoji: { mode: 'interval', everySec: 3 } }, allUnderstood: true }],
  ['gancho diferenciado e criativo legenda verde e amarela emojis a cada 3 segundos', { hookStyle: 'criativo', look: { captions: { text: VERDE, highlight: AMARELO }, emoji: { mode: 'interval', everySec: 3 } }, allUnderstood: true }],
  ['Gancho DIFERENCIADO e criativo, legenda verde e amarela, emojis a cada 3 segundo', { hookStyle: 'criativo', look: { emoji: { mode: 'interval', everySec: 3 } }, allUnderstood: true }],
  ['legenda verde e amarela, emojis a cada tres segundos', { look: { captions: { text: VERDE, highlight: AMARELO }, emoji: { mode: 'interval', everySec: 3 } }, allUnderstood: true }],
  ['legenda verde-amarela', { look: { captions: { text: VERDE, highlight: AMARELO } }, allUnderstood: true }],
  ['legenda nas cores da bandeira do brasil', { look: { captions: { text: VERDE, highlight: AMARELO } }, allUnderstood: true }],
  ['quero a legenda com a cor da bandeira', { look: { captions: { text: VERDE, highlight: AMARELO } }, allUnderstood: true }],
  // cores
  ['letra amarela com contorno preto', { look: { captions: { text: AMARELO, stroke: '#000000' } }, allUnderstood: true }],
  ['legenda branca com destaque rosa choque', { look: { captions: { text: '#FFFFFF', highlight: '#FF2E93' } }, allUnderstood: true }],
  ['legenda azul mais escuro', { look: { captions: { text: shade('#3B82F6', 'escuro', 0.5) } }, allUnderstood: true }],
  ['legenda azul claro', { look: { captions: { text: '#7DD3FC' } }, allUnderstood: true }],
  ['legenda #ff00aa', { look: { captions: { text: '#FF00AA' } }, allUnderstood: true }],
  ['legenda branca, destaque verde neon, contorno preto grosso', { look: { captions: { text: '#FFFFFF', highlight: '#39FF14', stroke: '#000000', strokeWidth: 16 } }, allUnderstood: true }],
  ['fundo preto na legenda', { look: { captions: { box: '#000000' } }, allUnderstood: true }],
  ['legenda sem fundo e sem contorno', { look: { captions: { box: 'none', strokeWidth: 0 } }, allUnderstood: true }],
  ['cor do video azul', { look: { accent: '#3B82F6' }, allUnderstood: true }],
  ['tudo vermelho', { look: { accent: '#EF4444', captions: { highlight: '#EF4444' } } }],
  ['legeda verde', { look: { captions: { text: VERDE } }, allUnderstood: true }],
  ['red captions with yellow highlight', { look: { captions: { text: '#EF4444', highlight: AMARELO } } }],
  // tamanho, posição, caixa das letras, fonte
  ['legenda gigante em cima', { look: { captions: { scale: 1.6, position: 'top' } }, allUnderstood: true }],
  ['legenda menor e embaixo', { look: { captions: { scale: 0.8, position: 'bottom' } }, allUnderstood: true }],
  ['legenda bem grande no meio da tela', { look: { captions: { scale: 1.5, position: 'center' } }, allUnderstood: true }],
  ['legenda a 30% da tela', { look: { captions: { y: 0.3 } }, allUnderstood: true }],
  ['legenda em maiuscula', { look: { captions: { case: 'upper' } }, allUnderstood: true }],
  ['legenda sem caixa alta', { look: { captions: { case: 'none' } }, allUnderstood: true }],
  ['deixa a legenda em caixa alta e amarela', { look: { captions: { case: 'upper', text: AMARELO } }, allUnderstood: true }],
  ['tudo em letra minúscula', { look: { captions: { case: 'lower' } }, allUnderstood: true }],
  ['fonte anton', { look: { captions: { font: 'Anton' } }, allUnderstood: true }],
  ['quero a fonte serifada', { look: { captions: { font: 'Instrument Serif' } }, allUnderstood: true }],
  ['letra de maquina de escrever', { look: { captions: { font: 'IBM Plex Mono' } }, allUnderstood: true }],
  // entrada e palavras
  ['legenda pulando', { look: { captions: { animation: 'bounce' } }, allUnderstood: true }],
  ['legenda aparecendo palavra por palavra', { look: { captions: { animation: 'typewriter' } }, allUnderstood: true }],
  ['legenda deslizando de lado', { look: { captions: { animation: 'slide' } }, allUnderstood: true }],
  ['uma palavra por vez', { look: { captions: { wordsAtOnce: 1 } }, allUnderstood: true }],
  ['duas palavras por linha', { look: { captions: { wordsPerLine: 2 } }, allUnderstood: true }],
  ['palavra falada sublinhada', { look: { captions: { highlightMode: 'underline' } }, allUnderstood: true }],
  // emojis
  ['emojis grandes em cima pulando', { look: { emoji: { mode: 'interval', scale: 1.25, position: 'top', animation: 'bounce' } }, allUnderstood: true }],
  ['com emojis nas palavras importantes', { look: { emoji: { mode: 'keywords' } }, allUnderstood: true }],
  ['emoji de fogo e foguete a cada 5s', { look: { emoji: { mode: 'interval', everySec: 5, prefer: ['🔥', '🚀'] } }, allUnderstood: true }],
  ['muitos emojis', { look: { emoji: { mode: 'interval', everySec: 2 } }, allUnderstood: true }],
  ['EMOJIS A CADA 2 SEGUNDOS', { look: { emoji: { mode: 'interval', everySec: 2 } }, allUnderstood: true }],
  ['emojis de 4 em 4 segundos girando', { look: { emoji: { mode: 'interval', everySec: 4, animation: 'spin' } }, allUnderstood: true }],
  ['legenda verde e amarela 🔥', { look: { captions: { text: VERDE }, emoji: { prefer: ['🔥'] } } }],
  ['sem emojis', { forbid: ['emojis'], look: {} }],
  ['nao quero emoji nenhum', { forbid: ['emojis'] }],
  ['emojis a cada 3 segundos, mas sem emojis', { forbid: ['emojis'] }],
  // cortes, transição, cenas, intensidade
  ['cortes rapidos e sem pausas', { look: { cuts: 'agressivo' }, allUnderstood: true }],
  ['mantem as pausas', { look: { cuts: 'suave' }, allUnderstood: true }],
  ['transicao flash', { look: { transition: 'flash' }, allUnderstood: true }],
  ['transição suave entre os cortes', { look: { transition: 'dip' } }],
  ['com barra de progresso', { look: { scenes: { barra: true } }, allUnderstood: true }],
  ['sem barra de progresso e sem titulo', { forbid: ['barra', 'titulo'] }],
  ['animacao 80%', { look: { motion: 0.8 }, allUnderstood: true }],
  // gancho
  ['gancho com pergunta', { hookStyle: 'pergunta', wantsHook: true, allUnderstood: true }],
  ['gancho impactante', { hookStyle: 'impacto', wantsHook: true, allUnderstood: true }],
  ['comeca com uma pergunta', { hookStyle: 'pergunta', wantsHook: true, allUnderstood: true }],
  ['gancho forte', { hookStyle: null, wantsHook: true, allUnderstood: true }],
  // misturados com o que já existia
  ['legenda verde, estilo pop, sem zoom', { preset: 'pop', forbid: ['zoom'], look: { captions: { text: VERDE } }, allUnderstood: true }],
  ['calmo e elegante com legenda dourada', { tone: 'calmo', look: { captions: { text: '#F5B700' } }, allUnderstood: true }],
  ['bem animado, legenda amarela em caixa alta, emojis a cada 2s', { tone: 'energetico', look: { captions: { text: AMARELO, case: 'upper' }, emoji: { everySec: 2 } }, allUnderstood: true }],
  // o que o app ainda não faz
  ['quero musica de fundo e legenda amarela', { look: { captions: { text: AMARELO } }, unsupported: ['música ou efeitos sonoros'] }],
  ['legenda amarela e um dinossauro dançando', { look: { captions: { text: AMARELO } }, unsupported: ['dinossauro dançando'] }],
  ['efeito 3d e filtro preto e branco', { understood: false, unsupported: ['efeitos 3D', 'filtro de cor no vídeo'] }],
  ['quero que fique viral', { understood: false, unsupported: ['garantir que viralize (ninguém consegue prometer)'] }],
];

describe('regras do pedido: bateria de pedidos reais (look)', () => {
  it(`tem pelo menos 40 pedidos (${CASES.length})`, () => expect(CASES.length).toBeGreaterThanOrEqual(40));

  for (const [prompt, exp] of CASES) {
    it(prompt, () => {
      const { brief, understood } = interpretPrompt(prompt);
      expect(briefSchema.safeParse(brief).success).toBe(true);
      expect(understood).toBe(exp.understood ?? true);
      if (exp.look) expect(brief.look).toMatchObject(exp.look);
      if (exp.forbid) for (const f of exp.forbid) expect(brief.forbid).toContain(f);
      if (exp.hookStyle !== undefined) expect(brief.hookStyle).toBe(exp.hookStyle);
      if (exp.wantsHook !== undefined) expect(brief.wantsHook).toBe(exp.wantsHook);
      if (exp.preset !== undefined) expect(brief.preset).toBe(exp.preset);
      if (exp.tone !== undefined) expect(brief.tone).toBe(exp.tone);
      for (const u of exp.unsupported ?? []) expect(brief.unsupported).toContain(u);
      if (exp.allUnderstood) expect(brief.unsupported).toEqual([]);
    });
  }

  it('"sem emojis" vence emojis pedidos na mesma frase e explica', () => {
    const { brief } = interpretPrompt('emojis a cada 3 segundos, mas sem emojis');
    expect(brief.look.emoji).toBeUndefined();
    expect(brief.notes.conflicts.join(' ')).toContain('a proibição vale mais');
  });

  it('"com barra" e "sem barra" juntos: proibição vence', () => {
    const { brief } = interpretPrompt('com barra de progresso, sem barra');
    expect(brief.forbid).toContain('barra');
    expect(brief.look.scenes?.barra).toBeUndefined();
  });

  it('"números grandes" continua sendo destaque de números (não tamanho de legenda)', () => {
    const { brief } = interpretPrompt('destaque os números grandes');
    expect(brief.emphasize).toContain('numeros');
    expect(brief.look.captions?.scale).toBeUndefined();
  });

  it('intervalo de emoji fora do limite é ignorado com nota', () => {
    const { brief } = interpretPrompt('emojis a cada 90 segundos');
    expect(brief.look.emoji?.everySec).not.toBe(90);
    expect(brief.notes.conflicts.join(' ')).toContain('1 a 30 segundos');
  });
});
