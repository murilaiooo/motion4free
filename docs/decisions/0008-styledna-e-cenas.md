# ADR-0008 — StyleDNA paramétrico, cenas puras e seletor por regras (Fase 3)

**Data:** 2026-10-20
**Status:** ACEITA. Complementa o [ADR-0005](0005-stack-v1.md). Única dependência nova: fontes OFL `@fontsource/*` 5.3.0 ([licenças](../licencas.md)).

## Contexto
A Fase 3 ([plano](../superpowers/plans/2026-10-20-fase3-motion.md)) decide a qualidade criativa: 3 estilos que se distinguem por tipografia, movimento, ritmo e layout; cenas que acompanham a fala; legendas maiores e com a palavra falada em destaque (pedido do teste real do responsável). Tudo no navegador, sem custo, com prévia = MP4.

## Decisão
1. **StyleDNA paramétrico** (`src/core/style.ts`): paleta, 4 papéis tipográficos (display, texto, ênfase, rótulo) com caixa e espaçamento, movimento (`rise|pop|wipe`, curva `smooth|snappy|gentle`, durações, intensidade, atraso), ritmo (cenas por 10 s, intervalo, frequência de destaque e zoom), forma (cantos, traço, sombra `none|soft|hard`, painel), layout (alinhamento, altura), legendas (posição, tamanho, palavras por legenda, destaque `box|color|underline|reveal`, caixa da linha), transição, barra de progresso, zoom e texto da chamada final. Nenhuma cena testa o id do preset. Três composições saem dos parâmetros: **só tipografia** (sem painel), **adesivo** (painel + centro) e **cartão** (painel + esquerda). Assim a Fase 4 pode gerar um StyleDNA novo por IA, validado por zod, sem código novo.
2. **EditPlan v2** guarda o StyleDNA inteiro (o plano basta para exportar no Worker), `Caption.wordStarts` e cenas como união discriminada com parâmetros por tipo. `migratePlan` converte v1 → v2 ao abrir projetos da Fase 2 (estilo padrão Pop; tempos por palavra vazios = distribuição proporcional).
3. **Cenas derivadas**: enquanto não existe edição manual de cenas, trocar estilo ou cortes recalcula cenas pelo seletor e reagrupa legendas no tamanho do estilo, preservando textos corrigidos cujo grupo de palavras não mudou. Trocar estilo é uma operação pura (`applyStyle`) e entra no desfazer.
4. **Seletor por regras** (`src/editorial/detect.ts`, `selector.ts`): números (algarismos, %, R$, por extenso em português, "um/uma" sozinho é artigo), enumerações (ordinais no começo de frase ou em sequência, `1.`/`2)`), perguntas, apresentação ("meu nome é…") e palavras-chave (léxico de ênfase + tamanho + exclamação). Cenas centrais nunca se sobrepõem, respeitam intervalo e orçamento por 10 s do estilo; prioridade título > chamada final > lista > lower third > número > citação. Anti-repetição: a mesma cena com os mesmos parâmetros não aparece duas vezes seguidas, nem na sequência central nem na do mesmo tipo; zooms alternam a escala.
5. **Render puro tipado contra `Ctx2D`** (subconjunto do Canvas 2D): os testes usam um contexto gravador em Node (texto, posição, fonte, cor e opacidade em instantes fixos) e verificam que desenhar em qualquer ordem dá o mesmo quadro. A regressão visual de pixels usa screenshots do Playwright na galeria (`?galeria`), com tolerância de 2%.
6. **Fontes locais OFL** carregadas com a FontFace API antes de desenhar, na página e no Worker; falha vira aviso M4F-801 e fonte reserva, nunca bloqueia o vídeo.

## Alternativas descartadas
- **Presets como código** (uma função de desenho por estilo): mais rápido de escrever, mas impede a IA da Fase 4 de criar estilos novos com segurança.
- **Motion Canvas / PixiJS / Lottie**: dependência grande para o que Canvas 2D já faz; e animação ligada ao relógio da UI não serve para exportar quadro a quadro (aviso do levantamento do Editonny).
- **Google Fonts em tempo de execução**: requisição externa a cada uso e indisponível no ambiente de teste; o pacote npm fixa versão e licença.
- **Comparar só pixels**: frágil a mudanças de navegador; o contexto gravador testa a intenção (o que, onde, quando) e os screenshots pegam regressões visuais grandes.

## Consequências
- Mudar um parâmetro de preset muda os quadros de referência: atualizar com `npx playwright test e2e/estilos.spec.ts --update-snapshots` depois de olhar as imagens.
- O seletor só entende português; outra língua precisa de léxico próprio.
- Cenas ainda não são editáveis uma a uma; a próxima fase (pedido por texto) precisa de "locks" para que um ajuste manual não seja recalculado.
