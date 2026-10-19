# Motion design, direção de arte e composição autoral — instruções do upstream

**Estado:** pesquisa técnica, sem motor integrado. Meta: animações **específicas ao briefing** com qualidade de composição, movimento e tipografia, não repetição de templates.

## Papel de cada camada
- `AI Creative Director`: a partir de prompt/presets/frames/fala cria StyleDNA, storyboard e decisões por beat.
- `SceneGraph`: representação declarativa de texto, shapes, máscara, gráficos, vídeo, objeto 3D, filtros, materiais, timeline, áudio e referências aos assets autorizados.
- `Creative Composer`: transforma SceneGraph seguro em comandos de render de bibliotecas, com limites.
- `Temporal Engine`: avalia uma cena em um **timestamp arbitrário** reproduzivelmente, independente do FPS do monitor.
- `Motion QA`: compara preview/export, legibilidade, easing, variação e aderência ao briefing. Modelo não executa JS/shader arbitrário.

## 1. PixiJS — compositor principal 2D candidato

**Upstream:** https://github.com/pixijs/pixijs (branch upstream de desenvolvimento `dev`, MIT). O repositório publica **skills técnicas específicas**, não apenas README.

**Fontes primárias inspecionadas**
- [Application skill](https://github.com/pixijs/pixijs/blob/dev/skills/pixijs-application/SKILL.md): v8 `new Application()` sem opções, depois `await app.init(...)`; stage, renderer, canvas e ciclo de vida.
- [Performance skill](https://github.com/pixijs/pixijs/blob/dev/skills/pixijs-performance/SKILL.md): cache de texturas, pooling, culling, GC, preparo de GPU e teardown.
- [Asset manifests](https://github.com/pixijs/pixijs/blob/dev/skills/pixijs-assets/references/manifests.md): `Assets.init({manifest})`, `loadBundle()`, `backgroundLoadBundle()`, aliases e formatos fallback.
- Outras skills relevantes: `skills/pixijs-scene-container/SKILL.md`, `skills/pixijs-scene-text/SKILL.md`, `skills/pixijs-filters/SKILL.md`, `skills/pixijs-custom-rendering/SKILL.md`, `skills/pixijs-core-concepts/references/render-loop.md`.

**Instruções a adaptar**
1. Criar uma `Application` v8 e **aguardar** `app.init({width,height,preference,autoStart:false,...})` antes de desenhar.
2. O `stage` recebe grupos de primitivos; usar o renderizador adequado após capability check WebGPU/WebGL.
3. Para export frame-by-frame, desabilitar ticker autônomo, atualizar parâmetros pelo timestamp e chamar `app.render()` manualmente; **testar, não presumir** que animações dependentes do ticker obedecem ao tempo da timeline.
4. Manifest de bundles: `Assets.init` apenas uma vez; `await Assets.loadBundle('critical')` e `Assets.backgroundLoadBundle('motion')`; assets versionados com fallback de extensão. Em projeto real, integrar licenças/hashes ao manifesto.
5. Pré-carregar textura e upload GPU com PrepareSystem para evitar hitch no primeiro frame; usar `cacheAsTexture` para grupos estáticos e invalidar ao mudar filhos.
6. No encerramento, descarregar textures com `Assets.unload`/destroy; a documentação enfatiza `releaseGlobalResources:true` para ciclos de inicialização em mesma aba.
7. Medir draw calls, RAM GPU, textura máxima, batching, texto dinâmico (evitar rerasterização per frame sem necessidade), culling e perdas de contexto.

**POC:** 3 composições 2D com hierarquias e movimentos distintos, mesmo áudio e captions, seeks aleatórios e render previsível em 1080×1920. Comparar com compositor 2D já existente do OpenReel antes de escolher manter os dois.

## 2. Motion Canvas — gramática de animação a estudar

**Upstream:** https://github.com/motion-canvas/motion-canvas (MIT). [README](https://github.com/motion-canvas/motion-canvas/blob/main/README.md): **core** para lógica de animação, **2d** para cena, editor de preview, player e plugin Vite.

**Como funciona:** código TS com generators produz animações com controle temporal, propriedades animáveis, marcações e sincronismo de áudio/narração.

**Como aproveitar:** estudar compositional DSL, easing, scene graph e preview para o nosso `StyleDNA/Storyboard/SceneGraph`; comparar uso de core/2d isolados versus PixiJS. **Exportador de vídeo padrão usa integração externa com FFmpeg/Node em seu workflow**; a existência de player web não prova export MP4 com áudio inteiramente dentro do navegador.

**Spike:** tentar renderizar frames `t=0,0.5,1,2...` em browser sem servidor nem dev plugin e mux com Mediabunny; medir código e RAM. Se dependente de Node, usar como inspiração da API, não requisito de runtime.

## 3. Theatre.js — dados finos de animação

**Upstream:** https://github.com/theatre-js/theatre.
- [Core README](https://github.com/theatre-js/theatre/blob/main/packages/core/README.md): `@theatre/core` para sequências/timelines que animam propriedades de DOM/SVG/Three.js. Licença **Apache-2.0 para o core**.
- `@theatre/studio` é ferramenta visual separada, com **licenciamento diferente (AGPL-3.0 indicado nos materiais upstream)**; ler arquivos específicos de pacote e impacto legal antes de embutir no app distribuído.
- [Examples](https://github.com/theatre-js/theatre/tree/main/examples), incluindo uso DOM e React Three Fiber.

**Adaptação:** utilizar dados de keyframe/sequência e easing quando compatíveis; idealmente o renderizador avalia cena com tempo solicitado, sem depender de reprodução em tempo real. Se Studio tiver incompatibilidades, construir UI própria baseada no editor existente ou usar apenas core.

**Teste:** animação idêntica acessada em ordem aleatória de timestamps, serialização e portabilidade entre dispositivos.

## 4. Three.js e React Three Fiber — composição 3D somente quando fizer sentido

**Upstreams:** [Three.js](https://github.com/mrdoob/three.js) (MIT), [React Three Fiber](https://github.com/pmndrs/react-three-fiber) (MIT).
- [Three.js README](https://github.com/mrdoob/three.js/blob/master/README.md): cena + câmera + geometria/material + renderer WebGL/WebGPU + render.
- [R3F instalação](https://github.com/pmndrs/react-three-fiber/blob/master/docs/getting-started/installation.mdx): `npm install three @react-three/fiber`; compatibilidade React major importa: R3F v8/React 18, R3F v9/React 19. O projeto Motion4Free ainda **não escolheu** React/versão; não instalar cegamente.

**Adaptação:** nós 3D vinculados a SceneGraph; carregar glTF autorizado, transformar segundo `StyleDNA`, câmera/materiais/iluminação, parâmetros em `t` absoluto, partículas controladas por seed por projeto. Nunca criar prova fotorealista falsa para informação factual. Evitar render 3D em todas as cenas; composição editorial 2D pode ser superior.

**Teste:** memória GPU, transparência/alfa no compositor 2D, render coerente após seek e variação significativa de cena; inspeção de licença **de cada modelo glTF/WebM**, separada da licença do Three.js.

## 5. Motion / GSAP — movimento e easing

- [Motion](https://github.com/motiondivision/motion) core MIT: `npm install motion`; animações JS/React/Vue, gestos, transições, keyframes.
- Motion+ e Motion Studio possuem ofertas separadas/pagas: **não assumir que recursos premium vêm com MIT**.
- GSAP está presente nas cenas do Editonny e pode operar animações refinadas; conferir **licença e pacote/versão** de cada plugin ao integrar e distribuir.

**Adaptação:** easing, curvas, entradas/saídas, texto cinético e transições, com fase temporal derivada de uma timeline estável; se um motor depende de requestAnimationFrame, adaptá-lo/testá-lo para render offline por timestamp. Misturar dois sistemas de timeline não é grátis em complexidade.

**Teste:** estado idêntico em seeks e 30/60fps, duração coerente após cortes, movimento não excessivo e sem pulo no MP4.

## 6. dotLottie Web — biblioteca de movimentos prontos, não autor de arte

**Upstream:** https://github.com/LottieFiles/dotlottie-web, MIT para player (licença das animações é independente).
- [Web README](https://github.com/LottieFiles/dotlottie-web/blob/main/packages/web/README.md): biblioteca WASM para reproduzir Lottie/dotLottie; workers opcionais.
- O upstream demonstra `DotLottie.preload()` para carregar WASM antes da primeira cena.
- Com CSP estrita, hospedar worker e WASM em mesma origem e configurar `DotLottieWorker.setWorkerUrl(...)`/`setWasmUrl(...)` antes de criar instâncias; versões WASM, JS e worker devem coincidir.

**Adaptação:** suporte opcional a animações vetoriais contextualizadas e permissíveis; não usar a mesma Lottie como assinatura de todos os vídeos. Testar render no instante específico, export de frame, compatibilidade e licença da animação obtida.

## 7. Ativos do Editonny: como Claude chega aos efeitos
[visuals/README](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/README.md) aponta cenas HTML/CSS/GSAP, fundos MP4, WebM alpha, ícones 3D, SFX e músicas. [three-steps.html](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/scenes/three-steps.html) exemplifica composição de camadas prontas. Claude direciona e pode ajustar cenas; não gera tudo por modelo de vídeo.

**No Motion4Free:** transformar essas receitas em **materiais, primitives e exemplos de direção**, criando a partir de evidência real. Nunca copiar cenas/áudio/assets indiscriminadamente para a build; manifest/licenças por arquivo. Assets próprios do usuário têm prioridade.

## Comparativo obrigatório (antes de escolher stack)
| Critério | OpenReel `CompositionRenderer` | PixiJS | Motion Canvas | Theatre Core |
|---|---|---|---|---|
| Layout/2D | Já usa OffscreenCanvas | Forte | Forte | Depende do host |
| Render em tempo arbitrário | API `renderFrame(time)`; verificar | Implementar | Investigar core | Investigar sequências |
| 3D | Precisa integração | Via Three | Não substitui 3D | Anima props 3D |
| Export MP4 | Via engine externa interna | Precisa Media mux | Fluxo padrão não é só browser | Precisa Media mux |
| Art direction | Nossa responsabilidade | Nossa responsabilidade | Nossa responsabilidade | Nossa responsabilidade |
| Licença | MIT no repo, assets apartados | MIT | MIT | Core Apache-2.0 |

**Gate final:** a mesma gravação, 3 briefs visualmente distintos: enquadramento, tipografia, composição, timing, objetos e estrutura realmente mudam, mas mantêm qualidade profissional. Export no navegador é requisito, não bônus.

[Índice](INDEX.md) · [Mídia](01-media-and-editor.md) · [Matriz](05-integration-matrix.md).
