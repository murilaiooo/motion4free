# Consolidação da fila de PRs — 24/10/2026

## Resultado verificável

No início havia **23 pull requests abertos** no repositório `murilaiooo/motion4free`. Após a triagem, `gh pr list --state open` retornou `[]`. Esta limpeza de fila **não** significa que todas as funcionalidades estejam incorporadas ou prontas para publicação.

| Destino | Pull requests | Estado |
| --- | --- | --- |
| Integração na branch de staging | #67, #101, #119, #130, #131 | Merge GitHub concluído em `integration/pr-consolidation-20261024`, não em `main` |
| Substituídas pela integração histórica #116 | #98, #99, #100, #103, #104, #106, #107, #108, #109, #110, #111, #112, #113, #114, #115 | Fechadas sem merge. O commit HEAD de cada uma é ancestral da branch remota #116, comprovado com Git. Commits/branches preservados |
| QA antigo desatualizado | #55 | Fechada sem merge; os novos testes Vitest deram 2/5, com pressupostos incompatíveis com a versão atual. Cenários ainda relevantes devem ser refeitos para #3/#4 |
| Snapshot de trabalho local | #122 | Fechada sem merge, arquivos e branch preservados; reconciliação rastreada na issue #132 |
| Integração monolítica não homologada | #116 | Fechada sem merge, 31 commits preservados; portar recursos em PRs pequenos conforme issue #133 |

## Implementações realmente integradas ao staging

- **#130**: fixture FFmpeg portátil para Windows, preflight de assets, ajustes de QA, documentação de release.
- **#131**: interface de configurações avançadas de IA simplificada, opções técnicas recolhidas e seletores claros.
- **#101**: pesquisa de clipes contextuais, critérios de qualidade e plano, sem prometer que o motor novo já está pronto.
- **#67**: documentação de arquitetura, UX e OpenCut, material histórico de pesquisa.
- **#119**: POC independente de eventos semânticos por palavra, 9 testes passando, sem integração à renderização do editor.

## Evidência técnica da combinação

No Windows com Brave e branch de staging:
- `npm run typecheck`: aprovado.
- `npm test`: **89 arquivos / 1.701 testes aprovados** após todas as cinco integrações.
- `npm run build`: aprovado com checagem de arquivos da build.
- `npm run fixture`: gerou cinco mídias sintéticas de teste sem depender do Bash/WSL.
- `npx playwright test e2e/configuracoes.spec.ts e2e/issue73-consent.spec.ts e2e/ai-routing-simple.spec.ts`: **4/4 aprovados** no Brave.
- `git diff --check` e clean worktree devem ser repetidos após cada alteração documental.

Limitações: testes de provedores usaram resposta simulada e chave sintética; não houve benchmark editorial com vídeos reais, estresse de codecs nem nova prova de export na combinação inteira. As duas exportações MP4 de curta duração já validadas individualmente na #130 não foram repetidas após a consolidação. Checks GitHub Actions das PRs estavam com falhas sem passos executados; seus estados não são considerados QA verde.

## Por que #116 não foi mesclada

O HEAD da #116 (v0.34.2) passou em worktree isolada `npm ci`, TypeScript, **83 arquivos / 1.670 testes** e build. Isso não comprova a integração. Um merge experimental **sem commit** contra o staging apresentou 13 conflitos em docs, dependências, estado de projeto, editor, IA e recorte de clipes. O merge foi abortado; staging e `main` não foram contaminados. Prosseguir pela issue #133, extraindo mudanças comprovadas em blocos menores, não por merge forçado.

## Segurança e publicação

**Nenhuma integração foi realizada na `main`; nenhuma publicação de produção foi iniciada.** A branch de staging é um candidato em preparação, não uma release. Os bloqueios de licenças/atribuição (#2), confiabilidade de mídia (#3/#4), qualidade contextual (#102), IA (#126/#127), QA de integração (#133) e resgate do snapshot (#132) continuam válidos. Antes da publicação, seguir `docs/release/RUNBOOK.md`.

Histórico e branches não foram apagados. O checkout principal `I:\codex\motion4free` e seus arquivos não rastreados permanecem preservados.
