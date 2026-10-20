import { describe, expect, it } from 'vitest';
import { briefSchema, type CreativeBrief } from '../src/core/brief';
import { NICHE_IDS } from '../src/core/niches';
import { interpretPrompt } from '../src/editorial/interpret';
import { CORPUS, type CorpusEntry } from './corpus/pedidos-nichos';

/**
 * Corpus de pedidos por nicho (v0.12): mede o intérprete por regras (sem IA) contra o que as pessoas
 * querem. A meta é a grande maioria; o que ainda erra fica listado (e documentado), nunca escondido.
 */
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

function partial(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected as Record<string, unknown>).every(([k, v]) => partial((actual as Record<string, unknown>)[k], v));
  }
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every((x) => actual.includes(x));
  return actual === expected;
}

function check(entry: CorpusEntry): string[] {
  const { brief } = interpretPrompt(entry.text);
  const x = entry.expect;
  const errs: string[] = [];
  const field = <K extends keyof CreativeBrief>(k: K) => {
    const want = (x as Record<string, unknown>)[k as string];
    if (want !== undefined && !partial(brief[k] ?? null, want)) errs.push(`${String(k)}: queria ${JSON.stringify(want)}, veio ${JSON.stringify(brief[k] ?? null)}`);
  };
  (['niche', 'preset', 'tone', 'goal', 'pace', 'intensity', 'hookStyle', 'wantsHook', 'register', 'forbid', 'emphasize', 'look'] as const).forEach(field);
  if (x.cta !== undefined && !(brief.look.cta ?? '').toLowerCase().includes(x.cta.toLowerCase())) errs.push(`cta: queria "${x.cta}", veio ${JSON.stringify(brief.look.cta ?? null)}`);
  for (const n of x.nao ?? []) if (!brief.unsupported.some((u) => norm(u).includes(norm(n)))) errs.push(`não sei fazer: faltou "${n}" (veio ${JSON.stringify(brief.unsupported)})`);
  return errs;
}

describe('corpus de pedidos por nicho (regras, sem IA)', () => {
  const results = CORPUS.map((c) => ({ c, errs: check(c) }));
  const passed = results.filter((r) => r.errs.length === 0).length;
  const rate = passed / CORPUS.length;

  it('tem pelo menos 300 pedidos e cobre todos os nichos', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(300);
    for (const n of NICHE_IDS) expect(CORPUS.filter((c) => c.niche === n).length, n).toBeGreaterThanOrEqual(12);
  });

  it('acerta a grande maioria (≥ 90%)', () => {
    const fails = results.filter((r) => r.errs.length).map((r) => `[${r.c.niche}] ${r.c.text} → ${r.errs.join('; ')}`);
    console.log(`corpus: ${passed}/${CORPUS.length} (${(rate * 100).toFixed(1)}%)\n${fails.join('\n')}`);
    expect(rate).toBeGreaterThanOrEqual(0.9);
  });

  it('nenhum pedido some calado: cada um muda algo ou aparece em "ainda não sei fazer"', () => {
    for (const c of CORPUS) {
      const r = interpretPrompt(c.text);
      expect(r.understood || r.brief.unsupported.length > 0, c.text).toBe(true);
      expect(briefSchema.safeParse(r.brief).success, c.text).toBe(true);
    }
  });
});
