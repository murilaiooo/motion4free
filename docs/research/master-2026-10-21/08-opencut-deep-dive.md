# OpenCut: auditoria de referência para Motion4Free Master

**Data:** 21/10/2026. **Repos:** [opencut-app/opencut](https://github.com/opencut-app/opencut) (rewrite) e [opencut-app/opencut-classic](https://github.com/opencut-app/opencut-classic) (Classic). Ambos exibem licença MIT na raiz. **Método:** leitura de README/LICENSE, árvores recursivas e caminhos de fonte específicos; **não** builds/testes do upstream. O Classic está `archived=true` no GitHub e se declara não mantido. Não copiar assets, dependências nem pesos sem auditoria separada.

## Veredicto

**Alta utilidade como fonte de engenharia, especialmente o Classic; baixa adequação para substituir nosso aplicativo.** O Motion4Free já tem React/Vite, operações editoriais, histórico, render Canvas2D e exportação Mediabunny. O objetivo é portar padrões cirúrgicos mantendo projetos antigos, privacidade e custo obrigatório zero. Acrescentar dois upstreams ao inventário, **sem transformar o projeto em fork**.

## Rewrite versus Classic

| Eixo | Rewrite `opencut` | Classic `opencut-classic` | Decisão |
|---|---|---|---|
| Status | README anuncia reconstrução e plugins/API/MCP/headless como trabalho futuro | README: versão original arquivada, sem manutenção; o site atual segundo README do rewrite usa Classic | confiar em código efetivo, não promessas |
| Editor web | `apps/web/src/routes/editor.tsx`: apenas título e `Coming soon` | código extenso de timeline, canvas, comandos, keyframes, máscaras e export | usar Classic para lógica real |
| Desktop | Rust/GPUI com `shell.rs`, `panels/timeline.rs` ainda placeholder | código GPUI + crates Rust de tempo/GPU | desktop não é escopo do Motion4Free |
| Arquitetura | `Cargo.toml` lista somente `apps/desktop`; `crates/*` comentado. Estrutura visual e ferramenta de build Moon/Proto | lógica TS com migração parcial para Rust/WASM | não migrar o runtime/stack |
| Licença | MIT na raiz | MIT na raiz | arquivos de terceiros/assets/modelos seguem licenças próprias |

## Descobertas no código Classic e destinos no Motion4Free

### A. Timebase integer-tick, FPS racional (MASTER-01)

[media_time.rs](https://github.com/opencut-app/opencut-classic/blob/main/rust/crates/time/src/media_time.rs) usa `MediaTime(i64)` e `TICKS_PER_SECOND=120_000`, conversões `from_seconds`, `from_frame`, `to_frame_floor/round`, `last_frame_time`. [frame_rate.rs](https://github.com/opencut-app/opencut-classic/blob/main/rust/crates/time/src/frame_rate.rs) usa `numerator/denominator`, com 24000/1001, 30000/1001, 60000/1001, validando integralidade dos ticks por frame e testes de rates. **Insights:** ticks inteiros representam áudio e vídeo com precisão; frames inteiros determinam cortes/render; a nossa proposta baseada só em frames pode ser ampliada para um tempo interno inteiro com resolução explícita. Iniciar com *adapter TS puro* em `src/engine/` para não introduzir Rust/WASM.

**Teste adicional:** 23.976, 29.97, 59.94 e 60 fps, cortes de palavra que caem entre frames, 1000 operações de split/trim/undo, `lastFrame` e roundtrip de projeto legado.

### B. CommandManager, transação e histórico (MASTER-02 e MASTER-14)

[CommandManager](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/core/managers/commands.ts) centraliza `execute/undo/redo`, preserva/restaura seleção quando comando demanda e permite ripple por transformação separada. [TimelineManager](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/core/managers/timeline-manager.ts) oferece APIs de track, trim, split, move, keyframe e máscaras; ações UI e atalhos não precisam reescrever regras. [actions](https://github.com/opencut-app/opencut-classic/blob/main/docs/actions.md) documenta registry de ação comum a botão, menu e teclado, com migração de hotkeys persistidas; *atenção: paths nesse doc podem ser legados*. **No M4F:** migrar operações de `Editor.tsx` gradualmente para ações tipadas, não substituir todo o `history.ts` existente. Um drag = um commit. Testar invalid op, seleção, undo/redo e IA executando o mesmo comando.

### C. Keyframes + curvas Bézier + parâmetros (MASTER-07)

[Keyframes engine](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/animation/keyframes.ts) mantém canais por propriedade, entradas por tempo, interpolação step/linear/bezier, recorte/retime/split e canais escalares/discretos. [UpsertKeyframeCommand](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/commands/timeline/element/keyframes/upsert-keyframe.ts) limita tempo dentro da duração do elemento e permite undo. [BezierGraph](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/timeline/components/graph-editor/bezier-graph.tsx) é um editor interativo de alças SVG. [Properties registry](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/components/editor/panels/properties/registry.tsx) lista transform, blending, áudio, texto, máscara e velocidade por tipo. **No M4F:** preservar `src/render/frame.ts` como render comum, animar primeiro opacity/position/scale e introduzir curva só com teste preview=MP4. Sem CSS-only keyframe que desaparece na exportação.

### D. Máscaras reais (NOVO: MASTER-23)

[MasksRegistry](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/masks/registry.ts) registra definição, campos, defaults, controles de interação e renderer; [mask snap](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/masks/snap.ts) trata posições/escala/rotação das handles. A árvore contém retângulo, elipse, coração, estrela, split, feather, path livre e seus testes de snapping. **No M4F:** primeira etapa retângulo/elipse/feather em elemento, operações reversíveis, verificando sobreposição e export. Evitar 'recorte de sujeito por IA' nessa etapa, que é outro problema.

### E. Efeitos parametrizados por passes e GPU (NOVO: MASTER-24)

[Guia de GPU/effects](https://github.com/opencut-app/opencut-classic/blob/main/docs/effects-renderer.md) descreve effects registry, `shader ID`, uniforms, passes estáticos/dinâmicos e shader WGSL sob Rust/wgpu; código em `rust/crates/compositor`, `effects`, `gpu`, `masks`. Não é suficiente para afirmar que todas as configurações funcionam em navegador/hardware atual. **No M4F:** criar registry de efeitos e propriedades primeiro, testar blur/grade em pipeline atual, avaliar GPU como *spike opt-in* com fallback Canvas2D. Manter o export WebCodecs/Mediabunny.

### F. Guias de rede social/áreas seguras (NOVO: MASTER-22)

[Guide registry](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/guides/registry.tsx) registra grid, TikTok, Instagram Reels, Shorts e Spotlight. [platforms.tsx](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/guides/definitions/platforms.tsx) define uma sobreposição real de TikTok (`TikTokLayout`), enquanto Reels/Shorts/Spotlight retornam `null` como overlay. **No M4F:** projetar nossas próprias safe zones verificadas para cada plataforma e proporção, guias visíveis somente na interface (não exportar), com configurações da UI salvas. Diferencial de impacto alto e custo técnico relativamente baixo.

### G. Áudio, fluxo e visual (MASTER-12, MASTER-03, MASTER-09)

[Audio mastering](https://github.com/opencut-app/opencut-classic/blob/main/apps/web/src/media/audio-mastering.ts) combina análise de pico, compressor/limiter em WebAudio/OfflineAudioContext e teto de amplitude; não é equivalente a medir loudness LUFS e não deve substituir normalização existente cegamente. No M4F usar teste de áudio antes/depois com sincronização e sem clipping. A árvore de UI separa `timeline/controllers`, `timeline/hooks`, `preview/controllers` e `preview/components`, úteis para refatorar `Editor.tsx` e `EditTimeline.tsx`, sem copiar interface inteira. O Classic tem previews de handles, markers, snapping, waveform, inspector por mídia e atalhos.

## Comparação com recursos existentes (anti-duplicação)

| OpenCut Classic | Motion4Free atual | O que realmente falta |
|---|---|---|
| Cmd history + preview overlay | `src/engine/history.ts`, `src/app/PreviewOverlay.tsx` já possuem undo por gesto | comandos centralizados e estado da UI consistente |
| Timeline multitrack + snapping | `src/app/EditTimeline.tsx`, ADR-0021, camadas 0–9 e waveform | pistas independentes e ferramentas completas, sem duplicar timeline |
| Framing/preview guides | `src/render/layout.ts`, `FramingPanel.tsx`, zonas básicas | overlays de plataforma no canvas com ativação clara |
| Keyframe channels + graph editor | movimentos automáticos e `core/edits.ts` com posição, escala/rotação | autoria temporal e curvas persistidas no projeto |
| Masks/effects | shapes e StyleDNA, Canvas2D | máscaras de corte com feather e efeitos parametrizados |
| Integer/rational media time | `src/engine/timeline.ts` usa `number` segundos; `OutputProfile.fps` | eliminar arredondamentos acumulativos sem destruir projetos |
| Rust GPU compositor | render em Canvas2D + WebCodecs/Mediabunny | **não obrigatório**; prova isolada antes de adoção |

## Especificação de execução aprofundada (adendo 21/10)

Para orientar uma IA com instruções por módulo, decisões de layout, arquivos exatos, contratos de eventos, persistência, passos de PR, testes e licença, usar o [dossiê detalhado OpenCut](opencut-integration/README.md). A auditoria curta neste arquivo é uma introdução; a análise profunda cobre também inspector, tool rail, UI responsive e plano de reorganização da mesa de edição Motion4Free.

## Recomendações concretas

1. **Agora:** enriquecer MASTER-01 com ticks inteiros e taxas racionais; estudar masks/guide UI com critérios de MVP; manter FreeCut e Cutaway como comparativos.
2. **Primeiro recurso visível:** MASTER-22, overlays por plataforma, em PR independente pequeno, sem download de ícones/brand assets.
3. **Após alicerce temporal:** MASTER-07 (keyframes) seguido MASTER-23 (máscaras).
4. **Depois:** MASTER-24 (registrador de efeitos) e experimento GPU. Nenhuma migração automática para Rust ou Next.js.
5. Revisar permissões/NOTICE por arquivo, dependências, licença dos shaders/assets, e fixar SHA do upstream antes de integrar código.

**Limites desta análise:** árvore + arquivos específicos, não varredura linha a linha de todos os 1.128 arquivos Classic e 130 do rewrite, sem screenshots comparativas, sem build, sem benchmark nem teste de runtime; 'arquivo presente' não prova comportamento final.
