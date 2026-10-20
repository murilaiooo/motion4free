# Fase 3 — sistema de motion design: plano de implementação

> Formato Superpowers `writing-plans`, versão curta. TDD nas camadas puras (teste primeiro, ver falhar, implementar, ver passar, commitar).

**Objetivo:** o mesmo vídeo sai em 3 estilos claramente diferentes (tipografia, movimento, ritmo e layout, não só cor), com animações que acompanham o que é dito: número grande quando se fala um número, lista quando se enumera, destaque em palavras-chave, pergunta em destaque, transição nos cortes, barra de progresso e chamada final. Legendas maiores, em negrito e com a palavra falada em destaque.

**Spec:** [v1, "Como a qualidade criativa vai surgir"](../specs/2026-10-20-motion4free-v1-design.md) · **Plano mestre:** [Fase 3](2026-10-20-plano-mestre.md) · **Decisão:** [ADR-0008](../../decisions/0008-styledna-e-cenas.md) · **Stack:** [ADR-0005](../../decisions/0005-stack-v1.md) (única dependência nova: fontes `@fontsource/*`, OFL).

## Decisões
- **`StyleDNA` v1** (`src/core/style.ts`, zod): paleta, tipografia (display/texto/ênfase, caixa, espaçamento), movimento (entrada `rise|pop|wipe`, curva, durações, intensidade), ritmo (cenas por 10 s, intervalo mínimo, frequência de destaque e zoom), forma (cantos, traço, sombra, painel), layout (alinhamento, altura das cenas), legendas (posição, tamanho, caixa, palavras por legenda, tipo de destaque), transição de corte, barra de progresso, zoom e texto da chamada final. É **parametrico**: nenhuma cena pergunta "qual preset é este"; cada uma lê parâmetros. Fase 4 (IA) poderá gerar um StyleDNA validado sem código novo.
- **`EditPlan` v2**: ganha `style` (o StyleDNA inteiro, para o plano ser autossuficiente na exportação), `Caption.wordStarts` (início de cada palavra, para destacar a palavra falada) e cenas como união discriminada com parâmetros por tipo. `migratePlan` converte v1 → v2 (estilo padrão, `wordStarts` vazio = distribuição proporcional). Projetos salvos da Fase 2 abrem normalmente.
- **Cenas derivadas**: enquanto não houver edição manual de cenas, as cenas são recalculadas pelo seletor sempre que trechos ou estilo mudam (`withSegments`, `applyStyle`). Trocar de estilo também reagrupa as legendas (cada estilo tem seu tamanho de legenda), preservando textos corrigidos cujo grupo de palavras não mudou.
- **Seletor por regras** (`src/editorial/selector.ts`): números (algarismos, `%`, `R$`, números por extenso em português), enumerações (ordinais no início de frase ou em sequência, `1.`/`2)`), perguntas, apresentação ("meu nome é…"), palavras-chave (léxico de ênfase + tamanho + exclamação). Prioridade, limite de densidade e intervalo mínimo vêm do StyleDNA; nunca há duas cenas de sobreposição ao mesmo tempo; anti-repetição remove a segunda de duas cenas consecutivas do mesmo tipo com os mesmos parâmetros (zooms alternam a escala).
- **Render puro** (`src/render/`): `drawFrame(ctx, plan, t, source)` continua sendo a única função de desenho (prévia = MP4). Tipado contra `Ctx2D`, um subconjunto do Canvas 2D, para que os testes usem um contexto gravador em Node. Tudo depende só de `(plano, t)`: desenhar em qualquer ordem dá o mesmo quadro.
- **Fontes** OFL locais (`@fontsource/*` 5.3.0, só o subconjunto latino em woff2, ~20–40 KB cada), carregadas pela FontFace API antes de desenhar, na tela principal e no Worker de exportação. Falha de fonte não impede o vídeo: usa fonte reserva e avisa (M4F-801).
- **Galeria de estilos** (`?galeria`): página que desenha cada cena em cada estilo sobre um fundo sintético. Serve para o responsável comparar e para o teste de regressão visual por screenshot.

## Tarefas
| # | Entrega | Arquivos | Testes |
|---|---|---|---|
| 1 | StyleDNA + 3 presets + EditPlan v2 + migração v1→v2 + projeto aceita v1 | `src/core/{style,presets,types,schema,project}.ts` | `tests/style.test.ts`, `schema.test.ts`, `project.test.ts` |
| 2 | Contexto gravador para testes + `Ctx2D` | `src/render/ctx.ts`, `tests/helpers/recording-ctx.ts` | usado pelos testes de render |
| 3 | Legendas com `wordStarts`, agrupamento por estilo | `src/editorial/captions.ts` | `tests/captions.test.ts` |
| 4 | Números por extenso, enumerações, perguntas, palavras-chave, nome | `src/editorial/detect.ts` | `tests/detect.test.ts` |
| 5 | Seletor com densidade e anti-repetição | `src/editorial/selector.ts` | `tests/selector.test.ts` |
| 6 | Cenas, legendas Reels e transições, puras | `src/render/{scenes,captions,style-kit,frame}.ts` | `tests/scenes.test.ts`, `frame.test.ts` (determinismo e seek) |
| 7 | `applyStyle` + `withSegments` recalcula cenas | `src/editorial/ops.ts`, `auto-edit.ts` | `tests/ops.test.ts` |
| 8 | Fontes no navegador e no Worker; aviso M4F-801 | `src/media/fonts.ts`, `export*.ts`, `player.ts` | e2e |
| 9 | Seletor de estilo no editor (desfazer funciona), galeria | `src/app/{Editor,StylePicker,Gallery}.tsx` | `e2e/estilos.spec.ts` |
| 10 | Imagens de comparação, licenças, ADR, versão 0.3.0 | `docs/assets/fase3/`, `docs/licencas.md`, `docs/CHANGELOG.md` | todos |

## E2E (`e2e/estilos.spec.ts`)
1. Trocar o estilo muda o desenho da prévia; desfazer volta ao estilo anterior; refazer reaplica.
2. Exportar no estilo escolhido gera MP4 1080×1920 válido com AAC.
3. Galeria: cada estilo desenha quadros diferentes entre si; o mesmo quadro desenhado duas vezes (em ordens diferentes) é idêntico; screenshots de referência por cena × estilo com tolerância.
4. Fontes carregadas (`document.fonts.check`).

## Verificação
`npx tsc --noEmit` · `npx vitest run` · `npm run build` · `npm run fixture && npx playwright test`.

## Fica para depois
- Editar, mover ou apagar cenas uma a uma (Fase 4/5: pedido por texto e ajustes finos).
- Texto da chamada final editável; nome do lower third editável.
- Seletor semântico (IA) no lugar das regras: Fase 4, mantendo as regras como reserva.
