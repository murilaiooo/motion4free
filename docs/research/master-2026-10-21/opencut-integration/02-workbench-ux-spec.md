# UX SPEC: mesa de edição Motion4Free Master, inspirada em Classic + Rewrite

## Princípio

Uma tela profissional deve **priorizar o vídeo e a timeline**, não o painel de configurações. A escolha feita pelo usuário altera o Inspector e não abre novos blocos sem contexto. Reter identificação de projeto/guardar/exportar sempre visíveis; somente visual muda na primeira migração. Referências principais: Classic `apps/web/src/app/editor/[project_id]/page.tsx` (grupos aninhados resizable), `panels/assets/index.tsx` (rail + biblioteca), `panels/properties/index.tsx` (tabs contextuais), `timeline/components/*` (toolbar/ruler/lane); Rewrite `apps/desktop/src/shell.rs`, `components/resizable.rs` e `theme.rs` (shell semântico).

## Wireframe alvo em monitor desktop (não pixel-perfect do upstream)

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Motion4Free  | Projeto ▾ | Salvo localmente  | ↶ ↷  | Layout ▾ | Ajuda | EXPORTAR │
├────┬────────────────────┬───────────────────────────────────┬──────────────────────┤
│    │ BIBLIOTECA         │        PRÉVIA / CANVAS           │ PROPRIEDADES          │
│ M  │ Buscar/Filtrar     │ [9:16]  Área segura ▾   Zoom ▾   │ Objeto selecionado    │
│ T  │                    │                                   │ Transformar | Estilo  │
│ L  │ Arquivos/Fontes    │           ░░ VÍDEO ░░             │ Movimento | Áudio    │
│ E  │ Modelos/Textos     │                                   │ controles agrupados   │
│ G  │ Áudio/Legendas     │    ⏮  ▶  ⏭  00:00:04:12         │ aplicar / desfazer    │
│ I  │ IA / Cores         │                                   │                      │
│ A  │                    │                                   │                      │
├────┴────────────────────┴───────────────────────────────────┴──────────────────────┤
│ TIMELINE: Edição | Original | selecionar | dividir | excluir | ímã | zoom ▾       │
│ marcadores      ♦gancho        ♦batida          ♦cta                                │
│ elemento 9      ◇ título      ◇                  camadas com scroll                 │
│ legenda         [palavras / estilo]                                                    │
│ vídeo principal [clip A              ][clip B      ]                                    │
│ áudio voz       ~~~~~──~~~~~──~~~~                                                    │
│ trilhas extras  [ música ] [ efeitos ]  (futuro, conforme engine)                      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Layout normal

1. **Topbar** compacto 52–58 px: projeto, salvamento, undo/redo, preset de layout, tema/atalhos por menu, Exportar como ação primária. Nada de dados repetitivos ocupando a prévia.
2. **Rail** 56–64 px: ícones com rótulo curto via tooltip e `aria-label`. Abas atuais do M4F, sem perder ID; categorias em sequência de uso: Mídia, Modelos, Texto, Elementos, Legendas, IA, Cores, Versões. Opcionalmente agrupar "Mais" quando faltar altura; não esconder ação silenciosamente.
3. **Biblioteca** 22–27% do espaço superior ou 280–340 px. Busca e cards para importar, modelos, presets, arquivo/elemento, versões. Abas com scroll próprio. Pode colapsar por atalho ou botão; reabrir último contexto.
4. **Stage central** ocupa resto (objetivo ≥43% dos 3 painéis quando há espaço). Preview mantém aspect ratio 9:16 / 4:5 / 1:1 / 16:9 e *nunca* corta controles. Controles de transporte junto ao canvas; zoom independente do zoom da timeline. Status de erro em faixa compacta e expandível; nunca sobrepor legendas.
5. **Inspector direito** 270–340 px ou ~23–27%. Conteúdo muda pela seleção: sem seleção = instrução curta + configuração de canvas; vídeo = Trim/Zoom/Áudio/Velocidade (quando implementado); texto = conteúdo/tipo/posição/cores/animação; caption = tipografia/tempo; range = pedido de IA; projeto = output/formato. Tabs contextuais preservam o último por `type` somente em estado de UI.
6. **Timeline inferior** default ~38–44% da área abaixo da topbar. Resizable para ~22–68% da área de trabalho. Scroll horizontal da régua sincronizado com lanes, scroll vertical independente nas pistas. Cabeçalho de faixas sempre visível. ViewSwitch Edição/Original preservado, com rótulos claros.
7. **Statusbar** compacta (24 px) ou status popover para atalhos; versão/commit e "processado no aparelho" verdadeiros permanecem acessíveis.

### Interações do layout

