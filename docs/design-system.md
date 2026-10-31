# Sistema visual da interface (v0.10)

Contrato visual do app (não do vídeo: o visual do vídeo é o StyleDNA, ver [ADR-0008](decisions/0008-styledna-e-cenas.md)). Decisão e referências no [ADR-0015](decisions/0015-novo-visual.md). Código: `src/app/theme.css` (tokens e primitivos) e `src/app/app.css` (telas e componentes).

## Regras
- Componente não usa valor solto de cor, espaço, raio, sombra ou tempo: usa o token.
- Tema escuro é o padrão (editor de vídeo; o vídeo se destaca). Tema claro é opcional (botão sol/lua), lembrado em `localStorage` (`m4f-tema`).
- Amarelo da marca só para a ação principal (Exportar, Aplicar, Assistir), seleção e foco. Azul = trecho ajustado; roxo = travado; verde = mantido/ok; vermelho = cortado/erro; âmbar = aviso.
- Todo erro ou aviso visível é uma caixa `ErrorBox` com código M4F, título, "Detalhes técnicos" e "Copiar detalhes".
- Ícones: Lucide (traço 1,75–2 px), 16–20 px; botão só com ícone tem `aria-label` e dica (`data-tip`).

## Tokens
| Grupo | Tokens | Valores (escuro) |
|---|---|---|
| Superfícies | `--bg-0` fundo · `--bg-1` painéis · `--bg-2` cartões · `--bg-3` campo/hover · `--bg-4` destaque · `--stage` palco | #0a0b0e · #111217 · #171920 · #1f222b · #2a2e39 · #07080a |
| Linhas | `--line`, `--line-strong` | #262933, #363a47 |
| Texto | `--text-1` principal · `--text-2` secundário · `--text-3` apoio | #eceef2 · #a6abb8 · #868b9c (contraste ≥ 4,5:1 sobre `--bg-1`, `--bg-2` e `--bg-3`) |
| Marca | `--brand`, `--brand-hover`, `--brand-ink`, `--brand-soft` | #ffd400, #ffe24d, #14130a |
| Semânticas | `--blue`, `--violet`, `--green`, `--red`, `--amber` (+ `-soft`) | ajustadas por tema |
| Foco | `--focus` | amarelo (escuro), azul (claro); anel de 2 px com 2 px de folga |
| Espaço | `--s-1`…`--s-8` | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Raio | `--r-xs`…`--r-xl`, `--r-pill` | 4, 6, 10, 14, 20 px, 999 |
| Tipo | `--font` (Inter "M4F UI"), `--mono`; `--fs-2xs`…`--fs-2xl`, `--fs-display` | 11, 12, 13, 14, 16, 20, 28 px; título da primeira tela 34–60 px |
| Elevação | `--shadow-1`…`--shadow-3` | cartão, menu, diálogo |
| Movimento | `--ease`, `--dur-1`, `--dur-2` | curva de saída suave; 120 e 220 ms; `prefers-reduced-motion` reduz a ~0 |
| Editor | `--topbar-h`, `--rail-w`, `--panel-w`, `--insp-w`, `--timeline-h`, `--status-h` | 56, 76, 352 (400 ≥ 1680 px), 328 (360), 228 (252), 30 px |

## Primitivos
- **Botões**: padrão (superfície), `.primary` (amarelo), `.ghost` (sem borda), `.icon` (quadrado 34 px), `.sm`, `.lg`, `.danger`, `.link`; `aria-pressed="true"` = selecionado. Altura mínima 34 px (28 no `.sm`).
- **Campos**: fundo `--bg-0`, borda `--line-strong`, foco com borda e halo da cor de foco.
- **Chips** (`.chip`, filtros), **etiquetas** (`.tag`), **teclas** (`.kbd`), **cartões** (`.card`), **segmentado** (`.segmented`, Antes/Depois), **barra de progresso** (`.bar`), **spinner**, **dica** (`data-tip`, `data-tip-side="right"`).

## Layout
| Largura | Organização |
|---|---|
| ≥ 1280 px | Topo · trilho de abas + painel · prévia · Detalhes · linha do tempo em toda a largura · status. Tela inteira, sem rolagem da página; cada painel rola sozinho. |
| 900–1279 px | Igual, mas Detalhes desce para baixo da prévia (até 34% da altura). |
| < 900 px | Uma coluna com rolagem: topo fixo, prévia (até 62% da altura), linha do tempo, painel da aba, Detalhes, status. Abas numa barra fixa embaixo. Nunca rolagem para o lado. |

## Componentes de tela
`TopBar`, `Landing` / `Processing`, `TemplateGallery` + `TemplateThumb`, `Transcript`, `Timeline`, `BriefPanel` / `HookPanel`, `RangePanel`, `ChangesPanel` / `VersionsPanel` / `ReferencePicker`, `ErrorBox`.

## Como conferir
- `npm run fixture && CHROMIUM_PATH=… npx playwright test e2e/visual.spec.ts`: primeira tela, abas, transcrição, galeria, atalhos, exportar, tema e telas de 390, 768 e 1280 px sem rolagem lateral.
- Capturas de referência da v0.10 (1440×900, 1920×1080, 768×1024, 390×844): pasta `visual-v0.10/` dos arquivos do projeto.

## Identidade "estúdio de bolso" (v0.33, ADR-0035)
- Telas de entrada (início, perguntas iniciais, preparo, galeria, Clipes) usam a **paleta quente**: mesmos nomes de token, valores em marrom/creme, com grão leve (`src/app/landing.css`). O editor fica neutro.
- **Marca-texto** (`.lp-mark`): fundo amarelo atrás da palavra, texto `--brand-ink`. Gesto da marca, igual à palavra falada na legenda.
- **Letra à mão** (`--hand`, Caveat) só para notas curtas acima de títulos e anotações; **serifa itálica** (`--serif`, Instrument Serif) só para a parte suave do título e números dos passos.
- **Cartões** (`src/app/cards.css`): raio 16 px, degradê `--bg-2`→`--bg-1`, filete de luz, sombra macia, sobe 2 px no mouse; escolhido = borda amarela + brilho (`--card-picked`). Nada de fundo amarelado opaco na seleção.
