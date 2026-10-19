# Auditoria arquitetural: personalização e nível profissional

**Data:** 2026-10-18 · **Estado:** revisão crítica independente, recomendações **não aprovadas** e nenhuma funcionalidade implementada.
**Escopo:** README, spec Superpowers, requisitos, arquitetura, fluxo Reels, IA, motion, runtime, custos, QA, roadmap, riscos, organização e backlog existentes até esta revisão.
**Nova condição explícita do responsável:** resultado com julgamento visual próximo ao de motion designer experiente; sem aparência repetitiva, genérica ou “feito por IA”; personalização em cada vídeo; interface por **prompt e presets**; **IA de direção criativa no processamento em background**; aproveitamento criterioso de projetos open source; sem custo obrigatório nem instalação ao usuário.

## Veredito
**NÃO APROVAR a especificação atual para implementação do produto final.** Ela é boa fundação de infraestrutura e segurança, mas especifica principalmente um seletor de cenas de um catálogo. Isso **não satisfaz** a nova exigência de peças autorais e identidade visual própria de cada edição. Recomendação: preservar o POC browser, inserir uma prova de direção artística (não somente prova de MP4), revisar contratos criativos/presets/render e só depois aprovar a spec e writing-plans.

## Achados prioritários

| ID | Gravidade | Evidência no repo | Lacuna | Correção proposta / gate |
|---|---|---|---|---|
| F01 | **Bloqueador** | `docs/ai/decision-engine.md`, spec §módulos: IA escolhe entre 3–5 cenas; `none` | Catálogo fixo gera vídeos semelhantes; “personalizado” equivale somente a escolher/cor de template | **Creative Director + Scene Composer**: composição paramétrica/procedural de tipografia, gráficos, formas, objetos, camera, materiais, luz e animação por cena; cena nova declarativa segura, não JS arbitrário |
| F02 | **Bloqueador** | `docs/requirements.md` exige “uma cena”, formato Reels e export | Critério de sucesso só comprova execução técnica, não direção de arte ou diferenciação | Gate criativo com benchmark humano **antes** do MVP ser qualificado como profissional |
| F03 | **Alto** | `docs/product/user-flow.md` descreve apenas prompt | Falta interface de **presets editáveis**, seleção de opções e fusão com texto livre | Um `CreativeBrief` comum a prompt, presets, referências e ajustes |
| F04 | **Alto** | `docs/architecture.md`: scene ID + frase | Falta projeto de arte unificado, storyboard, look development, shot graph, variações e escolhas de ritmo | `CreativeBrief -> StyleDNA -> Storyboard -> SceneGraph -> EditPlan -> Render` com versões e evidências |
| F05 | **Alto** | `docs/ai/decision-engine.md`: microdecisões sem arte global | Decisões isoladas produzem inconsistência de paleta, tipografia e movimentos | Diretor IA faz uma **passagem global de direção artística** e depois planos locais compatíveis |
| F06 | **Alto** | `docs/motion/catalog-and-assets.md`: templates e assets prontos | Sem procedimentos para criação original, transformação e diversificação inteligente | Gramática visual, scene factory, shader/2D/3D, motion primitives, variações controladas e curadoria humana |
| F07 | **Alto** | `docs/ai/evaluation.md`: QA criativa geral | Não mede repetição, originalidade contextual, aderência a referência, força de hierarquia, tipografia e motion nuance | Rubrica humana dedicada, casos vizinhos, diversidade visual, penalidade de repetição e limites de inferência estatística |
| F08 | **Alto** | `docs/ai/routing-and-costs.md`: fallback e microtarefas | Faltam limites concretos de **iterar preview + autocrítica + reparo**, com avaliação multimodal | Loop de revisão por orçamento e sinais visuais reais, no browser quando possível; jamais prometer percepção estética automática perfeita |
| F09 | **Alto** | `docs/research/repositories.md` prioriza editor/browser, quase não traz motion authoring | Bases fortes de composição, animação vector/GPU e keyframes ficaram de fora | Provar Motion Canvas, Theatre Core, PixiJS, Three.js, dotLottie, Motion, OpenTimelineIO com licença/integração |
| F10 | **Alto** | `docs/vision.md` diz IA “somente para” seleções | Contradiz IA criativa contínua que o usuário quer | IA opcional por disponibilidade mas **ativa como diretora** nos dispositivos/provedores elegíveis, não mero seletor |
| F11 | **Alto** | `docs/roadmap.md`: motion premium só na fase 5 | Deixa problema diferenciador para depois de MVP funcional genérico | POC dual: export **e** composição criativa diferenciada, depois UX/polimento |
| F12 | **Médio/Alto** | Assets Editonny e bancos listados sem pipeline de descoberta | Não há processo de associar asset externo, footage fornecida, procedência e estilo | Asset resolver com índice, licenças/atribuições, cache, fallback, metadados e consentimento; sem scraping indevido |
| F13 | **Alto** | Privacidade/custo local-first estabelecidos | “IA sempre no background” e “100% grátis a todos” conflitam em aparelhos fracos, cotas e tempo de export | Degradação explícita por perfil de capacidade; custo por projeto e roteamento; usuário entende qualidade variável, sem pagar infraestrutura |
| F14 | **Médio** | `docs/requirements.md` prevê revisões por chat | Falta edição precisa por seleção no vídeo e controles de estilo (intensidade, ritmo, identidade) | Presets + overrides por cena/trecho; explicar consequências antes de aplicar; undo/redo |
| F15 | **Médio** | `docs/motion/catalog-and-assets.md` menciona revisão de design | Não define ferramenta/processo de autoria de cenas aprovadas nem revisão de arte | Ferramenta interna de preview/render por frame, portfólio de exemplos e aprovação editorial |
| F16 | **Médio** | `docs/risks.md` tem R18 qualidade geral | Falta risco específico de convergência estética, presets repetitivos, “AI slop” | Riscos/benchmarks de diversidade, design systems flexíveis, coerência e falha de asset |
| F17 | **Médio** | GitHub tinha 12 issues abertas + 12 issues fechadas de escopo sobreposto | Histórico pouco claro: issues fechadas mantêm checklists vazias; parece entrega concluída sem prova | Registrar motivo de fechamento como duplicata, evitar backlog paralelo e ligar dependências; **não reabrir sem decisão** |
| F18 | **Médio** | `docs/github-setup.md` declara limitações da conexão | Topics, settings, regras de merge/proteção e licença própria não foram aprovados/aplicados | Seguir checklist; não afirmar “GitHub inteiramente configurado” |
| F19 | **Médio** | `docs/requirements.md` pouco trata B-roll/contexto fora de fala | Edição profissional exige escolha de imagens de apoio, visuais explicativos, áudio, grade e narrativa | Plano contextual de B-roll/infografia/asset com proveniência, sem criar provas falsas |
| F20 | **Médio** | Biblioteca em formato vertical focada em fala | Falta controlar referências de estilo do usuário e adaptação por segmento | ReferenceBoard: upload de referências, extração de propriedades visuais, comparação e preservação de intenção |
| F21 | **Médio** | Não existe código do produto | Não há demonstração de compatibilidade/nível de arte/zero custo | Tratar todas as afirmações de capacidade e superioridade como **hipóteses** |

