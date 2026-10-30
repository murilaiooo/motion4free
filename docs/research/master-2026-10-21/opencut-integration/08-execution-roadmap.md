# Plano executável e anti-loop: integração OpenCut em PRs independentes

**Produto atual:** Motion4Free v0.22.1; repetir leitura de `package.json`/main no início de cada sessão. **Estado abaixo:** TODAS AS TAREFAS PROPOSTAS (sem código entregue por este PR). `OCU-*` é decomposição do backlog `MASTER-*`; **não** abrir a mesma tarefa duas vezes. Trabalhar uma por vez, máximo 1 domínio por PR. Sempre consultar `AGENTS.md`, decisões e PRs em aberto.

## Wave A — mesa profissional, baixo risco, alto valor

| ID | PR isolado: fazer | Código M4F | Depende | Gate de aceite |
|---|---|---|---|---|
| OCU-01 | shell resizable top/3 painéis/timeline, layout seguro | `app/Editor.tsx`, `app.css`, `app/workbench/*` novo | nenhum | mesmos testids/controls, split, play, reload; não tocar schema/export |
| OCU-02 | persist layout/reset/collapse/mobile drawer/acessibilidade | `app/workbench/*`, `theme.css` | 01 | viewport 1024/1366/1920, zoom, keyboard, focus, reload sem pane sumir |
| OCU-03 | biblioteca tool rail + mídia grid/list/filtrar | `SidePanels.tsx`, `ClipList.tsx`, `workbench/*` | 01 | todas 8 abas e import existentes, sem reordenar clips ao ordenar assets |
| OCU-04 | inspector contextual e propriedades reagrupadas | `Editor.tsx`, `FramingPanel.tsx`, `workbench/InspectorPane.tsx` | 01 | edit fields iguais; seleção reflect canvas/timeline; no data loss |
| OCU-05 | timeline polish: pistas legíveis, toolbar, sticky ruler, zoom | `EditTimeline.tsx`, `app.css`, `engine/timeline-geometry.ts` | 01 | onda real, 10 layers, vídeo/legenda e range legíveis em zoom/resize |
| OCU-06 | seleção compartilhada e cancelamentos | `Editor.tsx`, `PreviewOverlay.tsx`, `editorial/editor-selection.ts` | 04/05 | uma seleção, inspector certo, ESC/pointercancel, drag uma vez |
| OCU-07 | action registry + command facade incremental | `app/Editor.tsx`, `engine/history.ts`, `editorial/actions.ts` | 06 | atalhos não disparam em input, Ctrl+Z/redo e seleção consistentes |

**Gate A:** usuário consegue importar, manipular, aplicar IA, abrir versões, exportar, e controlar a mesa redimensionada sem regressões. Sem feature fake.

## Wave B — recursos criativos com render real

| ID | PR isolado: fazer | Código M4F | Depende | Gate de aceite |
|---|---|---|---|---|
| OCU-08 | adapter timebase ticks/rational frame rate (MASTER-01) | `engine/media-time.ts`, `engine/timeline.ts`, tests | 07 | 23.976/29.97/59.94, conversões roundtrip, projeto legado preservado |
| OCU-09 | snap por fontes/zoom (MASTER-09) | `engine/timeline-geometry.ts`, `EditTimeline.tsx` | 08 | Shift bypass, no drift, zoom 1x/64x |
| OCU-10 | ripple opt-in seguro e seleção múltipla — **separar em dois PRs se ambos tocarem domínio diferente** | `editorial/clip-ops.ts`, `core/schema.ts`, `engine/timeline.ts` | 08/07 | no negative/gap, locked ranges, 30 clips, undo |
| OCU-11 | bookmarks locais com labels e cores (MASTER-09) | `core/edits.ts`, `core/schema.ts`, `EditTimeline.tsx` | 08 | schema versionado, snapping/seek/reload; marcador não entra MP4 |
| OCU-12 | transform controls e preview handles melhorados | `PreviewOverlay.tsx`, `render/hit.ts`, inspector | 04/07 | 1 gesture=1 undo, scale/rotation clamped, MP4 igual |
| OCU-13 | keyframe schema/model/renderer (MASTER-07) | `core/edits.ts`, `core/schema.ts`, `render/added.ts`, `render/frame.ts` | 08/07 | interpolation/undo/trim/reload, pixel parity |
| OCU-14 | sub-lanes + Bézier editor (MASTER-07) | `EditTimeline.tsx`, `app/workbench/*`, `animation/*` | 13 | arrastar diamond, preview curve, keyframe export igual |
| OCU-15 | rect/ellipse masks + feather (MASTER-23) | `core/edits.ts`, `render/added.ts`, `render/frame.ts`, inspector | 13/07 | clips/múltiplos objetos, feather sem vazar, MP4 |
| OCU-16 | star/heart/diamond/split/freeform mask, em PRs subdivididos | `render/masks/*`, inspector | 15 | cada shape testado em formato/export |
| OCU-17 | effects registry tipado + 1 efeito real (MASTER-24) | `render/effects/*`, `core/schema.ts`, inspector | 13/15 | enable/disable/reorder + export parity |
| OCU-18 | backgrounds e presets de fill só onde não existem | `FramingPanel.tsx`, `render/frame.ts` | 04/17 | gradiente/blur no MP4 e formatos corretos |
| OCU-19 | safe zones multi-rede & grid (MASTER-22) | `app/Editor.tsx`, `app/workbench/GuideOverlay.tsx` | 01 | guia não exportado; safe zones ajustáveis |
| OCU-20 | textos/stickers/graphic library e parâmetros | `SidePanels.tsx`, `core/edits.ts`, `render/added.ts` | 04/17 | assets/fontes licenciados, offline, export correto |

