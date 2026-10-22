# Hypit → Motion4Free: auditoria técnica e plano de aproveitamento (21/10/2026)

**Referência:** [hypit-ai/hypit](https://github.com/hypit-ai/hypit)  
**Snapshot da árvore upstream:** `0d36de9a9d17562fca0e478969b80eb1c16a7693` (branch main no levantamento).  
**Motion4Free:** main examinada em 21/10/2026, árvore `84e13c644cbf556021ccf76b89feeb93d2d8c7e3`, app v0.27.5.  
**Natureza desta entrega:** avaliação de arquitetura, código e pontos de integração; uma fundação original em `semantic-cues.ts`, isolada do fluxo de exportação. **Não é uma integração completa do Hypit.**

## 1. Método e abrangência

- Árvore Git recursiva upstream enumerada integralmente, sem truncamento: **2.079 entradas, 1.704 arquivos, 375 diretórios, 86 packages de primeiro nível, 214 arquivos de teste TS/JS identificados por sufixo, 117 assets de imagem/áudio/vídeo reconhecidos por extensão**. Diretórios e arquivos não são tratados como se todos tivessem sido lidos individualmente.
- Árvore Git recursiva Motion4Free: 543 entradas, 494 arquivos, 49 diretórios. A pesquisa consultou `AGENTS.md`, regras de arquitetura, ADR-0023, plano do produto, matrizes de pesquisa, módulos existentes de áudio, edição, seleção de momentos, timeline, legendas, render e testes.
- Leitura aprofundada das fontes estruturais e exemplos referenciados nas seções abaixo, incluindo implementação de alignment, projeção temporal, schedule de legendas e core de execução. **Não foram executados os binários Hypit nem o runtime Motion4Free neste levantamento.**
- Não tratar contagem da árvore como prova de qualidade, funcionamento ou cobertura dos 214 testes.

## 2. O que o Hypit realmente é

Hypit é uma cadeia de **autoria declarativa + compilação + grafo de operações + execução + composição audiovisual**, voltada a agentes que criam um vídeo ou adaptam o formato de uma referência. É diferente de um simples editor com presets e diferente de uma ferramenta especializada em encontrar os melhores cortes de um podcast longo.

Fluxo conceitual observado:

```text
Brief / vídeo de referência + agente
   → Sources SVML (composição) + SVS (recipes) + SVRUN (alvos)
   → Compiler / Module Closure / Author Graph
   → BuildPlan de operações e dependências
   → Producers determinísticos e Needs externas via Providers
   → Timeline absoluta + projeções narrativas + tracks audiovisuais
   → Render HTML/Chromium e mixagem/exportação
   → Results + Studio (inspeção e edição do projeto)
```

**São responsabilidades distintas:** agent interpreta a intenção; Source registra o que deve acontecer; Run seleciona saídas; Runtime/Endpoint escolhe como atender necessidades; Studio edita declarações; composição associa tracks de áudio e vídeo explicitamente. Uma falha de um provedor não autoriza transferir automaticamente o trabalho para outra conta paga.

### Inventário arquitetural principal (86 packages)

| Família | Exemplos de packages | Responsabilidade comprovada |
| --- | --- | --- |
| Autoria/compilação | `author`, `source`, `markup`, `recipe`, `compiler`, `loader`, `workspace` | fontes estruturadas, resolução e validação de módulos |
| Grafo/execução | `protocol`, `kernel`, `executor`, `producer`, `admission`, `run`, `result`, `runtime-local` | dependências, execução, builds e outputs |
| Relógio/semântica | `timeline`, `temporal`, `narrative`, `narrative-temporal`, `narrative-speech-alignment`, `speech-evidence` | tempo absoluto, tokens e alinhamento da fala |
| Visual | `composition`, `spatial`, `film`, `visual-track`, `text-fine`, `caption-fine`, `ranking`, `comment-sticker`, `depth-stack` | cenas, layouts, tipografia, eventos e pintura |
| Áudio/vídeo | `audio-track`, `media`, `media-local`, `media-operations`, `html-program`, `html-video`, `browser-capture` | entrada, faixas, captura e encoding |
| Geração | `generation`, `endpoint`, `provider-*`, `seedance`, `gpt-image`, `whisperx` | modelos, providers, credenciais, material gerado |
| Experiência | `studio`, `studio-companion`, `cli` | inspeção, autoria e comandos |

O Hypit v0.3.1 é um monorepo pnpm/TypeScript com Node >=22.15 e execução que pode usar ferramentas de mídia locais, Chromium headless e serviços opcionais de modelos. **Não é uma biblioteca drop-in para execução apenas em uma página web.**

## 3. Achados no código, testáveis e aproveitáveis como conceitos

### A. Tempo semântico projetado no tempo absoluto

Fontes: [timing](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/quickstart/timing.md), [temporal/projection.ts](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/temporal/src/projection.ts), [narrative-temporal/projection.ts](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/narrative-temporal/src/projection.ts).

Uma `Timeline` contém duração/taxa de quadros, mas não carrega texto. `TemporalInstant` e `TemporalWindow` representam, respectivamente, uma borda e um intervalo **semiaberto [start,end)** com identidade e limites validados. Um `NarrativeAlignment` mapeia fronteiras semânticas em um domínio local, e uma projeção explícita revela os frames absolutos para consumidores visuais e sonoros. Assim, deslocar um trecho não obriga a inventar novos timestamps de cada efeito.

**Para nós:** criar uma camada original de `wordId → ocorrências em segmentos editados → janela de frames`, sem trocar o `EditPlan` v6 nem a timeline existente. Cenas futuras podem aceitar um ID de evento semântico, preservando a edição manual do usuário.

### B. Alinhamento de fala robusto não é o mesmo que transcrição

Fontes: [README do speech alignment](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/narrative-speech-alignment/README.md), [align.ts](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/narrative-speech-alignment/src/align.ts).

O código alinha um script conhecido a evidência acústica em grupos monotônicos M:N: palavra igual, substituição, junção/divisão e omissões. Considera normalização de texto, confiabilidade, diferenças de fronteira e intervalos ausentes; devolve tempos quantizados em frames. A implementação não é WhisperX, não gera fala e não trata uma resposta de LLM como verdade temporal.

**Para nós:** manter Whisper/ASR já existente; acrescentar futuramente alinhamento leve apenas quando o usuário corrigir as palavras da legenda, regravar narração ou gerar variantes faladas. Priorizar casos PT-BR (contrações, pontuação e erros de ASR), testes adversariais de drift e fallback para temporização original. **Não portar o align.ts por causa da licença.**

### C. Legenda: documento, timing, estilo e visibilidade separados

Fontes: [caption-fine](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/caption-fine/README.md), [schedule.ts](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/caption-fine/src/schedule.ts), [render.ts](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/caption-fine/src/render.ts).

Uma cue mantém os tempos reais das unidades; lead/tail ampliam somente a janela visível. Handoff entre cues, priorização de estilos, unidade ativa, contorno de texto, caixa e animações têm responsabilidades próprias. Um overlay ligado a rosto usa **evidência espacial explícita**. Sem medição no frame, não supõe que o rosto está lá.

**Para nós:** separar melhor a temporização da apresentação visual; expor no editor controles de lead/tail, animar por palavra sem alterar o transcript, impedir duas legendas em conflito, usar coordenadas seguras (reels) e detecção de rosto local quando disponível. Já existe `src/editorial/captions.ts` e `src/render/captions.ts`: ampliar, não duplicar.

### D. Componentes de cena, não uma lista rígida de presets

Fontes: [component anatomy](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/guide/component-anatomy.md), [ranking](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/ranking/README.md), [composition](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/quickstart/composition.md).

Cada componente pode declarar entradas, manifest, geometria, schedule, desenho, estilos e propriedades editáveis. Gráficos por ranking, reaction cards, subtítulos, popups e B-roll são Tracks explícitos. A ordem de pintura vem de z-index resolvido, não da ordem acidental de importação.

**Para nós:** criar um catálogo original de primitivas combináveis: scorecard animado, contador, ranking, citações, destaque de palavra, comentário, imagem inserida e split-screen. Usuário deve poder mover/editar cada camada; o modelo só seleciona tipos e parâmetros validados. Não executar JavaScript ou importar packages arbitrários sugeridos por IA.

### E. Execução, Results, seleção de provedores e reutilização

Fontes: [compiler](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/compiler/README.md), [kernel plan.ts](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/kernel/src/plan.ts), [runtime](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/guide/runtime.md), [providers](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/guide/providers.md).

Planos com dependências, resultados identificáveis e configurações explícitas permitem repetir saídas, reutilizar material que não mudou e dar diagnóstico específico sobre operações bloqueadas. Modelo (pedido) é separado do provider (forma de execução). Credencial é referência de runtime, não parte da composição.

**Para nós:** não portar o kernel; fortalecer nosso gerenciador de jobs browser-first, hash de conteúdo/versão do plano, cache por etapa, invalidação seletiva e recuperação de falha. Na UI, explicar quais tarefas são locais, quais usam API pessoal, qual provedor/modelo atende a cada uma e se existe custo ou quota. Não prometer grátis quando for cota paga BYOK.

### F. Studio, preview e export

Fontes: [Studio README](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/studio/README.md), [browser capture](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/browser-capture/src/browser.ts), [editing windows](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/guide/studio-temporal-windows.md).

Studio mostra Source, Tasks e Artifacts e permite editar a **declaração de origem** da propriedade, em vez de aplicar compensações opacas ao desenho. Capture usa browser headless selecionado por versão exata no host, que **não cabe diretamente no navegador do visitante**.

**Para nós:** preservar a paridade entre preview e export via `src/render/frame.ts` e Mediabunny, testes de seek/frame e editor visual já existentes; adicionar edição de âncoras semânticas, status de export por clipe, inspeção de evidências, reuso de resultados. Não instalar Puppeteer/Node/Chromium no browser.

## 4. Matriz de compatibilidade com a main do Motion4Free

| Recurso do Hypit | O que Motion4Free já possui | Lacuna real | Ação |
| --- | --- | --- | --- |
| Word timing / time projection | `Word.id`, `captions.wordStarts`, `placeSpan`, segmentos duplicáveis | Eventos de motion não têm vínculo persistente por wordId | **P0:** POC `semantic-cues.ts` |
| Captions animadas | `editorial/captions`, `render/captions`, customização de estilo | separar lead/tail e motion por cue, resolver overlap | P1, sobre render atual |
| Scenes combináveis | `SceneInstance` fechadas + presets/StyleDNA | cenas parametrizáveis com vínculos e layering reutilizável | P1, evoluir schema com migração |
| Remixes/100 variantes | receitas de nicho, looks, mudanças por trecho | variantes de projeto e reuso granular | P1, cache e controles explícitos |
| Build graph e Results | pipeline, progress e cache de análise de clipes | cache por dependência, reexecução parcial, resume forte | P1, sem dependência Hypit |
| Providers | BYOK e registro de modelos | UX guided, budgets por provedor/capacidade | Aproveitar issue #73 |
| Viral long-form selection | heurísticas + opcional IA para reordenar candidatos | história completa, payoff e verificação contextual | Aproveitar issue #102 (SupoClip) |
| Face-aware placement | framing inteligente e edição de legenda | evidência de posição por frame, ausências/safe zones | P2 após benchmark |
| Headless Chromium render | Mediabunny e WebCodecs no navegador | qualidade/seek/paridade, não engine Node | **Não integrar** |
| Face swap e geração externa | não é objetivo do núcleo local | direitos de imagem, dependência de API/recursos | Fora do MVP |

**Nota:** o Hypit oferece um formato de produção/recriação, **não prova um algoritmo próprio de seleção dos melhores minutos de um podcast**. A issue #102 cobre esse problema editorial separado.

## 5. Licença, custo e segurança: pontos bloqueantes

Arquivo verificado: [LICENSE](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/LICENSE). A licença se identifica como Apache 2.0 modificada, mas acrescenta condições para serviço multi-tenant, oferta comercial/redistribuição de derivados e preservação de marcas/avisos em determinadas superfícies. **Não é Apache-2.0 pura, nem se deve presumir compatibilidade com distribuição MIT do Motion4Free.**

Decisão de engenharia nesta entrega:
1. **Proibido** copiar código, assets, arquivos SVML/SVS ou bibliotecas próprias de Hypit para `src/`, `public/` ou `package.json` sem autorização/licenciamento específico.
2. **Permitido como trabalho original:** estudar contratos arquiteturais e desenvolver módulos independentes, sem importação nem trechos reproduzidos do Hypit.
3. Manter credits/URLs de pesquisa, separar documentação de código vendorizado e registrar a origem conceitual.
4. Se algum dia for proposta execução do binário Hypit, exigir avaliação jurídica/licença e POC isolado, explícito, opt-in. **Não adicionar dependência automaticamente.**

Outros bloqueios: Chromium/Puppeteer e serviços Python/WhisperX não funcionam como dependências sem instalação em qualquer navegador; modelos de imagem/vídeo pagos ou com cotas são opcionais, não fazem parte do requisito zero custo; nenhum upload silencioso, nenhuma execução arbitrária de código de IA, chaves pessoais isoladas e sem logs de segredo.

## 6. Implementação original iniciada nesta branch

### `src/editorial/semantic-cues.ts`

API pura `scheduleSemanticCues(words, segments, cues, fps)`. Os dados já existentes `Word.id`, `Segment.srcStart/srcEnd` são suficientes para o primeiro corte:
- `SemanticCue` descreve ID estável do evento, palavra âncora, borda start/end, offset e duração em frames;
- gera **uma ocorrência por segmento**, inclusive quando um mesmo trecho foi colado duas vezes;
- reordenação ou corte anterior move a janela automaticamente;
- palavra incompleta/cortada ou inexistente **não gera efeito**;
- cada janela respeita o segmento que originou a fala; resultado usa frames e [start,end);
- validadores recusam entrada/IDs/eventos malformados; sem dependência externa, navegador, mídia ou IA;
- **não modifica o EditPlan atual** e não altera visual/export enquanto a integração não for aprovada e testada.

### `tests/semantic-cues.test.ts`

Casos unitários escritos: palavra por ID; corte anterior; reordenação; duplicação; palavra parcialmente cortada; lead/offset negativo; fim de palavra e clipping; determinismo/imutabilidade; entradas inválidas. **Testes escritos não significam testes executados.** Executar na máquina de desenvolvimento quando estiver acessível, antes de integrar.

### Próxima integração (não implementada nesta PR)

Criar `SemanticEvent` versionado no `EditPlan` ou camada derivada, com migração/rollback. Fazer `src/editorial/selector.ts` produzir `wordId`/tipo validado somente quando houver evidência. Resolver schedule após toda alteração de segmentos; render ler os eventos agendados sem procurar texto; edição manual/trava local sempre vence. Preservar ASR como fonte de IDs, e não aceitar IDs inventados pela IA. A versão de texto após regravação exige novo alinhamento e confirmação, não confiar no ID antigo.

## 7. Backlog de execução recomendado, sem duplicar issues existentes

### P0: vínculo semântico e UX de edição
1. Evoluir POC para schema persistente com versionamento e migrate; ligar ao editor e render sem alterar export tradicional.
2. Assinatura estável por **ocorrência** (wordId + ocorrência em segmento) para escolhas do usuário.
3. Testar seek antes/depois de cortes, reorder, trecho duplicado, silêncio, fala perdida e frames 24/30/60 fps.
4. Fazer exportar MP4 real e verificar que preview e MP4 exibem o elemento no mesmo frame, inclusive undo/redo e projeto reaberto.
5. Garantir edição manual, travas e recuperação de projeto; fallback sem efeitos se ASR indisponível.

### P1: produção de variantes realmente reaproveitável
1. Criar `VariantSpec` como delta sobre um `BaseComposition`, com revisões independentes do original e assets com proveniência/licença.
2. Oferecer versões de gancho, layout, CTA, legenda e proporção; permitir escolher o que muda, sem gerar voz/rosto por padrão.
3. Chavear cache por **hash confiável dos inputs efetivos, algoritmo e versão do modelo**; invalidação por etapa e limite configurável de armazenamento; arquivos não saem do computador.
4. Exibir preview A/B, consumo de espaço, progresso por etapa, razões da mudança e botão de desfazer/restaurar.
5. Verificar ausência de explosão de RAM/armazenamento ao gerar 3, 10 e 100 variantes; não prometer 100 simultâneas no browser.

### P1/P2: catálogo profissional
- Ranqueamento, reveal acionado por palavra, lower thirds, comentário, card de comparações, progressão de lista, split-screen, B-roll manual/licenciado, áudio sincronizado a eventos; estilos e cores editáveis, safe zones de Reels/Shorts.
- Layout com `z` explícito, bounds e hit test; edição por arraste e teclado; parâmetros tipados; nenhuma execução de JS arbitrário recebido do modelo.
- Legenda com destaque por palavra, pre/post-roll sem alterar fala, handoff, kerning/outline testados em 1080x1920 e 1920x1080, opção de evitar rosto sem deslocamento inventado.
- QA de alinhamento PT-BR/EN, números, nomes, retakes e palavras incorretas; usuário revisa sugestão sem reconstruir trabalho validado.

### P0 relacionado, não reabrir duplicado
A seleção com começo, desenvolvimento e payoff já é tratada pela [issue #102](https://github.com/murilaiooo/motion4free/issues/102). BYOK/modelos já tem [issue #73](https://github.com/murilaiooo/motion4free/issues/73). SceneGraph já consta de [issue #28](https://github.com/murilaiooo/motion4free/issues/28). Referenciar essas tarefas, não criar duplicatas.

## 8. Portões de QA antes de declarar funcionalidade pronta

| Prova | Aceite |
| --- | --- |
| Unitário | `npm test` com casos novos e regressão do motor de timeline, cenas e legendas |
| Estático | `npm run typecheck` e `npm run build`, sem nova dependência restrita |
| E2E | importar, transcrever, editar, duplicar, desfazer, reabrir, pré-visualizar, exportar e inspecionar um MP4 real |
| Precisão | diferença de evento versus frame esperado documentada e examinada em 24/30/60 fps |
| Integridade | nenhum texto inventado no trecho; evento não vaza para trecho cortado ou clone indevido |
| UX | editar/remover âncora visivelmente, escolher presets sem configuração de código |
| Custo/privacidade | edição local sem key, sem upload não autorizado, queda local/fallback informada |
| Performance | orçamento medido de memória/cache/export em amostras de 15s, 60s e vídeo longo, sem limiar inventado |
| Compatibilidade | Firefox/Chrome/Brave conforme matriz de recursos; downgrade explicado |
| Licenças | auditoria de todos os modelos, fonts, músicas, materiais e plugins novos antes de inclusão |

## 9. Referências adicionais revisadas

- [Hypit README](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/README.md) e [package.json](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/package.json).
- [Quickstart](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/quickstart.md), [packages/extensões](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/guide/packages.md), [temporal README](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/temporal/README.md).
- [Studio temporal](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/docs/guide/studio-temporal-windows.md), [evidência de região](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/region-evidence/README.md), [Browser Capture](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/browser-capture/src/browser.ts).
- [Hypit overview de executores](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/executor/README.md) e [Hypit ranking](https://github.com/hypit-ai/hypit/blob/0d36de9a9d17562fca0e478969b80eb1c16a7693/packages/ranking/src/index.ts).

## 10. Limites do estudo

A árvore de **todos** os arquivos foi inventariada; apenas os principais guias, contratos, implementações e partes do Motion4Free necessárias à decisão foram lidos diretamente. Isso **não é** um line-by-line review dos 1.704 arquivos do upstream, nem auditoria de segurança do produto inteiro. Não houve instalação, export, benchmark real ou testes E2E porque o computador remoto estava offline e o ambiente desta análise não possuía uma cópia completa do projeto privado. O resultado de CI e a integração com UI/export continuam pendentes.

**Decisão:** aproveitar conceitos bem delimitados em código original compatível com o produto, priorizando semântica de timing e variantes; não introduzir `@hypit/hypit` nem suas dependências.
