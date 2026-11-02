import { EMOJI_FONT_FAMILY } from '../core/emoji';
import { CYRILLIC_FAMILIES, cyrillicFallback, fontsOf, hasCyrillic, nearestWeight, type FontFamily, type FontSpec, type StyleDNA } from '../core/style';
import type { EditPlan } from '../core/types';
import emojiFont from '../assets/emoji/m4f-emoji.woff2?url';
import cyr_inter_500_normal from '@fontsource/inter/files/inter-cyrillic-500-normal.woff2?url';
import cyr_inter_600_normal from '@fontsource/inter/files/inter-cyrillic-600-normal.woff2?url';
import cyr_inter_700_normal from '@fontsource/inter/files/inter-cyrillic-700-normal.woff2?url';
import cyr_inter_800_normal from '@fontsource/inter/files/inter-cyrillic-800-normal.woff2?url';
import cyr_montserrat_700_normal from '@fontsource/montserrat/files/montserrat-cyrillic-700-normal.woff2?url';
import cyr_montserrat_800_normal from '@fontsource/montserrat/files/montserrat-cyrillic-800-normal.woff2?url';
import cyr_montserrat_900_normal from '@fontsource/montserrat/files/montserrat-cyrillic-900-normal.woff2?url';
import cyr_ibm_plex_sans_500_normal from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-500-normal.woff2?url';
import cyr_ibm_plex_sans_600_normal from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-600-normal.woff2?url';
import cyr_ibm_plex_sans_700_normal from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-700-normal.woff2?url';
import cyr_ibm_plex_mono_500_normal from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2?url';
import cyr_ibm_plex_mono_600_normal from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-600-normal.woff2?url';
import cyr_nunito_800_normal from '@fontsource/nunito/files/nunito-cyrillic-800-normal.woff2?url';
import cyr_nunito_900_normal from '@fontsource/nunito/files/nunito-cyrillic-900-normal.woff2?url';
import cyr_cormorant_garamond_500_normal from '@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-500-normal.woff2?url';
import cyr_cormorant_garamond_600_normal from '@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-600-normal.woff2?url';
import cyr_cormorant_garamond_500_italic from '@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-500-italic.woff2?url';
import cyr_oswald_500_normal from '@fontsource/oswald/files/oswald-cyrillic-500-normal.woff2?url';
import cyr_oswald_700_normal from '@fontsource/oswald/files/oswald-cyrillic-700-normal.woff2?url';
import cyr_rubik_800_italic from '@fontsource/rubik/files/rubik-cyrillic-800-italic.woff2?url';
import cyr_rubik_900_italic from '@fontsource/rubik/files/rubik-cyrillic-900-italic.woff2?url';
import cyr_caveat_700_normal from '@fontsource/caveat/files/caveat-cyrillic-700-normal.woff2?url';
import cyr_playfair_display_400_normal from '@fontsource/playfair-display/files/playfair-display-cyrillic-400-normal.woff2?url';
import cyr_playfair_display_400_italic from '@fontsource/playfair-display/files/playfair-display-cyrillic-400-italic.woff2?url';
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
// v0.9 (modelos, ADR-0014)
import archivoBlack400 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url';
import dmSans500 from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url';
import dmSans700 from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url';
import spaceGrotesk500 from '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2?url';
import spaceGrotesk700 from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url';
import nunito800 from '@fontsource/nunito/files/nunito-latin-800-normal.woff2?url';
import nunito900 from '@fontsource/nunito/files/nunito-latin-900-normal.woff2?url';
import cormorantGaramond500 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2?url';
import cormorantGaramond600 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url';
import cormorantGaramond500I from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2?url';
import oswald500 from '@fontsource/oswald/files/oswald-latin-500-normal.woff2?url';
import oswald700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2?url';
import vt323400 from '@fontsource/vt323/files/vt323-latin-400-normal.woff2?url';
import bungee400 from '@fontsource/bungee/files/bungee-latin-400-normal.woff2?url';
import rubik800I from '@fontsource/rubik/files/rubik-latin-800-italic.woff2?url';
import rubik900I from '@fontsource/rubik/files/rubik-latin-900-italic.woff2?url';
import courierPrime400 from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2?url';
import courierPrime700 from '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2?url';
import caveat700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import kalam700 from '@fontsource/kalam/files/kalam-latin-700-normal.woff2?url';
import playfairDisplay400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfairDisplay400I from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';

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
  'Archivo Black|400|normal': archivoBlack400,
  'DM Sans|500|normal': dmSans500,
  'DM Sans|700|normal': dmSans700,
  'Space Grotesk|500|normal': spaceGrotesk500,
  'Space Grotesk|700|normal': spaceGrotesk700,
  'Nunito|800|normal': nunito800,
  'Nunito|900|normal': nunito900,
  'Cormorant Garamond|500|normal': cormorantGaramond500,
  'Cormorant Garamond|600|normal': cormorantGaramond600,
  'Cormorant Garamond|500|italic': cormorantGaramond500I,
  'Oswald|500|normal': oswald500,
  'Oswald|700|normal': oswald700,
  'VT323|400|normal': vt323400,
  'Bungee|400|normal': bungee400,
  'Rubik|800|italic': rubik800I,
  'Rubik|900|italic': rubik900I,
  'Courier Prime|400|normal': courierPrime400,
  'Courier Prime|700|normal': courierPrime700,
  'Caveat|700|normal': caveat700,
  'Kalam|700|normal': kalam700,
  'Playfair Display|400|normal': playfairDisplay400,
  'Playfair Display|400|italic': playfairDisplay400I,
};

/**
 * Letras cirílicas (#171, legenda em russo): baixadas só quando a legenda tem essas letras. Mesma família
 * e peso das latinas, com `unicodeRange` do cirílico, então o resto do texto não muda.
 */
