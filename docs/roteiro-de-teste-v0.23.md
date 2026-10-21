# Roteiro de teste — v0.23.0 (progresso detalhado)

Confira no rodapé que está em **v0.23.0**. Nada para instalar.

1. **Vídeo novo, primeira vez com o modo Precisa** (de preferência numa janela anônima, para o modelo ser baixado de novo).
   Escolha um vídeo de 1 a 3 minutos. Na tela "Editando seu vídeo" deve aparecer:
   - "Etapa X de 4" e uma porcentagem grande que **não volta para trás** dentro da mesma etapa;
   - no download do modelo: "Passou …", "Falta …", "xxx MB de 1,4 GB" e a velocidade em MB/s, mudando a cada segundo;
   - depois "Preparando o modelo…" com barra andando, e então "Transcrevendo a fala…" com "trecho N de M" e minutos de fala ouvidos.
2. **Mesmo vídeo de novo, numa aba normal.** O texto do modelo deve dizer "já guardado neste aparelho" em vez de "Baixando".
3. **Exportar.** No editor, clique em Exportar: o painel mostra %, tempo passado, tempo restante e, no fim, "Fechando o arquivo MP4". Feche e reabra o painel: o tempo continua, não zera.
4. **Vários vídeos (3 a 5 curtos).** O progresso deve dizer "clipe 2 de 5" em cada etapa. Depois, no editor, veja a faixa "Guardando uma cópia do vídeo neste navegador" com MB e velocidade.
5. **Clipes de vídeo longo** (vídeo de 5 min ou mais). A análise mostra leitura do áudio ("mm:ss de mm:ss lidos") e transcrição com tempo restante. Na lista, "Gerar e baixar os escolhidos": a barra de baixo mostra o lote inteiro ("Gerando o clipe 2 de 5", %, quanto falta); cada cartão mostra o seu.
6. **IA no navegador** (aba IA, se o computador tiver placa de vídeo). Ao pedir algo, o download da IA mostra MB baixados, velocidade e tempo restante; depois "A IA no navegador está lendo o pedido" com o tempo passando.
7. **Armazenamento.** Abra: enquanto mede, aparece o tempo passando.

**O que reportar:** print de qualquer tela em que o tempo restante pareça muito errado, a porcentagem volte para trás, ou alguma espera fique só com um "girando" sem número.