**Gate B:** cada novo controle tem contrato de dados, canUndo, persistência, efeito visual real e arquivo MP4 validado. Não juntar todas as features em um PR.

## Wave C — motor e acabamento avançado

| ID | Fazer | Dependência | Gate |
|---|---|---|---|
| OCU-21 | protótipo GPU WebGPU/WASM opt-in (MASTER-24) | 17/08 | benchmarks e fallback CPU, sem custo/instalação |
| OCU-22 | arquivo de legenda SRT/ASS e projeto áudio multitrack — **separar obrigatoriamente em PR de subtitle e PR de audio** | 08/07/13 e export plan | import/export + vídeo com voz/música sem desync |
| OCU-23 futuro | velocidade 0.5–2 / pitch | 08/07/22 | re-time video+audio+caption igual preview/MP4 |
| OCU-24 futuro | API interna/plugins/IA estruturada/automação em partes | 07/13/03 | typed/validated/dry-run/approval/local-first, zero plugin remoto automático |

**Prioridade adicional independente:** `MASTER-03` preflight e `MASTER-04` preview/export parity devem ser resolvidos como fundação *antes* de mexer em export ou media. `MASTER-05` backup/portabilidade preserva reversibilidade. Não reabrir estas tarefas dentro de OCU sem verificar status.

## Dependency graph (essencial)

```text
01 shell -> 02 layout persistence -> 03 library
         -> 04 inspector -> 06 selection -> 07 commands -> 08 time
         -> 05 timeline -------------------> 09 snap
08 + 07 -> 13 keyframe/render -> 14 graph; 15 masks -> 16 advanced masks
13 + 15 -> 17 effects -> 18 background / 20 assets -> 21 GPU spike
01 -> 19 platform guides (paralelizável sem schema)
08 + export parity -> subtitle/audio; audio+time -> speed
07 + 13 -> future Editor API -> plugins/IA/headless only after ADR
```

## Modelo de entrega de cada tarefa para IA executora

1. `TASK ID`, baseline SHA, arquivos atuais já existentes, PRs em andamento e hipótese de lacuna real.
2. **Before changes:** uma prova de onde o comportamento atual mora (grep symbols/link file), 3–8 acceptance cases novos, nenhum teste repetido sem justificativa.
3. **Implementation:** alteração mínima, 1 domínio, sem instâncias concorrentes de estado.
4. **Evidence:** caminho do commit, lista de arquivos, qual caso passou/falhou, screenshot/MP4 real quando apropriado; se não rodou informar explicitamente.
5. **Compatibility:** projeto anterior carrega; Undo/Redo; OPFS sem apagar dados; `AGENTS.md` exige versão/changelog e códigos de erro novos na publicação.
6. **PR:** abrir pequeno PR, não mergear sem CI/gates necessários; se GitHub Actions quota acabou, registrar impedimento sem retry loop. Oferecer roteiro curto em PT-BR para usuário validar a aparência.
7. **Next:** registrar próxima task e blocker, sem dizer que "tudo concluído" se outra task está proposta.

## Não fazer

- Novo editor paralelo "OpenCut mode"; troca completa para Next.js ou Rust; copiar repositório inteiro; dependência de SaaS pago; ocultar UI behind placeholders; cobrar do usuário comandos técnicos; mexer nas configurações sensíveis do GitHub; apagar branches/snapshots; criar 22 PRs vazios.
- Não somar OCU IDs ao backlog MASTER como novas features quando representam a mesma coisa; use `MASTER-*` como épicos existentes, OCU como subtarefas executáveis.
