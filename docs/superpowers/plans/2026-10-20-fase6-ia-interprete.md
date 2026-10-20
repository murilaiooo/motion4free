# v0.6 — IA como intérprete principal e espaço de parâmetros: plano de implementação

> Formato Superpowers `writing-plans`, versão curta. Iteração pedida pelo responsável depois do teste da v0.5 (antes do gate da Fase 6 do plano mestre). TDD nas camadas puras.

**Objetivo:** "gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos" muda o vídeo de verdade — com ou sem IA — e a tela diz "Apliquei: …" e "Ainda não sei fazer: …".

**Decisão:** [ADR-0011](../../decisions/0011-ia-interprete-e-look.md) · **Stack:** [ADR-0005](../../decisions/0005-stack-v1.md) (sem troca de peça).

**Gate:** com a IA desligada, o pedido exato deixa a legenda verde com destaque amarelo, põe emojis a cada ~3 s e mostra a área "Ainda não sei fazer" (teste ponta a ponta); a exportação continua gerando um MP4 real.

## Tarefas
| # | Entrega | Arquivos | Testes |
|---|---|---|---|
| 1 | Look (zod), StyleDNA v2, Brief v2, EditPlan v5 + migração | `src/core/{look,style,brief,types,schema,presets}.ts` | `schema`, `project`, `look-params` |
| 2 | Cores por nome e código | `src/core/color-names.ts`, `color.ts` | `look-params` |
| 3 | Desenho: cores, posição, caixa, fonte, entradas, palavras por linha | `src/render/{captions,kit,easing}.ts` | `look-params` (um teste por campo) |
| 4 | Emojis: lista, escolha pelo sentido, cenas, desenho, fonte OFL | `src/core/emoji.ts`, `src/editorial/{emoji-pick,selector}.ts`, `src/render/emoji.ts`, `src/assets/emoji/`, `scripts/make-emoji-font.sh`, `src/media/fonts.ts` | `look-params` |
| 5 | Aplicar look ao estilo (proibições vencem), gancho por tipo, ritmo de cortes | `src/editorial/{brief-apply,hooks,cuts,ops}.ts` | `look-params`, `cuts-hooks-ai` |
| 6 | Regras largas + "ainda não sei fazer" (≥ 40 pedidos) | `src/editorial/{tokens,look-rules,interpret}.ts` | `look-rules` (63 pedidos) |
| 7 | IA intérprete: prompt + exemplos, validação campo a campo, 1 correção, junção | `src/editorial/ai-brief.ts` | `ai-brief` |
| 8 | Modelos leve/padrão/forte, espelho, erros de memória | `src/core/{llm-models,mirror}.ts`, `src/ai/local-ai.ts` | `mirror` |
| 9 | Trecho pelo mesmo intérprete | `src/editorial/{range-interpret,range-ai,ranges}.ts` | `look-params`, `cuts-hooks-ai` |
| 10 | Tela: Apliquei / Ainda não sei fazer, escolha de modelo, IA no trecho | `src/app/{BriefPanel,AiOptions,RangePanel,Editor}.tsx` | `e2e/pedido-ia.spec.ts` |
| 11 | Códigos M4F-805/1012/1013, ADR-0011, CHANGELOG, roteiro, versão 0.6.0 | `src/core/errors.ts`, `docs/` | `errors` |
