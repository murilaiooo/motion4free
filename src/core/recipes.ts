import type { Emphasis, Goal, Level, Pace, Register, Tone } from './brief';
import type { CtaKind } from './cta';
import type { HookStyle, Look } from './look';
import { NICHE_IDS, NICHE_NAMES, type NicheId } from './niches';
import type { TemplateId } from './templates';

/**
 * Receitas por tipo de conteúdo (v0.12, ADR-0017): o que deixa o primeiro resultado perto de "pronto para
 * postar" para cada nicho — modelo, tom, ritmo, gancho, chamada final, linguagem e alguns ajustes do look.
 * Tudo são valores fechados do espaço de parâmetros do app (nada de texto livre): a receita vira um
 * CreativeBrief preenchido por baixo do que a pessoa pediu (o pedido explícito sempre vale mais).
 * Base: docs/produto/personas-e-fluxos.md (pesquisa, formatos e o que é "pronto" em cada nicho).
 */
export interface Recipe {
  niche: NicheId;
  template: TemplateId;
  tone: Tone;
  goal: Goal;
  pace: Pace;
  intensity: Level;
  hookStyle: HookStyle;
  cta: CtaKind;
  register: Register;
  emphasize: readonly Emphasis[];
  /** ajustes do look (cores, emojis, cortes); só valores do esquema */
  look: Look;
  /** frase curta para a tela ("o que esta receita faz") */
  summary: string;
}

const r = (x: Recipe): Recipe => x;

