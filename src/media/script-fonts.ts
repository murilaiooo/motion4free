import { SCRIPT_FONT_FILES, type ScriptFontFile } from './script-font-ranges';

/**
 * Fontes de reserva para as escritas das 10 línguas que as fontes dos modelos não têm (v0.45.0):
 * chinês (Noto Sans SC), árabe e urdu (Noto Sans Arabic), hindi (Noto Sans Devanagari) e bengali
 * (Noto Sans Bengali), todas OFL-1.1 via @fontsource, peso 700. Este módulo só é carregado quando o
 * texto tem uma dessas escritas; do chinês, só os pedaços (unicode-range) com os caracteres usados.
 * Funciona na página e no Worker de exportação (FontFace API).
 */

const SC_URLS = import.meta.glob('/node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-[0-9]*-700-normal.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const OTHER_URLS = import.meta.glob(
  [
    '/node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2',
    '/node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2',
    '/node_modules/@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-700-normal.woff2',
  ],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

const URL_BY_FILE = new Map<string, string>(Object.entries({ ...SC_URLS, ...OTHER_URLS }).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]));

/** "U+4e00-4e1f,U+4e2a" → pares [início, fim]. */
export function parseUnicodeRange(range: string): [number, number][] {
  return range.split(',').map((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(a!, 16), parseInt(b ?? a!, 16)] as [number, number];
  });
}

const parsed = new Map<ScriptFontFile, [number, number][]>();
const rangesOf = (f: ScriptFontFile) => {
  let r = parsed.get(f);
  if (!r) parsed.set(f, (r = parseUnicodeRange(f.range)));
  return r;
};
const covers = (f: ScriptFontFile, cp: number) => rangesOf(f).some(([a, b]) => cp >= a && cp <= b);

/** Caracteres que pedem fonte de reserva: as quatro escritas e a pontuação CJK; emojis ficam de fora. */
function needsFallback(cp: number): ScriptFontFile['script'] | null {
  if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) || (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)) return 'arabic';
  if (cp >= 0x0900 && cp <= 0x097f) return 'devanagari';
  if (cp >= 0x0980 && cp <= 0x09ff) return 'bengali';
  if ((cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xffef)) return 'han';
  return null;
}

/** Quais arquivos baixar para desenhar este texto (puro: testável sem navegador). */
export function scriptFontFilesFor(text: string): ScriptFontFile[] {
  const chosen = new Set<ScriptFontFile>();
  const seen = new Set<number>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (seen.has(cp)) continue;
    seen.add(cp);
    const script = needsFallback(cp);
    if (!script) continue;
    const file = SCRIPT_FONT_FILES.find((f) => f.script === script && covers(f, cp));
    if (file) chosen.add(file);
  }
  return [...chosen];
}

function fontSet(): FontFaceSet {
  if (typeof document !== 'undefined') return document.fonts;
  return (self as unknown as { fonts: FontFaceSet }).fonts;
}

const loading = new Map<string, Promise<void>>();

function loadFile(f: ScriptFontFile): Promise<void> {
  const cached = loading.get(f.file);
  if (cached) return cached;
  const p = (async () => {
    const url = URL_BY_FILE.get(f.file);
    if (!url) throw new Error(`arquivo de fonte ausente: ${f.file}`);
    // um peso só (700) que vale para todos os pesos pedidos: o modelo continua decidindo o resto
    const face = new FontFace(f.family, `url(${new URL(url, location.href).href})`, { weight: '100 900', style: 'normal', unicodeRange: f.range });
    await face.load();
    fontSet().add(face);
  })();
  p.catch(() => loading.delete(f.file));
  loading.set(f.file, p);
  return p;
}

/** Baixa e registra as fontes de reserva necessárias para o texto. Devolve as que falharam. */
export async function loadScriptFonts(text: string): Promise<string[]> {
  const files = scriptFontFilesFor(text);
  const results = await Promise.allSettled(files.map(loadFile));
  return results.map((r, i) => (r.status === 'rejected' ? `${files[i]!.family} (${files[i]!.file}): ${String(r.reason)}` : '')).filter(Boolean);
}
