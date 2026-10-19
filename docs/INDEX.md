# Índice da documentação

> **Estado:** documentação inicial consolidada em 18/10/2026. Motion4Free é um projeto em fase de concepção; nenhuma implementação de editor, benchmark ou custo zero em escala está comprovada.

## Comece aqui
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
- [Contribuição](../CONTRIBUTING.md) · [Segurança](../SECURITY.md)

### Convenções
- **Confirmado**: observação apoiada por código/documentação citados; não valida performance no nosso produto.
- **Proposto**: solução de arquitetura ainda não implementada.
- **Hipótese**: depende de experimento comparativo.
- **Gate**: condição que precisa passar para avançar de fase.
- **Gate duplo:** export de vídeo no navegador **e** qualidade de direção artística personalizada; um MP4 válido não comprova qualidade premium.
- Preferir módulos independentes; nenhuma dependência de API paga; um projeto em um único repositório.


## Auditoria criativa premium (revisão de 18/10/2026)
- [Auditoria completa — 21 pontos](reviews/2026-10-18-premium-creative-audit.md)
- [Direção artística e IA criativa](creative/art-direction.md)
- [Presets, prompts e referências](creative/presets-and-prompts.md)
- [Composição e SceneGraph](creative/composition-engine.md)
- [ADR-0004 — diretor criativo, ainda proposta](decisions/0004-creative-director-proposal.md)

**Aviso:** a spec anterior foi complementada com adendo em revisão; os testes e o plano de implementação permanecem não autorizados/pendentes.