const CYRILLIC_FILES: Record<string, string> = {
  'Inter|500|normal': cyr_inter_500_normal,
  'Inter|600|normal': cyr_inter_600_normal,
  'Inter|700|normal': cyr_inter_700_normal,
  'Inter|800|normal': cyr_inter_800_normal,
  'Montserrat|700|normal': cyr_montserrat_700_normal,
  'Montserrat|800|normal': cyr_montserrat_800_normal,
  'Montserrat|900|normal': cyr_montserrat_900_normal,
  'IBM Plex Sans|500|normal': cyr_ibm_plex_sans_500_normal,
  'IBM Plex Sans|600|normal': cyr_ibm_plex_sans_600_normal,
  'IBM Plex Sans|700|normal': cyr_ibm_plex_sans_700_normal,
  'IBM Plex Mono|500|normal': cyr_ibm_plex_mono_500_normal,
  'IBM Plex Mono|600|normal': cyr_ibm_plex_mono_600_normal,
  'Nunito|800|normal': cyr_nunito_800_normal,
  'Nunito|900|normal': cyr_nunito_900_normal,
  'Cormorant Garamond|500|normal': cyr_cormorant_garamond_500_normal,
  'Cormorant Garamond|600|normal': cyr_cormorant_garamond_600_normal,
  'Cormorant Garamond|500|italic': cyr_cormorant_garamond_500_italic,
  'Oswald|500|normal': cyr_oswald_500_normal,
  'Oswald|700|normal': cyr_oswald_700_normal,
  'Rubik|800|italic': cyr_rubik_800_italic,
  'Rubik|900|italic': cyr_rubik_900_italic,
  'Caveat|700|normal': cyr_caveat_700_normal,
  'Playfair Display|400|normal': cyr_playfair_display_400_normal,
  'Playfair Display|400|italic': cyr_playfair_display_400_italic,
};
const CYRILLIC_RANGE = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

const loading = new Map<string, Promise<void>>();

function fontSet(): FontFaceSet {
  if (typeof document !== 'undefined') return document.fonts;
  return (self as unknown as { fonts: FontFaceSet }).fonts;
}

function load(f: Pick<FontSpec, 'family' | 'weight' | 'style'>, cyrillic = false): Promise<void> {
  const key = `${f.family}|${f.weight}|${f.style}`;
  const cacheKey = cyrillic ? `${key}|cyr` : key;
  const cached = loading.get(cacheKey);
  if (cached) return cached;
  const url = (cyrillic ? CYRILLIC_FILES : FILES)[key];
  const p = (async () => {
    if (!url) throw new Error(`arquivo de fonte ausente: ${cacheKey}`);
    const face = new FontFace(f.family, `url(${new URL(url, location.href).href})`, { weight: String(f.weight), style: f.style, ...(cyrillic ? { unicodeRange: CYRILLIC_RANGE } : {}) });
    await face.load();
    fontSet().add(face);
  })();
  // falha não fica em cache: a próxima tentativa baixa de novo
  p.catch(() => loading.delete(cacheKey));
  loading.set(cacheKey, p);
  return p;
}

export interface FontsResult {
  ok: boolean;
  /** famílias que falharam, para o detalhe do aviso M4F-801 */
  detail: string;
}

/** Arquivos cirílicos para uma fonte: os dela, ou os da família parecida que tem cirílico. */
export function cyrillicSpecs(f: Pick<FontSpec, 'family' | 'weight' | 'style'>): Pick<FontSpec, 'family' | 'weight' | 'style'>[] {
  if (CYRILLIC_FAMILIES.has(f.family) && CYRILLIC_FILES[`${f.family}|${f.weight}|${f.style}`]) return [f];
  const family: FontFamily = cyrillicFallback(f.family) ?? f.family;
  const near = nearestWeight(family, f.weight, f.style);
  return CYRILLIC_FILES[`${family}|${near.weight}|${near.style}`] ? [{ family, ...near }] : [];
}

/**
 * Carrega as fontes do estilo antes de desenhar (tela principal e Worker). Nunca rejeita.
 * `cyrillic`: a legenda tem letras russas; baixa também os arquivos cirílicos (#171).
 */
export async function ensureFonts(style: StyleDNA | StyleDNA[], opts: { cyrillic?: boolean } = {}): Promise<FontsResult> {
  const seen = new Set<string>();
  const specs = (Array.isArray(style) ? style : [style]).flatMap(fontsOf).filter((f) => {
    const k = `${f.family}|${f.weight}|${f.style}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const cyr = opts.cyrillic ? specs.flatMap(cyrillicSpecs).filter((f, i, all) => all.findIndex((g) => g.family === f.family && g.weight === f.weight && g.style === f.style) === i) : [];
  const jobs = [...specs.map((f) => ({ f, run: load(f) })), ...cyr.map((f) => ({ f, run: load(f, true) }))];
  const results = await Promise.allSettled(jobs.map((j) => j.run));
  const failed = results.map((r, i) => (r.status === 'rejected' ? `${jobs[i]!.f.family} ${jobs[i]!.f.weight}: ${String(r.reason)}` : '')).filter(Boolean);
  return { ok: failed.length === 0, detail: failed.join('; ') };
}

/** O vídeo tem texto em letras cirílicas (legendas, cenas, textos adicionados ou a faixa original guardada)? */
export function planNeedsCyrillic(plan: Pick<EditPlan, 'captions' | 'scenes'> & { edits?: unknown; subtitleTranslation?: unknown }): boolean {
  return hasCyrillic(JSON.stringify([plan.captions, plan.scenes, plan.edits ?? null, plan.subtitleTranslation ?? null]));
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
