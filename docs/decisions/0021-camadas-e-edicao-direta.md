# ADR-0021 — Camadas, onda real e edição direta fluida na prévia (v0.18.0)

**Data:** 2026-10-21
**Status:** ACEITA.

## Contexto
O responsável testou a v0.17 e pediu quatro coisas:
- camadas para trabalhar em níveis diferentes;
- a onda do áudio real, que ficava "pixelada" no zoom porque era uma imagem de 1200 colunas esticada;
- pontas mais fáceis de pegar, com um arraste menos pesado;
- itens da prévia que dê para mover, já que a legenda ficava em cima do rosto e não saía.

A causa do último problema: `PreviewOverlay` usava `require` (que não existe no navegador). Por isso a posição inicial de todo elemento vinha vazia e o arraste nem começava. Além disso, as cenas geradas (emoji, título) recebiam uma posição no formato errado, e cada movimento do mouse virava uma entrada do desfazer e redesenhava o editor inteiro.

## Decisão
1. **Camadas.** Elemento adicionado ganha `track` opcional (0 a 9; ausente = 0). A camada maior é desenhada por cima (`resolvePlan` ordena de forma estável). Na linha do tempo, cada camada é uma faixa, sempre com uma vazia por cima. Arrastar o elemento para outra faixa troca a camada; o painel também tem "Para cima / Para baixo" (`setElementTrack`). As animações geradas ficam numa faixa própria, e o vídeo e o áudio ficam separados.
2. **Onda real.** `buildPeakIndex` (picos por bloco de 256 amostras) e `peakBetween` leem o áudio de verdade. O canvas cobre só a parte visível da linha do tempo, na resolução da tela, e é redesenhado ao rolar ou dar zoom (agora até 64×).
3. **Arraste leve.** A linha do tempo redesenha no máximo uma vez por quadro, e as pontas ficaram com 16 px de área de pegada, para fora do bloco. Na prévia, o arraste só muda a prévia do player; ao soltar, vira uma entrada do desfazer. Os cantos mudam o tamanho, Shift trava o eixo, e o ímã encosta no centro, na área segura e nos outros elementos.
4. **Legenda move todas.** Arrastar uma legenda na prévia move todas as legendas juntas (escopo "todas"), que é o caso de tirar a legenda do rosto.

## Consequências
- Projetos antigos abrem iguais (`track` ausente = camada 1).
- Clicar no vazio da prévia ainda toca/pausa. Clicar num emoji ou título agora seleciona, em vez de tocar.