export const RECIPES: Record<NicheId, Recipe> = {
  coach: r({ niche: 'coach', template: 'impacto', tone: 'inspirador', goal: 'inspirar', pace: 'rapido', intensity: 'media', hookStyle: 'impacto', cta: 'siga', register: 'informal', emphasize: ['palavras'], look: { cuts: 'agressivo' }, summary: 'frase de impacto no começo, palavras fortes em destaque, cortes secos e "siga para mais" no fim' }),
  infoprodutor: r({ niche: 'infoprodutor', template: 'impacto', tone: 'energetico', goal: 'vender', pace: 'rapido', intensity: 'alta', hookStyle: 'numero', cta: 'link-bio', register: 'informal', emphasize: ['numeros', 'palavras'], look: { cuts: 'agressivo' }, summary: 'gancho com número, números e palavras-chave em destaque, cortes rápidos e "link na bio" no fim' }),
  loja: r({ niche: 'loja', template: 'pop', tone: 'divertido', goal: 'vender', pace: 'rapido', intensity: 'alta', hookStyle: 'pergunta', cta: 'link-bio', register: 'informal', emphasize: ['numeros'], look: { cuts: 'agressivo', emoji: { mode: 'keywords' } }, summary: 'abre com pergunta, preços em destaque, emojis nas palavras certas e "link na bio" no fim' }),
  restaurante: r({ niche: 'restaurante', template: 'pop', tone: 'divertido', goal: 'vender', pace: 'rapido', intensity: 'alta', hookStyle: 'impacto', cta: 'delivery', register: 'informal', emphasize: ['numeros'], look: { accent: '#FF8C1A', cuts: 'agressivo', emoji: { mode: 'keywords' } }, summary: 'cores quentes, emojis de comida pela fala, preços em destaque e "pede já o seu" no fim' }),
  beleza: r({ niche: 'beleza', template: 'editorial', tone: 'elegante', goal: 'vender', pace: 'normal', intensity: 'media', hookStyle: 'pergunta', cta: 'agende', register: 'informal', emphasize: ['palavras'], look: { accent: '#F472B6', emoji: { mode: 'keywords', prefer: ['✨', '😍', '💯'] } }, summary: 'visual elegante em rosa, brilhos nas palavras certas e "agenda seu horário" no fim' }),
  fitness: r({ niche: 'fitness', template: 'pop', tone: 'energetico', goal: 'ensinar', pace: 'rapido', intensity: 'alta', hookStyle: 'impacto', cta: 'salve', register: 'informal', emphasize: ['numeros', 'listas'], look: { cuts: 'agressivo', emoji: { mode: 'keywords', prefer: ['💪', '🔥'] } }, summary: 'muita energia, séries e números em destaque, cortes secos e "salva pra não esquecer" no fim' }),
  saude: r({ niche: 'saude', template: 'tutorial', tone: 'acolhedor', goal: 'ensinar', pace: 'normal', intensity: 'baixa', hookStyle: 'pergunta', cta: 'agende', register: 'formal', emphasize: ['listas', 'palavras'], look: { emoji: { mode: 'off' } }, summary: 'tom acolhedor e claro, abre com pergunta, passos numerados, sem emojis e "agende seu horário" no fim' }),
  juridico: r({ niche: 'juridico', template: 'documental', tone: 'serio', goal: 'informar', pace: 'normal', intensity: 'baixa', hookStyle: 'pergunta', cta: 'siga', register: 'formal', emphasize: ['listas'], look: { emoji: { mode: 'off' } }, summary: 'sóbrio e informativo (regras da OAB), abre com pergunta, sem emojis e "siga para mais conteúdos" no fim' }),
  imoveis: r({ niche: 'imoveis', template: 'luxo', tone: 'elegante', goal: 'vender', pace: 'normal', intensity: 'media', hookStyle: 'numero', cta: 'visita', register: 'informal', emphasize: ['numeros'], look: { emoji: { mode: 'off' } }, summary: 'visual de alto padrão, preço e metragem em destaque e "bora agendar uma visita?" no fim' }),
  educacao: r({ niche: 'educacao', template: 'tutorial', tone: 'divertido', goal: 'ensinar', pace: 'normal', intensity: 'media', hookStyle: 'pergunta', cta: 'salve', register: 'informal', emphasize: ['listas', 'palavras'], look: {}, summary: 'abre com pergunta, tópicos numerados e palavras-chave em destaque, "salva pra não esquecer" no fim' }),
  financas: r({ niche: 'financas', template: 'impacto', tone: 'serio', goal: 'ensinar', pace: 'rapido', intensity: 'media', hookStyle: 'numero', cta: 'siga', register: 'informal', emphasize: ['numeros'], look: { accent: '#22C55E', cuts: 'agressivo' }, summary: 'gancho com número, valores em destaque em verde, cortes secos e "me segue pra mais" no fim' }),
  religioso: r({ niche: 'religioso', template: 'cinema', tone: 'inspirador', goal: 'inspirar', pace: 'lento', intensity: 'baixa', hookStyle: 'impacto', cta: 'compartilhe', register: 'formal', emphasize: ['palavras'], look: { cuts: 'suave', emoji: { mode: 'off' } }, summary: 'cinematográfico e calmo, pausas respeitadas, sem emojis e "compartilhe com alguém" no fim' }),
  podcast: r({ niche: 'podcast', template: 'podcast', tone: 'energetico', goal: 'entreter', pace: 'rapido', intensity: 'media', hookStyle: 'impacto', cta: 'episodio', register: 'informal', emphasize: ['nome'], look: { cuts: 'agressivo' }, summary: 'frase de impacto no começo, nome de quem fala, cortes secos e "ep completo no canal" no fim' }),
  humor: r({ niche: 'humor', template: 'pop', tone: 'divertido', goal: 'entreter', pace: 'rapido', intensity: 'alta', hookStyle: 'criativo', cta: 'marque', register: 'informal', emphasize: [], look: { cuts: 'agressivo', emoji: { mode: 'interval', everySec: 3, prefer: ['😂', '🤯', '😱'] } }, summary: 'ritmo rápido, emojis de risada, gancho diferente e "marca aquele amigo" no fim' }),
  noticia: r({ niche: 'noticia', template: 'jornal', tone: 'serio', goal: 'informar', pace: 'normal', intensity: 'media', hookStyle: 'impacto', cta: 'siga', register: 'formal', emphasize: ['numeros'], look: { cuts: 'agressivo', emoji: { mode: 'off' } }, summary: 'cara de telejornal, números em destaque, sem emojis e "siga para mais conteúdos" no fim' }),
  tech: r({ niche: 'tech', template: 'neon', tone: 'energetico', goal: 'informar', pace: 'rapido', intensity: 'media', hookStyle: 'pergunta', cta: 'comente', register: 'informal', emphasize: ['numeros', 'listas'], look: { cuts: 'agressivo' }, summary: 'limpo e atual, preços e números em destaque, cortes secos e "comenta aqui embaixo" no fim' }),
  viagem: r({ niche: 'viagem', template: 'cinema', tone: 'inspirador', goal: 'inspirar', pace: 'normal', intensity: 'media', hookStyle: 'criativo', cta: 'salve', register: 'informal', emphasize: ['numeros'], look: { emoji: { mode: 'keywords', prefer: ['✈️', '☀️', '😍'] } }, summary: 'cinematográfico, preços em destaque, emojis de viagem e "salva pra não esquecer" no fim' }),
  maternidade: r({ niche: 'maternidade', template: 'marca-texto', tone: 'acolhedor', goal: 'inspirar', pace: 'normal', intensity: 'media', hookStyle: 'pergunta', cta: 'compartilhe', register: 'informal', emphasize: ['listas'], look: { accent: '#F472B6', emoji: { mode: 'keywords', prefer: ['❤️', '✨', '🙏'] } }, summary: 'acolhedor e escrito à mão, emojis carinhosos e "manda pra alguém" no fim' }),
  b2b: r({ niche: 'b2b', template: 'documental', tone: 'serio', goal: 'informar', pace: 'normal', intensity: 'baixa', hookStyle: 'numero', cta: 'direct', register: 'formal', emphasize: ['numeros', 'listas'], look: { emoji: { mode: 'off' } }, summary: 'sóbrio e direto, gancho com número, dados em destaque, sem emojis e "envie uma mensagem" no fim' }),
  artista: r({ niche: 'artista', template: 'editorial', tone: 'inspirador', goal: 'inspirar', pace: 'normal', intensity: 'media', hookStyle: 'criativo', cta: 'siga', register: 'informal', emphasize: [], look: { cuts: 'suave' }, summary: 'elegante, pausas respeitadas, gancho diferente e "me segue pra mais" no fim' }),
  vlog: r({ niche: 'vlog', template: 'neon', tone: 'divertido', goal: 'entreter', pace: 'normal', intensity: 'media', hookStyle: 'criativo', cta: 'siga', register: 'informal', emphasize: [], look: { emoji: { mode: 'keywords' } }, summary: 'leve e atual, emojis pela fala e "me segue pra mais" no fim' }),
};

export const RECIPE_LIST: readonly Recipe[] = NICHE_IDS.map((id) => RECIPES[id]);

/** "Receita para Corretor…: …" (para a tela). */
export const recipeLine = (id: NicheId) => `${NICHE_NAMES[id]}: ${RECIPES[id].summary}.`;
