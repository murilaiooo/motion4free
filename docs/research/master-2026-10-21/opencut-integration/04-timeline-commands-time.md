# Timeline profissional, comandos, seleção e tempo preciso

As features aqui **dependem do estado real do projeto**; executar em PRs separados. Não substituir `src/app/EditTimeline.tsx` por timeline Classic completa.

## T1: layout e ferramentas da timeline (OCU-05)

**Upstream:** `timeline/components/index.tsx`, `timeline-toolbar.tsx`, `timeline-track.tsx`, `timeline-ruler.tsx`, `track-layout.ts`, `expanded-layout.ts`, `timeline/hooks/use-scroll-sync.ts` (Classic).

**Atual:** `src/app/EditTimeline.tsx` com `MAX_ROWS=3`, `tl-layer-*`, `tl-anim`, `tl-audio`, `tl-cap-*`, `range-lane`, waveform e zoom. `app.css` usa `.tl-body` com coluna fixa `96px`; `EditTimeline.tsx` já tem header/toolbars e Edição/Original.

**Fazer:** separar funções puras de geometria régua/zoom/tempo para `src/engine/timeline-geometry.ts`, preservando cálculos atuais; headers de pista sticky; linhas por categoria (overlay/caption/video/audio/range), resize vertical somente visual, scrollbar acoplada ao ruler, controles de ímã/split/zoom de fácil alcance; pequenos menus de pista (visibilidade/mute) **somente quando houver semântica real**. Persistir zoom como UI, não EditPlan. Testar long duration, many clips, zoom extremo, edge trims, scroll perf. **Não fazer:** reescrever snapping/drag já funcional só para mudar aparência.

## T2: seleção, drag-preview, operações em lote (OCU-06)

**Upstream:** `selection/editor-selection.ts`, `selection/hooks/use-box-select.ts`, `timeline/hooks/element/use-keyframe-selection.ts`, `preview/controllers/preview-interaction-controller.ts`. **Atual:** `src/app/Editor.tsx` mantém `selectedEl`, `selectedSeg`, `selectedCut`, `selection`; `PreviewOverlay.tsx` faz preview transitório e commita uma vez.

**Fazer:** `src/editorial/editor-selection.ts` com `Selection = discriminated union` + `resolveSelection` sem dupla fonte; seleção em timeline refletida no canvas; shift/ctrl multiselect **apenas quando actions compatíveis**; cancelar ESC; click empty; impedir drag de elemento de disparar seek. Box selection em PR posterior com retângulo sobre timeline, `isSelectable`, `trackId`, IDs estáveis. **Aceite:** selecionar um texto atualiza inspector; arrastar visualmente, desfazer uma vez; crop dos limites não altera seleção; múltiplos não quebram inspector. O inspector de multi-elementos no upstream Classic é incompleto: não copiá-lo como solução.

## T3: action registry e undo de operações (OCU-07)

**Upstream:** `actions/definitions.ts`, `actions/use-editor-actions.ts`, `core/managers/commands.ts`, `commands/timeline/*`. **Atual:** teclas e funções locais de `Editor.tsx`, `EditTimeline.tsx`, `TopBar.tsx`, history snapshot `src/engine/history.ts`.

**Fazer:** `src/editorial/actions.ts` com IDs estáveis (`split`, `trim`, `undo`, `redo`, `seek`, `delete`, `duplicate`, `togglePlay`) e requisitos `canExecute(selection,project)`; `invokeEditorAction(id, payload)` mapeia ao handler atual; UI, menu e keyboard chamam mesma ação. Após validar, criar `EditorCommand` tipado; comandos produzem `nextPlan` imutável e metadata de seleção, `apply`/history continuam como único executor. Cada gesture vira uma transação, undo/redo restaura documento sem pisar em estado de layout.

**Riscos:** reentrância de IA, foco em campo de texto, duplicate keydown, conteúdo de clipboard multi-clip, redo após nova ação. Tests: duas ações consecutivas, undo/redo, falha Zod sem mutação, seleção mantida, um drag/uma entrada, teclas com IME.

## T4: timebase e FPS racional (OCU-08)

**Upstream:** `rust/crates/time/src/media_time.rs` `MediaTime(i64)`, `TICKS_PER_SECOND=120_000`; `frame_rate.rs` `numerator/denominator`; `timeline/snapping/resolve.ts`. **Atual:** `src/core/types.ts` comenta “Tempo sempre em segundos (number)”; `src/engine/timeline.ts` mapeia tempo source/out com number, `src/media/export.ts` calcula quadro por `frame/fps`.

