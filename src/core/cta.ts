import type { Register } from './brief';

/**
 * Chamadas finais (CTA) que o app sabe escrever (v0.12, ADR-0017). Frases fixas, curtas (≤ 32 caracteres,
 * o limite do StyleDNA), em duas linguagens: formal ("Siga para mais") e informal ("Me segue pra mais").
 * O texto nunca vem da IA: ou é uma destas frases, ou é o que a pessoa escreveu no próprio pedido.
 */
export const CTA_KINDS = ['siga', 'link-bio', 'comente', 'salve', 'compartilhe', 'marque', 'direct', 'whatsapp', 'agende', 'compre', 'inscreva', 'visita', 'episodio', 'delivery', 'curta'] as const;
export type CtaKind = (typeof CTA_KINDS)[number];

export const CTA_TEXT: Record<CtaKind, Record<Register, string>> = {
  siga: { formal: 'Siga para mais conteúdos', informal: 'Me segue pra mais' },
  'link-bio': { formal: 'Acesse o link na bio', informal: 'Corre no link da bio' },
  comente: { formal: 'Comente aqui embaixo', informal: 'Comenta aqui embaixo' },
  salve: { formal: 'Salve para ver depois', informal: 'Salva pra não esquecer' },
  compartilhe: { formal: 'Compartilhe com alguém', informal: 'Manda pra alguém' },
  marque: { formal: 'Marque alguém', informal: 'Marca aquele amigo' },
  direct: { formal: 'Envie uma mensagem', informal: 'Chama no direct' },
  whatsapp: { formal: 'Fale conosco no WhatsApp', informal: 'Chama no WhatsApp' },
  agende: { formal: 'Agende seu horário', informal: 'Agenda seu horário' },
  compre: { formal: 'Garanta o seu', informal: 'Garante o seu' },
  inscreva: { formal: 'Inscreva-se', informal: 'Se inscreve aí' },
  visita: { formal: 'Agende sua visita', informal: 'Bora agendar uma visita?' },
  episodio: { formal: 'Episódio completo no canal', informal: 'Ep completo no canal' },
  delivery: { formal: 'Faça seu pedido', informal: 'Pede já o seu' },
  curta: { formal: 'Curta e siga', informal: 'Curte e segue' },
};

export const ctaText = (kind: CtaKind, register: Register | null | undefined): string => CTA_TEXT[kind][register ?? 'informal'];

/** "Comente X": a palavra vem do pedido (uma palavra só, até 16 letras). */
export function commentCta(word: string, register: Register | null | undefined): string | null {
  const clean = word.trim().replace(/^["“'‘]+|["”'’]+$/g, '');
  if (!/^[\p{L}\p{N}]{1,16}$/u.test(clean)) return null;
  return `${register === 'formal' ? 'Comente' : 'Comenta'} “${clean.toUpperCase()}”`;
}

/** Todas as frases fixas (para conferir que um texto de chamada é do app). */
export const ALL_CTA_TEXTS: readonly string[] = Object.values(CTA_TEXT).flatMap((r) => [r.formal, r.informal]);
