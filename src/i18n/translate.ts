/**
 * Tradução da interface (v0.40, ADR-0041). Camada pura: recebe dicionários "texto em português → inglês"
 * e traduz um texto já mostrado na tela. Sem APIs de navegador.
 *
 * Duas formas de entrada no dicionário:
 * - exata: a chave é o texto como está no código ("Exportar" → "Export");
 * - com lacunas: {0}, {1}… marcam partes que mudam ("Exportando {0}%" → "Exporting {0}%").
 *   A parte que muda é traduzida de novo se ela mesma estiver no dicionário.
 *
 * Texto que não está no dicionário fica como está (em português); nada quebra.
 */

export type Entries = Readonly<Record<string, string>>;

interface Pattern {
  re: RegExp;
  en: string;
  /** quanto texto fixo o padrão tem: padrões mais específicos são testados antes */
  weight: number;
}

export interface Dictionary {
  exact: Map<string, string>;
  patterns: Pattern[];
}

const SLOT = /\{(\d+)\}/g;
/** abaixo deste tanto de texto fixo, o padrão é "fraco" (ver translateCore) */
const WEAK = 14;
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Junta os dicionários de cada área num só. Em chave repetida, vale o primeiro. */
export function buildDictionary(sources: readonly Entries[]): Dictionary {
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    for (const [ptRaw, en] of Object.entries(src)) {
      const pt = norm(ptRaw);
      if (!pt || !en || seen.has(pt)) continue;
      seen.add(pt);
      if (!/\{\d+\}/.test(pt)) {
        exact.set(pt, en);
        continue;
      }
      const fixed = pt.replace(SLOT, '');
      // padrão quase sem texto fixo ("{0}, {1}") pegaria qualquer coisa: fica de fora
      if ((fixed.match(/[A-Za-zÀ-ú]/g) ?? []).length < 3) continue;
      const order: number[] = [];
      let source = '';
      let last = 0;
      for (const m of pt.matchAll(SLOT)) {
        source += escape(pt.slice(last, m.index)) + '([\\s\\S]+?)';
        order.push(Number(m[1]));
        last = m.index! + m[0].length;
      }
      source += escape(pt.slice(last));
      // a lacuna N do inglês aponta para o grupo de captura na ordem em que aparece no português
      const en2 = en.replace(SLOT, (_, n: string) => {
        const pos = order.indexOf(Number(n));
        return pos < 0 ? '' : `{${pos}}`;
      });
      patterns.push({ re: new RegExp(`^${source}$`), en: en2, weight: fixed.length });
    }
  }
  patterns.sort((a, b) => b.weight - a.weight);
  return { exact, patterns };
}

/** Número com vírgula decimal ("1,5" ou "1,2 GB") vira ponto ("1.5", "1.2 GB") no inglês. */
const decimal = (s: string) => (/^-?[\d.,]+\s*[A-Za-z%]{0,3}$/.test(s) ? s.replace(/(\d),(\d)/g, '$1.$2') : s);

function translateCore(text: string, dict: Dictionary, depth: number): string | undefined {
  const hit = dict.exact.get(text);
  if (hit !== undefined) return hit;
  if (depth > 1) return undefined;
  for (const p of dict.patterns) {
    const m = p.re.exec(text);
    if (!m) continue;
    const parts = m.slice(1).map((part) => {
      const core = (part ?? '').trim();
      return { part: part ?? '', core, tr: translateCore(core, dict, depth + 1) };
    });
    // padrão com pouco texto fixo ("Sem {0}", "Apagar {0}") só vale quando a parte que muda é curta
    // (nome, número) ou também tem tradução; senão uma frase nova ficaria metade em cada idioma
    if (p.weight < WEAK && parts.some((x) => x.tr === undefined && x.core.split(/\s+/).length > 2)) continue;
    return p.en.replace(SLOT, (_, n: string) => {
      const x = parts[Number(n)];
      if (!x) return '';
      const lead = x.part.match(/^\s*/)![0];
      const tail = x.part.match(/\s*$/)![0];
      return lead + (x.tr ?? decimal(x.core)) + tail;
    });
  }
  return undefined;
}

/** Traduz um texto da tela; espaços nas pontas são preservados. Sem tradução conhecida, devolve o original. */
export function translateText(text: string, dict: Dictionary): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const core = norm(m[2] ?? '');
  if (!core || !/[A-Za-zÀ-ú]/.test(core)) return text;
  const hit = translateCore(core, dict, 0);
  return hit === undefined ? text : (m[1] ?? '') + hit + (m[3] ?? '');
}
