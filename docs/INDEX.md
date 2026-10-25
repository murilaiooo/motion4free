# Índice da documentação

> **Estado:** spec v1 aprovada e plano de execução pronto em 20/10/2026. A implementação começa pela Fase 1; nenhum benchmark de qualidade ou custo em escala foi executado ainda.

## Comece aqui (em vigor desde 20/10/2026)
- [Spec v1 consolidada e aprovada](superpowers/specs/2026-10-20-motion4free-v1-design.md): o que é o produto, arquitetura, decisões e fases.
- [Plano mestre](superpowers/plans/2026-10-20-plano-mestre.md): 6 fases, roteiro de teste e gate de cada uma.
- [Plano do produto final (passagem de bastão)](superpowers/plans/2026-10-20-plano-produto-final.md): **comece por aqui** — pedidos do responsável, 4 frentes em andamento, estado de cada branch e como continuar.
- [Plano detalhado da Fase 1 — primeiro MP4](superpowers/plans/2026-10-20-fase1-primeiro-mp4.md): tarefas com código e testes.
- [ADR-0005: stack v1 e forma de decidir](decisions/0005-stack-v1.md).
- [Plano detalhado da Fase 3 — sistema de motion design](superpowers/plans/2026-10-20-fase3-motion.md) e [ADR-0008](decisions/0008-styledna-e-cenas.md).
- [Plano detalhado da Fase 4 — pedido por texto + IA](superpowers/plans/2026-10-20-fase4-pedido.md) e [ADR-0009](decisions/0009-pedido-e-ia.md).
- [Plano detalhado da Fase 5 — ajuste por trecho e por conversa](superpowers/plans/2026-10-20-fase5-trechos.md) e [ADR-0010](decisions/0010-trechos-travas-versoes.md).
- [Plano da v0.6 — IA como intérprete principal e espaço de parâmetros](superpowers/plans/2026-10-20-fase6-ia-interprete.md) e [ADR-0011](decisions/0011-ia-interprete-e-look.md).
- [v0.7 — qualidade profissional do movimento](decisions/0012-sistema-de-movimento.md) (ADR-0012).
- [v0.9 — 15 modelos: registro de modelos, acabamento do quadro e pedido pelo nome](decisions/0014-registro-de-modelos.md) (ADR-0014).
- [v0.8 — legenda precisa: Whisper large-v3-turbo com reserva automática, janelas com folga, limpeza e medida de acerto](decisions/0013-legenda-precisa.md) (ADR-0013) e [como medir o acerto da legenda](ai/avaliar-legenda.md).
- [v0.10 — novo visual: editor em tela cheia](decisions/0015-novo-visual.md) (ADR-0015) e [sistema visual da interface](design-system.md).
- [Roteiro de teste consolidado (tudo até a v0.10, com o novo visual), para quem testa](roteiro-de-teste.md).
- [v0.22 — criador de clipes de vídeo longo](CHANGELOG.md), [plano](superpowers/plans/2026-10-21-criador-de-clipes.md), [roteiro de teste da v0.22](roteiro-de-teste-v0.22.md) e [ADR-0023](decisions/0023-criador-de-clipes.md).
- [v0.23 — progresso detalhado em todas as esperas](CHANGELOG.md), [roteiro de teste da v0.23](roteiro-de-teste-v0.23.md) e [ADR-0024](decisions/0024-progresso-detalhado.md).
- [v0.19 — menu da esquerda reorganizado](CHANGELOG.md), [roteiro de teste da v0.19](roteiro-de-teste-v0.19.md) e [ADR-0022](decisions/0022-menu-lateral.md).
- [v0.18 — camadas, onda de áudio real e mover itens na prévia](CHANGELOG.md), [roteiro de teste da v0.18](roteiro-de-teste-v0.18.md) e [ADR-0021](decisions/0021-camadas-e-edicao-direta.md).
- [v0.17 — linha do tempo de editor: dividir, apagar, mover, aparar, copiar, recortar, colar e duplicar](CHANGELOG.md), [roteiro de teste da v0.17](roteiro-de-teste-v0.17.md) e [ADR-0020](decisions/0020-linha-do-tempo-edicao.md).
- [v0.16 — recuperação de projetos, volume igual entre clipes e enquadramento](CHANGELOG.md), [roteiro de teste da v0.16](roteiro-de-teste-v0.16.md) e [kit de avaliação cega da qualidade do motion](qualidade/avaliacao-cega.md) (issue #30).

## Contexto e histórico
- [Visão do produto](vision.md): público, problema, proposta de valor e princípios.
- [Requisitos e limites](requirements.md): funções, não objetivos, critérios de aceitação.
- [Fluxo do usuário](product/user-flow.md): exemplo de edição de Reels de ponta a ponta.
- [UX criativa](product/creative-experience.md): prompt, presets, referências e overrides por trecho.
- [Auditoria premium](reviews/2026-10-18-premium-creative-audit.md): 21 achados, bloqueadores e novas exigências.
- [Arquitetura](architecture.md): componentes, dados, limites e alternativas.
- [Especificação Superpowers](superpowers/specs/2026-10-18-motion4free-design.md) e [adendo premium](superpowers/specs/2026-10-18-premium-personalization-amendment.md): propostas **para revisão**, não aprovação de implementação.
- [Roadmap](roadmap.md): fases, provas técnicas e critérios de passagem.

## Subsistemas
- [Motor de decisões de IA](ai/decision-engine.md)
- [Diretor criativo de IA](ai/creative-director.md): StyleDNA, storyboard, composição e revisão.
- [Roteador de modelos e custo zero](ai/routing-and-costs.md)
- [Avaliação, benchmarks e qualidade](ai/evaluation.md)
- [Motor no navegador](engine/browser-runtime.md)
- [Pipeline audiovisual](engine/media-pipeline.md)
- [Motion design e assets](motion/catalog-and-assets.md)
- [Composição procedural](motion/procedural-composition.md): scenes customizadas declarativas 2D/3D.

## Toolkit e onboarding de agentes
- [Setup e matriz do Vibe Coding Toolkit](setup.md): origem, revisão fixada, componentes e limites.
- [Onboarding](onboarding.md): como clonar o submódulo e navegar pela documentação.
- [Contrato de qualidade](quality.md): verificações disponíveis e futuras.
- [Definição de produto](../PRODUCT.md) · [Ponte Claude](../CLAUDE.md) · [Guia de design](design.md).

## Histórico e organização
- [Contexto consolidado da conversa](history/conversation-decisions.md)
- [Configurações GitHub e pendências administrativas](github-setup.md)
- [Issues e trabalho priorizado](https://github.com/murilaiooo/motion4free/issues)

## Governança e pesquisa
- [Repositórios de referência e licenças](research/repositories.md)
- [Pesquisa de engines criativas](research/creative-toolkit.md): Motion Canvas, PixiJS, Theatre, Three.js e outros.
- [Riscos e limitações](risks.md)
- [ADR-0001: browser-first](decisions/0001-browser-first.md)
- [ADR-0002: decisões IA local-first](decisions/0002-ai-local-first.md)
- [ADR-0003: biblioteca semântica](decisions/0003-semantic-motion.md)
- [ADR-0005: stack v1 e forma de decidir](decisions/0005-stack-v1.md)
- [ADR-0006: espelho do modelo de transcrição no próprio site](decisions/0006-espelho-do-modelo.md)
- [ADR-0007: editor da Fase 2 (histórico, projeto no OPFS, player, exportação em Worker)](decisions/0007-editor-projeto-local.md)
- [ADR-0008: StyleDNA paramétrico, cenas puras e seletor por regras (Fase 3)](decisions/0008-styledna-e-cenas.md)
- [ADR-0009: CreativeBrief, intérprete do pedido em camadas e IA opcional (Fase 4)](decisions/0009-pedido-e-ia.md)
- [ADR-0010: trechos, travas, revisão focal, versões e cores de referência (Fase 5)](decisions/0010-trechos-travas-versoes.md)
- [ADR-0011: IA como intérprete principal, look, emojis e ritmo de cortes (v0.6)](decisions/0011-ia-interprete-e-look.md)
- [ADR-0012: sistema de movimento — molas, curvas, câmera e legenda palavra a palavra (v0.7)](decisions/0012-sistema-de-movimento.md)
- [ADR-0013: legenda precisa — Whisper large-v3-turbo, escada de reserva, janelas com folga e WER (v0.8)](decisions/0013-legenda-precisa.md)
- [ADR-0014: registro de modelos e acabamento do quadro (v0.9)](decisions/0014-registro-de-modelos.md)
- [ADR-0015: novo visual — editor em tela cheia, design tokens e legendas em parágrafo (v0.10)](decisions/0015-novo-visual.md)
- [Licenças de recursos de terceiros incluídos no app (fontes, IA opcional)](licencas.md)
- [Contribuição](../CONTRIBUTING.md) · [Segurança](../SECURITY.md)

### Convenções
- **Confirmado**: observação apoiada por código/documentação citados; não valida performance no nosso produto.
- **Proposto**: solução de arquitetura ainda não implementada.
- **Hipótese**: depende de experimento comparativo.
- **Gate**: condição que precisa passar para avançar de fase.
- **Gate duplo:** export de vídeo no navegador **e** qualidade de direção artística personalizada; um MP4 válido não comprova qualidade premium.
- Preferir módulos independentes; nenhuma dependência de API paga; um projeto em um único repositório.


## Plano de fechamento dos 21 achados
- [Matriz de remediação, provas e gates F01–F21](reviews/2026-10-19-f01-f21-remediation-plan.md)

## Auditoria criativa premium (revisão de 18/10/2026)
- [Auditoria completa — 21 pontos](reviews/2026-10-18-premium-creative-audit.md)
- [Direção artística e IA criativa](creative/art-direction.md)
- [Presets, prompts e referências](creative/presets-and-prompts.md)
- [Composição e SceneGraph](creative/composition-engine.md)
- [ADR-0004 — diretor criativo, ainda proposta](decisions/0004-creative-director-proposal.md)

**Aviso:** a spec anterior foi complementada com adendo em revisão; os testes e o plano de implementação permanecem não autorizados/pendentes.

## Manuais técnicos dos repositórios upstream (pesquisa de 19/10/2026)
- [Manual de integração e mapa de fontes](research/upstream-implementation/INDEX.md)
- [Editor, áudio e exportação](research/upstream-implementation/01-media-and-editor.md)
- [Motion design e composição](research/upstream-implementation/02-motion-and-composition.md)
- [IA gratuita e avaliação](research/upstream-implementation/03-ai-and-evaluation.md)
- [Cache, distribuição, toolkit e licenças](research/upstream-implementation/04-distribution-and-tooling.md)
- [Matriz de 23 repositórios e gates](research/upstream-implementation/05-integration-matrix.md)

**Status:** instruções extraídas/adaptadas da fonte; bibliotecas não instaladas no runtime nem comprovadas por POC. Os manuais orientam os agentes antes de cada integração aprovada.


## Auditoria de recursos e licenças de release (24/10/2026)
- [Inventário por arquivo, licenças, SHA-256 e política de rejeição de novos assets](reviews/2026-10-24-runtime-license-audit.md) — issue #2.
- [Política de licenças, fontes, emoji e modelos externos](licencas.md).

## Verificação do OpenReel e decisão de timeline (24/10/2026)
- [Auditoria reproduzível de importação, split/undo/redo, legendas, exportação MP4 real e licenças](research/updates/2026-10-24-openreel-engine-evaluation.md) — issue #5.
- [ADR-0032: manter a timeline do Motion4Free, sem fork do OpenReel](decisions/0032-openreel-not-primary-timeline.md).

**Resultado:** OpenReel é editor funcional, mas substituir nosso motor não mostrou benefício que supere o risco de migrar planos e projetos. Nenhuma biblioteca de terceiros ou recurso externo foi integrado ao runtime nesta avaliação.

## Nova atualização de upstream: Editonny (19/10/2026)
- [Auditoria da atualização do Editonny — site Next.js, design system, prompts, testes e impacto no Motion4Free](research/updates/2026-10-19-editonny-guide.md)
- O **motor de edição não recebeu mudanças** no commit examinado; boas ideias estão no criador de briefs, nos tokens, na biblioteca e no QA web.

