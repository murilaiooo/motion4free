# Matriz de cobertura e execução — repositórios do Motion4Free

**Data:** 2026-10-19. **Status do produto:** sem editor implementado. Os manuais [01](01-media-and-editor.md), [02](02-motion-and-composition.md), [03](03-ai-and-evaluation.md) e [04](04-distribution-and-tooling.md) foram escritos a partir de código/README/docs upstream, com links de entrada. **Não é uma afirmação de que todas as APIs/arquivos de cada repo foram examinados; são os pontos de implementação relevantes ao nosso escopo atual.**

## Legenda
- **Fonte examinada:** README, guia, skill ou arquivo-fonte conferido via GitHub.
- **Implementação:** nenhuma — ainda aguardando spec/plan aprovados.
- **Referência:** técnica aproveitável sem instalar repo.
- **Spike obrigatório:** hipótese a testar com vídeo/render real e licenças.
- **Candidato:** não é dependência selecionada.

## Repositórios principais: 23 integrações ou referências analisadas

| # | Repositório / papel | Entradas verificadas e método útil | Destino previsto | Decisão atual |
|---|---|---|---|---|
| 01 | [Editonny](https://github.com/soumatheusgomes/editonny) | `skills/editonny/SKILL.md`, `engine/WORKFLOW.md`, `tighten_cut.py`, `suggest_visuals.py`, `visuals/README.md`; edição factual, EDL, cenas, QA | editorial + motion | Estudar/portar seletivamente, respeitar assets |
| 02 | [OpenReel](https://github.com/Augani/openreel-video) | `docs/ai-editing.md`, `AGENT-GUIDE.md`, `composition-renderer.ts`, `export-engine.ts`, `webcodecs-backend.ts`, serializer/capabilities | editor + history + renderer | **Spike P0**, aproveitar antes de reconstruir |
| 03 | [Mediabunny](https://github.com/Vanilagy/mediabunny) | `docs/guide/writing-media-files.md`, `supported-formats-and-codecs.md`, `README.md` | decoder/encoder/mux | **Spike P0**, atenção MPL-2.0 |
| 04 | [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | `apps/website/docs/getting-started/usage.md` | conversão/fallback | Opcional lazy, requer teste RAM |
| 05 | [Auto-Editor](https://github.com/WyattBlue/auto-editor) | `skills/auto-editor/SKILL.md`: classificação e margem de corte | heurísticas de limpeza | Referência para port de algoritmos |
| 06 | [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) | `docs/tutorials/quickstart.md`: ranges, tracks e adapters | interoperabilidade | Referência, não runtime |
| 07 | [PixiJS](https://github.com/pixijs/pixijs) | `skills/pixijs-application/SKILL.md`, `pixijs-performance/SKILL.md`, assets manifest | compositor 2D | **Spike P0**, comparar com OpenReel |
| 08 | [Motion Canvas](https://github.com/motion-canvas/motion-canvas) | `README.md`: core, generators, 2D, player, editor | motion procedural | **Spike P0**, export web não confirmado |
| 09 | [Theatre.js](https://github.com/theatre-js/theatre) | `packages/core/README.md`, `LICENSE`: core vs editor Studio | keyframes/timing | Candidato, separar licença core/studio |
| 10 | [Three.js](https://github.com/mrdoob/three.js) | `README.md`: cena, câmera, renderer WebGL/WebGPU | render 3D | Candidato condicionado a estilo/performance |
| 11 | [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | `docs/getting-started/installation.mdx`: React/renderer version pairing | 3D declarativo | Candidato só se stack React for selecionada |
| 12 | [Motion](https://github.com/motiondivision/motion) | `README.md`: core MIT vs ofertas extras premium | CSS/JS easing/keyframes | Candidato |
| 13 | [dotLottie Web](https://github.com/LottieFiles/dotlottie-web) | `packages/web/README.md`: WASM preload, Worker URL, CSP | render de Lottie/licenciado | Opcional, não substitui compositor |
| 14 | [Transformers.js](https://github.com/huggingface/transformers.js) | `README.md`: `pipeline`, WebGPU, dtype/quantização | transcrição, embeddings e visão | **Spike P0**, pesos/licenças separados |
| 15 | [WebLLM](https://github.com/mlc-ai/web-llm) | `docs/user/basic_usage.rst`, `examples/get-started-web-worker/README.md` | LLM local | Candidato condicionado a GPU/VRAM |
| 16 | [Semantic Router](https://github.com/aurelio-labs/semantic-router) | `docs/get-started/quickstart.md`, calibração | roteamento semântico | **Portar ideias TS**, lib Python não obrigatória |
| 17 | [TypeChat](https://github.com/microsoft/TypeChat) | `README.md`: schema TS, validação, reparo | schema de operações | Reutilizar/padronizar ideias |
| 18 | [Outlines](https://github.com/dottxt-ai/outlines) | `README.md`: geração tipada/constrangida em Python | modelos locais/QA offline | Referência; não instalar no browser |
| 19 | [DSPy](https://github.com/stanfordnlp/dspy) | `README.md`, first-program, MIPROv2 docs | otimização offline | Ferramenta de desenvolvimento, não produto |
| 20 | [Promptfoo](https://github.com/promptfoo/promptfoo) | `README.md`, templates `promptfooconfig` | avaliação/regressão offline | Ferramenta de desenvolvimento |
| 21 | [GTA5-Web](https://github.com/hammadshakeelai/gta5-web) | `hosting/chunk-fetch.js`, build file | chunks/Range/cache RAM | **Só padrões de infraestrutura**, não engine/assets |
| 22 | [Vice City WASM](https://github.com/joncodeofficial/gta-vice-city-wasm) | `public/sw.js`, `src/main.js` | OPFS/SW/cache | **Só padrões de infraestrutura**, sem assets do jogo |
| 23 | [Vibe Coding Toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit) | `docs/prompts/12-existing-project-setup.md`, docs de Superpowers | agentes e QA | **Submódulo versionado já incluído**, não runtime |

## Referências complementares / não selecionadas
- **GSAP:** usado nas cenas Editonny; avaliar APIs de timeline e licença por distribuição e plugin antes de adicionar.
- **OpenVideo:** [licença própria](https://github.com/openvideodev/react-video-editor/blob/main/LICENSE) com limites de distribuição/licenciamento; **não confundir source available com open source permissivo**. Estudar conceito de UX/browser encode, sem vendorização automática.
- **Revideo** e outros renderizadores comerciais/open core: não há instruções de integração confirmadas nesta rodada; somente estudar quando houver decisão concreta.
- **Assets de bancos terceiros, Freesound, 3dicons, fontes e modelos:** auditá-los arquivo a arquivo na fase de catálogo; não assumir a licença de um pacote por estar no README de outro.
- **GSAP plugins premium / Motion+ / Theatre Studio:** licenças especiais; evitar incluir sem autorização aplicável.

## Etapas de integração aprováveis separadamente

### Lote A — motor audiovisual
**Inputs:** vídeo de usuário, cortes e captions. **Candidatos:** OpenReel + Mediabunny; fallback FFmpeg.wasm só se necessário. **Prova:** MP4 correto, sync, persistência e memória.

### Lote B — motor criativo
**Inputs:** uma mesma gravação + 3 `CreativeBrief` opostos. **Candidatos:** renderer próprio OpenReel vs PixiJS; Motion Canvas/Three/Theatre opcionais. **Prova:** três composições realmente distintas, seek determinístico e export consistente.

### Lote C — análise e IA
**Inputs:** mídia/transcrição + prompts/presets. **Fontes:** Editonny heurísticas, Transformers.js, WebLLM, Semantic Router/TypeChat/Outlines. **Prova:** direção de arte coerente, decisões seguras, poucas chamadas, suporte a fallback.

### Lote D — qualidade
**Inputs:** edições reais + exemplos de referência licenciados. **Fontes:** DSPy, Promptfoo, QA audiovisual. **Prova:** avaliação cega profissional, métricas técnicas e falhas adversariais.

### Lote E — produção
**Inputs:** modelos/assets autorizados + projetos locais. **Fontes:** técnicas de GTA5/VC, OPFS, Cache API, Service Worker e toolkit. **Prova:** cache/offline, backup, segurança, licenças e operação dentro de quotas grátis verificadas.

## Stop conditions
Interromper dependência específica e propor alternativa quando:
- Não permite operação browser sem servidor ou helper para funcionalidade obrigatória;
- Força gasto recorrente/conta paga ou depende de API sem quota estável;
- Licença de código/asset não permite nossa distribuição pretendida;
- Produz render diferente da prévia, arte ruim ou “AI slop” nos vídeos de teste;
- Compromete confidencialidade do vídeo ou executa prompt/transcrição como código;
- Consome memória que inviabiliza o hardware-alvo e não possui fallback honesto.

## O que ainda falta verificar para dizer “instruções completas e aplicadas”
- Ler APIs específicas e testes dos módulos **na revisão congelada que for selecionada**, não só guias atuais.
- Fazer diff/experimento de integração real de OpenReel+SceneGraph e de saída MP4.
- Escolher stack e mecanismo temporal único; codecs e formatos suportados.
- Audit legal de cada dependência/transitive dependency/model weight/asset.
- Documentar números de desempenho, UX, qualidade e zero custo real.
- Após aprovação escrita da spec com Superpowers, gerar plano detalhado de implementação e executar POCs antes de escolher todos os módulos.

**Não estão concluídos:** instalação de engines no Motion4Free, escolhas definitivas de licenças e qualquer avaliação comparativa com motion designers profissionais. O que está concluído é o **levantamento operacional inicial de instruções para os 23 upstreams centrais**.

[Índice](INDEX.md) · [Checklist de auditoria F01–F21](../../reviews/2026-10-19-f01-f21-remediation-plan.md).

## Delta Editonny 19/10/2026, sem criar um 24º upstream

A linha **01 Editonny** inclui agora duas fontes diferentes no mesmo projeto: (a) engine editorial e catálogo já inventariados; (b) **nova UI localizada, builder tipado, design system, biblioteca e testes do guia** no commit [`05d3ded`](https://github.com/soumatheusgomes/editonny/commit/05d3dedcddcf6717001b0a3ef91411ec08f614d4). Não contar componentes React como efeitos exportáveis.

| Subconjunto da revisão | Destino canônico | Estado |
|---|---|---|
| `request/draft.ts`, `options.ts`, `prompt.ts`, `BriefForm.tsx` | [presets + brief validado](../../creative/presets-and-prompts.md) | Design proposto; port pendente |
| `DESIGN.md` e `design-system/` | [design system da UI](../../design.md) | Padrões estudados; sem stack aprovada |
| `preferences/store.ts`, `library/useLibraryState.ts` | [auditoria e salvamento/URL](../updates/2026-10-19-editonny-guide.md) | Estratégia identificada; teste pendente |
| `editor/Timeline.tsx`, `Waveform.tsx`, `KineticCaption.tsx` | [guia audiovisual](01-media-and-editor.md) | UX de referência; **não** engine de render |
| `quality.spec.ts`, `locale.spec.ts`, `verify.yml` | [matriz de testes](../../quality.md) | Critérios documentados; CI de produto pendente |

**Não foram instaladas novas dependências.** OpenReel/Mediabunny continuam candidatos aos mecanismos de timeline/codec; o guia Editonny não substitui provas de seek, render, áudio ou qualidade artística.
