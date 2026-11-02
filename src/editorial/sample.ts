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
  { id: 'legenda', label: 'Legenda e palavra-chave', t: 21.2 },
  { id: 'chamada', label: 'Chamada final', t: 26.6 },
] as const;

function cap(id: string, text: string, start: number, end: number, wordStarts: number[] = []): Caption {
  return { id, text, start, end, wordIds: [], wordStarts };
}

/** Textos do vídeo de demonstração em inglês (v0.40.1): mesmo número de palavras, para o tempo de cada uma bater. */
const SAMPLE_EN: Record<string, string> = {
  'Três dicas que mudam tudo': 'Three tips that change everything',
  'Noventa por cento desistem': 'Ninety percent just quit',
  'Segundo, durma bem': 'Second, sleep well',
  'Oi, meu nome é Ana Souza': 'Hi, my name is Ana Souza',
  'O segredo é ter consistência': 'The secret is staying consistent',
  'Siga para mais dicas': 'Follow for more tips',
  'desistem antes de três meses': 'quit before three months',
  'Comece pequeno': 'Start small',
  'Durma bem': 'Sleep well',
  'Anote o progresso': 'Track your progress',
  'Você sabe por que a maioria desiste?': 'Do you know why most people quit?',
  segredo: 'secret',
  'Siga para mais': 'Follow for more',
  'Segue pra mais': 'Follow for more',
  'Continue acompanhando': 'Keep watching',
  'Clique no link': 'Click the link',
  'siga para mais': 'follow for more',
  'Ouça o episódio completo': 'Listen to the full episode',
  'Salve para não esquecer': 'Save it for later',
  'Assista até o fim': 'Watch until the end',
  'Acompanhe as notícias': 'Follow the news',
  'Segue pro próximo nível': 'Follow for the next level',
  'Siga para a próxima página': 'Follow for the next page',
  'Salva e compartilha': 'Save and share',
  'Descubra mais': 'Discover more',
};

/** Vídeo de demonstração dos modelos; `lang: 'en'` troca os textos de exemplo para inglês. */
export function galleryPlan(style: StyleDNA, lang: 'pt' | 'en' = 'pt'): EditPlan {
  const plan = translated(galleryPlanPt(style), lang);
  return { ...plan, captions: plan.captions.flatMap((c) => chunkCaption(c, style.captions.maxWords)) };
}

/**
 * v0.41: a prévia corta as frases como o app corta no vídeo de verdade (o Foco mostra uma palavra por vez,
 * o Pop três...). Usa o tempo de cada palavra; a última palavra da frase não fica sozinha.
 */
export function chunkCaption(c: Caption, maxWords: number): Caption[] {
  const words = c.text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords || c.wordStarts.length !== words.length) return [c];
  const groups: number[][] = [];
  for (let i = 0; i < words.length; i += maxWords) groups.push(words.slice(i, i + maxWords).map((_, k) => i + k));
  if (groups.length > 1 && groups.at(-1)!.length === 1) groups.at(-2)!.push(groups.pop()![0]!);
  return groups.map((g, k) => ({
    id: k === 0 ? c.id : `${c.id}-${k}`,
    text: g.map((i) => words[i]).join(' '),
    start: c.wordStarts[g[0]!]!,
    end: k === groups.length - 1 ? c.end : c.wordStarts[groups[k + 1]![0]!]!,
    wordIds: [],
    wordStarts: g.map((i) => c.wordStarts[i]!),
  }));
}

function translated(plan: EditPlan, lang: 'pt' | 'en'): EditPlan {
  if (lang !== 'en') return plan;
  const tr = (text: string) => SAMPLE_EN[text] ?? text;
  return {
    ...plan,
    captions: plan.captions.map((c) => ({ ...c, text: tr(c.text) })),
    scenes: plan.scenes.map((sc) => {
      const out: Record<string, unknown> = { ...sc };
      for (const key of ['text', 'label', 'subtitle'] as const) if (typeof out[key] === 'string') out[key] = tr(out[key] as string);
      if (Array.isArray(out.items)) out.items = (out.items as { text: string; at: number }[]).map((it) => ({ ...it, text: tr(it.text) }));
      return out as unknown as typeof sc;
    }),
  };
}

function galleryPlanPt(style: StyleDNA): EditPlan {
  return {
    version: 6,
    clips: [{ id: 'c1', name: '', duration: 28, framing: null }],
    framing: { mode: 'fill', fill: 'blur', zoom: 1, x: 0, y: 0 },
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
