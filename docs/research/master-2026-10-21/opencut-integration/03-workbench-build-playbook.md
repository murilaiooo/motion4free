# Playbook de implementação: workbench UX sem reconstruir o editor

Leia `02-workbench-ux-spec.md`. Este documento descreve **como** implementar, não representa código já aplicado. M4F v0.22.1; atualizar mapeamento se main avançar.

## Mapa de arquivos e extração progressiva

| Origem M4F existente | Criar/extrair em PR pequeno | Regra de migração |
|---|---|---|
| `src/app/Editor.tsx`: JSX `.ws` e TopBar | `src/app/workbench/EditorWorkspace.tsx` | recebe slots `topbar`, `rail`, `library`, `stage`, `inspector`, `timeline`, `status`; não conhece `EditPlan` |
| `src/app/app.css`: `.ws`, `.stage`, `.tl-area` | `src/app/workbench/workbench.css` OU seções existentes no `app.css` | sem 2 fontes concorrentes de layout; manter testes IDs |
| `src/app/Editor.tsx`: state `tab` | `src/app/workbench/useWorkbenchLayout.ts` ou hook/React state | estado de UI, localStorage `m4f.workbench-layout.v1`, jamais OPFS |
| `src/app/Editor.tsx`: rail e painel com TABS | `src/app/workbench/ToolRail.tsx`, `LibraryPane.tsx` | exatamente 8 IDs existentes e conteúdo atual; nenhuma aba placeholder inventada |
| `src/app/Editor.tsx`: stage/viewer/transport | `src/app/workbench/PreviewPane.tsx` somente depois da extração sem regressões | manter `canvasRef`, `playerRef`, `PreviewOverlay`, `togglePlay` e callbacks sem recriar player |
| `src/app/Editor.tsx`: inspector condicional | `src/app/workbench/InspectorPane.tsx` | primeiro mover JSX sem alterar lógica; só depois criar registry contextual |
| `src/app/EditTimeline.tsx` | não extrair enquanto workbench inicia | componente atual é único, não clonar timeline |
| `src/app/TopBar.tsx` | reutilizar | versão, save, export, theme e undo continuam iguais |

### Fonte upstream exata

Classic `apps/web/src/app/editor/[project_id]/page.tsx`: grupo resizable vertical contendo três painéis horizontais; `apps/web/src/editor/panel-store.ts`: `PanelSizes`, persist versionada, migração/restore. Classic `apps/web/src/panels/layout.ts`: defaults `tools:25`, `preview:50`, `properties:25`, `mainContent:50`, `timeline:50`. Nosso layout pode escolher defaults diferentes pelos formatos verticais. Rewrite `apps/desktop/src/components/resizable.rs`: clamp, orientação vertical/horizontal, duplo clique reset. Não instalar `react-resizable-panels` só porque upstream usa; avaliar implementação leve local com pointer events vs dependência MIT compatível, baseada em teste e ADR.

## Contratos de UI (exemplo proposto, adaptar nomes depois de ler árvore atual)

```ts
type PaneId = 'library' | 'preview' | 'inspector' | 'timeline';
type WorkbenchPreset = 'edit' | 'animate' | 'finish';
interface WorkbenchLayoutV1 {
  version: 1;
  libraryPx: number;
  inspectorPx: number;
  timelineRatio: number; // 0.22..0.68 dentro da área de trabalho
  libraryCollapsed: boolean;
  inspectorCollapsed: boolean;
  activeTool: 'modelos'|'texto'|'elementos'|'legendas'|'midia'|'ia'|'cores'|'versoes';
}
interface EditorSelection {
  kind: 'none'|'segment'|'element'|'cut'|'range';
  id?: string;
}
```

**Importante:** `EditorSelection` é **somente apresentação** em PR inicial; use adapters para os `selectedEl`/`selectedSeg` já existentes. Não alterar contratos de `EditPlan` nem IDs de elementos, e não criar um segundo source-of-truth da seleção.

## Receita de layout, cada passo em um PR isolável

