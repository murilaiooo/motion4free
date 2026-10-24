# Estado real do release Motion4Free — 24/10/2026

**Decisão: BLOQUEADO para publicação pública.** A branch prepara gates, corrige o teste Windows e valida dois MP4s sintéticos curtos no Brave, mas **não certifica** os demais subsistemas, a qualidade editorial, o licenciamento, toda a exportação e o desempenho em vídeos reais.

## Origem, preservação e integração

- GitHub `main` no início: `941b791ecf7e4803c5c69d55ab8469e516b8b184` (código v0.30.0); branch da revisão: `release/readiness-20261024`, criada da main em worktree isolada `I:\codex\motion4free\.local\variantes\release-readiness-20261024`.
- A pasta de trabalho principal `I:\codex\motion4free` estava na branch `sync/local-product-work-20261022`, commit `0a138b5`, com `.agents/`, `.claude/` e `skills-lock.json` não rastreados. **Não modificar, limpar, resetar ou sobrescrever essa pasta.**
- Outras seis worktrees já existiam. A PR [#122](https://github.com/murilaiooo/motion4free/pull/122) preserva 48 arquivos locais ainda não reconciliados, não deve ser mesclada às cegas.
- A PR [#116](https://github.com/murilaiooo/motion4free/pull/116) agrega mudanças de vários subsistemas que originalmente **não foram testadas**. A PR [#119](https://github.com/murilaiooo/motion4free/pull/119) contém pesquisa e POC Hypit, sem promoção direta ao runtime.
- Snapshot inicial GitHub: **21 PRs abertos, 22 issues abertas**. Nenhuma issue foi encerrada nem PR externo mesclado nesta revisão.

## Correções comprovadas nesta branch

1. **Falha reproduzida no Windows:** `npm run fixture` chamava Bash/WSL e falhava em `MountDisk/ERROR_PATH_NOT_FOUND` porque uma configuração WSL fora deste projeto apontava para um disco inexistente. Mudança mínima: `scripts/make-fixture.mjs` invoca FFmpeg diretamente em Node, preservando as cinco fixtures geradas. `scripts/make-fixture.sh` removido por obsolescência comprovada. Geração após a correção passou no Windows.
2. **E2E em Brave:** teste `e2e/configuracoes.spec.ts` falhava 1/2 antes por ausência da fixture e passou **2/2** após a correção, incluindo a preservação do projeto ao abrir configurações.
3. **Novo gate de build Cloudflare:** `scripts/check-dist.mjs` verifica a presença do índice, tamanho máximo por arquivo (25 MiB), presença acidental de extensões sensíveis/diagnósticas e links simbólicos. Integração após `prune-dist`. Três testes unitários específicos aprovados. Essa barreira é defesa parcial, **não** scanner completo de segredos.
4. **QA E2E atualizado para a interface real:** `e2e/qa-regression.spec.ts` abre a aba **Mídia** para conferir os clipes e expande os avisos recolhidos na prévia. Antes, os testes falhavam após 90 s por tentar ler componentes ocultos, apesar de projetos salvos e linha do tempo visível. Correção do roteiro, não do editor.
5. **Documentação corrigida:** fontes de verdade em README/PRODUCT/SECURITY/AGENTS e índice, mapa de módulos, este STATUS e roteiro de publicação/rollback. A versão do pacote mantém 0.30.0 porque não houve publicação.

## Evidência obtida, limites claros

| Gate | Estado comprovado |
| --- | --- |
| Instalar deps | `npm ci --ignore-scripts --no-audit --no-fund`: passou no Windows, Node 24.19.0 |
| TypeScript baseline | `npm run typecheck`: passou |
| Testes baseline main | `npm test`: **87 arquivos / 1.689 testes aprovados** |
| Build baseline main | `npm run build`: passou |
| Geração de fixture antes | `npm run fixture`: falhou por WSL externo |
| Geração de fixture depois | `npm run fixture`: passou, cinco vídeos sintéticos |
| Brave E2E antes/depois | `e2e/configuracoes.spec.ts`: 1 passou/1 falhou antes, 2 passaram após |
| Novos testes da build | `npx vitest run tests/check-dist.test.ts`: 3 passaram |
| Suíte completa após mudanças | `npm test`: **88 arquivos / 1.692 testes aprovados** |
| Brave consentimento por API | `e2e/issue73-consent.spec.ts` junto às configurações: **3/3 E2E passaram** usando chave sintética e resposta simulada, sem credenciais reais |
| Build com gate novo | `npm run typecheck` e `npm run build`: passaram; `node scripts/check-dist.mjs` passou |
| MP4 real sem áudio | `npx playwright test e2e/qa-regression.spec.ts -g fict` com Brave: **1/1 passou**, MP4 exportado pelo editor, FFprobe confirmou 1080 × 1920 e ausência de faixa de áudio artificial |
| MP4 real após recuperação | `npx playwright test e2e/qa-regression.spec.ts -g removido` com Brave: **1/1 passou**, preservou apenas o clipe azul após reabrir, MP4 com áudio, duração esperada e quadro azul confirmado por FFmpeg |
| Entrada corrompida entre válidas | `npx playwright test e2e/qa-regression.spec.ts -g corrompido`: **1/1 passou** depois de abrir o painel de mídia e de avisos; sem exportação nesse cenário |
| Limite desses smokes | Apenas mídias sintéticas de 1–3 s; não provam sincronismo labial, estresse em vídeos longos nem exportação de todas as proporções |
| E2E completo e integração externa real | **não executados** |
| Análise integral de licenças/modelos/arte | **não concluída** |
| Verificação deployment Cloudflare atual | **não executada**, e nenhuma publicação foi iniciada |

O teste de ASR e qualidade contextual com gravações humanas e créditos de provedor reais não é demonstrado pelos testes automatizados. Logs locais `_gate-*.log` e `_brave-*.log` são ignorados e não devem ser anexados com informação sensível.

## Bloqueios priorizados

1. **P0 — conformidade e copyright:** issue [#2](https://github.com/murilaiooo/motion4free/issues/2) (auditoria/attribution de modelos, bibliotecas e arquivos distribuídos). Respeitar pausa registrada antes de alterar escopo.
2. **P0 — confiabilidade de mídia:** issues [#3](https://github.com/murilaiooo/motion4free/issues/3) e [#4](https://github.com/murilaiooo/motion4free/issues/4): dois smokes MP4 sintéticos passaram; ainda faltam combinações de codecs/resoluções, recuperação sob falha, sincronismo e limites de hardware/OPFS com gravações reais.
3. **P0 — seleção narrativa/contexto:** issue [#102](https://github.com/murilaiooo/motion4free/issues/102): testes reais e benchmark de trechos com gancho, desenvolvimento e conclusão; não confundir algoritmo implementado com qualidade comprovada.
4. **P1 — configuração de IA simples e fiel:** issues [#126](https://github.com/murilaiooo/motion4free/issues/126) e [#127](https://github.com/murilaiooo/motion4free/issues/127): modelos por tarefa, preço validado, teste visível e transcrição por API apenas se capacidade confirmada/explicitamente autorizada; nunca trocar Whisper silenciosamente.
5. **P1 — integração experimental:** PRs #116/#119 e relacionados exigem reconciliação com mudanças já integradas e testes locais específicos. Evitar merge de pilhas heterogêneas.
6. **P1 — UX/compatibilidade:** E2E completo, cancelamento e recovery, acessibilidade, navegadores/hardware, métricas de vídeo e validação de dispositivo permanecem pendentes.

A issue #5 (OpenReel) exige decisão baseada em evidência; **não** substituir a timeline atual por premissa arquitetural.

## Continuação sem redescoberta

1. Ler [AGENTS](../../AGENTS.md), [módulos](../architecture/MODULES.md), [runbook](RUNBOOK.md), [skills](SKILLS.md), `docs/decisions/` e o contexto de PRs #116/#122.
2. Inspecionar `git status` de todas as worktrees antes de novos merges. Continuar no branch isolado ou criar uma worktree nova da main. Não restaurar arquivos do snapshot #122 sem verificar se já existem na main.
3. Repetir checks e ampliar os E2E Brave que ainda faltam. Dois MP4s curtos já passaram; verificar formatos adicionais, codecs, integridade do áudio, sincronismo de fala e desempenho com mídia autorizada maior, registrando SHA, aparelho e logs redigidos.
4. Rever material de licença e atribuições. Depois tratar as issues P0 e P1 sem duplicação e abrir PRs pequenos. Não executar deploy até cumprir [runbook](RUNBOOK.md) e gate humano.
