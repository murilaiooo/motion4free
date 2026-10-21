# Motion4Free

**Editor de Reels com motion design personalizado que roda no navegador, sem instalação e sem custo.**
A versão atual é a v0.15.1, com importação de até 30 clipes, edição manual, presets, pedidos por texto e exportação de MP4 no navegador. O deploy é automático na Cloudflare; a versão pública e os checks do commit podem ser confirmados no GitHub Actions.

> **Visão:** transforme uma gravação sua falando em um Reels bem editado, por linguagem natural ou estilos prontos, preservando a voz, o significado e a privacidade. A IA atua como diretora que escolhe e ajusta um sistema de motion design curado; o motor compõe, valida e renderiza localmente sem executar código vindo do modelo.

## Como funciona
1. A pessoa abre o site no Chrome ou Edge e escolhe um vídeo. O vídeo **não sai do computador**.
2. Escreve o que quer e/ou escolhe um estilo pronto.
3. O site transcreve, corta silêncios sem comer palavras, escolhe o gancho, cria legendas e anima no estilo pedido.
4. A pessoa revisa, ajusta e baixa o MP4 9:16.

Sem GPU ou sem IA disponível, o site continua cortando, legendando, animando por regras e exportando, e avisa que a direção criativa automática ficou limitada.

**Não prometemos vídeo viral, qualidade profissional universal nem IA ilimitada.** Cada afirmação de qualidade depende de teste com vídeos reais e avaliação de pessoas.

## Estado do projeto

| Parte | Estado |
|---|---|
| Visão, requisitos, riscos e pesquisa | Documentados |
| [Spec v1 consolidada](docs/superpowers/specs/2026-10-20-motion4free-v1-design.md) | **Aprovada** (20/10/2026) |
| [Stack (ADR-0005)](docs/decisions/0005-stack-v1.md) | **Decidida**: TypeScript, Vite, React, Mediabunny, Transformers.js |
| [Plano mestre](docs/superpowers/plans/2026-10-20-plano-mestre.md) | Pronto, 6 fases com gates |
| [Plano detalhado da Fase 1](docs/superpowers/plans/2026-10-20-fase1-primeiro-mp4.md) | Fase inicial implementada; evolução no [CHANGELOG](docs/CHANGELOG.md) |
| Site publicado | [Versão de produção](https://motion4free.murdokmurilo1.workers.dev), verificar atualização após merge e build da Cloudflare |
| Avaliação de qualidade criativa | Pendente de comparação com vídeos reais por pessoas; testes técnicos de MP4 não substituem esse gate |

## Como o trabalho acontece
O agente decide a parte técnica, implementa com testes e abre um PR por entrega. Cada PR ganha um link de prévia e um **roteiro de teste**; o responsável pelo produto testa com vídeos reais e dá feedback. Detalhes no [plano mestre](docs/superpowers/plans/2026-10-20-plano-mestre.md).

## Documentação
- **Decisão e execução:** [spec v1](docs/superpowers/specs/2026-10-20-motion4free-v1-design.md) · [plano mestre](docs/superpowers/plans/2026-10-20-plano-mestre.md) · [Fase 1](docs/superpowers/plans/2026-10-20-fase1-primeiro-mp4.md) · [ADRs](docs/decisions/)
- **Contexto:** [índice completo](docs/INDEX.md) · [visão](docs/vision.md) · [requisitos](docs/requirements.md) · [riscos](docs/risks.md) · [arquitetura (histórico)](docs/architecture.md)
- **Pesquisa:** [auditoria premium F01–F21](docs/reviews/2026-10-18-premium-creative-audit.md) · [manuais dos repositórios upstream](docs/research/upstream-implementation/INDEX.md) · [atualização do Editonny](docs/research/updates/2026-10-19-editonny-guide.md)
- **Acompanhamento:** [histórico de versões](docs/CHANGELOG.md) · [catálogo de erros](docs/erros.md)
- **Colaboração:** [AGENTS.md](AGENTS.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

## Referências principais

| Repositório | Uso no Motion4Free |
|---|---|
| [Editonny](https://github.com/soumatheusgomes/editonny) | Regras editoriais, cenas e QA como referência |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) | Leitura e escrita de vídeo com WebCodecs (dependência) |
| [Transformers.js](https://github.com/huggingface/transformers.js) | Transcrição Whisper no navegador (dependência) |
| [OpenReel](https://github.com/Augani/openreel-video) | Referência de timeline e exportação web |
| [WebLLM](https://github.com/mlc-ai/web-llm) | IA local candidata na Fase 4 |
| [Vice City WASM](https://github.com/joncodeofficial/gta-vice-city-wasm) e [GTA5 Web](https://github.com/hammadshakeelai/gta5-web) | Padrões de cache e carregamento progressivo |

Lista completa e ressalvas de licença em [repositórios de referência](docs/research/repositories.md).

## Custo e privacidade
Custo zero é uma restrição de projeto: nada de API ou servidor pago, nada de contornar limites de serviços gratuitos. Vídeos e transcrições ficam no dispositivo por padrão. IA externa, quando existir, só com a chave da própria pessoa e consentimento claro, e nunca recebe o vídeo. A mídia original nunca é alterada.

## Rodar localmente (desenvolvimento)
Requer Node 22.
```bash
npm install
npm run dev                     # abre em http://localhost:5173
npm test                        # testes de unidade
npm run fixture && npm run e2e  # teste de ponta a ponta (precisa de ffmpeg)
```

## Toolkit de agentes
O [Vibe Coding Toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit) está como submódulo em `tooling/vibe-coding-toolkit` (prompts e processos, não é o motor). Para clonar com ele: `git clone --recurse-submodules https://github.com/murilaiooo/motion4free.git`.

## Licença
Código do Motion4Free sob [MIT](LICENSE). Bibliotecas, modelos, fontes e assets de terceiros mantêm as próprias licenças (por exemplo, Mediabunny é MPL-2.0).

---

*Motion4Free: a criatividade na direção, a precisão no motor, o processamento no navegador.*
