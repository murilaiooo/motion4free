# Matriz detalhada: duas gerações do OpenCut e o Motion4Free real

**Evidência:** cada afirmação importante aponta para arquivo específico; paths nesta página são relativos à raiz dos repositórios mencionados. `main` dos upstreams deve ser fixada por SHA antes do port. `T`: presente na árvore. `L`: conteúdo lido. `P`: anunciado/planejado, não funcionalidade confirmada.

## Baseline

| Critério | Motion4Free v0.22.1 | OpenCut Classic | Novo OpenCut |
|---|---|---|---|
| Runtime | Vite + React + TS + Canvas2D + Mediabunny | Next.js/React/TS + módulos Rust/WASM/wgpu em migração | Vite/React web + shell Rust GPUI em construção |
| Editor funcional no repositório | Sim, `src/app/Editor.tsx` / `EditTimeline.tsx` | Sim, `apps/web/src/app/editor/[project_id]/page.tsx` | Não: `apps/web/src/routes/editor.tsx` mostra “Coming soon” |
| Mesa de edição | CSS Grid em `src/app/app.css`: top + rail + panel + stage + inspector + timeline + status | 2 grupos `ResizablePanelGroup`, 3 painéis superiores + timeline | `apps/desktop/src/shell.rs` organiza Browser/Preview/Inspector/Timeline (painéis placeholder) |
| Persistência | Projetos OPFS, `SavedProject.format=2`, versões e histórico | `core/managers/project-manager.ts`, painel de projetos; funcionalidades não testadas | Não presumir |
| Histórico | Estados imutáveis e limite 100, `src/engine/history.ts` | CommandManager com `execute/undo/redo` | Não presumir |
| Timeline | Segmentos e 10 camadas virtuais; onda real, snap, trim/split/copy/paste | Pistas e controladores especializados, keyframe lanes, ripple, snap, bookmark | A área timeline no GPUI ainda é placeholder |
| Animações | StyleDNA e entrada/saída automáticas; não editor completo de curvas | Canais, retime/split, ease Bézier, seleção de keyframes, graph | Não presumir |
| Export | WebCodecs/Mediabunny, render compartilhado | `scene-exporter.ts` e pipeline heterogêneo | Não presumir |
| Servidor pago | Não requerido | upstream pode ter DB/Redis/dependências infra | proposta multiplaforma não prova custo zero |
| Licença root | MIT | MIT, repositório arquivado | MIT |

## Auditoria do que já temos no M4F (NÃO recriar)

`src/app/Editor.tsx`: `TabId` com modelos/texto/elementos/legendas/mídia/IA/cores/versões; `<TopBar>`; `<PreviewOverlay>`; `<FramingPanel>`; `<ElementInspector>`, `<SegmentInspector>`, `<RangePanel>`; `ViewSwitch` Edição/Original; safe zone simples para Reels; `<EditTimeline>`; `<ChangesPanel>`. `src/app/SidePanels.tsx`: cartões para texto/forma/emoji e ajustes de legenda. `src/app/EditTimeline.tsx`: zoom, snap, faixa de áudio real, legendas, trechos e camadas `0..9`, ações de split/copy/cut/paste/duplicate/delete. `src/app/PreviewOverlay.tsx`: seleção, arraste, resize e preview transitório antes do commit. `src/engine/history.ts`: undo/redo de estados. `src/core/schema.ts`: migração Zod `editPlanSchema`, `MAX_CLIPS=30`. `src/core/project.ts`: `PROJECT_FORMAT=2`. `src/media/export.ts`: single/multi export. `src/render/frame.ts`: desenho determinístico.

**Problema central da interface:** `Editor.tsx` ~1244 linhas integra lógica de manipulação, painel de ferramentas, viewer, inspector, timeline, export popover, seleção e atalhos; `app.css` fixa dimensões da `.ws` com variáveis `--rail-w`, `--panel-w`, `--insp-w` e `--timeline-h`, sem persistência de drag das divisórias. Não construir outro editor paralelo; extrair shells e preservar handlers existentes.

## Catálogo do Classic — 23 oportunidades

