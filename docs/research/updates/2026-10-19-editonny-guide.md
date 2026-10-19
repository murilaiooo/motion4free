# Atualização Editonny — auditoria de 19/10/2026

**Fonte:** [soumatheusgomes/editonny](https://github.com/soumatheusgomes/editonny) · [commit fixo `05d3dedcddcf`](https://github.com/soumatheusgomes/editonny/commit/05d3dedcddcf6717001b0a3ef91411ec08f614d4) · **upstream CI:** [Verify editonny — PASS](https://github.com/soumatheusgomes/editonny/actions/runs/39210390804) · **status Motion4Free:** pesquisa, **não houve atualização de dependência ou código de runtime**.

## Resposta curta

A atualização de 19 de outubro moderniza **o guia público e seu design system**, não o motor Python/HyperFrames responsável pelas edições. O commit altera ~300 arquivos: **181 em `design-system/`, 90 em `web/`, 8 em `tests/`, 5 em `docs/` e apenas 1 arquivo em `skills/`** (o launcher `skills/editonny/scripts/editonny.py`, para abrir a aplicação Next.js). Não há alteração neste commit nos `engine/helpers/*.py`, nas 145 cenas existentes nem no pipeline editorial audiovisual. O README ainda descreve **145 cenas e 54 pedidos exemplares**; não foram introduzidas 145 cenas novas.

### Antes vs agora
| Área | Antes (`8baae6e`) | Agora (`05d3ded`) | Consequência para Motion4Free |
|---|---|---|---|
| Guia web | HTML/CSS/JS estático, aberto localmente | Next.js 16.4, React 19.3, App Router, Next Intl | **Não migrar nosso hosting para Next.js/Vercel** por causa disso; extraia arquitetura/UX conforme stack |
| Linguagem | Interface/pedidos prioritariamente EN, README pt/es | Interface e briefs en-US/pt-BR/es | Implementar brief localizado com IDs internos estáveis |
| Design system | Estilo web específico | `DESIGN.md` + workspace `design-system/` com **38 componentes** e tokens/testes | Criar nosso design system original e verificável; evitar clone de identidade visual |
| Criador de pedidos | Prompts estáticos simples | `RequestDraft` tipado, formatos/ritmos/legendas/efeitos, exemplos e cenas | Adaptar para `CreativeBrief` com referências, presets, estilo e controles por trecho |
| Estado local | Sem mesmo contrato de estado | Validação de dados do browser, fallback em memória e sync entre abas | Reaproveitar técnicas no fluxo dos presets/projetos |
| Catálogo | Cenas e exemplos | Busca categorizada compartilhável por parâmetros URL | Inspiração para biblioteca de motion com filtros e previews |
| Qualidade da UI | Testes prévios | Vitest + Playwright + axe, dois temas, locais/mobile, guardrails de tokens | Ampliar nossos gates de QA da UI, não só de MP4 |
| Motor editorial | Python/Whisper/FFmpeg/HyperFrames | **Não atualizado neste commit** | Não esperar melhoria direta dos resultados de edição |

## O que aproveitar primeiro

### P0 — Builder de briefing com presets e prompt livre
- [`web/src/features/request/draft.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/request/draft.ts): `RequestDraft` com `agent,folder,goal,format,pace,captions,effects,sceneId`; defaults; `parseDraft` filtra tipos/IDs inválidos, `applyExample` personaliza sem sobrescrever tudo, `withScene` faz adaptação pontual.
- [`options.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/request/options.ts): enums/IDs estáveis e ratios 9:16, 16:9, 1:1, 4:5.
- [`prompt.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/request/prompt.ts) e [`phrases/pt-BR.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/request/phrases/pt-BR.ts): verbalização localizada do plano, preserve palavras do usuário e regras de não alterar significado/não gastar créditos sem autorização.
- [`BriefForm.tsx`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/create/BriefForm.tsx): controles guiados, teclado/radiogroup e campos acessíveis.

**Adaptação:** não usar o formato do Editonny como nosso limite. Nosso `CreativeBrief` precisa também de `referenceAssetIds, mood, targetAudience, antiStyle, creativeIntensity, styleDNA, perSceneOverrides, locks, brandProfile`, com conflito resolvido por precedência explícita. Preset é partida, prompt modifica estilo/objetos/ritmo, não apenas cor ou escolha de `sceneId`.

**Teste:** (a) mesmo vídeo e 3 briefs -> arte distinta; (b) prompt altera preset parcialmente; (c) sem localStorage continua funcional; (d) parâmetros inválidos não invocam ferramentas ou código indevido.

### P0 — Design system com contrato e guardrails automáticos
- [`DESIGN.md`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/DESIGN.md) como fonte normativa de paleta, tipografia, espaçamento, componentes e movimento.
- [`design-system/README.md`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/README.md): componentes agrupados em core, forms, content, feedback, editor, motion e site; 38 espécimes em `/design-system`. Regras de import/lint impõem tokens.
- [`tests/design-system.test.mjs`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/tests/design-system.test.mjs): compara token CSS vs DESIGN.md, componentes exportados vs specimens, consistência dos temas.
- [`design-system/tokens/motion.css`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/tokens/motion.css): easing/duração/keyframes/reduced-motion.

**Adaptação:** usar conceito `MOTION4FREE_DESIGN.md` ou contrato equivalente e tokens tipográficos/easing rigorosos, com personalidade **própria** e UI premium; UI de app distinta da composição do vídeo (usuário define StyleDNA por vídeo). Não copiar imagens/marcas/logo/estética Editonny como identidade do nosso produto.

**Teste:** tokens alinhados com componentes + snapshots/responsividade + a11y dark/light + perf em dispositivo médio; evitar estilos genéricos de IA.

### P1 — Componentes de editor como referência de UX, não engine de vídeo
- [`components/editor/Timeline.tsx`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/components/editor/Timeline.tsx): segmentos marcados por beat, `playhead`, seek com teclado e marcas de revisão, **mas waveform usa barras ilustrativas geradas**.
- [`components/editor/KineticCaption.tsx`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/components/editor/KineticCaption.tsx): efeito de destaque karaoke com base em palavras por segundo **constantes**, não timestamps transcritos.
- [`components/motion/KineticText.tsx`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/components/motion/KineticText.tsx): rotação de palavras via intervalo, não timecode.
- [`components/motion/Counter.tsx`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/components/motion/Counter.tsx): contador usa `requestAnimationFrame`/`performance.now()` e visibilidade no viewport.
- [`components/feedback/ProgressRing.tsx`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/components/feedback/ProgressRing.tsx): indicador com valor 0–1, aria e label.

**Regra crucial:** não colocar esses componentes tal como estão na engine de export. O Motion4Free precisa de animação como **função pura de tempo `frame(t)`**, ligada a `word.start/end`, easing e semântica, para seek e export reproduzível. Reaproveitar estética/UX/tokens e portar técnicas autorizadas; timeline real requer waveform real e scroll/zoom/layers/locks.

### P1 — Persistência e biblioteca navegável
- [`web/src/features/preferences/store.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/preferences/store.ts): `createStore` valida conteúdo não confiável de `localStorage`, usa fallback memória quando quota/permissão falha, sincroniza evento `storage` entre abas.
- [`web/src/features/library/useLibraryState.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/library/useLibraryState.ts): filtros `q,category,scene/example` na URL, debounce, Back fecha item, IDs inválidos rejeitados.
- [`web/src/features/examples/records.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/examples/records.ts): catálogo de exemplos/IDs com copy em JSON por idioma.

**Adaptação:** construir `PresetBrowser` e `AssetBrowser` com busca por semântica, categoria, estilo, licença, duração e restrições de voz/rosto. URL compartilhável de **presets públicos** pode ser útil, mas **nunca inserir transcrição, caminhos locais, arquivos pessoais ou tokens em URL**. Projeto/mídia em OPFS/IndexedDB; localStorage apenas para preferências leves.

### P1 — Verificação de UX profissional e internacionalização
- [`web/e2e/quality.spec.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/e2e/quality.spec.ts): verifica dark/light em 15 rotas, erros de console, 1 h1, overflow horizontal, a11y axe WCAG 2.x A/AA, reduced motion e showcase com 38 componentes.
- [`web/e2e/locale.spec.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/e2e/locale.spec.ts): Accept-Language, cookie, localidades e links.
- [CI `verify.yml`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/.github/workflows/verify.yml): lint, TS, tests, build Next e Playwright Chromium + traces em falha.

**Adaptação:** a11y, mobile responsive, screenreader, reduced-motion e compatibilidade de idioma são essenciais para interface do editor e brief. Porém `prefers-reduced-motion` da UI não deve modificar silenciosamente o vídeo exportado que o usuário pediu. Acrescentar testes de canvas/codec, frame parity, privacidade, armazenamento e retrabalho de IA.

## O que NÃO devemos importar como solução “mágica”
1. **Site guia Next.js/Vercel**: não atende ao requisito por si só de edição 100% browser e custo 0. O site ainda só **constrói pedidos e mostra cenas**; não recebe ou exporta mídia dos visitantes.
2. **Animações React UI por wall clock**: boas para landing/editor, inadequadas sem adaptação para export frame exato.
3. **145 cenas existentes**: não foram ampliadas neste commit e um catálogo fixo não garante originalidade.
4. **38 componentes**: não equivalem a 38 novas animações de vídeo.
5. **Testes do site**: CI verde é sobre qualidade do guia, não prova objetiva de vídeo profissional gerado.
6. **Assets e design**: MIT do código não elimina atribuição/licença separada de fontes, imagens, vídeos, músicas e dados.

## Priorização de incorporação
| Item | Valor | Esforço aproximado | Etapa |
|---|---|---|---|
| Tipo de brief + prompt localizado + presets editáveis | Muito alto | Médio | Spec/POC criativo |
| Design tokens + enforce com linter/testes | Alto | Médio | Fundação UX |
| Library browser filtrável por semântica e estilo | Alto | Médio | MVP creative |
| Controle de histórico/marks/timeline acessível | Médio/alto | Médio/alto | Editor |
| Progresso de render e fallback de storage | Alto | Baixo/médio | Editor/export |
| Efeitos cinéticos de UI (port temporal) | Médio | Médio | Premium motion tests |
| Next.js 16 + infraestrutura Vercel | Baixo/negativo para objetivo atual | Alto | **Não adotar só por upstream** |

## Recomendações para decisões Motion4Free
- Inserir no manual de [upstreams](../upstream-implementation/01-media-and-editor.md) e [UX de presets](../../creative/presets-and-prompts.md) como fonte de padrões concretos.
- Planejar design system do **produto** separado de StyleDNA de **cada vídeo**.
- Aplicar `frame(t)` e assets por hash com render local; não sacrificar direção artística por repetir componentes prontos.
- Comparar UI/editor OpenReel com componentes Editonny: incorporar o que falta, não manter duas timelines concorrentes.
- Adotar melhores práticas de testes e documentação sem instalar Next no MVP browser-first sem prova de necessidade.


## Decisões complementares de integração (conferência do código-fonte)

Este quadro complementa as seções P0/P1 acima, sem criar outro catálogo ou uma segunda timeline. Fonte fixada: `05d3dedcddcf6717001b0a3ef91411ec08f614d4`. **Estado: critérios propostos; nenhuma adaptação foi executada no Motion4Free.**

| Comportamento confirmado no código upstream | Decisão específica do Motion4Free | Prova exigida |
|---|---|---|
| `request/draft.ts` valida cada campo e limita strings a 4.000 caracteres; `options.ts` usa IDs estáveis e quatro proporções | Manter IDs independentes do idioma e um schema versionado, com validação por campo e por referência efetivamente registrada. O limite de tamanho será escolhido por teste, não copiado cegamente | Corrupção/versão desconhecida/ID inexistente não causam execução nem perda de escolhas válidas |
| `withScene()` troca `effects: none` por `subtle` automaticamente | **Não reproduzir**: uma proibição explícita de efeitos prevalece sobre seleção de cena; explicar conflito e oferecer opção, jamais reativar efeito silenciosamente | Selecionar cena após “sem efeitos” preserva a proibição e solicita decisão explícita antes de compor |
| `prompt.ts` gera instrução textual localizada com `$editonny` ou `/editonny` | Não expor sintaxe de Codex/Claude como dependência do produto web. Compilar o briefing para `CreativeBrief`/`EditPlan` estruturados; texto de UI não é operação executável | Mesmo briefing em pt-BR/en-US/es gera os mesmos IDs e constraints sem mudar a transcrição fornecida |
| `BriefForm.tsx` usa radiogroups navegáveis por teclado e seleção acessível | Adotar controles acessíveis, presets editáveis e overrides, não a aparência ou o formulário inteiro do upstream | Navegar, editar e revisar o briefing sem mouse, com leitura compreensível por tecnologias assistivas |
| `preferences/store.ts` usa fallback em memória se `localStorage` falhar e sincroniza abas | Fallback temporário deve indicar **não salvo**; preferências leves em storage simples, projetos/mídia em OPFS/IndexedDB com recuperação e export do projeto | Storage bloqueado/corrompido/quota cheia, conflito entre abas e reabertura têm tratamento explícito |
| `library/useLibraryState.ts` usa URL para `q`, categoria e IDs públicos; Back fecha detalhe | Presets e cenas públicas podem usar links compartilháveis; nunca incluir prompts privados, transcrições, paths locais, hashes sensíveis, tokens ou dados de mídia em query string | URLs compartilhadas e histórico do browser permanecem sem informações privadas |
| `Waveform.tsx` sintetiza barras com seno; `Timeline.tsx` usa essas barras para a demo | Calcular waveform real do áudio decodificado, alinhar cortes/playhead às amostras e timebase do projeto; estudar UX upstream, não adotar esses dados como medição | Waveform acompanha fonte real e permanece alinhada após trim, seek, zoom e export |
| `KineticCaption.tsx` avança por `wps`; `KineticText` e `Counter` usam relógio/intervalo/RAF de UI | Renderizar motion de vídeo por `renderAt(frame/time)` e timestamps reais; UI pode ter animações decorativas separadas | Frame solicitado fora de ordem é determinístico; legenda destaca palavra correta com seek/export |
| `web/e2e/quality.spec.ts` audita duas cores, 15 rotas e acessibilidade, mas exclui legendas ilustrativas da análise axe | Adaptar suíte web quando a stack existir **e acrescentar** auditoria de legenda final, contraste sobre footage, safe areas e legibilidade quadro a quadro | QA de UI e QA do vídeo são independentes; não usar exclusão de demo para encobrir problemas da saída final |
| `design-system/README.md`, `DESIGN.md` e `tests/design-system.test.mjs` vinculam tokens, API de componentes e showcase | Um único design system **do aplicativo** com lint/testes; `StyleDNA` **dos vídeos** continua independente e variável por briefing | Alterar um token quebra teste de contrato se CSS/showcase não acompanharem |
| `verify.yml` executa check/build e browser Playwright; upstream CI foi bem-sucedido | Planejar pipeline equivalente **após selecionar stack**, mais provas de áudio, mídia, memória, licenças e render; não copiar comandos Next.js prematuramente | CI local do Motion4Free apresenta artefatos próprios; CI verde do Editonny não é evidência de vídeo aqui |

A localização atual cobre en-US, pt-BR e es. São línguas iniciais de interface a considerar, **não** limite de idiomas aceitos na fala ou na transcrição. As animações da UI respeitam `prefers-reduced-motion`; isso não pode modificar silenciosamente a exportação solicitada.

### Destinos canônicos, sem duplicação
- Modelo e precedência dos briefs: [presets e prompts](../../creative/presets-and-prompts.md).
- Design system do aplicativo: [guia de design](../../design.md).
- Testes/CI e QA separados: [contrato de qualidade](../../quality.md) e [requisitos](../../requirements.md).
- Ordem de prova/implantação: [roadmap](../../roadmap.md).
- Manual do Editonny original e da atualização: [editor e áudio](../upstream-implementation/01-media-and-editor.md).
- Matriz geral dos 23 projetos: [integração upstream](../upstream-implementation/05-integration-matrix.md).


**Limite desta auditoria:** análise estática do commit e módulos citados, sem executar Next.js, navegador ou render de vídeo. O [CI upstream passou](https://github.com/soumatheusgomes/editonny/actions/runs/39210390804), mas nossos testes de integração ainda não foram executados.

[Índice de integrações](../upstream-implementation/INDEX.md) · [Roadmap](../../roadmap.md) · [Auditoria premium](../../reviews/2026-10-18-premium-creative-audit.md).
