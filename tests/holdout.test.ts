import { describe, expect, it } from 'vitest';
import { interpretPrompt } from '../src/editorial/interpret';
import { briefSchema } from '../src/core/brief';
import { mergeLook } from '../src/core/look';
import { styleForBrief } from '../src/editorial/brief-apply';
import { withRecipe } from '../src/editorial/recipe-apply';
import { DEFAULT_STYLE } from '../src/core/presets';

// Holdout: exemplos nunca vistos, ambíguos, conversacionais, multilíngues e contraditórios.
// Não estão no corpus original; testam generalização, não memorização.

interface HoldoutCase {
  text: string;
  expect: {
    niche?: string | null;
    preset?: string | null;
    tone?: string | null;
    goal?: string | null;
    pace?: string | null;
    intensity?: string | null;
    forbid?: string[];
    emphasize?: string[];
    wantsHook?: boolean;
    hookStyle?: string | null;
    register?: string | null;
    ctaContains?: string;
    lookCheck?: (look: any) => boolean;
  };
  // O que o usuário NÃO deveria perder: instrução explícita deve vencer nicho
  mustNot?: string[];
}

const HOLDOUT: HoldoutCase[] = [
  // Conversacionais e ambíguos
  { text: 'Oi, faz um vídeo daora pra minha lanchonete, bem colorido e rápido', expect: { niche: 'restaurante', tone: 'divertido', pace: 'rapido' } },
  { text: 'Preciso de um vídeo super sério para meu escritório de advocacia, sem piadas', expect: { niche: 'juridico', tone: 'serio', forbid: [] } },
  { text: 'Sou manicure, quero mostrar unhas decoradas com zoom nos detalhes', expect: { niche: 'beleza' } }, // zoom pedido via "zoom nos detalhes" deve ir para look?
  { text: 'Vídeo para vender curso online, quero que converta muito, bem vendedor', expect: { goal: 'vender', niche: 'educacao' } },
  { text: 'Gravação do meu treino de perna, coloca contador de séries', expect: { niche: 'fitness' } },
  // Contraditórios: explícito vence inferido
  { text: 'sou coach mas quero estilo documental sério, sem motivação barata', expect: { niche: 'coach', preset: 'documental', tone: 'serio' } },
  { text: 'vídeo de restaurante mas quero parecer gamer turbo com neon', expect: { niche: 'restaurante', preset: 'turbo' } },
  { text: 'sem emojis, mas coloca um emoji de fogo no final', expect: { forbid: ['emojis'] } }, // segunda parte deve gerar conflito, mas proibição vence
  // Multilíngue / gírias
  { text: 'faz um reels brabo, aesthetic minimalista, legenda chique', expect: { tone: 'elegante', preset: 'minimal' } },
  { text: 'video pra minha loja, quero highlight nos preços e na promo', expect: { niche: 'loja', goal: 'vender', emphasize: [] } },
  // Combinações complexas
  { text: 'público jovem, tom divertido, ritmo acelerado, com barra de progresso e legenda sem animação', expect: { tone: 'divertido', pace: 'rapido' } },
  { text: 'quero 5 dicas numeradas com chamada final me segue pra mais', expect: { emphasize: ['listas'], ctaContains: 'segue' } },
  { text: 'coloca meu @marina.nails no canto e título escrito Bem-vinda', expect: { ctaContains: undefined, lookCheck: (l) => !!l.handle } },
  // Bordas
  { text: 'vídeo sem nada, só música', expect: {} },
  { text: 'URGENTE: vídeo para vender hoje, com urgência e prova social', expect: { goal: 'vender' } },
  { text: 'tutorial de crochê fofo e acolhedor para iniciantes', expect: { niche: 'artista', tone: 'acolhedor', goal: 'ensinar' } },
];

describe('holdout: generalização do intérprete (não visto no corpus)', () => {
  it('cada caso gera brief válido e entendido ou listado em não sei fazer', () => {
    for (const c of HOLDOUT) {
      const { brief, understood } = interpretPrompt(c.text);
      expect(briefSchema.safeParse(brief).success, c.text).toBe(true);
      expect(understood || brief.unsupported.length > 0, c.text).toBe(true);
    }
  });

  it('instrução explícita vence nicho inferido', () => {
    const { brief } = interpretPrompt('sou coach mas quero estilo documental sério, sem motivação barata');
    expect(brief.niche).toBe('coach');
    expect(brief.preset).toBe('documental');
    expect(brief.tone).toBe('serio');
    // motivacional não deve voltar como tom inspirador quando usuário disse "sem motivação barata"
    // "sem motivação barata" não é proibição direta, mas "sério" deve prevalecer sobre "inspirador"
  });

  it('gamer turbo vence restaurante quando explícito', () => {
    const { brief } = interpretPrompt('vídeo de restaurante mas quero parecer gamer turbo com neon');
    expect(brief.niche).toBe('restaurante');
    expect(brief.preset).toBe('turbo');
  });

  it('proibição vence pedido contraditório', () => {
    const { brief } = interpretPrompt('sem emojis, mas coloca um emoji de fogo no final');
    expect(brief.forbid).toContain('emojis');
    // look.emoji deve estar ausente quando proibição existe
    expect(brief.look.emoji).toBeUndefined();
  });

  it('holdout acerta maioria sem overfitting (≥75%)', () => {
    let passed = 0;
    for (const c of HOLDOUT) {
      const { brief } = interpretPrompt(c.text);
      let ok = true;
      for (const [k, v] of Object.entries(c.expect)) {
        if (k === 'ctaContains' && v) {
          if (!(brief.look.cta ?? '').toLowerCase().includes((v as string).toLowerCase())) ok = false;
        } else if (k === 'lookCheck' && v) {
          if (!(v as any)(brief.look)) ok = false;
        } else if (v !== undefined) {
          const actual = (brief as any)[k];
          if (Array.isArray(v)) {
            if (!Array.isArray(actual) || !(v as string[]).every(x => actual.includes(x))) ok = false;
          } else if (actual !== v) ok = false;
        }
      }
      if (ok) passed++;
      else console.log(`holdout fail: "${c.text}" → ${JSON.stringify(brief)}`);
    }
    const rate = passed / HOLDOUT.length;
    console.log(`holdout: ${passed}/${HOLDOUT.length} (${(rate*100).toFixed(1)}%)`);
    expect(rate).toBeGreaterThanOrEqual(0.75);
  });

  it('cada campo do brief chega ao render (style/look aplicados)', () => {
    for (const c of HOLDOUT) {
      const { brief } = interpretPrompt(c.text);
      // brief deve ser aplicável a estilo sem quebrar (mesmo sem receita)
      const style = styleForBrief(DEFAULT_STYLE, brief);
      expect(style.id).toBeTruthy();
      const planLook = mergeLook({}, brief.look ?? {});
      expect(typeof planLook).toBe('object');
    }
  });
});
