import type { FontSpec, StyleDNA } from './style';
import { CINEMA, DATILOGRAFIA, DOCUMENTAL, EDITORIAL, IMPACTO, JORNAL, LUXO, MARCA_TEXTO, MINIMAL, NEON, PODCAST, POP, RETRO, TURBO, TUTORIAL } from './template-styles';

/**
 * Registro de modelos (v0.9, ADR-0014). Um modelo = um StyleDNA (o que o desenho lê) + o que a tela e o
 * intérprete precisam saber dele: nome em português, uma frase, etiquetas, cores e fonte da miniatura e
 * as palavras que o escolhem num pedido. A galeria, o seletor de estilo, o intérprete por regras e o
 * prompt da IA leem só daqui: um modelo novo entra acrescentando uma linha nesta lista.
 *
 * Regra de nomes: nada de marca registrada nem nome de criador ou empresa.
 */

/** Ids, na ordem em que aparecem na tela. Literal para o esquema do pedido (zod) e para a IA. */
export const TEMPLATE_IDS = ['pop', 'neon', 'editorial', 'documental', 'impacto', 'minimal', 'podcast', 'tutorial', 'cinema', 'jornal', 'retro', 'turbo', 'datilografia', 'marca-texto', 'luxo'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Etiquetas para filtrar a galeria (o rótulo em português fica em TAG_LABELS). */
export const TEMPLATE_TAGS = ['energetico', 'vendas', 'negocios', 'podcast', 'entrevista', 'tutorial', 'educacao', 'minimalista', 'elegante', 'cinematografico', 'noticias', 'retro', 'games', 'humor', 'historias', 'lifestyle'] as const;
export type TemplateTag = (typeof TEMPLATE_TAGS)[number];
export const TAG_LABELS: Record<TemplateTag, string> = {
  energetico: 'Energético',
  vendas: 'Vendas',
  negocios: 'Negócios',
  podcast: 'Podcast',
  entrevista: 'Entrevista',
  tutorial: 'Tutorial',
  educacao: 'Educação',
  minimalista: 'Minimalista',
  elegante: 'Elegante',
  cinematografico: 'Cinematográfico',
  noticias: 'Notícias',
  retro: 'Retrô',
  games: 'Games',
  humor: 'Humor',
  historias: 'Histórias',
  lifestyle: 'Dia a dia',
};

/** O que basta para desenhar a miniatura de um modelo (cartão da galeria) sem rodar o compositor. */
export interface TemplatePreview {
  /** fundo do cartão */
  background: string;
  /** cor do texto principal */
  text: string;
  /** cor de destaque (palavra falada, detalhes) */
  accent: string;
  /** caixa/painel e o texto sobre ela */
  panel: string;
  onPanel: string;
  /** fonte do título (já carregada pelo app quando o estilo é carregado) */
  titleFont: Pick<FontSpec, 'family' | 'weight' | 'style' | 'case'>;
  /** fonte da legenda */
  captionFont: Pick<FontSpec, 'family' | 'weight' | 'style' | 'case'>;
  /** como a palavra falada aparece: caixa, cor, sublinhado, revelação ou marca-texto */
  highlight: StyleDNA['captions']['highlight'];
}

export interface Template {
  id: TemplateId;
  /** nome curto em português (sem marca registrada) */
  name: string;
  /** uma frase para quem escolhe, sem termos técnicos */
  description: string;
  tags: readonly TemplateTag[];
  preview: TemplatePreview;
  style: StyleDNA;
  /** palavras do pedido (sem acentos, minúsculas) que escolhem o modelo; ver editorial/interpret.ts */
  match: {
    /** depois de "estilo", "modelo", "template"... ("estilo podcast"); o id e o nome já entram sozinhos */
    aliases: readonly string[];
    /** sozinhas já escolhem (inequívocas: "cinematográfico", "podcast") */
    words: readonly string[];
    /** sugerem o modelo com peso fraco (um pedido explícito vale mais) */
    hints: readonly string[];
  };
}

function previewOf(style: StyleDNA, background: string): TemplatePreview {
  const P = style.palette;
  const pick = ({ family, weight, style: s, case: c }: FontSpec) => ({ family, weight, style: s, case: c });
  return {
    background,
    text: P.text,
    accent: style.captions.colors.highlight ?? P.accent,
    panel: style.captions.colors.box ?? P.panel.slice(0, 7),
    onPanel: P.onPanel,
    titleFont: pick(style.type.display),
    captionFont: pick(style.type.text),
    highlight: style.captions.highlight,
  };
}

const t = (style: StyleDNA, background: string, description: string, tags: TemplateTag[], match: Partial<Template['match']> = {}): Template => ({
  id: style.id as TemplateId,
  name: style.name,
  description,
  tags,
  preview: previewOf(style, background),
  style,
  match: { aliases: match.aliases ?? [], words: match.words ?? [], hints: match.hints ?? [] },
});

export const TEMPLATES: readonly Template[] = [
  t(POP, '#1A1A1A', 'Energético: letras grandes, palavra falada em destaque amarelo, cortes com flash e muitas animações.', ['energetico', 'humor', 'lifestyle']),
  t(NEON, '#0D0D0D', 'Limpo e atual: letras brancas grossas, poucas palavras por vez e a palavra falada acendendo em verde.', ['energetico', 'lifestyle'], { aliases: ['karaoke'] }),
  t(EDITORIAL, '#14110E', 'Elegante: letra de revista, legenda que acende palavra por palavra, movimento lento e poucas animações.', ['elegante', 'historias'], { aliases: ['revista'] }),
  t(DOCUMENTAL, '#121417', 'Sóbrio: painéis escuros à esquerda, letra técnica, quase sem movimento.', ['educacao', 'noticias', 'negocios'], { aliases: ['documentario'] }),
  t(IMPACTO, '#141414', 'Vendas e negócios: cada palavra num bloco branco, a palavra falada em vermelho, tudo entrando rápido.', ['vendas', 'negocios', 'energetico'], { aliases: ['vendas', 'blocos', 'caixa por palavra'] }),
  t(MINIMAL, '#1E1F22', 'Minimalista: tudo em letras minúsculas, legenda discreta que acende devagar, sem transições.', ['minimalista', 'lifestyle', 'elegante'], { aliases: ['minimalista', 'clean', 'limpo'], hints: ['minimalista', 'minimalismo', 'minimo', 'clean', 'limpo', 'limpa'] }),
  t(PODCAST, '#17120F', 'Conversa e entrevista: selo de podcast no canto, legenda em pílulas escuras e nome de quem fala em destaque.', ['podcast', 'entrevista', 'negocios'], { aliases: ['entrevista', 'videocast', 'bate papo'], words: ['podcast', 'videocast'], hints: ['entrevista', 'bate papo', 'conversa'] }),
  t(TUTORIAL, '#0F1A2E', 'Passo a passo: letras arredondadas, pílulas brancas, passos numerados em círculos e a palavra falada sublinhada.', ['tutorial', 'educacao'], { aliases: ['passo a passo', 'aula', 'didatico'], hints: ['tutorial', 'passo a passo', 'aula', 'didatico', 'didatica'] }),
  t(CINEMA, '#1C140C', 'Cinematográfico: faixas pretas de cinema, cor quente, letra clássica e movimentos lentos.', ['cinematografico', 'historias', 'elegante'], { aliases: ['cinematografico', 'filme', 'filmico'], words: ['cinematografico', 'cinematografica', 'cinematico', 'cinematica', 'filmico', 'estilo filme', 'de cinema'] }),
  t(JORNAL, '#0B1F3A', 'Notícia: selo "ao vivo", faixa de manchetes correndo embaixo e tarjas de título como num telejornal.', ['noticias', 'negocios'], { aliases: ['noticia', 'noticias', 'telejornal', 'plantao', 'manchete'], words: ['telejornal', 'plantao', 'manchete', 'manchetes', 'faixa de noticias'], hints: ['noticia', 'noticias', 'jornal'] }),
  t(RETRO, '#1A0B2E', 'Retrô dos anos 90: letra de computador antigo, linhas de TV, cores separadas e "REC" com o tempo.', ['retro', 'humor', 'games'], { aliases: ['anos 90', 'anos 80', 'vhs', 'fita', 'vintage', 'nostalgia'], words: ['retro', 'vhs', 'vintage', 'anos 80', 'anos 90', 'nostalgico', 'nostalgica', 'fita antiga'] }),
  t(TURBO, '#16072E', 'Games e muita energia: títulos que caem quicando, legenda inclinada com a palavra em degradê.', ['games', 'energetico', 'humor'], { aliases: ['gamer', 'games', 'game', 'jogo', 'jogos', 'gaming'], words: ['gamer', 'gaming', 'games', 'estilo game'], hints: ['jogo', 'jogos', 'game'] }),
  t(DATILOGRAFIA, '#2B2620', 'Máquina de escrever: a legenda vai sendo digitada numa tira de papel, com cursor piscando.', ['historias', 'elegante', 'educacao'], { aliases: ['maquina de escrever', 'datilografado', 'maquina'], words: ['datilografia', 'datilografado'] }),
  t(MARCA_TEXTO, '#1D1D1B', 'Escrito à mão: letra de caderno, palavra falada riscada de marca-texto e títulos com traço de caneta.', ['educacao', 'humor', 'lifestyle'], { aliases: ['marca texto', 'caneta', 'escrito a mao', 'manuscrito', 'caderno'], words: ['escrito a mao', 'manuscrito', 'letra de mao'] }),
  t(LUXO, '#0A0A0A', 'Luxo: preto e dourado, título em itálico dentro de uma moldura fina, legenda em maiúsculas espaçadas.', ['elegante', 'vendas', 'lifestyle'], { aliases: ['luxuoso', 'luxuosa', 'premium', 'dourado', 'alto padrao'], words: ['luxo', 'luxuoso', 'luxuosa', 'alto padrao'], hints: ['premium'] }),
];

/** Modelo pelo id (undefined se não existe). */
export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((x) => x.id === id);
}

/** Modelos com uma etiqueta, na ordem da tela. */
export function templatesByTag(tag: TemplateTag): Template[] {
  return TEMPLATES.filter((x) => x.tags.includes(tag));
}

/** Nome de cada modelo pelo id (para o resumo "o que entendi"). */
export const TEMPLATE_NAMES = Object.fromEntries(TEMPLATES.map((x) => [x.id, x.name])) as Record<TemplateId, string>;
