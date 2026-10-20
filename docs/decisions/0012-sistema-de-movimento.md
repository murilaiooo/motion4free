# ADR-0012 — Sistema de movimento: molas, curvas, câmera e legenda palavra a palavra (v0.7.0)

**Data:** 2026-10-20
**Status:** ACEITA. Complementa o [ADR-0008](0008-styledna-e-cenas.md) (StyleDNA e cenas puras) e o [ADR-0011](0011-ia-interprete-e-look.md) (look). Stack do [ADR-0005](0005-stack-v1.md) sem troca de peça; nenhuma dependência nova.

## Contexto
O responsável pediu para testar tudo e, se parecesse básico, continuar até o app parecer profissional. Os quadros da v0.6 tinham boa tipografia, mas o movimento era genérico: entradas lineares ou cúbicas iguais para tudo, legenda entrando como um bloco, palavra destacada pulando de uma vez, nada saindo da tela, título e legenda repetindo a mesma frase ao mesmo tempo, emoji caindo em cima do título, legenda pedida "em cima" sob o título, legenda passando por baixo dos botões do Reels e vídeo parado em trechos longos.

## Decisão
1. **Módulo puro `src/render/motion.ts`**: mola amortecida resolvida analiticamente (`spring`, `springIn` normalizada numa janela, termina exatamente em 1), `cubicBezier` do CSS, curvas `easeOutExpo/Quint`, `easeInOutQuint`, `easeOutBackBy` (sobra configurável), `stagger` com teto e `wiggle` (tremor determinístico por soma de senos). Tudo função de `t`: nenhuma integração quadro a quadro, então o mesmo instante dá o mesmo quadro na prévia, no MP4 e em qualquer ordem de seek.
2. **Personalidades do StyleDNA ganham curvas reais** (sem campo novo no esquema): `snappy` = mola com sobra que cresce com a intensidade; `gentle` = exponencial (revista); `smooth` = in-out forte (cortina de documentário). Entrada `rise` vira **revelação por máscara** (o texto sobe de trás de uma linha invisível e sai subindo); `pop` cresce com mola e encolhe ao sair.
3. **Legenda** (`drawCaption`): entrada **palavra a palavra** (atraso de 35 ms por palavra, teto de 0,2 s) com mola (pop) ou subida (rise); **caixa da palavra falada desliza** da palavra anterior na mesma linha (o texto escuro fica na palavra que a caixa cobre mais); palavra falada cresce com mola e a anterior volta em 0,1 s; **a palavra que cresce empurra as vizinhas** (letras nunca encavalam); palavra-chave falada ganha um "soco" extra proporcional à intensidade; sublinhado cresce da esquerda; "revelação" acende suave; **saída curta** (0,12 s) quando há pausa antes da próxima legenda; contorno e preenchimento em passadas separadas com **sombra suave** sob o contorno (sem o deslocamento duro que borrava as letras). Na metade de baixo, a largura respeita os **botões do Reels** (até 87% da largura). Legendas não deixam **uma palavra sozinha** no fim da frase (cabe uma a mais).
4. **Câmera** (`cameraAt`): **Ken Burns** lento nos trechos mantidos de 3 s ou mais, depois de 1,2 s sem corte, com velocidade e teto pelo zoom e intensidade do estilo; desligado com "sem zoom"/"sem efeitos" (zoom do estilo = 1) e nos trechos "sem animação aqui". Zoom de ênfase com **soco de mola** nos estilos `snappy` e **tremor** curto no impacto (intensidade ≥ 0,6), com escala extra para nunca mostrar a borda; zoom de corte com saída exponencial.
5. **Composição sem colisões**: legenda some quando o título mostra a mesma frase (≥ 60% das palavras); cenas centrais se afastam da legenda pedida em cima/no meio (`overlayYFor`); emoji "auto" fica logo acima da legenda (ou abaixo, quando ela está no alto) e, sem legenda, longe da legenda e da cena central; faixa escura suave atrás das cenas só tipografia (Editorial, Neon) para ler sobre qualquer fundo; gancho em adesivo em duas cores alternadas; ponta brilhante na barra de progresso.
6. **Estilo novo "Neon"**: a legenda "karaokê" limpa (branca, Inter 800, 2 palavras por vez, palavra falada em verde neon crescendo com mola, sem caixas), títulos Montserrat 900 só tipografia. Só fontes que já acompanham o app (OFL, ver [licencas.md](../licencas.md)). No pedido, só "estilo neon" escolhe o estilo; "verde neon" continua sendo cor.

## Custo medido (Chromium sem GPU do ambiente de desenvolvimento)
- Desenhar um quadro 1080×1920 da galeria (um trecho de 28 s, Ken Burns quase sempre ligado): Pop 2,3 → 7,8 ms; Editorial 5,7 → 15,4 ms; Documental 4,7 → 11,8 ms; Neon 12,9 ms.
- Exportar vídeo de 20 s sem cortes: 10,5 → 14,5 s; vídeo de 8 s com 2 trechos: 4,4 → 5,4 s.
- A diferença é quase toda a reamostragem bilinear do vídeo escalado (Ken Burns/zoom): ~6,5 ms por quadro sem GPU, quase zero com GPU. Por isso o Ken Burns fica só em trechos longos. Vídeo com muitos cortes curtos quase não muda de tempo.

## Alternativas descartadas
- **Biblioteca de animação** (GSAP, Motion One, Popmotion): ligadas ao relógio da página e com estado; a exportação quadro a quadro precisa de funções puras de `t`.
- **Mola integrada passo a passo**: depende do quadro anterior; seek e Worker dariam quadros diferentes.
- **Recolorir a palavra sob a caixa com recorte (clip)**: mais bonito durante 1–2 quadros da troca, mas dobra os `fillText` e complica os testes; a troca de cor na metade do deslizamento (≈ 20 ms) fica invisível a 30 fps.
- **Ken Burns em todos os trechos**: +45% no tempo de exportação sem GPU; trechos curtos já têm o movimento do corte.

## Consequências
- Quadros de referência da galeria atualizados (`e2e/estilos.spec.ts-snapshots`, 4 estilos); a regressão fina fica nos testes de unidade (`tests/motion.test.ts`, `tests/motion-frame.test.ts`).
- Mudar uma curva muda os quadros: olhar a galeria (`?galeria`) e atualizar as referências de propósito.
- Ainda não: animação por letra, desfoque de movimento, transições com deslocamento lateral ("whip"), recolorir sob a caixa por recorte.