## O que está se encaixando (preservar)
- Sem instalação obrigatória; media/render no navegador; storage e carregamento progressivo (boa estratégia a provar).
- Editor não destrutivo com transcrição, waveform, safe-area, export e regras para não alterar significado.
- IA em dados declarativos e validados, nunca shell/JS executável da transcrição.
- Budget e fallback para APIs grátis; minimização de upload, controle de credenciais.
- QA de arquivo exportado, test suite, Superpowers e comparações cegas.
- OpenReel, Editonny e Mediabunny como candidatos (não componentes adotados).

## Alternativas comparadas
**A. Catálogo fechado + IA escolhe opção.** Melhor previsibilidade/custo, mas alta repetição e teto de personalização. NÃO atende o requisito sozinho.
**B. IA gera código/novos vídeos livremente.** Alta flexibilidade aparente; risco de execução, estética errática, regressão, latência e custo. NÃO serve como caminho padrão.
**C. RECOMENDADO: biblioteca + gramática de composição + direção artística IA + render determinístico.** Presets são pontos de partida; cada projeto recebe DNA visual, storyboards e cenas compostas com combinações/modificações de elementos aprovados, e revisão audiovisual. **É proposta, ainda não validada.**

## Contratos novos sugeridos
- **CreativeBrief:** texto do usuário, preset inicial, público-alvo, intenção, tom, plataformas, formato, ritmo, densidade de motion, preferências positivas/negativas, proibições, referência visual e prioridade de originalidade. Campos de usuário têm precedência sobre preset.
- **StyleDNA:** família visual, direção de arte, paleta, fontes autorizadas, grid/layout, composição 2D/3D, linguagem de materiais, easing/movimentos, ritmo de cena, mix/SFX, regras de continuidade e exceções expressivas.
- **Storyboard:** beats narrativos, função e duração de cada cena, recursos necessários, transição e justificativa vinculada a fala/visual.
- **SceneGraph:** grafo seguro versionado de nós aprovados: text, vector, chart, 3d, image, video, crop, mask, light, shader, caption, particle, transition, audio; parâmetros e keyframes por frame/tempo. Sem código arbitrário.
- **AssetManifest:** hash, origem, licença, formato, direitos, variações, estado cache e substitutos.
- **CreativeReview:** scores observáveis de legibilidade, safe zones, sync, diversidade, coerência, aderência a referência; opinião estética marcada como subjetiva com limitação de confiança.