**Primeiro fazer adapter**, sem mudar SavedProject: `src/engine/media-time.ts` com `FrameRate {numerator;denominator}`, `ticks: number` (**JS safe int**; calcular limite de duração), `toTicks(seconds)`, `ticksToSeconds`, `snapFloor/NearestFrame`, `durationFrames`, `lastFrameTick`. 120000 ticks/s encaixam rates 24/25/30/60 e NTSC racional 24000/1001,30000/1001,60000/1001; porém testar políticas para rates arbitrários e evitar divisões não exatas. Se alta duração exigir, usar `bigint` apenas dentro de engine, serialização Zod explicitamente convertida (não JSON nativo). **Não converter objetos originais silenciosamente**: mantenha floats persistidos, use ticks para aritmética no runtime em adapter e planeje schema migration em ADR posterior.

**Testes:** split/trim sempre dentro dos segmentos, `[start,end)` consistente, source/out roundtrip, 23.976/29.97/59.94, último frame, duração 0, rate inválido, cortes/ASR fora de grade, 1000 operações, legacy project roundtrip, render MP4 sample frame. Comparar Cutaway (frames) vs OpenCut (ticks), registrar escolha em ADR; não prometer sample-accurate áudio apenas por ticks.

## T5: snapping por fontes (OCU-09)

**Upstream:** `timeline/snapping/build.ts`, `resolve.ts`, `preview/preview-snap.ts` e `timeline/element-snap-source.ts`, `bookmarks/snap-source.ts`. **Atual:** ímã já existe em `EditTimeline.tsx`, snap da preview em `PreviewOverlay.tsx`.

**Fazer:** resolver puro `resolveSnap({target, sources, tolerancePx, zoom, excludedIds})`, lista deduplicada de pontos `playhead`, `clipStart`, `clipEnd`, `caption`, `bookmark`; prioridade explícita, offset tolerância em px convertido a tempo, Shift temporariamente desativa. Mesmo mouse drag gera no máximo um commit; retorno inclui `snappedTo` para desenhar indicador no UI sem alterar export. Tests em frame limítrofe e zoom baixo/alto.

## T6: ripple editing, pista, proteção contra gaps (OCU-10)

**Upstream:** `ripple/diff.ts`, `ripple/apply.ts`, `commands/timeline/element/move-elements.ts`, `timeline/group-move/` e `timeline/placement/`. **Atual:** `Segment[]` sequencial determina output timeline e source mapping; não há garantia de que o formato de Classic encaixe diretamente.

**Fazer:** `RippleMode = off|on` na UI (off por padrão), `planRipple(before,op,after)` puro para deslocar `added` e `range` apenas se semanticamente ligados ao output, respeitando locked ranges. Não reordenar source quando não solicitado; não sobrepor vídeos no main track; não gerar lacunas nem tempo negativo. Zod valida saída antes de commit. Tests: split em 0/fim, remover bloco, delete ripple, clipboard colado no meio, remapeamento de captions e áudio, 30 clips, redo.

## T7: bookmarks de produção (OCU-11)

**Upstream:** `timeline/bookmarks/components/bookmarks.tsx`, `hooks/use-bookmark-drag.ts`, `snap-source.ts`, `preview-overlay-source.tsx`. **Atual:** `ranges` do Motion4Free já representariam trechos de IA; **não** reaproveitar como marcador de produção.

**Novo tipo `TimelineMarker`:** `id`, `atOutTicks`, `label`, `color`, `note?`, `durationTicks?`, `kind: hook|beat|cta|manual`. Introduzir com `project schema` versionado em PR específico; converter para/from seconds na borda se tempo ainda float. Inspector de marcador e régua com tooltip; click seek; drag atualiza marcador em uma transação; delimitar marcador ao output. Tests de reload/undo/fps/resize; sem passar overlay para MP4.

## T8: expansão de tracks para keyframes (OCU-14)

**Upstream:** `timeline/components/expanded-layout.ts`, `timeline/hooks/element/use-keyframe-drag.ts`, `timeline/components/graph-editor/*`. Transformar posição/escala/opacity em sub-lanes sob elemento ativo, com área de click hit test separada. Não deixar keyframes competirem com drag e trims; vertical scroll y estável ao expandir; mix de keyframes adicionado ao mesmo projeto é versionado. Dependente de animação persistente (ver 05).

## Critério de segurança transversal

- Na primeira rodada só UI e geometria pura; sistema de tempo, seleção múltipla, ripple, marcadores com schema **não** entram no mesmo PR.
- Se `EditPlan` mudar, criar fixtures v6/v7 conforme schema atual, migrar `SavedProject.format=2` somente se formato externo exigir, testar restore de versões, e não descartar arquivos OPFS.
- Instrumentar contagem de render apenas durante medição; nenhuma telemetria remota.
