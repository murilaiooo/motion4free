/**
 * Pedidos de troca parcial (issue #11): "outro gancho", "troque só o gancho", "tira o gancho",
 * "outro estilo". Mudam só aquela parte do vídeo, sem refazer o resto do pedido nem a transcrição.
 * Regras simples em português; o resto dos pedidos continua no intérprete completo.
 */
export type PartialRequest = { kind: 'next-hook' } | { kind: 'no-hook' } | { kind: 'next-style' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

const NEXT_HOOK = /^(?:(?:por favor )?(?:troque|troca|trocar|mude|muda|mudar|quero|tente|tenta|usa|use|coloque|coloca|me de|da)?(?: so| apenas)?(?: o| um| uma)? ?)?(?:outro gancho|outra abertura|gancho diferente|abertura diferente|proximo gancho|gancho|abertura)(?: diferente| por outro| por outra)?$/;
const NO_HOOK = /^(?:tira|tire|tirar|remova|remove|sem)(?: o)? gancho$|^sem abertura$|^tira a abertura$/;
const NEXT_STYLE = /^(?:(?:troque|troca|trocar|mude|muda|mudar|quero|tente|tenta)?(?: so| apenas)?(?: o| um)? ?)?(?:outro estilo|estilo diferente|outro modelo|modelo diferente|outro visual|visual diferente)$/;

export function partialRequest(text: string): PartialRequest | null {
  const t = norm(text);
  if (!t || t.split(' ').length > 8) return null;
  if (NO_HOOK.test(t)) return { kind: 'no-hook' };
  // "gancho" sozinho continua sendo "quero um gancho forte" no intérprete completo
  if (NEXT_HOOK.test(t) && /outr|diferente|proximo|troc|troq|mud/.test(t)) return { kind: 'next-hook' };
  if (NEXT_STYLE.test(t)) return { kind: 'next-style' };
  return null;
}

/** Próximo da lista depois do atual (volta ao primeiro no fim). */
export function nextOf<T>(list: readonly T[], isCurrent: (item: T) => boolean): T | null {
  if (list.length === 0) return null;
  const i = list.findIndex(isCurrent);
  return list[(i + 1) % list.length] ?? null;
}
