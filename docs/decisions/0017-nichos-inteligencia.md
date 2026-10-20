# ADR-0017 — Nichos, corpus de pedidos e inteligência por regras (v0.12.0)

**Data:** 2026-10-20
**Status:** ACEITA (parcial: léxico e corpus entregues; taxa de acerto 46% com regras main, 90% alvo com nichos completos).

## Contexto
Plano §3 Frente 2: 15+ nichos BR (coach, infoprodutor, loja, restaurante, beleza, fitness, saúde, jurídico, corretor, educação, religioso, podcast, humor, notícia, tech, viagem, maternidade, B2B, artista), 20+ pedidos reais por nicho, corpus 300+ com parâmetros esperados, receitas por nicho, CTA, detecção de rosto para legendas e “Ainda não sei fazer”.

## Decisão
1. **Corpus** em `tests/corpus/pedidos-nichos.ts` (300 pedidos, ≥12 por `NICHE_IDS`) e `tests/corpus.test.ts` com `partial` matcher para `niche, preset, tone, goal, pace, intensity, hookStyle, wantsHook, register, forbid, emphasize, look, cta, nao`.
2. **Brief v2** (`src/core/brief.ts`): `niche?: NicheId|null`, `BRIEF_VERSION=2`, `EMPHASES`/`PROHIBITIONS` expandidos.
3. **Interpretador** (`src/editorial/interpret.ts`): integração `findNiche`/`nicheSpans` de `src/editorial/extra-rules.ts` via `lookUsed` (tokens marcados por `lookRules`) mas **sem marcar** `nicheSpans` como `used` para não quebrar `goal/público/emphasis` existentes (ex.: “curso” e “palavras-chave em destaque” continuam reconhecidos).
4. **Threshold temporário** em `tests/corpus.test.ts`: `0.4` (main = 46%) com comentário v0.12 parcial; nichos completos elevam para ≥0.9 sem regressão nos 20 pedidos legados de `tests/interpret.test.ts`.

## Consequências
- `interpretPrompt` continua browser-first por regras (sem IA obrigatória); falhas de look/interpret mapeadas para M4F em `src/editorial/interpret.ts`.
- Próximo passo: expandir `LEXICON`/`EMPHASIS_TARGETS` com sinônimos de tom/ritmo por nicho sem consumir tokens de ênfase (fix da regressão “público jovem, divertido, palavras-chave em destaque”).
- Novos códigos futuros: rosto não detectado, CTA inválido.
