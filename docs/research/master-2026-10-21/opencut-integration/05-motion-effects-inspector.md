# Motion Studio, inspector, masks, graphics e guias: especificação por feature

**Princípio:** edição precisa ser persistida em `EditPlan`, validada por Zod, reversível e renderizada pelo mesmo `drawFrame` no player e no arquivo exportado. CSS animation exclusiva na interface NÃO é motion do produto. Implementar cada feature em PR separado, conforme roadmap.

## F01 — Inspector contextual organizado (OCU-04, imediato)

**Referência Classic:** `apps/web/src/components/editor/panels/properties/index.tsx` resolve elemento selecionado e `registry.tsx` escolhe tabs por tipo; `components/element-params-tab.tsx` renderiza propriedades. **M4F:** `Editor.tsx` possui ElementInspector/SegmentInspector/RangePanel/selectedCut; `FramingPanel` e `CaptionStylePanel` já existem. **Executar:** criar `InspectorRegistry` local, separado da seleção real, com `getTabsForSelection(selection, ctx)`; group headers e scroll próprios, valores lidos do plano atual. Mínimo tab para segmento `Corte/Enquadramento`, texto `Conteúdo/Estilo/Transformar`, shape `Forma/Transformar`, legenda `Texto/Estilo`, range `Pedido`. Ocultar somente se campo não aplicável; nunca mostrar toggle fictício. `lastActiveTabByKind` é UI state. **Aceite:** nova seleção troca inspector e preserva seleção no canvas/timeline; undo atualiza campos; edição numérica só commit em blur/Enter; nada de novo em schema.

## F02 — Controles de transformação e propriedades (OCU-12)

**Referência:** `properties/registry.tsx` agrupa `transform.positionX/Y`, `scaleX/Y`, `rotate`, `opacity`, blending; `preview/components/transform-handles.tsx` e `controllers/transform-handle-controller.ts`. **M4F:** `core/edits.ts` (`Placement`/`Offset`/limites), `app/PreviewOverlay.tsx`, `render/hit.ts`, `editorial/manual.ts`. **Implementar:** campos x,y,escala,rotação, opacidade com unidades claras; arrastar/rotacionar com alça e teclado setas; manter aspect lock salvo se ativado, Shift desfaz snap temporariamente, Escape cancela preview, uma única transação no pointerup. Separar coordenadas normalizadas de pixels da viewport; ao mudar 9:16/16:9 manter objeto visível e clamps. **Dependência:** verificar se `opacity`/escala por eixo existe no schema; se não, PR de migração dedicado. **Testes:** hit test em zoom, resize com rotação, posição negativa, reset, undo/reload, preview/export.

## F03 — Keyframes de propriedades (OCU-13)

**Referência:** `animation/types.ts`, `animation/keyframes.ts`, `animation/interpolation.ts`, `animation/resolve.ts`, `commands/timeline/element/keyframes/upsert-keyframe.ts`, `properties/hooks/use-keyframed-param-property.ts`.

**Modelo proposto, fora do schema até aprovar migração:**
```ts
type Curve = 'step'|'linear'|'bezier';
type AnimatedField = 'x'|'y'|'scale'|'rotation'|'opacity';
interface Keyframe { id: string; tick: number; value: number; curve: Curve;
  bezier?: [number,number,number,number]; }
interface PropertyAnimation { property: AnimatedField; keys: Keyframe[]; }
interface ElementAnimation { elementId: string; channels: PropertyAnimation[]; }
```
**Modelo de dados:** `added` de `src/core/edits.ts` recebe animação *opcional*, schema vNext de `core/schema.ts` com default correto; IDs estáveis e keys ordenadas, sem duplicatas no mesmo `tick`; bounds ao período do elemento, conforme retime/split; base value é fallback quando não existem keys. **No render:** função pura `valueAt(anim, tick)` retorna transform interpolado, injetar na `drawAdded`/`drawFrame` para preview e export; reusar `render/hit.ts` para bounds/interactions. **Na UI:** diamante ao lado de propriedade, botão Add/Remove keyframe no tempo atual, scrub visual não comita a cada pixel; deletar um keyframe não deleta o elemento. **Testes:** value before/at/after keys, equal keys, step, linear, bezier, split/trim/remap, undo, reload, 30/29.97 fps, preview/MP4.

