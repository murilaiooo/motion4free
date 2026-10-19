# motion4free

**Motion design profissional com IA gratuita. Um editor de vídeo que roda no navegador, sem instalação obrigatória.**

> **Estado do projeto: concepção e pesquisa.** Ainda não existe um editor funcional, demo pública ou prova de edição gratuita ilimitada. Este repositório organiza a visão, arquitetura, tecnologias candidatas, riscos e plano de validação.

## A ideia

Motion4Free pretende transformar um vídeo gravado em uma edição profissional, mediante um pedido simples, por exemplo:

> “Edite esse vídeo para Reels do Instagram, com um gancho forte nos primeiros 3 segundos, motion design sincronizado com o que estou falando, transições modernas e cortes de respiração.”

O produto deve analisar mídia localmente, entender a fala, propor narrativa e cenas relevantes, proteger o significado do discurso, montar uma timeline revisável e exportar um MP4 no próprio navegador.

### Nossa tese
**Não precisamos de uma IA cara para fazer tudo. Precisamos de um editor que já saiba editar.** Regras profissionais, modelos locais especializados, biblioteca premium de assets e animações paramétricas resolvem a maior parte do trabalho. Modelos gratuitos decidem entre candidatos pré-filtrados, com validação, fallback e benchmark.

## Princípios
- **Custo obrigatório zero para usuário e mantenedor é a meta**, mas infraestrutura gratuita tem limites; vamos medir antes de prometer escala.
- **Browser-first / local-first:** sem instalar helper; CPU/GPU, OPFS, WebAssembly/WebCodecs/WebGPU, cache e lazy downloads quando possível.
- **Qualidade acima de quantidade:** hook que preserva contexto, movimento ligado à semântica e cenas aprovadas por design.
- **Modelos gratuitos úteis, não mágicos:** seleção curta, few-shot, regras, embeddings, schema restrito, verificadores e escalonamento seletivo.
- **Privacidade:** mídia não sai do dispositivo por padrão; envio externo só quando informado e autorizado.
- **Transparência:** nenhum compromisso de viralidade, edição perfeita em todo hardware ou IA ilimitada sem testes.

## Navegação principal

| Tema | Documento |
|---|---|
| Mapa completo | [Índice](docs/INDEX.md) |
| Visão, usuários e valor | [Visão](docs/vision.md) |
| Requisitos, limites e aceitação | [Requisitos](docs/requirements.md) |
| Exemplo concreto: Reels | [Fluxo de edição](docs/product/user-flow.md) |
| Desenho do sistema | [Arquitetura](docs/architecture.md) |
| Superpowers (rascunho para revisão) | [Design spec](docs/superpowers/specs/2026-10-18-motion4free-design.md) |
| IA com precisão e poucos tokens | [Motor de decisões](docs/ai/decision-engine.md) |
| APIs gratuitas e cotas | [Roteamento e custos](docs/ai/routing-and-costs.md) |
| Provar qualidade | [Benchmarks e QA](docs/ai/evaluation.md) |
| WebAssembly/WebGPU, cache | [Runtime browser](docs/engine/browser-runtime.md) |
| Corte, legenda, som e MP4 | [Pipeline de vídeo](docs/engine/media-pipeline.md) |
| Motion design e recursos | [Catálogo e licenças](docs/motion/catalog-and-assets.md) |
| Código externo investigado | [Repositórios de referência](docs/research/repositories.md) |
| Execução fase a fase | [Roadmap](docs/roadmap.md) |
| Riscos e trade-offs | [Riscos](docs/risks.md) |
| Contexto da conversa | [Registro de decisões](docs/history/conversation-decisions.md) |
| Configurações GitHub | [Setup e pendências](docs/github-setup.md) |

As decisões estão registradas em [ADRs](docs/decisions/0001-browser-first.md), [IA local-first](docs/decisions/0002-ai-local-first.md) e [motion semântico](docs/decisions/0003-semantic-motion.md).

## Como vamos trabalhar

1. Revisar a [especificação inicial](docs/superpowers/specs/2026-10-18-motion4free-design.md).
2. Seguir o processo Superpowers: **spec aprovada -> plano do POC -> implementação -> testes -> revisão**.
3. Provar primeiro um vídeo real importado e exportado em MP4 no navegador (corte, legenda e 1 animação).
4. Só depois ampliar timeline, catálogo, roteador de IAs e testes editoriais cegos.
5. Centralizar tudo neste repositório; preservar originais e dados privados.

## Tecnologias pesquisadas (não integradas)

[Editonny](https://github.com/soumatheusgomes/editonny) · [OpenReel](https://github.com/Augani/openreel-video) · [Mediabunny](https://github.com/Vanilagy/mediabunny) · [Transformers.js](https://github.com/huggingface/transformers.js) · [WebLLM](https://github.com/mlc-ai/web-llm) · [DSPy](https://github.com/stanfordnlp/dspy) · [Promptfoo](https://github.com/promptfoo/promptfoo). Para comparações e caveats, ler [pesquisa](docs/research/repositories.md).

## Contribuição e segurança

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md). O repositório está privado na data de organização. A licença do Motion4Free **ainda não foi definida**; não assumir que o conteúdo foi liberado como open source.

---

**Estado atual:** documentação de fundação e planejamento; código do produto, infraestrutura pública, assets redistribuídos e testes de exportação ainda não implementados.
