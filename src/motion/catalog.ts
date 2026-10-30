import type { SceneInstance, SceneKind } from '../core/types';
import { sceneSchema } from '../core/schema';

export interface SceneCard {
  name: string;
  intent: readonly string[];
  whenToUse: string;
  whenNotToUse: string;
  inputs: readonly string[];
  /** Engineering bounds, not measured readability or visual QA. */
  duration: { min: number; max: number | null };
  faceSafety: 'may-cover-face' | 'edge-overlay' | 'changes-crop';
  variants: readonly string[];
  render: string;
  license: { spdx: 'MIT'; source: string; notice: 'LICENSE'; assets: readonly string[] };
}

const card = (name: string, intent: string[], whenToUse: string, whenNotToUse: string,
  inputs: string[], min: number, max: number | null, faceSafety: SceneCard['faceSafety'],
  render: string, variants = ['type', 'sticker', 'card']): SceneCard => ({
  name, intent, whenToUse, whenNotToUse, inputs, duration: { min, max }, faceSafety,
  variants, render, license: { spdx: 'MIT', source: render.split('#')[0]!, notice: 'LICENSE', assets: [] },
});

/** Original Motion4Free implementations. No Editonny asset is licensed by this registry. */
export const SCENE_CATALOG = {
  'kinetic-title': card('Título de abertura', ['opening'], 'Frase de abertura ou gancho escolhido.', 'Não encurtar condições ou negações para criar promessa.', ['text: 1–60 caracteres'], .8, 5, 'may-cover-face', 'src/render/scenes.ts#drawKineticTitle'),
  'highlight-word': card('Palavra em destaque', ['emphasis'], 'Palavra relevante dentro da frase.', 'Uma palavra isolada pode inverter o sentido; manter contexto.', ['text: 1–30 caracteres'], .05, 5, 'may-cover-face', 'src/render/frame.ts', ['StyleDNA']),
  'big-number': card('Número com contexto', ['quantity', 'price'], 'Número transcrito com unidade e qualificador.', 'Negação, hipótese ou comparação incompleta não são afirmação.', ['value: 1–12 caracteres', 'label: até 30 caracteres'], .8, 8, 'may-cover-face', 'src/render/scenes.ts#drawBigNumber'),
  list: card('Etapas', ['ordered-steps'], 'Marcadores de enumeração e rótulos da fala.', 'Não criar itens ausentes nem transformar alternativas em etapas.', ['items: 1–5 textos de até 40 caracteres com instante de entrada'], .8, 40, 'may-cover-face', 'src/render/scenes.ts#drawList'),
  quote: card('Pergunta da fala', ['question'], 'Pergunta completa identificada na transcrição.', 'Não apresentar paráfrase como citação literal.', ['text: 1–80 caracteres'], .8, 5, 'may-cover-face', 'src/render/scenes.ts#drawQuote'),
  'lower-third': card('Identificação', ['identity'], 'Apresentação explícita de nome.', 'Não inferir cargo, identidade ou organização.', ['title: 1–32 caracteres', 'subtitle: até 40 caracteres'], .8, 8, 'edge-overlay', 'src/render/scenes.ts#drawLowerThird'),
  'emphasis-zoom': card('Aproximação', ['emphasis'], 'Ênfase pontual com espaço no enquadramento.', 'Movimento pode recortar rostos ou conteúdo; evitar se movimento proibido.', ['scale: 1–1.4'], .05, 3, 'changes-crop', 'src/render/frame.ts', ['StyleDNA.zoomScale']),
  'cut-transition': card('Transição', ['join'], 'Emenda real entre segmentos.', 'Não usar como evidência de mudança narrativa.', ['at: instante dentro da janela'], .05, .6, 'changes-crop', 'src/render/frame.ts', ['zoom', 'flash', 'dip']),
  'progress-bar': card('Progresso', ['navigation'], 'Indicação de avanço no vídeo editado.', 'Não representa uma porcentagem citada na fala.', [], .05, null, 'edge-overlay', 'src/render/scenes.ts#drawProgress', ['StyleDNA.progress']),
  'end-cta': card('Chamada final', ['call-to-action'], 'Chamada definida pela direção ou pela pessoa.', 'Não apresentar chamada configurada como fala literal.', ['text: 1–32 caracteres'], .8, 5, 'may-cover-face', 'src/render/scenes.ts#drawEndCta'),
  emoji: card('Emoji contextual', ['illustration'], 'Associação simples com uma palavra da fala.', 'Não implica compreensão de ironia, sentimento ou contexto sensível.', ['emoji: enum fechado em src/core/emoji.ts'], .05, 5, 'may-cover-face', 'src/render/emoji.ts', ['StyleDNA']),
} satisfies Record<SceneKind, SceneCard>;

export type CatalogRejection = 'parameters' | 'duration' | 'timeline';
export function catalogRejection(scene: SceneInstance, total: number): CatalogRejection | null {
  if (!sceneSchema.safeParse(scene).success) return 'parameters';
  if (!Number.isFinite(total) || scene.start < 0 || scene.end > total + .001 || scene.end <= scene.start) return 'timeline';
  const { min, max } = SCENE_CATALOG[scene.kind].duration;
  const span = scene.end - scene.start;
  if (span + .001 < min || (max !== null && span > max + .001)) return 'duration';
  if (scene.kind === 'cut-transition' && (scene.at < scene.start || scene.at > scene.end)) return 'timeline';
  if (scene.kind === 'list' && scene.items.some((item, i) => item.at < 0 || item.at > scene.end || (i > 0 && item.at < scene.items[i - 1]!.at))) return 'timeline';
  return null;
}
