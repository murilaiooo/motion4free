# Motion4Free Master: pesquisa comparativa e plano de evolução

**Corte da análise:** 21/10/2026. **Baseline inicial:** v0.21.1 (`ac09c5e`). **Baseline atualizado após merge concorrente:** v0.22.0 (`2a80e0f`, PR #66). **Natureza:** pesquisa, auditoria estática e planejamento; nenhuma integração, benchmark ou teste de vídeo foi executado nesta entrega.

## Objetivo e navegação

Chegar a um editor de Reels/Shorts com comportamento previsível, controle criativo de alto nível e interface profissional sem perder os requisitos do produto: navegador primeiro, privacidade local, ausência de instalação obrigatória, custo monetário obrigatório zero, licenças respeitadas e exportação real.

1. [01-state-of-product.md](01-state-of-product.md): funcionalidades atuais, mapa do código, o que já existe e gargalos.
2. [02-upstream-engineering.md](02-upstream-engineering.md): projetos GitHub examinados, trechos de código e comparação de abordagens.
3. [03-master-experience.md](03-master-experience.md): layout, navegação, motion UX e evolução incremental do design system.
4. [04-prioritized-backlog.md](04-prioritized-backlog.md): propostas numeradas, dependências e critérios de aceite.
5. [05-architecture-and-qa.md](05-architecture-and-qa.md): contratos de engine e plano de provas técnicas/visuais.
6. [06-licenses-and-provenance.md](06-licenses-and-provenance.md): permissões, restrições, atribuição e regras de reutilização.
7. [07-source-map.md](07-source-map.md): caminhos exatos do GitHub para retomar cada inspeção sem repetir a pesquisa.
8. [08-opencut-deep-dive.md](08-opencut-deep-dive.md): avaliação detalhada de OpenCut Classic e rewrite, módulos úteis, lacunas e integração segura.

## Adendo 21/10: OpenCut

A inspeção posterior identificou [OpenCut Classic](https://github.com/opencut-app/opencut-classic) (MIT, **arquivado**) como referência forte para comandos, keyframes Bézier, máscaras, efeitos em GPU e timebase em ticks, e [OpenCut rewrite](https://github.com/opencut-app/opencut) (MIT, **ainda esqueleto de editor**) como visão futura de plugins/API. **Não migrar stack e não tratar recursos anunciados no rewrite como entregues.** Ver [estudo técnico](08-opencut-deep-dive.md).

## Conclusões da pesquisa

- **Não substituir a stack nem a UI de uma só vez.** `src/render/frame.ts`, `src/media/export.ts`, `src/editorial/*`, `src/app/EditTimeline.tsx` e o design system existente já resolvem problemas reais.
- **Maior lacuna arquitetural:** edição interna em segundos fracionários, com vários domínios de tempo, e exportação orientada a `Math.floor(duration * fps)`. Convergir paulatinamente para um modelo de frames inteiro e contratos reproduzíveis, sem migrar projetos antigos de forma destrutiva.
- **Maior avanço visual funcional:** workspaces *Editar / Animar / Finalizar*, inspector contextual, timeline de leitura rápida e manipuladores de keyframes com prévia/export idênticos. Conservar cores e tokens já definidos em `docs/design-system.md`.
- **Maior avanço criativo:** keyframes visíveis, movimentos encadeados e presets que permaneçam editáveis; não simplesmente mais modelos superficiais.
- **Maior avanço para criadores:** áudio multifaixa, ducking, beat markers, marcadores de conteúdo, edição por palavras e exportação de projeto portátil.
- **Risco:** alegações de README, licença do framework versus licença do aplicativo, uso de modelos/assets, memória de vídeos longos, estabilidade de projetos salvos e CI sem cota.
- **v0.22:** o criador de cortes de vídeos longos existe na main desde a análise. NÃO abrir tarefa genérica 'criar clipping de vídeos longos': trabalhar qualidade, revisão, métricas e integração.

## Critérios de priorização

Primeiro integridade de timeline/projeto/exportação, depois ferramentas de autoria, depois aceleração criativa e refinamento estético. Nenhuma feature passa para 'concluída' sem: contrato de dados; teste de operação; preview igual ao MP4; projeto salvo/reaberto; performance e limites; verificação de licença; roteiro manual. Resultados de upstream não provam qualidade do Motion4Free.

## Como usar

Use os IDs `MASTER-01` a `MASTER-24` do backlog (22–24 adicionados após a avaliação do OpenCut). Faça PRs pequenos e independentes, com migrações compatíveis e rollback. Antes de implementar, confirme a versão atual da main e se um PR paralelo já implementou o item. Este relatório complementa, não substitui, `AGENTS.md`, `docs/superpowers/`, `docs/decisions/`, `docs/research/upstream-implementation/` e `docs/quality.md`.

**Estado no GitHub:** material proposto em branch de documentação, sem merge automático e sem mudanças no aplicativo.
