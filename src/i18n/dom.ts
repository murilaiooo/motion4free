import { getLocale, subscribeLocale, type Locale } from './locale';
import { translateText, type Dictionary } from './translate';

/**
 * Aplica o idioma na tela (v0.40, ADR-0041). Os componentes continuam escrevendo em português; esta camada
 * observa o documento e troca cada texto e cada atributo de leitura (title, placeholder, aria-label, alt,
 * dica) pela versão em inglês do dicionário, antes de a tela ser pintada.
 *
 * Por que assim: o app tem ~2.500 textos espalhados por telas que outras frentes mudam ao mesmo tempo.
 * Trocar cada texto por uma chave geraria conflito em quase todo arquivo. Aqui, um texto novo ainda sem
 * tradução só aparece em português até entrar no dicionário (scripts/i18n-missing.mjs lista os que faltam).
 *
 * Conteúdo da pessoa (fala transcrita, legenda na prévia, nomes de projetos e arquivos) nunca é traduzido.
 */

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip', 'aria-valuetext', 'aria-roledescription'] as const;

/** Áreas com texto da própria pessoa ou técnico: não traduzir. */
const KEEP =
  'script,style,textarea,code,pre,[translate="no"],[contenteditable="true"],[data-no-translate],' +
  '.transcript,.preview-overlay,.etl-chip-text,.project-name,.proj-name,.caption-track';

/** texto original (em português) de cada nó e o que esta camada escreveu por cima */
const textSource = new WeakMap<Text, string>();
const textApplied = new WeakMap<Text, string>();
const attrSource = new WeakMap<Element, Map<string, string>>();
const attrApplied = new WeakMap<Element, Map<string, string>>();

let dict: Dictionary | null = null;
let locale: Locale = getLocale();

function keep(el: Element | null): boolean {
  return !el || el.closest(KEEP) !== null;
}

function doText(node: Text): void {
  const value = node.nodeValue ?? '';
  if (textApplied.get(node) === value) return; // fomos nós que escrevemos
  if (!value.trim()) return;
  if (keep(node.parentElement)) return;
  textSource.set(node, value);
  const next = locale === 'en' && dict ? translateText(value, dict) : value;
  if (next !== value) {
    textApplied.set(node, next);
    node.nodeValue = next;
  } else textApplied.delete(node);
}

function doAttr(el: Element, name: string): void {
  const value = el.getAttribute(name);
  if (value === null || !value.trim()) return;
  const applied = attrApplied.get(el);
  if (applied?.get(name) === value) return;
  // atributos de leitura (dicas, nomes de botões) são da interface mesmo dentro da área do usuário;
  // só ficam de fora onde o código pede explicitamente (translate="no")
  if (el.closest('[translate="no"],[data-no-translate]')) return;
  let src = attrSource.get(el);
  if (!src) attrSource.set(el, (src = new Map()));
  src.set(name, value);
  const next = locale === 'en' && dict ? translateText(value, dict) : value;
  let ap = applied;
  if (!ap) attrApplied.set(el, (ap = new Map()));
  if (next !== value) {
    ap.set(name, next);
    el.setAttribute(name, next);
  } else ap.delete(name);
}

function doElement(el: Element): void {
  for (const name of ATTRS) if (el.hasAttribute(name)) doAttr(el, name);
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) doElement(root as Element);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doElement(n as Element);
  }
}

/** Volta todos os textos ao português original (troca para pt) ou aplica o inglês de novo. */
function refresh(): void {
  const it = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n: Node | null = document.documentElement; n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      const src = textSource.get(t);
      if (src !== undefined && textApplied.get(t) === t.nodeValue) {
        textApplied.delete(t);
        if (t.nodeValue !== src) t.nodeValue = src;
      }
      doText(t);
    } else {
      const el = n as Element;
      const src = attrSource.get(el);
      const ap = attrApplied.get(el);
      if (src && ap) {
        for (const [name, written] of ap) {
          const orig = src.get(name);
          if (orig !== undefined && el.getAttribute(name) === written) el.setAttribute(name, orig);
        }
        ap.clear();
      }
      doElement(el);
    }
  }
}

function setLang(l: Locale): void {
  document.documentElement.lang = l === 'en' ? 'en' : 'pt-BR';
}

/** Liga a tradução da tela. Chamar uma vez, antes do primeiro desenho do React. */
export function startI18n(dictionary: Dictionary): void {
  dict = dictionary;
  setLang(locale);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target as Text);
      else if (r.type === 'attributes' && r.attributeName) doAttr(r.target as Element, r.attributeName);
      else r.addedNodes.forEach(walk);
    }
  });
  walk(document.documentElement);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
  subscribeLocale((l) => {
    locale = l;
    setLang(l);
    refresh();
  });
}

/** Traduz um texto avulso que não vai para a tela (ex.: título de download, diálogo do navegador). */
export function t(text: string): string {
  return locale === 'en' && dict ? translateText(text, dict) : text;
}
