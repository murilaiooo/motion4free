/**
 * Leitura tolerante de JSON vindo de modelos de IA gratuitos (v0.37, M4F-1112). Modelos diferentes erram de
 * jeitos diferentes: pensam em voz alta antes (<think>, "Reasoning:"), cercam com ```json, escrevem um
 * exemplo em texto antes do JSON de verdade, usam vírgula sobrando, comentários, aspas tipográficas, ou são
 * cortados no meio por limite de tokens. Aqui nada é executado: só se tenta achar um valor JSON e, se o fim
 * foi cortado, aproveitar os objetos completos que vieram antes do corte.
 */

/** Remove raciocínio e cercas. Raciocínio sem fim (<think> aberto) só sai se sobrar JSON depois dele. */
export function stripReasoning(raw: string): string {
  let text = raw.replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '');
  const open = /<(think|thinking|reasoning)>/i.exec(text);
  if (open) {
    const after = text.slice(open.index + open[0].length);
    // pensamento aberto até o fim: o JSON pode estar dentro dele (modelo esqueceu de fechar)
    text = text.slice(0, open.index) + after;
  }
  return text.replace(/```(?:json|JSON)?/g, '').replace(/[“”]/g, '"');
}

/** Conserta os deslizes mais comuns sem mudar valores: vírgula sobrando e comentários fora de strings. */
export function repairJson(text: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 1; continue; }
    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += c;
  }
  return out;
}

/** Fim do valor JSON (objeto ou lista) que começa em `a`, equilibrando chaves fora de strings; -1 se foi cortado. */
function balancedEnd(text: string, a: number): number {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = a; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function tryParse(text: string): unknown {
  try { return JSON.parse(text); } catch { /* tenta consertado */ }
  try { return JSON.parse(repairJson(text)); } catch { return undefined; }
}

/** Todos os valores JSON completos da resposta, na ordem em que aparecem (o último costuma ser a resposta final). */
export function jsonValues(raw: string): unknown[] {
  const text = stripReasoning(raw);
  const out: unknown[] = [];
  for (let a = 0; a < text.length; a++) {
    const c = text[a];
    if (c !== '{' && c !== '[') continue;
    const end = balancedEnd(text, a);
    if (end < 0) continue;
    const value = tryParse(text.slice(a, end + 1));
    if (value !== undefined && typeof value === 'object' && value !== null) {
      out.push(value);
      a = end;
    }
  }
  return out;
}

/**
 * Objetos `{...}` completos e sem chaves internas dentro de uma resposta cortada no meio
 * (ex.: `{"spans":[{"a":1},{"a":2},{"a":` → os dois primeiros).
 */
export function salvageObjects(raw: string): Record<string, unknown>[] {
  const text = stripReasoning(raw);
  const out: Record<string, unknown>[] = [];
  const re = /\{[^{}]*\}/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const value = tryParse(m[0]);
    if (value && typeof value === 'object' && !Array.isArray(value)) out.push(value as Record<string, unknown>);
  }
  return out;
}

/** Primeiro campo presente entre vários nomes possíveis (inglês, português, snake_case, camelCase). */
export function pick(obj: Record<string, unknown>, names: readonly string[]): unknown {
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase().replace(/[_\s-]/g, ''), k]));
  for (const name of names) {
    const key = lower.get(name.toLowerCase().replace(/[_\s-]/g, ''));
    if (key !== undefined && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}
