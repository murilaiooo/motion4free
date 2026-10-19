# Motion4Free

**Estúdio inteligente de edição e motion design personalizado, browser-first e com custo monetário zero como objetivo.**  
Projeto em fase de concepção e arquitetura. Ainda não existe versão funcional para edição de vídeos.

> **Visão:** transforme uma gravação em um Reels profissional por linguagem natural, preservando a voz, o significado e a privacidade. IA funciona como diretora criativa ao longo do processo, construindo narrativa e direção de arte individual; nosso motor compõe, valida e renderiza localmente sem executar código livre do modelo.

## A ideia

O usuário abre o site, carrega um vídeo, escreve “edite para Instagram Reels, crie um gancho nos três primeiros segundos, sincronize motion design com a minha fala, aplique transições modernas e remova respirações desnecessárias” e recebe uma **primeira edição revisável**, com timeline, legendas, prévia e exportação MP4.

A experiência-alvo é **sem instalação obrigatória**, com downloads progressivos e cache no próprio navegador, inspirado nas técnicas WebAssembly/OPFS/Service Worker usadas em ports de jogos. O processamento e a renderização devem rodar no dispositivo do usuário sempre que o hardware permitir.

**Não prometemos vídeo viral, qualidade profissional universal, nem IA ilimitada.** A equivalência a um motion designer experiente é um **gate de avaliação artística** a demonstrar, não uma característica já comprovada. Esses são objetivos sujeitos a demonstrações reais, avaliação humana e limites de hardware/API.

## O diferencial

**Requisito de produto em revisão:** o usuário poderá usar **prompt de texto, presets personalizáveis ou ambos**, com identidade visual própria por vídeo. Uma edição tecnicamente correta mas genérica, repetitiva ou sem qualidade artística **não atende** à definição de pronto. Veja a [auditoria de qualidade premium](docs/reviews/2026-10-18-premium-creative-audit.md).

Em vez de pedir que um modelo de IA execute tudo:

1. **Código determinístico** cuida de transcrição temporal, análise de áudio, cortes e proteção da fala, enquadramento, legendas, render e checks técnicos.
2. **Motor de motion design autoral** combina uma biblioteca curada com composição procedural 2D/3D, tipografia cinética, keyframes, máscaras, áudio e assets licenciados. O mesmo template não deve virar aparência padrão de todos os vídeos.
3. **IA local ou gratuita como diretora criativa** interpreta prompt, presets e referências, define uma identidade visual (StyleDNA), planeja storyboard e composições por cena, e revisa resultados sob orçamento. Modelos não executam código arbitrário.
4. **Validações independentes** checam comandos, significados, números, negações, sincronização e qualidade da exportação.
5. **Fallback offline/local** mantém edição básica útil quando APIs gratuitas estiverem sem cota.

## Estado do projeto

| Parte | Estado |
|---|---|
| Visão, requisitos e riscos | Documentados |
| Arquitetura browser-first e decisões de IA | Propostas e documentadas |
| Pesquisa de Editonny, OpenReel e ports WASM | Inventariada |
| Especificação Superpowers | **Rascunho para revisão** |
| Prova de conceito de render MP4 no navegador | **Não iniciada** |
| Editor/timeline e site implantado | **Não implementados** |
| Avaliação cega de qualidade versus referências | **Não executada** |
| Gratuidade em escala | **Não validada** |

## Documentação central

- [Índice completo](docs/INDEX.md) e [visão do produto](docs/vision.md)
- [Especificação de arquitetura Superpowers](docs/superpowers/specs/2026-10-18-motion4free-design.md) e [adendo de personalização premium](docs/superpowers/specs/2026-10-18-premium-personalization-amendment.md)
- [Requisitos e testes de aceitação](docs/requirements.md) · [Roadmap e gates](docs/roadmap.md)
- [Arquitetura de componentes](docs/architecture.md) · [Fluxo Reels end-to-end](docs/product/user-flow.md)
- [Motor de decisões por IA](docs/ai/decision-engine.md) · [Roteamento de cotas e custo zero](docs/ai/routing-and-costs.md) · [Benchmark de qualidade](docs/ai/evaluation.md)
- [Processamento no navegador](docs/engine/browser-runtime.md) · [Pipeline audiovisual](docs/engine/media-pipeline.md)
- [Motion design e proveniência dos assets](docs/motion/catalog-and-assets.md) · [Composição procedural](docs/motion/procedural-composition.md)
- [UX por prompt e presets](docs/product/creative-experience.md) · [Diretor criativo de IA](docs/ai/creative-director.md)
- [Auditoria arquitetural premium](docs/reviews/2026-10-18-premium-creative-audit.md) · [Pesquisa de ferramentas criativas](docs/research/creative-toolkit.md)
- [Repositórios e fontes técnicas](docs/research/repositories.md) · [Riscos](docs/risks.md)
- Decisões (propostas): [browser-first](docs/decisions/0001-browser-first.md), [IA local-first](docs/decisions/0002-ai-local-first.md), [motion semântico](docs/decisions/0003-semantic-motion.md)

## Referências principais