| # | Capacidade | Evidência principal | Situação do M4F | Estratégia | Risco |
|---|---|---|---|---|---|
| 01 | painel esquerda + preview + propriedades com resize | `app/editor/[project_id]/page.tsx`, `editor/panel-store.ts` (L) | existe fixo | adaptar layout e persistência | baixo |
| 02 | rail de ferramentas com ícones e tooltip | `panels/assets/tabbar.tsx`, `assets-panel-store.tsx` (L) | rail 8 abas | refinar rótulos, foco, colapso | baixo |
| 03 | browser de mídia grid/list, sort/filter, reveal | `panels/assets/views/assets.tsx` (L) | ClipList/OPFS | melhorar apresentação e descoberta, não importar backend | médio |
| 04 | inspector que muda por tipo de elemento | `panels/properties/index.tsx`, `registry.tsx` (L) | 4 inspectors condicionais | registry local leve e abas por tipo | baixo |
| 05 | ações independentes de botão e teclado | `actions/definitions.ts`, `timeline-toolbar.tsx` (L) | shortcuts locais | ActionRegistry sem duplicar comandos | médio |
| 06 | comandos reversíveis com seleção | `core/managers/commands.ts` (L) | snapshots no histórico | adaptar como fachada incremental | alto |
| 07 | seleção múltipla + box select | `selection/hooks/use-box-select.ts` (T) | single selection predominante | adicionar depois de ações/cmd | médio |
| 08 | timecode racional 120000 ticks/s | `rust/crates/time/*` (L) | segundos fracionários | adapter TS + migração segura | alto |
| 09 | timeline com zoom/track header/expand | `timeline/components/index.tsx`, `expanded-layout.ts` (L) | tracks com altura fixa | row geometry, scroll sync | alto |
| 10 | snap entre clips, playhead e bookmarks | `timeline/snapping/resolve.ts` (L) | snap básico | fontes de snap com prioridade | médio |
| 11 | ripple editing isolado | `core/managers/commands.ts`, `ripple/` (L+T) | cortes/remontagem sem modo explícito | comando opt-in somente após testes | alto |
| 12 | keyframes por propriedade | `animation/keyframes.ts` (L) | motions automáticas | canais por propriedade animável | alto |
| 13 | lanes + graph Bézier/curvas | `timeline/components/graph-editor/*` (L+T) | inexistente | editor de curvas opt-in | alto |
| 14 | transform na preview + overlay separado | `preview/components/index.tsx`, `transform-handles.tsx` (L+T) | já arrasta e faz resize | polir interação, multi-selection futuro | médio |
| 15 | masks shape + feather + stroke | `masks/registry.ts`, `masks/snap.ts` (L) | shapes, mas não masks reais | introduzir mask no schema vNext | alto |
| 16 | efeito como registro tipado | `effects/registry.ts`, `effects/definitions/blur.ts` (T) | efeitos procedurais | registry TS, validar render export | médio |
| 17 | compositor/effects GPU | `rust/crates/compositor`, `docs/effects-renderer.md` (T+L) | Canvas2D | spike e fallback antes de dependência | muito alto |
| 18 | guias de composição | `guides/registry.tsx`, `platforms.tsx` (L) | safe zone Reels simples | múltiplas plataformas, overlay UI-only | baixo |
| 19 | bookmarks/notes/cores | `timeline/bookmarks/components/bookmarks.tsx` (L) | ranges editáveis | marcador de produção não destrutivo | médio |
| 20 | controle de velocidade/pitch | `speed/components/speed-tab.tsx` (L) | aparar segmentos/zoom, velocidade não equivalente | engine retime por segmento depois de timing | alto |
| 21 | audio gain/limiter/volume visual | `media/audio-mastering.ts`, `timeline/components/audio-volume-line.tsx` (L+T) | waveform e voz | multitrack/gain/duck/limiter | alto |
| 22 | import SRT/ASS | `subtitles/parse.ts`, `subtitles/srt.ts`, `subtitles/ass.ts` (L+T) | legendas ASR editáveis | import externo + edição não destrutiva | médio |
| 23 | graphics/stickers/text, backgrounds e fontes | `graphics/`, `stickers/`, `text/`, `background/` (T+L) | texto/forma/emoji/StyleDNA | enriquecer propriedades e catálogo seguro | médio |

### Confirmado incompleto no upstream

- `apps/web/src/components/editor/panels/assets/index.tsx`: abas `transitions` e `adjustment` são somente placeholders; nunca marcar "importado do OpenCut".
- `apps/web/src/guides/definitions/platforms.tsx`: só `tiktok` usa `TikTokLayout`; Reels/Shorts/Spotlight têm `renderOverlay: () => null`.
- `apps/web/src/components/editor/panels/properties/index.tsx`: seleção múltipla apresenta apenas aviso com contagem, não um inspector multi-edit completo; não presumir essa capacidade.
- Alguns docs Classic (`docs/actions.md`, `docs/keyframes.md`, `docs/effects-renderer.md`) têm paths históricos; usar código atual como verdade.
- README do rewrite lista Editor API, plugins, MCP, headless e scripting em **What's coming**; não usar como confirmação de entrega.

## O que não portar e por quê

- Não adotar Next.js, GPUI, Bun, Zustand, Rust, wgpu, monorepo/moon só para ter design parecido. Nossos requisitos são browser-first, custo obrigatório zero e manutenção incremental; o ganho visual vem de CSS/React existentes.
- Não importar backend, login, assets, fontes externas, API de sounds ou analytics sem necessidade e análise de privacidade.
- Não usar WASM/GPU do Classic como substituto imediato de `drawFrame`; risco de divergência preview/export, codecs e devices.
- Não reconstruir legendas, clipping longo, formatos ou gerenciamento de versões já entregues em v0.22.1.

## Ordem de valor

**P0 usuário:** workbench, painel contextual, rail/tool finder, timeline visual, responsive e teclado. **P1 criação:** keyframes, curva, masks, guides, assets e captions. **P2 motor:** timebase rational, typed commands, audio/retime, GPU com fallback. Dependências técnicas prevalecem sobre ordem visual para features que mutam tempo e schema.

**Critérios de término:** o botão faz algo real; preview ≡ MP4; abre projeto antigo; undo/redo íntegro; render local sem upload; modo escuro/claro; teclado/foco; mobile/viewport sem corte; testes e licença.