## Personalização que o usuário deve realmente perceber
Dois usuários com mesmo tema, estilos e referências diferentes devem receber **composições visualmente e ritmicamente diferentes**, não apenas recoloração/zoom. Um mesmo usuário deve obter identidade consistente sem repetir cegamente cena e transição. Deve existir controle editorial fino, estilo livre e `avoid_styles`; presets funcionam como atalhos que o usuário modifica por prompt.

Não há como garantir originalidade absoluta ou o julgamento de uma pessoa experiente em todos os vídeos apenas com modelos gratuitos. Definir `100% personalizado` como aderência a brief, escolhas, referências e contexto individual em toda a timeline, **não** como garantia de nunca reutilizar um primitivo ou parecer diferente em todos os pixels.

## Duas provas obrigatórias ANTES de declarar MVP viável
**Prova 1 — vídeo:** MP4 exportado local, vídeo+voz+legendas+cortes+motion, sem servidor.
**Prova 2 — arte:** três vídeos/referências diferentes, mesmo tema, três briefings/presets distintos: layouts, hierarquias, animações, assets e ritmo distintos, coerentes, inspecionados por motion designers em avaliação cega. Avaliar fallback gratuito/offline. Usar vídeos de teste com direitos.

## Rubrica criativa sugerida (0–5 por eixo; avaliação humana)
1. Direção de arte, hierarquia e consistência visual.
2. Tipografia, legibilidade e relação com cena.
3. Timing, easing, continuidade e musicalidade do movimento.
4. Significado visual (animação esclarece, não distrai).
5. Escolha/qualidade de assets, enquadramento e composição.
6. Narrativa e gancho honesto.
7. Originalidade relativa e ausência de clichês/repetição.
8. Fidelidade ao prompt/preset/referências e capacidade de revisão.
9. Qualidade de áudio, cortes e transições.
10. Preferência geral versus edição de referência humana/Editonny.

Medir confiabilidade interavaliadores, testar diversidade entre vídeos com o mesmo conteúdo, e analisar **falhas piores** separadamente da média.

## Decisão de projeto
Esta auditoria é **parecer técnico**, não aprovação da nova arquitetura. **Superpowers: manter spec atual em revisão**, produzir adendo de direção criativa e obter aprovação antes de writing-plans/código. Abrir novas issues para cada lacuna crítica sem fechar tarefas que já existem.

## Referências novas
- Motion Canvas (MIT): https://github.com/motion-canvas/motion-canvas — linguagem de animação e timeline programática. O exportador FFmpeg documentado **não é prova de export browser-only**.
- Theatre.js: https://github.com/theatre-js/theatre — core Apache-2.0, studio AGPL-3.0, avaliar limites de integração do editor.
- PixiJS (MIT): https://github.com/pixijs/pixijs — 2D WebGL/WebGPU, filtros/composição.
- React Three Fiber/Three.js: https://github.com/pmndrs/react-three-fiber — 3D declarativo.
- dotLottie Web (MIT): https://github.com/LottieFiles/dotlottie-web — reprodução vetorial WASM/state machines; não gera a arte por si.
- Motion (MIT): https://github.com/motiondivision/motion — timings/transições e animações JS.
- OpenTimelineIO (Apache-2.0): https://github.com/AcademySoftwareFoundation/OpenTimelineIO — padrões de modelagem/intercâmbio de timeline, não motor navegador.
- tldraw: https://tldraw.dev/community/license — source available, **não gratuito irrestrito em produção**, não recomendar como dependência para custo zero sem licença adequada.
- Glaxnimate (GPL-3.0+): https://github.com/mbasaglia/glaxnimate — estudar exemplos de motion autoral; atenção a licença e integração.

## Próximas ações
1. Incorporar os requisitos de criatividade/presets/IA de direção no design draft, como **proposta aguardando revisão**.
2. Comparar interoperabilidade/suporte a seek/exports das bibliotecas em experimentos isolados.
3. Definir e documentar dataset de arte e referências autorizadas.
4. Implementar prova dual browser-export + customização de arte (após gates Superpowers).
5. Somente depois disso expandir catálogo e provedores.