1. **Baseline e branch:** conferir `main`, versão, PRs abertos, `AGENTS.md`; criar branch `feature/workbench-01-shell` sobre main atual. Registrar screenshot do workspace atual e os seletores `data-testid` usados em E2E. Nunca partir da branch de documentação como branch de feature sem necessidade.
2. **Shell sem lógica:** `EditorWorkspace` recebe slots; preserve árvore de contexto do React (remontar canvas pode resetar player). Ajuste CSS grid com `minmax(0,1fr)`, `min-width:0`, `min-height:0`; mover `.ws` para wrapper, mantendo classes internas.
3. **Separadores 3 eixos:** `library/preview`, `preview/inspector`, `stage/timeline`. Eventos Pointer: `setPointerCapture`; `pointermove` usa preview CSS variável em estado leve; `pointerup` salva; `pointercancel` restaura; `lostpointercapture` finaliza/limpa. Ignorar seleção do vídeo durante drag. Usar `ResizeObserver` (com cleanup) e clamp com limites.
4. **Persistência e defaults:** localStorage com `try/catch`, validation `Number.isFinite`, limites absolutos/relativos, fallback para `defaults`. Gravar somente após fim do gesto; schema versionado independente do projeto. Testar dados inválidos e split-screen menor.
5. **Colapsar:** biblioteca e inspector por botão ou shortcut, sem desmontar o conteúdo que segura estados críticos; preferir CSS/hidden com cautela. Em viewport menor, drawer acessível com `role=dialog`/aria e Escape.
6. **Inspector contextual:** `resolveInspectorSelection` pure function priorizando `selectedEl` > `selectedSeg` > `selectedCut` > `activeSelection`; apresentar title/label com campos de controles já existentes. Mudar a seleção numa região atualiza o mesmo inspector.
7. **Refinar library/rail:** preservar `TABS` IDs, títulos, callbacks e testids; grupos com tooltips e rótulo; search/filters somente quando implementados de verdade. Nenhuma aba vazia "Em breve" no fluxo principal.
8. **Polimento visual:** mudar espaçamentos/tokens de `theme.css`, não CSS de vídeo nem canvas de export. Ver dark/light, focus-visible, reduced-motion, contraste.
9. **Gate:** rodar checks especificados em `10-qa-matrix.md`; zero alterações runtime em renderer/export/schema, comparar vídeo antes/depois apenas se editor tocar código desses subsistemas. Changelog + versão **quando publicar mudança runtime**, conforme `AGENTS.md`.

## Cálculo sugerido das dimensões

```ts
const MIN_PREVIEW = 360; // CSS px ideal para desktop, ajustar p/ viewport
const MIN_LIBRARY = 220;
const MIN_INSPECTOR = 240;
const MIN_TIMELINE_RATIO = .22;
const MAX_TIMELINE_RATIO = .68;
function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
```

**Cuidado:** se `viewport - rail - handles - library - inspector < MIN_PREVIEW`, colapsar biblioteca ou virar inspector em drawer, **não** permitir largura negativa/overflow. Em zoom 200% reavaliar layout como viewport estreito. Preview area deve manter `canvas.width/height` ligado ao render existente, nunca calcular dimensões do MP4 a partir do CSS de pane.

## Componente de separador: checklist

- `role="separator"`, `tabIndex=0`, `aria-orientation`, valores ARIA; `aria-label` localizado e screen reader feedback.
- Teclado horizontal + vertical com passos; `Home/End`; duplo clique reset; pointer/touch support; sem global mouse listeners remanescentes após unmount.
- Drag de separador bloqueia seleção/copy/cut de clipes; scroll/resizing não perde playhead; restaurar tamanho muda só UI.
- Persist não salva `File`, `Blob`, MediaStream, chaves nem texto de transcrição; não incluir `EditPlan`.
- Não usar inline style hardcoded para cores; CSS tokens do M4F.

## Riscos conhecidos

- **Remontagem de player:** JSX movido muda `key` e pode resetar `playerRef`; manter componente estável durante resize e troca de painel.
- **Separador vs timeline drag:** pointercapture e propagação podem disparar trim/cut; limitar hit targets.
- **Persistência:** `localStorage` indisponível, corrompido ou da versão antiga; fallback seguro sem perder documento.
- **Undo por UI:** mudança de painel NÃO entra no undo do conteúdo audiovisual.
- **Contextos múltiplos:** estado da ferramenta e seleção do clip não podem apagar props de prévia.
- **Layout em baixa altura:** altura timeline adaptável, export popover visível e footer não cobrindo viewport.
- **Performance:** não chamar `setPlan` em `pointermove` de painel; React render da timeline pesada só se dimensão efetivamente muda.

## Aceite do primeiro pacote visual

Mesmo vídeo, mesma duração, mesmos IDs, mesmos valores e MP4 antes/depois; split/trim/edit caption e undo/redo sem diferença; biblioteca, seleção, inspector, preview, timeline, export operacionais; estado UI resiste reload sem quebrar projetos; reset de layout funciona; sem overflow em 1366×768, 1920×1080 e 1024×768. `README` e notas do PR indicam “refactor UX only”.
