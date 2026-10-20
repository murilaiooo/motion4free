import { EMPTY_EDITS } from '../core/edits';
import { EMPTY_BRIEF } from '../core/brief';
import type { StyleDNA } from '../core/style';
import type { Caption, EditPlan } from '../core/types';

/**
 * Plano de demonstração (galeria de estilos e imagens de comparação): as mesmas cenas e legendas
 * desenhadas em cada estilo, sem precisar de vídeo nem de transcrição.
 */
export const GALLERY_SHOTS = [
  { id: 'abertura', label: 'Abertura', t: 1.3 },
  { id: 'numero', label: 'Número grande', t: 4.6 },
  { id: 'lista', label: 'Lista', t: 8.6 },
  { id: 'pergunta', label: 'Pergunta', t: 12.2 },
  { id: 'nome', label: 'Nome na tela', t: 15.8 },
  { id: 'legenda', label: 'Legenda e palavra-chave', t: 22.1 },
  { id: 'chamada', label: 'Chamada final', t: 26.6 },
] as const;

function cap(id: string, text: string, start: number, end: number, wordStarts: number[] = []): Caption {
  return { id, text, start, end, wordIds: [], wordStarts };
}

export function galleryPlan(style: StyleDNA): EditPlan {
  return {
    version: 6,
    ranges: [],
    reference: null,
    edits: EMPTY_EDITS,
    output: { width: 1080, height: 1920, fps: 30 },
    style,
    brief: EMPTY_BRIEF,
    segments: [{ srcStart: 0, srcEnd: 28 }],
    captions: [
      cap('c1', 'Três dicas que mudam tudo', 0.2, 2.6, [0.2, 0.5, 0.9, 1.1, 1.5]),
      cap('c2', 'Noventa por cento desistem', 3, 5.5, [3, 3.5, 3.8, 4.3]),
      cap('c3', 'Segundo, durma bem', 7, 9, [7, 7.6, 8.1]),
      cap('c4', 'Oi, meu nome é Ana Souza', 14.2, 16.6, [14.2, 14.6, 14.9, 15.2, 15.4, 15.7]),
      cap('c5', 'O segredo é ter consistência', 20.8, 22.6, [20.8, 21.0, 21.5, 21.7, 21.9]),
      cap('c6', 'Siga para mais dicas', 25.6, 27.6, [25.6, 26.0, 26.3, 26.5]),
    ],
    scenes: [
      { id: 's1', kind: 'progress-bar', start: 0, end: 28 },
      { id: 's2', kind: 'kinetic-title', text: 'Três dicas que mudam tudo', start: 0, end: 2.6 },
      { id: 's3', kind: 'big-number', value: '90%', label: 'desistem antes de três meses', start: 3, end: 5.8 },
      { id: 's4', kind: 'list', items: [{ text: 'Comece pequeno', at: 6.2 }, { text: 'Durma bem', at: 7 }, { text: 'Anote o progresso', at: 8 }], start: 6, end: 10.2 },
      { id: 's5', kind: 'quote', text: 'Você sabe por que a maioria desiste?', start: 10.8, end: 13.6 },
      { id: 's6', kind: 'lower-third', title: 'Ana Souza', subtitle: 'Personal trainer', start: 14.2, end: 17.6 },
      { id: 's7', kind: 'emphasis-zoom', scale: style.zoomScale, start: 20.6, end: 23 },
      { id: 's8', kind: 'highlight-word', text: 'segredo', start: 21, end: 22.6 },
      { id: 's9', kind: 'end-cta', text: style.cta, start: 25.4, end: 28 },
    ],
  };
}
