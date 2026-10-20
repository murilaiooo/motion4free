/**
 * Emojis que o app sabe desenhar. São os glifos do subconjunto da fonte Noto Color Emoji (OFL-1.1)
 * que acompanha o app (`src/assets/emoji/m4f-emoji.woff2`, gerado por `scripts/make-emoji-font.sh`
 * com exatamente esta lista). Prévia e exportação usam o mesmo arquivo de fonte, então o emoji
 * sai igual nas duas. Emoji fora desta lista nunca entra no plano (o esquema recusa).
 */
export const EMOJI_SET = [
  '🔥', '💰', '🚀', '💡', '✅', '❌', '⚠️', '❤️', '😂', '😱', '🤔', '👀', '💪', '🎯', '📈', '📉', '⏰', '📱',
  '💻', '🧠', '📚', '🎉', '✨', '🙏', '👏', '👉', '⭐', '🏆', '🍕', '☕', '🏠', '✈️', '🌱', '☀️', '🌙', '💤',
  '😍', '😎', '🤯', '💥', '🔑', '🛒', '🎁', '📣', '🗣️', '👍', '💬', '🔔', '💯', '🤝', '🧘', '⚡', '💚', '💛',
  '🎬', '📌', '🧩', '🔒', '💸', '🥇', '👋', '😢', '😡', '🤑', '🙌', '👇', '⬇️', '💎', '🧐', '😴', '🥳', '🤩',
] as const;

export type Emoji = (typeof EMOJI_SET)[number];

/** Família registrada pela FontFace API (página e Worker de exportação). */
export const EMOJI_FONT_FAMILY = 'M4F Emoji';

export function isEmoji(s: unknown): s is Emoji {
  return typeof s === 'string' && (EMOJI_SET as readonly string[]).includes(s);
}

/** Aceita o emoji com ou sem o seletor de variação (U+FE0F) e devolve a forma da lista. */
export function normalizeEmoji(s: unknown): Emoji | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (isEmoji(t)) return t;
  const bare = t.replace(/️/g, '');
  return EMOJI_SET.find((e) => e.replace(/️/g, '') === bare) ?? null;
}
