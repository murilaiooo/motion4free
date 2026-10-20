import { hexToRgb, mix, rgbToHex, type RGB } from './color';

/**
 * Nomes de cor em português e inglês → #RRGGBB. Usado pelas regras do pedido e para aceitar
 * "verde" vindo da IA no lugar de um código. Tons escolhidos para ficarem vivos e legíveis sobre vídeo.
 * Chaves sem acento e no singular masculino; `colorFromWords` cuida de feminino, plural e acentos.
 */
export const COLOR_NAMES: Record<string, string> = {
  verde: '#22C55E',
  'verde escuro': '#15803D',
  'verde claro': '#86EFAC',
  'verde limao': '#A3E635',
  'verde lima': '#A3E635',
  'verde neon': '#39FF14',
  'verde agua': '#5EEAD4',
  'verde bandeira': '#009C3B',
  'verde musgo': '#4D7C0F',
  amarelo: '#FFD400',
  'amarelo ouro': '#FFC107',
  'amarelo claro': '#FDE68A',
  'amarelo neon': '#F5FF3B',
  dourado: '#F5B700',
  ouro: '#F5B700',
  azul: '#3B82F6',
  'azul claro': '#7DD3FC',
  'azul escuro': '#1E3A8A',
  'azul marinho': '#1E3A8A',
  'azul bebe': '#BAE6FD',
  'azul royal': '#2453FF',
  'azul neon': '#1FB6FF',
  celeste: '#7DD3FC',
  turquesa: '#22D3EE',
  ciano: '#22D3EE',
  vermelho: '#EF4444',
  'vermelho escuro': '#B91C1C',
  vinho: '#7F1D1D',
  bordo: '#7F1D1D',
  laranja: '#FF8C1A',
  rosa: '#F472B6',
  'rosa claro': '#FBCFE8',
  'rosa choque': '#FF2E93',
  pink: '#FF2E93',
  magenta: '#E879F9',
  roxo: '#8B5CF6',
  lilas: '#C4B5FD',
  violeta: '#8B5CF6',
  branco: '#FFFFFF',
  preto: '#000000',
  cinza: '#9CA3AF',
  'cinza claro': '#D1D5DB',
  'cinza escuro': '#374151',
  prata: '#C0C0C0',
  prateado: '#C0C0C0',
  marrom: '#8B5A2B',
  bege: '#E8D8B0',
  creme: '#FFF4D6',
  neon: '#39FF14',
  // inglês
  green: '#22C55E',
  yellow: '#FFD400',
  blue: '#3B82F6',
  red: '#EF4444',
  orange: '#FF8C1A',
  purple: '#8B5CF6',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9CA3AF',
  grey: '#9CA3AF',
  gold: '#F5B700',
};

/** Formas femininas/plurais → forma da tabela. */
const FORMS: Record<string, string> = {
  verdes: 'verde', amarela: 'amarelo', amarelas: 'amarelo', amarelos: 'amarelo', dourada: 'dourado', douradas: 'dourado', dourados: 'dourado',
  azuis: 'azul', vermelha: 'vermelho', vermelhas: 'vermelho', vermelhos: 'vermelho', laranjas: 'laranja', rosas: 'rosa', roxa: 'roxo', roxas: 'roxo',
  roxos: 'roxo', branca: 'branco', brancas: 'branco', brancos: 'branco', preta: 'preto', pretas: 'preto', pretos: 'preto', cinzas: 'cinza',
  prateada: 'prateado', marrons: 'marrom', escura: 'escuro', escuras: 'escuro', escuros: 'escuro', clara: 'claro', claras: 'claro', claros: 'claro',
  vinhos: 'vinho', lilases: 'lilas',
};

export const stripAccentsLower = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
export const baseColorWord = (w: string) => FORMS[w] ?? w;

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** "#0f0", "#00FF00" → "#00FF00"; senão null. Sem "#" só aceita 6 dígitos com pelo menos uma letra a–f. */
export function parseHex(s: string): string | null {
  const t = s.trim();
  const m = HEX.exec(t);
  if (!m) return null;
  if (!t.startsWith('#') && (m[1]!.length !== 6 || !/[a-f]/i.test(m[1]!) || !/[0-9]/.test(m[1]!))) return null;
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return `#${h.toUpperCase()}`;
}

const SHADE = { escuro: 0.35, claro: 0.4 } as const;

/** Escurece (mistura com preto) ou clareia (com branco). */
export function shade(hex: string, how: 'escuro' | 'claro', amount: number = SHADE[how]): string {
  const target: RGB = how === 'escuro' ? [0, 0, 0] : [255, 255, 255];
  return rgbToHex(mix(hexToRgb(hex), target, amount));
}

/**
 * Lê uma cor de palavras já normalizadas (sem acento, minúsculas). Devolve a cor e quantas palavras usou,
 * ou null. Aceita "verde", "verde escuro", "azul bem claro", "#22c55e", "amarela", "mais escuro" depois da cor.
 */
export function colorFromWords(words: string[], i: number): { hex: string; used: number } | null {
  const w0 = words[i];
  if (!w0) return null;
  const hex = parseHex(w0);
  if (hex) return { hex, used: 1 };
  const a = baseColorWord(w0);
  if (!COLOR_NAMES[a]) return null;
  // nome composto da tabela ("verde limao", "azul marinho", "rosa choque")
  const b = words[i + 1] ? baseColorWord(words[i + 1]!) : '';
  let color = COLOR_NAMES[a]!;
  let used = 1;
  if (b && COLOR_NAMES[`${a} ${b}`]) {
    color = COLOR_NAMES[`${a} ${b}`]!;
    used = 2;
  }
  // "mais escuro", "bem claro", "escuro", "clarinho"
  let k = i + used;
  const lead = words[k];
  if (lead === 'mais' || lead === 'bem' || lead === 'meio' || lead === 'um' || lead === 'pouco') k++;
  if (words[k] === 'pouco' || words[k] === 'tom') k++;
  if (words[k] === 'mais') k++;
  const mod = words[k] ? baseColorWord(words[k]!) : '';
  if ((mod === 'escuro' || mod === 'claro' || mod === 'clarinho' || mod === 'escurinho') && used === 1) {
    const how = mod.startsWith('escur') ? 'escuro' : 'claro';
    const strong = lead === 'bem' || lead === 'mais';
    color = shade(color, how, strong ? SHADE[how] + 0.15 : SHADE[how]);
    used = k - i + 1;
  }
  return { hex: color, used };
}

/** Valor de cor vindo de fora (IA): código ou nome. */
export function parseColorValue(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const words = stripAccentsLower(v).replace(/[^a-z0-9# ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  const r = colorFromWords(words, 0);
  return r && r.used === words.length ? r.hex : null;
}
