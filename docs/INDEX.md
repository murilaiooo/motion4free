# Índice da documentação

> **Estado:** documentação inicial consolidada em 18/10/2026. Motion4Free é um projeto em fase de concepção; nenhuma implementação de editor, benchmark ou custo zero em escala está comprovada.

## Comece aqui
- [Visão do produto](vision.md): público, problema, proposta de valor e princípios.
- [Requisitos e limites](requirements.md): funções, não objetivos, critérios de aceitação.
- [Fluxo do usuário](product/user-flow.md): exemplo de edição de Reels de ponta a ponta.
- [Arquitetura](architecture.md): componentes, dados, limites e alternativas.
- [Especificação Superpowers](superpowers/specs/2026-10-18-motion4free-design.md): desenho proposto **para revisão**, não aprovação de implementação.
- [Roadmap](roadmap.md): fases, provas técnicas e critérios de passagem.

## Subsistemas
- [Motor de decisões de IA](ai/decision-engine.md)
- [Roteador de modelos e custo zero](ai/routing-and-costs.md)
- [Avaliação, benchmarks e qualidade](ai/evaluation.md)
- [Motor no navegador](engine/browser-runtime.md)
- [Pipeline audiovisual](engine/media-pipeline.md)
- [Motion design e assets](motion/catalog-and-assets.md)

## Governança e pesquisa
- [Repositórios de referência e licenças](research/repositories.md)
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
- Preferir módulos independentes; nenhuma dependência de API paga; um projeto em um único repositório.
