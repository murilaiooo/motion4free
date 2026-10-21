# ADR-0020 — Linha do tempo de edição, ordem própria dos pedaços e área de transferência (v0.17.0)

**Data:** 2026-10-21
**Status:** ACEITA.

## Contexto
O responsável testou a v0.16 e achou o editor "de brinquedo": a linha do tempo só mostrava a gravação original com os cortes; não dava para dividir, apagar, mover, copiar, colar ou aparar pedaços nem mover elementos no tempo. O motor já tinha dividir, apagar, aparar, zoom por pedaço e mudar o tempo de elementos (ADR-0018), sem tela. Mover e colar pedaços exigia mudar uma regra do plano: até a v0.16 os `segments` ficavam sempre na ordem da gravação e sem repetir trecho.

## Decisão
1. **Duas vistas.** A padrão, **Edição** (`src/app/EditTimeline.tsx`), mostra o vídeo final: pedaços em blocos com forma de onda, faixa de elementos (títulos, números, emojis, textos e formas), faixa de legendas e faixa de trechos. A vista **Original** (`Timeline.tsx`) continua igual, com os cortes listrados. A escolha fica guardada no navegador.
2. **Ordem própria.** `segments` pode ficar fora da ordem da gravação e o mesmo trecho pode aparecer mais de uma vez. Player, áudio e exportação já percorriam os pedaços na ordem do vídeo final. As funções de tempo foram generalizadas, com o mesmo resultado de antes quando os pedaços estão em ordem:
   - `placeSpan` dá cada vez que uma palavra aparece, então legendas e cenas repetem com o pedaço colado;
   - `sourceToOutputClamped`, `sourceEndToOutputClamped` e `rangeOut` usam o primeiro e o último uso;
   - `listCuts` dá o que nenhum pedaço usa;
   - `restoreCut` põe o trecho ao lado do vizinho sem refazer a ordem;
   - `adjustCut` recusa, com M4F-518, porque refaria a ordem;
   - `trimSegment` só para no vizinho quando ele é vizinho também na gravação, e nunca passa das pontas do próprio clipe.
3. **Elementos ancorados na gravação.** Os elementos continuam guardados no tempo da gravação, como antes. Com a ordem mudada, um elemento aparece onde o começo dele está e nunca dura mais do que durava (`srcToOut`). A cópia de uma legenda repetida ganha chave `#2`, como as cenas.
4. **Operações puras** (`src/editorial/sequence.ts`): `moveSegment`, `duplicateSegment`, `insertSegments` (colar na agulha, dividindo se preciso) e `deleteOutRange`. No elemento, `copyElement` e `pasteElement`; legenda não copia sozinha (M4F-519). Tudo passa por `withSegments`, que mantém as travas (M4F-504) e refaz legendas e cenas.
5. **Edição.** A área de transferência vale só na sessão e não sai do aparelho. Os atalhos são S, Delete/Backspace, Ctrl+C/X/V/D e Esc. Arrastar só aplica ao soltar (uma entrada no desfazer). O ímã encosta nas emendas, nas pontas e na agulha.

## Consequências
- Mudar a ordem dos clipes (lista de clipes) volta os pedaços para a ordem da gravação dentro da nova ordem dos clipes.
- Transcrição: com ordem própria, o roteiro segue o vídeo final.
- Ainda **não** há: velocidade por pedaço, volume por pedaço, várias faixas de vídeo sobrepostas (picture-in-picture) nem seleção de vários pedaços de uma vez. Ficam para quando houver pedido e teste.
- Testes: `tests/sequence.test.ts` e `e2e/linha-do-tempo.spec.ts`. Os testes antigos da vista Original foram ajustados para abrir essa vista primeiro.
