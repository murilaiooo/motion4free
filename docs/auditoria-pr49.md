# Auditoria PR #49 — Revisão Independente

**Data:** 2026-10-20  
**Branch:** `arena/16b888d0-motion4free` → `main`  
**Commits auditados:** `7bbe723`, `7e651b0`, `776d7a8`  
**Status PR:** `pr_open` (não mergear até verificação completa)

## 1. Diferença real vs `main`

```
11 arquivos, 768 + 603 adições, 130 remoções
src/app/App.tsx, ClipList.tsx, Editor.tsx, PreviewOverlay.tsx, FormatSelector.tsx, Landing.tsx
src/editorial/interpret.ts, src/media/multi.ts, player.ts, export.ts, core/project-library.ts
tests/corpus.test.ts, interpret.test.ts, holdout.test.ts, e2e-multi.test.ts
```

## 2. Componentes introduzidos e uso real

| Componente | Criado | Usado em workflow? | Defeito crítico | Status pós-correção |
|---|---|---|---|---|
| `ClipList.tsx` | 70L | **Não** — nunca importado (desconectado) | UI multi sem controle de ordem | **Corrigido** em `776d7a8`: integrado no `Editor` quando `plan.clips>1` |
| `PreviewOverlay.tsx` | 396L | Sim, mas com `fake measurer` errado | Hit-test impreciso, boxes desalinhados em HiDPI | **Corrigido**: measurer com canvas real + `letterSpacing` |
| `FormatSelector.tsx` | 56L | Sim, mas só no `empty-insp` | Formato não acessível quando elemento selecionado | **Parcial**: ainda só no empty, mover para inspector global pendente |
| `src/media/multi.ts` | 81L | Sim, mas stub (words/silences vazios, sem áudio, sem transcrição) | Multi sem legendas reais, sem áudio, sem estilo | **Parcial**: agora abre cada `Input` via `openMedia`, mas transcrição por clip ainda stub — documentado como limitação |
| `App.tsx` multi | 61L | Sim, mas salvava só `primary` via `storeCopy` | Perda de clipes 2..N ao salvar | **Corrigido**: `saveClipVideo` para cada `clipId` + fallback `video.bin` |
| `player.ts` / `export.ts` | reescrita | **Não usado** na versão inicial (Editor ainda chamava single `PlanPlayer`) | Preview/export mostravam só 1º clipe | **Corrigido**: `Editor` passa `clipSources` Map para `PlanPlayer` e `exportPlanMulti`; `ClipFrames` com `decodeSize`/`placeSource` sem crop prematuro |
| `project-library.ts` | +60L | Não carregava multi | `loadProject` retornava `video=null` sem `loadClipVideos` | **Corrigido**: `VIDEO_DIR`, `saveClipVideo`, `loadClipVideos` |

## 3. Contratos de tipo e transições React

- `Session` estendida com `clipSources?: Map<string,ClipSource>` — via `any` em `App.tsx` (frágil, mas tipado em `Editor.tsx`). Undo/redo via `pushHistory` preservado; `setElementPlacement` testado em `manual.test.ts` (5 casos).
- `PlanPlayer` construtor com 6º param opcional `clipSources` — mantém compatibilidade com single (`media` obrigatório). `setPlan` reconstrói layouts.
- `exportPlan` vs `exportPlanMulti`: duplicação mantida para não quebrar Worker; `exportInBackground` ainda single-only — limitação conhecida.

## 4. Testes

- Total anterior: 1.362 testes, 51 arquivos. Após correções: **1.376 testes, 53 arquivos** (+2 novos: `holdout`, `e2e-multi`; +14 casos).
- `corpus.test.ts` threshold 0,4→0,9: 349/363 (96,1%) — verificado.
- `interpret.test.ts` 2 legados alterados:
  - `vídeo para vender meu curso, chamativo`: `ignored: ['curso']` → `[]` — **justificado**: `curso` agora é nicho `educacao` (words: `curso|aula|...`), antes era `ignored` por falha de `findNiche`. Novo comportamento correto.
  - `vídeo motivacional` goal `inspirar`: antes null (tone inexistente), agora `tone inspirador` + `goal inspirar` — **justificado**: `motivacional` mapeado para ambos, antes sem entrada.
- Nenhum teste enfraquecido; apenas expectativas incorretas atualizadas.

## 5. Por que 1.362 testes não provam novas features

- 1.362 são unitários puros (engine, editorial, render). Nenhum cobre fluxo `import → preview → reorder → save → export → ffprobe`.
- Novos `e2e-multi` cobrem pipeline puro + persistência (sem decodificação real) e `holdout` 16 casos (75%). Ainda falta E2E com mídia real via `ffmpeg/ffprobe` e browser automation — marcado como **Implementado mas não verificado em mídia real**.

## 6. Estado por categoria (exigência do solicitante)

- **Completo e verificado (com evidência):** Interpretação 96,1% corpus + 75% holdout; manual overlay hit-test/drag/snap/preview=export (testes `manual`, `render-math`); formatos 4 outputs com `framing.test.ts` (placeSource sem stretch, safeArea).
- **Implementado mas não verificado em mídia real:** Multi-clip preview/export com `ClipFrames` (código existe, `e2e-multi` passa em pipeline puro, mas sem `ffprobe` em MP4 real).
- **Parcialmente implementado:** Multi-ClipList reordenação (UI existe, mas `onAdd` vazio); áudio multi (decode por clip não combinado); Timeline marcadores de emenda ausentes; `FormatSelector` não persistido em todos os estados.
- **Não implementado:** E2E browser + `ffmpeg` real; worker multi-clip; modelo de transcrição por clip.
- **Bloqueado:** Nenhum; todas as integrações críticas têm caminho técnico.

## 7. Recomendação

Manter PR #49 aberto até:
1. E2E real com 2 vídeos sintéticos (gerados via `CanvasSource`+`Output`) → export → `ffprobe` valida duração/dimensões/ordem.
2. `ClipList.onAdd` e `Timeline` com junções visíveis.
3. `FormatSelector` sempre visível e persistido em `project`.

Próximos PRs focados: `multi-audio`, `timeline-juncoes`, `e2e-real-media`.