| Repositório | Inspiração |
|---|---|
| [Editonny](https://github.com/soumatheusgomes/editonny) | Skill editorial, transcrição/cortes, cenas HTML/GSAP, catálogo e QA |
| [OpenReel](https://github.com/Augani/openreel-video) | Timeline, armazenamento e exportação web |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) | Media I/O com WebCodecs em TypeScript |
| [Vice City WASM](https://github.com/joncodeofficial/gta-vice-city-wasm) | Cache persistente OPFS e Service Worker |
| [GTA5 Web](https://github.com/hammadshakeelai/gta5-web) | Manifests, chunked assets e HTTP Range |
| [DSPy](https://github.com/stanfordnlp/dspy) e [Promptfoo](https://github.com/promptfoo/promptfoo) | Otimização e benchmarks de decisões |
| [Transformers.js](https://github.com/huggingface/transformers.js) e [WebLLM](https://github.com/mlc-ai/web-llm) | IA local no navegador |

Veja a [lista completa](docs/research/repositories.md), incluindo ressalvas técnicas e de licenciamento.

## Roadmap resumido

1. **Fundação:** revisão da especificação e governança do repositório.
2. **Prova audiovisual:** importar vídeo, cortar, legendar, animar, renderizar e exportar MP4 no navegador.
3. **Prova de decisões:** análise semântica local, seleção de ganchos, motion contextual e validação.
4. **MVP de Reels:** interface editável, IA gratuita opcional, fallback e revisões conversacionais.
5. **Qualidade beta:** testes com vídeos reais, provas de direção artística diferenciada, licenças, privacidade e benchmarks cegos.
6. **Distribuição:** hosting estático, medições de uso/custo/banda e compatibilidade.

O objetivo é trabalhar por **provas técnicas**. Não adicionar dezenas de APIs ou centenas de animações antes de validar o primeiro MP4 e sua qualidade.

## Custo e privacidade

O preço para o usuário e a operação sem custo são **restrições de projeto**, não uma promessa de escalabilidade já validada. Hosting estático, quotas de APIs, transferência de modelos e capacidade dos dispositivos terão de ser medidos. Não colocaremos chaves secretas no navegador público nem contornaremos termos de serviços gratuitos com múltiplas contas.

Originais devem permanecer no dispositivo do usuário por padrão. APIs externas só poderão receber dados com informação clara e consentimento apropriado. A mídia original nunca deve ser alterada.

## Plano de resolução dos 21 achados

A [matriz de remediação F01–F21](docs/reviews/2026-10-19-f01-f21-remediation-plan.md) define **como fechar cada ponto com evidência**, distinguindo documentação de testes reais. O objetivo é 100% de cobertura auditável, não alegar qualidade humana perfeita sem provas.

## Toolkit de desenvolvimento com agentes
O [Vibe Coding Toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit) foi adicionado como **submódulo Git** em `tooling/vibe-coding-toolkit`, fixado na revisão `790a895`. Ele fornece instruções para Claude/Codex, ferramentas, prompts e verificações, **não** o motor de edição.

Para obter o toolkit ao clonar:

```bash
git clone --recurse-submodules https://github.com/murilaiooo/motion4free.git
```

Em um clone existente: `git submodule update --init --recursive`. Consulte [setup e matriz de integração](docs/setup.md), [onboarding](docs/onboarding.md), [qualidade](docs/quality.md) e [PRODUCT.md](PRODUCT.md). Nenhum CLI global, framework, chave ou serviço pago foi instalado automaticamente.

## Colaboração e próximos passos

Leia [AGENTS.md](AGENTS.md) se for trabalhar com agentes, [CONTRIBUTING.md](CONTRIBUTING.md) para contribuir e [SECURITY.md](SECURITY.md) para privacidade. A especificação está **aguardando revisão** antes do plano de implementação do Superpowers.

**Licença do Motion4Free:** ainda não escolhida. Código, modelos e assets externos mantêm suas respectivas condições; a licença MIT do Editonny não substitui uma auditoria de recursos.

---

*Motion4Free: a criatividade na direção, a precisão no motor, o processamento no navegador.*

## Revisão de qualidade premium — em avaliação
A [auditoria arquitetural e criativa](docs/reviews/2026-10-18-premium-creative-audit.md) encontrou lacunas críticas: somente escolher templates não basta para gerar edições realmente personalizadas. A proposta atual acrescenta **AI Creative Director**, **Creative Composer/SceneGraph**, **presets editáveis + prompt livre** e uma prova de originalidade/qualidade **antes** de considerar o produto profissional.
- [Direção de arte assistida por IA](docs/creative/art-direction.md)
- [Presets, prompts e referências](docs/creative/presets-and-prompts.md)
- [Compositor de cenas e tecnologias](docs/creative/composition-engine.md)
- [ADR-0004 — proposta não aprovada](docs/decisions/0004-creative-director-proposal.md)

**Status:** mudança arquitetural em revisão Superpowers; não há implementação e não há promessa de qualidade superior sem benchmark.

## Guias técnicos extraídos dos repositórios

Antes de implementar, consulte o [Manual técnico de integração upstream](docs/research/upstream-implementation/INDEX.md). Ele organiza instruções de **23 projetos centrais** por subsistema, indica as entradas reais da documentação/código, as adaptações ao Motion4Free e os gates de teste e licença. Veja também a [matriz de cobertura](docs/research/upstream-implementation/05-integration-matrix.md). As bibliotecas listadas **não estão instaladas no editor**, que ainda não foi implementado.