- Divisórias esquerda / direita / horizontal com handle ≥6 px visual e alvo pointer ≥12 px. Cursor `col-resize` / `row-resize`; duplo clique reseta; teclado `←/→` ou `↑/↓` ajusta 2–5%; `Home` e `End` aos limites; `aria-valuenow`, `aria-valuemin`, `aria-valuemax` em separador focável.
- Largura clamped por espaço disponível, nunca `display:none` no canvas por resize acidental. Gravar mudanças após `pointerup`, não no movimento a cada pixel. Se janela mudar, clamp antes de layout para não sumir biblioteca/inspector.
- `Restaurar layout` em menu dedicado; layouts `Editar`, `Animar`, `Finalizar` opcionais depois do MVP. Preset apenas altera divisões e tabs, não `EditPlan` nem render.
- Foco: atalhos globais de edição não disparam quando `input`, `textarea`, `contenteditable`, `dialog`, composição IME ou menus estão ativos; hotkey Espaço só toca quando o editor está em foco apropriado. Atalhos novos seguem registry, não múltiplos listeners concorrentes.
- Duas scrollbars: biblioteca e inspector roláveis separadamente, régua/lanes sincronizadas. Não rolar janela inteira por engano.
- seleção em preview e timeline compartilham uma fonte de verdade e refletem estado na outra; clique no vazio pode deselecionar, mas não deve pausar/cancelar drag erroneamente.
- Durante exportação, garantir acessibilidade e mostrar progresso sem travar informações de projeto/erro.

### Estágios responsivos (são metas, não medições de screenshots reais)

| viewport | estrutura | prioridade |
|---|---|---|
| ≥1600 px | rail + biblioteca 320–400 + preview flexível + inspector 300–380, timeline 40% | edição confortável |
| 1280–1599 px | rail + biblioteca 280–340 + preview flexível + inspector 260–320 | preview central suficiente |
| 1024–1279 px | biblioteca colapsável; inspector drawer ao selecionar; timeline altura 38–45% | não comprimir vídeo |
| 768–1023 px | stage principal, ferramentas em drawer, inspector overlay/drawer, timeline compacta | permitir função essencial |
| <768 px | visualização/importação básica ou UI compacta explícita; não afirmar NLE completo sem testes | controles acessíveis sem overflow |

Não inventar mobile editor pronto nem copiar `MobileGate` do Classic; M4F prioriza browser sem instalação, mas o suporte a edição móvel depende de implementação/teste separado.

### Visual profissional sem copiar marca

Manter `src/app/theme.css` como tokens únicos e `src/app/app.css` como stylesheet do workspace, usando nomes semânticos existentes. A inspiração no tema GPUI do rewrite são papéis (background/surface/text/muted/border/ring), **não** copiar cores absolutas. Reduzir cartões decorativos/bordas redundantes; bordas apenas delimitam regiões e seleções. Altura de toolbar 36–44; controles de edição reais clicáveis com target ~36x36 mínimo, tooltips e contraste WCAG AA para texto essencial. Estado ativo pelo foco, fundo e ícone, nunca só cor. Fonts locais já presentes; não adicionar packs remotos.

### Inspeção contextual: matriz

| Seleção atual | Cabeçalho direito | Abas de primeiro estágio | Abas futuras |
|---|---|---|---|
| nenhuma | Propriedades do projeto | Canvas / Proporção / Fundo | Estatísticas |
| segmento | Clipe N | Corte / Enquadramento / Posição | Velocidade / Áudio / Efeitos |
| added text | Texto | Conteúdo / Estilo / Transformação | Animação / Máscara |
| shape/emoji | Elemento | Propriedades / Transformação | Máscara / Animação |
| legenda/palavra | Legenda | Texto / Estilo / Posição | Curvas / Tracking |
| recorte | Corte removido | Restaurar / Limites | — |
| range IA | Trecho selecionado | Pedido / Aplicar / Desfazer | Sugestões |
| várias seleções | Múltiplos elementos | operações comuns habilitadas | edição em lote (não declarar pronta) |

**Resolver seleção primeiro:** `selectedEl` vs `selectedSeg` vs `selectedCut` vs `activeSelection` não podem produzir inspector trocando aleatoriamente; definir precedência explícita e callbacks de seleção. Exceção: quando tudo nulo, canvas.

## Gate visual antes de lógica nova

O primeiro PR reorganiza somente JSX/CSS e estado de layout. Critérios: mesmas `data-testid`, nada perdido nas 8 abas, `EditTimeline` e player intactos, nenhum diff em `core/schema.ts`, `render/frame.ts`, `media/export.ts`. Validar por screenshots 1920x1080, 1366x768, 1024x768, tema dark/light, zoom navegador 125/200%, foco teclado e arraste. Não implementar dezenas de features enquanto ajusta a UI.
