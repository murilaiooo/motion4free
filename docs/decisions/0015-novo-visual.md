# ADR-0015 — Novo visual: editor em tela cheia, design tokens e legendas em parágrafo (v0.10.0)

**Data:** 2026-10-20
**Status:** ACEITA. Só a camada `src/app` (interface) muda; motor, plano, renderização e exportação continuam os do [ADR-0005](0005-stack-v1.md) a [ADR-0012](0012-sistema-de-movimento.md). Dependência nova: `lucide-react` (ícones, ISC). Sistema visual em [design-system.md](../design-system.md).

## Contexto
Feedback do responsável sobre a v0.7 (captura em `feedback/v0.7-tela-atual.png`): "Precisamos urgente refatorar todo esse frontend. Design e layout de hoje tá muito pobre, longe de ser algo profissional. Aproveite os espaços da tela." A tela era uma coluna estreita (640 px) no meio de uma página escura: prévia pequena, painéis empilhados e as 440 legendas de um vídeo de 2 min e meio em 440 linhas, uma embaixo da outra.

## Referências estudadas
Editores de vídeo no navegador e de legendas para vídeos curtos: **CapCut (web)**, **Descript**, **Submagic**, **Captions**, **VEED** e **Canva (vídeo)**. Delas vieram só ideias de organização e interação (nenhum asset, logo, nome ou código):
- *CapCut / VEED / Canva*: trilho de ferramentas à esquerda com um painel ao lado, prévia grande no centro, painel de propriedades à direita, linha do tempo com faixas em toda a largura embaixo, botão "Exportar" destacado no canto superior direito.
- *Descript*: a transcrição é a superfície de edição — o texto corre como um parágrafo, clicar numa palavra leva o player até ela, trechos cortados aparecem riscados, a palavra falada acende durante a reprodução.
- *Submagic / Captions*: galeria de modelos de legenda com prévia de verdade e etiquetas, fluxo "soltar o vídeo → processar com passos → ajustar".

## Decisão
1. **Três estados de tela**: *primeira tela* (promessa, área de soltar/escolher o vídeo, nota de privacidade, exemplos de modelos desenhados com a mesma `drawFrame` do vídeo final), *processamento* (cartão com 4 passos — abrir, cortar silêncios, transcrever, montar — derivados das mensagens de progresso por uma função pura `processingStep`, com porcentagem geral) e *editor*.
2. **Editor em grade de tela cheia (≥ 1280 px)**: barra do topo (marca, nome do projeto, estado de salvamento, desfazer/refazer, trocar vídeo, tema, **Exportar**); trilho de **7 abas** (Modelos, Pedido, Legendas, Gancho, Trechos, Versões, Cores) com painel de 352–400 px; prévia 9:16 no centro, do maior tamanho que couber (unidades de container `cqw/cqh`), com transporte, barra de posição e **área segura do Reels** (calculada de `reelsSafeArea`, a mesma regra do motor); painel **Detalhes** à direita (corte ou trecho selecionado + "O que mudou" com Antes/Depois sempre visível); **linha do tempo** em toda a largura com régua clicável/arrastável, faixas Vídeo/Legendas/Trechos, agulha e **zoom** (1× a 16×, Ctrl+roda); barra de status com versão·commit, atalhos e lembrete de privacidade. Entre 900 e 1279 px, Detalhes desce para baixo da prévia. Abaixo de 900 px (tablet e celular), uma coluna: prévia, linha do tempo, painel da aba e Detalhes, com as abas fixas numa barra embaixo (estilo app de celular); tocar numa aba rola até o painel.
3. **Painéis montados e escondidos** (`hidden`), não desmontados: um pedido sendo escrito ou uma escolha de IA não se perdem ao trocar de aba. Abas com `role="tablist"`/`tab`/`tabpanel`, setas do teclado, Home/End.
4. **Legendas em parágrafo** (`src/editorial/transcript.ts`, puro e testado): palavras na ordem da fala agrupadas por legenda; palavras que caíram num corte entram riscadas entre elas; legenda corrigida usa o texto novo com tempo distribuído pelo tamanho das palavras; `activeToken` dá a palavra falada; `paginate` divide vídeos longos em páginas de 80 legendas (a parte cortada fica com a legenda seguinte). Clicar numa palavra leva a prévia até ela e abre a legenda para corrigir ali mesmo (Enter confirma, Esc cancela). O destaque da palavra falada é aplicado direto no DOM (atributo `data-active`) para não redesenhar o parágrafo a cada quadro; a página acompanha a fala.
5. **Galeria de modelos por adaptador** (`src/core/template-gallery.ts`): a tela só conhece `TemplateInfo` (id, nome, descrição, etiquetas, estilo). Hoje vem da lista de estilos; quando o registro de modelos existir, só o adaptador muda. Cartões com quadro real (`TemplateThumb` → `renderShot` → `drawFrame`), animados ao passar o mouse/focar, filtro por etiqueta, selecionado marcado com borda e selo.
6. **Design tokens em CSS puro** (`src/app/theme.css`): cores semânticas para tema escuro (padrão) e claro (opcional, lembrado no navegador), espaço base 4, raios, escala de tipo, elevação e tempos de animação; `prefers-reduced-motion` respeitado. Fonte da interface: **Inter** (OFL) do pacote `@fontsource/inter` que o app já usava nos vídeos, registrada como família própria ("M4F UI") para não interferir no motor. Sem framework de UI, sem CSS-in-JS.
7. **Ícones**: `lucide-react@1.49.0` (ISC), importados um a um (tree-shaking; só os usados entram no bundle).
8. **Atalhos**: Espaço toca/pausa (fora de campos e botões), J/L voltam/avançam 1 s, K pausa, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y. Dicas (tooltips) em CSS nos botões de ícone.
9. **Nada some**: todos os fluxos e todos os códigos M4F continuam, com o botão "Copiar detalhes"; versão e commit continuam visíveis (rodapé na primeira tela, barra de status no editor). Seletores de teste existentes mantidos; testes de ponta a ponta passam a abrir a aba certa antes de agir (helper `e2e/ui.ts`).

## Alternativas descartadas
- **Biblioteca de componentes/framework de CSS** (Tailwind, shadcn, MUI, Chakra): o ADR-0005 fixa Vite + React + CSS simples; tokens em variáveis CSS dão o mesmo contrato sem build extra nem dependência grande.
- **Lista virtualizada por linha** para as legendas: resolveria o tamanho, mas manteria o formato de formulário; o parágrafo paginado é a interação esperada (Descript) e 80 legendas por página não pesam.
- **Desmontar o painel da aba escondida**: mais leve, mas perderia texto digitado e estado da IA.
- **Inspector sempre com as legendas**: duplicaria os campos (dois `caption-input`), confunde quem testa e os testes.

## Consequências
- Quadros de referência da galeria (`e2e/estilos.spec.ts-snapshots`) regenerados: a página `?galeria` ganhou o novo cabeçalho e as miniaturas caíram 0,5 px mais acima/abaixo (285↔286 px de altura); o conteúdo foi conferido (Neon e Documental idênticos; Pop e Editorial diferem 2–6% só pela reamostragem da meia linha).
- `StylePicker.tsx` saiu (substituído por `Templates.tsx`); os textos dos estilos foram para o adaptador.
- A tela de processamento mostra "Montando a edição" (novo passo em `pipeline.ts`).
- Build de teste aceita `?asr=demo` (fala mais longa) para capturas de tela.