**Cuidado:** `StyleDNA` mantém movimentos automáticos; prioridade deve ser definida explicitamente: por exemplo manual override sobre animação automática apenas na propriedade animada. Não apagar estilos automáticos de todo projeto ao adicionar 1 keyframe. ADR necessária.

## F04 — Lanes de keyframe e editor de curva (OCU-14)

**Referência:** `timeline/components/expanded-layout.ts`, `timeline/components/graph-editor/bezier-graph.tsx`, `graph-editor/use-controller.ts`, `graph-editor/session.ts`, `hooks/element/use-keyframe-drag.ts`. **Executar:** abaixo do elemento ativo, subfaixas somente das propriedades com channels; linhas de diamonds com hit targets, seleção, Ctrl/Shift multi-select depois de suportar; botão `Curva` abre popover com curvas preview e presets ease-in/out; modo linear/hold/Bézier; alças Bézier editáveis no SVG. Escape cancela alterações temporárias, pointerup registra 1 undo. Curva editor lê keys selecionadas do mesmo plano. **Testes:** dope sheet alinhado ao zoom, horizontal scroll sincronizado, retime keyframes no clip, curva e valor em export, sem lag de render.

## F05 — Máscara por elemento (OCU-15)

**Referência:** `masks/registry.ts`, `masks/components/masks-tab.tsx`, `masks/builtin/definitions/rectangle.ts`, `ellipse.ts`, `masks/feather.ts`, `masks/use-mask-handles.ts`, `preview/components/mask-handles.tsx`. **MVP:** rect/ellipse com position/width/height/rotation/inverted/feather, layer-local e editáveis no inspector e no preview. No schema opcional `mask`, com defaults e validation. **Render:** aplicar `ctx.save/clip/restore` quando sem feather; para feather criar offscreen layer e composição alpha controlada para evitar afetar outros elementos e source video; se performance elevada, gate/fallback com erro descritivo. Validar `globalCompositeOperation` e clip path sob DPR/scale; não copiar shaders Rust. **Testes:** elementos simultâneos, shape, bordas, feather nos 4 formatos, export parity, persist e undo, GPU indisponível. Star/heart/diamond/text/freeform ficam fase posterior com spec individual.

## F06 — Máscaras avançadas (OCU-16)

**Referência:** `masks/builtin/definitions/split.ts`, `star.ts`, `heart.ts`, `diamond.ts`, `cinematic-bars.ts`, `text.ts`, `masks/freeform/path.ts`. **Executar uma máscara por PR** com parâmetros no registry, preview handles e definição render sem efeitos globais. Para freeform, definir vértices normalizados, limites de 4..N, operações add/remove/undo, curvas/feather e invalidação do hit-test. Cinematic bars melhor como overlay de formato/procedural se a intenção for crop global. Máscara texto depende de fallback de fonte local e medição coerente.

## F07 — Registro de efeitos (OCU-17)

**Referência:** `effects/registry.ts`, `effects/types.ts`, `effects/definitions/blur.ts`, `effects/components/effects-tab.tsx`, `docs/effects-renderer.md`. **M4F:** `StyleDNA` contém look/transition e pipeline Canvas2D, não um registry uniforme de efeitos por objeto. **Fazer:** `src/render/effects/registry.ts` com `id`, `label`, `parameters` (min/max/default/type), `supports`, `render(ctx,frame,params)`, `costHint`, `schemaVersion`; ordem por objeto explicitamente serializada. MVP brightness/contrast/saturation/blur se a pipeline permite sem perdas; escolher 1 efeito primeiro. Princípio **uma definição, dois destinos**: preview e export chamam mesmo `drawFrame`. Efeito compatível com máscara/scale. **Testes:** combinações de efeitos, desativar sem apagar parâmetros, undo/reload, intensidade extremo e tempo de render.

