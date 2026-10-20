# ADR-0010 — Trechos, travas, revisão focal, versões e cores de referência (Fase 5)

**Data:** 2026-10-20
**Status:** ACEITA. Complementa o [ADR-0007](0007-editor-projeto-local.md) (histórico e projeto no OPFS), o [ADR-0008](0008-styledna-e-cenas.md) (StyleDNA e cenas) e o [ADR-0009](0009-pedido-e-ia.md) (pedido). Nenhuma dependência nova.

## Contexto
A Fase 5 ([plano](../superpowers/plans/2026-10-20-fase5-trechos.md)) deixa a pessoa ajustar um pedaço do vídeo sem mexer no resto. Gate: mudar o trecho de 12 s a 18 s não altera nada fora dele, inclusive sincronia de voz e legendas.

## Decisão
1. **`EditPlan` v4** com `ranges` (trechos) e `reference` (cores de uma imagem). v1–v3 migram em degraus, sem mudança visível. O projeto salvo passa ao **formato 2**, que acrescenta `versions`; formato 1 abre com a lista vazia.
2. **Trecho ancorado no original** (`srcStart`/`srcEnd`). A pessoa escolhe no tempo do vídeo editado (arrastando na faixa "Trechos" ou digitando início/fim) e o app converte. `out` é derivado e recalculado depois de qualquer mudança; um corte antes do trecho só o desloca. Trechos não se sobrepõem (M4F-506); mínimo de 0,5 s (M4F-505).
3. **Pedido de trecho em campos fechados**: tom, intensidade, ritmo, proibições e destaques (o mesmo intérprete do pedido geral) + `quiet` ("sem animação aqui"), `accent` ("destaque isso": palavra-chave mais forte do trecho + zoom), `variant` ("troca essa animação": ciclo determinístico entre palavra-chave, zoom e título com a fala do trecho, começando pelo tipo que ainda não está lá) e trava. Nada de texto inventado: palavras e títulos vêm da fala do trecho.
4. **Revisão focal**: só as cenas que começam e terminam dentro do trecho são recalculadas, com o estilo do trecho e as palavras do trecho. Legendas e trechos mantidos nunca mudam num pedido de trecho; cenas que cruzam a borda ficam como estão (e cenas novas centrais não se sobrepõem a elas). Garantido por construção e testado: gate 12–18 s em 3 estilos × 6 pedidos e 40 trechos aleatórios (com segundo pedido em outro trecho), comparando tudo fora do trecho com `toEqual` e conferindo que cada legenda começa quando a sua palavra é falada.
5. **Estilo por trecho**: o trecho guarda o seu StyleDNA; `drawFrame` usa o estilo do trecho que contém `t` (prévia e exportação usam a mesma função, então continuam iguais). Fora dos trechos o quadro é idêntico ao de antes (teste com o contexto que grava chamadas). Fontes de todos os estilos do plano são carregadas antes de desenhar.
6. **Trava = cópia**: travar guarda as cenas e legendas que tocam o trecho (e o estilo). Depois de mudanças gerais (estilo, pedido geral, gancho, cores, cortes fora do trecho) o plano é refeito e a cópia é recolocada — idêntica, ou deslocada pela diferença se um corte antes dela mudou. Legendas fora da trava são refeitas só com as palavras de fora (nenhuma palavra repetida ou perdida). Cortar, restaurar corte ou corrigir legenda dentro da trava, e pedido de trecho num trecho travado, são recusados com M4F-504. Destravar ou "voltar ao normal" refaz o vídeo inteiro, que por ser determinístico deixa o resto igual.
7. **"O que mudou"**: `diffPlans` puro compara com o estado anterior (ou uma versão escolhida) e lista estilo, cores, cortes, trechos, cenas que entraram/saíram (pelo conteúdo, não pelo id) e legendas. A prévia alterna entre antes e depois no mesmo instante (alternância em vez de lado a lado, para não decodificar o vídeo duas vezes).
8. **Versões com nome** (até 20, M4F-605) guardam o plano inteiro no projeto; restaurar é uma operação comum (entra no desfazer).
9. **Imagem de referência**: lida pelo navegador num canvas 64×64, só neste aparelho; paleta por median-cut (puro, determinístico); entram só `accent`, `accent2` e `panel`, com contraste WCAG ≥ 4,5:1 contra o preto e contra o texto do painel quando ele fica por cima. Texto da legenda, sombra e degradê não mudam. Imagem sem cor viva (croma < 0,22) não muda nada (M4F-804). Só as cores ficam no projeto.
10. **Gancho no começo por reordenação: não entra.** O motor supõe trechos em ordem crescente: `listCuts`/`segmentsFromCuts`, a linha do tempo (desenhada no tempo do original), `sourceToOutput` (uma palavra só pode aparecer uma vez) e as legendas por palavra dependem disso. Mover ou repetir a frase do gancho exigiria trechos fora de ordem e palavras duplicadas em todas essas camadas e no player/exportação. O gancho continua como título de abertura (ADR-0009).

## Alternativas descartadas
- **Trecho no tempo do vídeo editado**: mais simples, mas qualquer corte antes dele faria o trecho "andar" para outras falas.
- **Trava por regra ("não recalcular aqui")** em vez de cópia: dependeria de o seletor dar o mesmo resultado com outro estilo, o que não é verdade; a cópia garante igualdade exata.
- **Estilo por cena** em vez de por trecho: mais flexível, mas aumentaria o plano e o desenho sem ganho para os pedidos desta fase.
- **k-means** para a paleta: resultado depende da semente; median-cut é determinístico e bastante para 64×64 pixels.

## Consequências
- O plano fica maior (cada trecho guarda um StyleDNA, ~1,5 KB); o histórico de 100 passos continua pequeno.
- A barra de progresso é global: dentro de um trecho travado ela acompanha o vídeo atual (fica fora da cópia).
- Pedidos de estilo, objetivo, público e gancho dentro de um trecho viram nota ("valem para o vídeo inteiro").
- Imagem de referência só influencia cores; composição/layout fica para depois.
