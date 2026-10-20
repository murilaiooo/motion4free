import { EMOJI_FONT_FAMILY } from '../core/emoji';
import { fontsOf, type FontSpec, type StyleDNA } from '../core/style';
import emojiFont from '../assets/emoji/m4f-emoji.woff2?url';
import interB from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import interSB from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interXB from '@fontsource/inter/files/inter-latin-800-normal.woff2?url';
import instrument from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import instrumentItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import anton from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';
import montserrat700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import montserrat800 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2?url';
import montserrat900 from '@fontsource/montserrat/files/montserrat-latin-900-normal.woff2?url';
import plex500 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url';
import plex600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url';
import plex700 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2?url';
import plexCond600 from '@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-600-normal.woff2?url';
import plexCond700 from '@fontsource/ibm-plex-sans-condensed/files/ibm-plex-sans-condensed-latin-700-normal.woff2?url';
import plexMono500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import plexMono600 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url';

/**
 * Fontes livres (OFL) que acompanham o app, servidas do próprio site (sem Google Fonts).
 * Só o subconjunto latino (cobre o português). Licenças em docs/licencas.md e em /licencas-fontes.txt.
 */
const FILES: Record<string, string> = {
  'Inter|500|normal': interB,
  'Inter|600|normal': interSB,
  'Inter|700|normal': interBold,
  'Inter|800|normal': interXB,
  'Instrument Serif|400|normal': instrument,
  'Instrument Serif|400|italic': instrumentItalic,
  'Anton|400|normal': anton,
  'Montserrat|700|normal': montserrat700,
  'Montserrat|800|normal': montserrat800,
  'Montserrat|900|normal': montserrat900,
  'IBM Plex Sans|500|normal': plex500,
  'IBM Plex Sans|600|normal': plex600,
  'IBM Plex Sans|700|normal': plex700,
  'IBM Plex Sans Condensed|600|normal': plexCond600,
  'IBM Plex Sans Condensed|700|normal': plexCond700,
  'IBM Plex Mono|500|normal': plexMono500,
  'IBM Plex Mono|600|normal': plexMono600,
};

const loading = new Map<string, Promise<void>>();

function fontSet(): FontFaceSet {
  if (typeof document !== 'undefined') return document.fonts;
  return (self as unknown as { fonts: FontFaceSet }).fonts;
}

function load(f: Pick<FontSpec, 'family' | 'weight' | 'style'>): Promise<void> {
  const key = `${f.family}|${f.weight}|${f.style}`;
  const cached = loading.get(key);
  if (cached) return cached;
  const url = FILES[key];
  const p = (async () => {
    if (!url) throw new Error(`arquivo de fonte ausente: ${key}`);
    const face = new FontFace(f.family, `url(${new URL(url, location.href).href})`, { weight: String(f.weight), style: f.style });
    await face.load();
    fontSet().add(face);
  })();
  // falha não fica em cache: a próxima tentativa baixa de novo
  p.catch(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

export interface FontsResult {
  ok: boolean;
  /** famílias que falharam, para o detalhe do aviso M4F-801 */
  detail: string;
}

/** Carrega as fontes do estilo antes de desenhar (tela principal e Worker). Nunca rejeita. */
export async function ensureFonts(style: StyleDNA | StyleDNA[]): Promise<FontsResult> {
  const seen = new Set<string>();
  const specs = (Array.isArray(style) ? style : [style]).flatMap(fontsOf).filter((f) => {
    const k = `${f.family}|${f.weight}|${f.style}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const results = await Promise.allSettled(specs.map(load));
  const failed = results.map((r, i) => (r.status === 'rejected' ? `${specs[i]!.family} ${specs[i]!.weight}: ${String(r.reason)}` : '')).filter(Boolean);
  return { ok: failed.length === 0, detail: failed.join('; ') };
}

let emojiLoading: Promise<void> | null = null;

/**
 * Fonte dos emojis (subconjunto da Noto Color Emoji, OFL-1.1, colorida e vetorial): a mesma no player e
 * no Worker de exportação, para o emoji sair igual nos dois. Só é baixada (~50 KB) quando há emojis.
 * Nunca rejeita: falha vira aviso M4F-805.
 */
export async function ensureEmojiFont(): Promise<FontsResult> {
  emojiLoading ??= (async () => {
    const face = new FontFace(EMOJI_FONT_FAMILY, `url(${new URL(emojiFont, location.href).href})`);
    await face.load();
    fontSet().add(face);
  })();
  try {
    await emojiLoading;
    return { ok: true, detail: '' };
  } catch (err) {
    emojiLoading = null;
    return { ok: false, detail: String(err) };
  }
}