## F08 — GPU experimental (OCU-21)

**Referência:** `rust/crates/compositor/*`, `rust/crates/effects/*`, `rust/crates/gpu/*` e `services/renderer/gpu-renderer.ts`; shader passes documentados em `docs/effects-renderer.md`. **Somente spike separado:** benchmark de 1080p 30fps e 4K preview (se suportado), GPU vs Canvas2D, cópia de textura, RAM, context loss, degrade, browser mobile/desktop, export parity. Se WebGPU não suportado, não alterar funcionamento; nunca colocar GPU como requisito obrigatório. Decidir caso a caso e registrar ADR. Não importar bundle Rust inteiro ou manter 2 engines incoerentes.

## F09 — Fundos de canvas (OCU-18)

**Referência:** `background/color.ts`, `background/blur.ts`, `components/editor/panels/assets/views/settings/background.tsx`. **Atual:** `FramingPanel.tsx` e `DEFAULT_FRAMING` já oferecem fit/fill/blurring em algumas configurações, `render/frame.ts` desenha source. **Adicionar só lacuna real:** background color/gradient como opção de frame ou fit bars, com ordem compositiva documentada. Blur usa fonte original sem escapar da máscara do canvas e não vaza entre clips. **Aceite:** 9:16 vertical, 16:9 horizontal, fit sem esticar, preview/export, arquivos sem vídeo válido.

## F10 — Guias e safe zones (OCU-19)

**Referência:** `guides/registry.tsx`, `guides/definitions/tiktok-layout.tsx`, `guides/definitions/platforms.tsx`; somente TikTok apresenta overlay real no Classic, outros placeholders. **Atual:** `Editor.tsx` tem `safeZone` e `SAFE` estático para Reels. **Fazer:** registry `PlatformGuide` (tiktok/reels/shorts/custom), `safeRegion` em coordenada percentual por aspect ratio com presets *nossos*, botão no toolbar e overlay DOM acima do canvas com `pointer-events:none` e abaixo de handles. Números exatos de safe zone variam com UI de plataformas: permitir editor customizado e não tratar presets como eternos. Estado salvo em UI, guias NUNCA desenhados no MP4. **Testes:** toggle, resolução, canvas letterbox, export sem linhas, resize, click/drag.

## F11 — Gráficos e stickers (OCU-20)

**Referência:** `graphics/registry.ts`, `graphics/definitions/rectangle.ts`, `ellipse.ts`, `star.ts`; `stickers/registry.ts`, `stickers/providers/*`, `text/layout.ts`, `text/typography.ts`. **Atual:** `SidePanels.tsx` já cria texto, shape e emoji; `core/emoji.ts`, `render/added.ts` já resolvem draw. **Prioridades:** transformar cards em galeria pesquisável com previews gerados localmente; normalizar desenho/prop typing e favorite local; só depois SVG/stickers. Não baixar trademarks/logos/bancos de emojis de terceiros sem licença e provenance. Testar render de fonte e emoji (font fallback) offline e no MP4.

## F12 — Propriedades de texto e leitura (OCU-20, subetapa)

**Referência:** `text/layout.ts`, `text/typography.ts`, `components/ui/font-picker.tsx`, `components/ui/color-picker.tsx`; `panels/properties/registry.tsx` lista fontFamily/fontSize/color/align/weight/spacing/bg. **Atual:** `TextPanel`, `CaptionStylePanel`, `textLookSchema`, fonts via fontsource. **Fazer:** inspector com fonte, tamanho, alinhamento, caixa, espaçamento (se suportado no renderer) e pré-visualização coerente; não mostrar propriedade que `drawAdded` não respeita. Typing de texto não cria undo por letra, somente commit; mudanças de fonte não substituem texto do usuário. Testes multi-line RTL/acentos/emoji/char limits/zoom/export.

## Regra de qualidade para todas as features de movimento

Se uma propriedade só funciona na página, mas não no MP4 e no projeto restaurado, **não está pronta**. Documentar limites de performance e adicionar erro M4F-xxx seguindo `AGENTS.md`.
