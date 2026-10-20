# Roteiro de teste — Motion4Free v0.10.0 (novo visual + legenda precisa + tudo das versões anteriores)

Para quem vai testar. Não precisa instalar nada nem usar terminal. Leva uns 30 a 40 minutos.

**Antes de começar**
- Use o **Chrome ou o Edge do computador**, atualizados, com a janela **maximizada**. No fim, abra também no **celular**.
- Abra o **link de prévia** que veio na mensagem do PR (ou o endereço do Motion4Free). Confira no rodapé da primeira tela se está escrito **Motion4Free v0.10.0**.
- Separe **um vídeo seu falando**, de 30 a 90 segundos, com algumas pausas (pode ser gravado no celular). Se der, separe também uma **foto ou logo bem colorida**.
- Nada do vídeo sai do seu computador: tudo acontece dentro do navegador.

## Como a tela está organizada (novo na v0.10)
- **No alto**: o nome do vídeo, se está salvo, as setas de **desfazer/refazer**, **Trocar vídeo**, o botão do sol (tema claro) e o botão amarelo **Exportar**.
- **À esquerda**: as ferramentas em abas — **Modelos, Pedido, Legendas, Gancho, Trechos, Versões, Cores**. Clicar numa aba abre o painel ao lado.
- **No meio**: a prévia grande, com **Assistir**, o tempo e uma barra para ir a qualquer ponto.
- **À direita**: **Detalhes** (o que você selecionou) e **O que mudou** (com Antes/Depois).
- **Embaixo**: a **linha do tempo** com o vídeo (listrado vermelho = cortado), as legendas e a faixa **Trechos**.
- No celular: prévia em cima e as abas numa barra no pé da tela.

## Passo a passo

1. **Primeira tela.** Ela deve mostrar a frase "Edite Reels no seu navegador…", uma área grande tracejada e, ao lado, três exemplos de modelos. *Ela parece um produto profissional? O que falta?*
1b. **Precisão da legenda (v0.8).** Embaixo da área tracejada há **Precisão da legenda**, com dois cartões. Deixe em **Precisa (recomendada)** e leia o que aparece (qual modelo, se usa a placa de vídeo e o tamanho do download, cerca de 1,4 GB). A escolha fica lembrada. (Opcional: com **`?avaliar`** no fim do endereço abre uma página que mede quantas palavras a legenda acerta; cole o texto exato da fala e clique em "Transcrever e medir".)
2. **Abrir o vídeo.** **Arraste o arquivo** do vídeo para a área tracejada (ou clique nela e escolha). Aparece o cartão "Editando seu vídeo" com os passos e a porcentagem. Na primeira vez o site baixa o modelo de legenda (pode levar vários minutos). *Anote quanto tempo levou o download e a transcrição.* Se aparecer o aviso **M4F-307**, o modelo grande não funcionou no seu computador e o app usou outro: copie o aviso e mande no feedback.
3. **Conferir o resumo.** Acima da prévia aparece "Original X s › Editado Y s". O editado deve ser mais curto (as pausas longas foram cortadas). Clique em **Assistir** (ou aperte a **barra de espaço**, ou clique na própria prévia) e veja se som e imagem estão juntos e se nenhum corte comeu pedaço de palavra.
4. **Legendas (novo jeito).** Abra a aba **Legendas**. O que você falou aparece como um texto corrido. Toque **Assistir**: a palavra falada acende em amarelo. Clique numa palavra errada: a prévia vai até ela e a frase vira um campo; corrija e aperte **Enter** (Esc cancela). Assista: a legenda corrigida aparece no vídeo. Palavras de pedaços cortados aparecem **riscadas**. No alto da aba aparece **"Legenda feita com …"** (o modelo usado). Conte, mais ou menos, quantas palavras estão erradas e se alguma frase foi inventada ou repetida.
5. **Cortes.** Na linha do tempo, clique numa parte listrada de vermelho. À direita, em **Detalhes**, aparece "Trecho cortado": toque em **Restaurar este trecho**. Depois use as setas de **desfazer** e **refazer** no alto (ou Ctrl+Z e Ctrl+Shift+Z). Teste o **zoom** da linha do tempo (lupas no canto direito) e clique na régua de tempo para ir a um ponto.
6. **Modelos.** Na aba **Modelos**, passe o mouse sobre os cartões (o quadro se mexe) e toque em **Pop**, **Neon**, **Editorial** e **Documental**. Cada um muda letras, cores, animações e ritmo. Use os filtros (**Elegante**, **Calmo**…). O escolhido fica com borda amarela e um ✓.
7. **Movimento.** Com **Pop**, clique em **Assistir**: as palavras entram uma depois da outra, a caixa amarela desliza junto com a voz, a legenda sai suave nas pausas. O botão do quadradinho ao lado da barra da prévia mostra a **área segura do Reels** (onde os botões do Instagram cobrem a tela): a legenda deve ficar dentro dela.
8. **Pedido por texto (sem IA).** Na aba **Pedido**, escreva exatamente:
   *gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos*
   Toque em **Aplicar**. A **legenda fica verde** com a **palavra falada em amarelo**; aparecem **emojis a cada uns 3 segundos**; o título de abertura muda. Aparece um quadro verde **"Apliquei:"** e, dentro dele, **"Ainda não sei fazer:"** (aqui deve dizer que entendeu tudo). Teste também: *legenda verde e música de fundo* (música aparece em "Ainda não sei fazer") e *bem animado mas sem efeitos*.
8b. **(Opcional) Com IA.** Ainda em **Pedido**, abra "IA opcional (avançado)" e escolha a IA no navegador (Padrão, Leve ou Forte) ou a sua chave do Google Gemini. Confira "Apliquei (com a IA…)". Se aparecer **M4F-1013**, escolha o modelo Leve.
9. **Gancho.** Na aba **Gancho**, escolha uma das frases sugeridas (o cartão fica amarelo). Ela aparece como título no começo do vídeo e é exatamente uma frase sua.
10. **Selecionar um pedaço.** Na linha do tempo, **arraste** o mouse na faixa **Trechos** (a de baixo) por cima de uns 5 segundos do meio do vídeo — ou abra a aba **Trechos** e toque em "Selecionar 3 s a partir de agora". Em **Detalhes** abre o painel "Trecho selecionado".
11. **Pedir uma mudança só nesse pedaço.** Toque no exemplo **sem animação aqui**. O resto do vídeo deve continuar igual. Depois escreva **destaque isso** e toque em **Aplicar no trecho**. Em **O que mudou** (à direita, embaixo) leia a lista, clique numa linha e alterne **Antes** e **Depois** (a prévia mostra "ANTES" num selo).
12. **Travar o pedaço.** No painel do trecho, toque em **Travar este trecho**. Troque o modelo (aba Modelos) e faça outro pedido geral: o pedaço travado fica igual. Tente corrigir uma legenda dentro dele (aba Legendas): aparece o aviso **M4F-504**. A aba **Trechos** lista os pedaços ajustados/travados; clique num para reabrir e **Destravar**.
13. **Versões.** Na aba **Versões**, escreva um nome (ex.: *versão calma*) e toque em **Guardar**. Mude o modelo. Toque em **Restaurar** na versão: o vídeo volta. **Comparar** mostra a versão na prévia sem mudar nada.
14. **Cores.** Na aba **Cores** você vê as cores atuais do vídeo. Toque em **Escolher imagem** e escolha a foto/logo colorida: as cores de destaque passam a ser as dela. **Voltar às cores do estilo** desfaz.
15. **Fechar e voltar.** Espere aparecer "✓ Salvo neste navegador" no alto. Feche a aba e abra o link de novo: tudo deve estar lá. (Se pedir o vídeo de novo com o aviso **M4F-604**, escolha o mesmo arquivo.)
16. **Exportar.** Toque em **Exportar** (no alto, à direita). Um quadro mostra a porcentagem; você pode continuar mexendo. No fim aparece o vídeo e o botão **Baixar vídeo**. Abra o arquivo no celular (ou suba como rascunho no Instagram) e confira.
17. **Tema claro (opcional).** Toque no sol, no alto: a tela fica clara. Recarregue: continua clara. A lua volta ao escuro.
18. **No celular.** Abra o link no celular e repita 2, 4, 6 e 16. A prévia fica em cima, as abas numa barra no pé da tela, e nada deve precisar rolar para o lado.

## O que nos contar

Responda no projeto do jeito que for mais fácil. Ajuda muito dizer:
- **Sobre o visual**: parece um editor profissional? Achou cada ferramenta fácil? Algo ficou pequeno, apertado ou escondido? Mande um print se puder.
- **Qual vídeo usou**: duração, gravado no celular ou câmera.
- **Para cada passo**: deu certo? O que você esperava e o que aconteceu?
- **O segundo exato** onde algo ficou estranho (aparece em "0,00 s / 0,00 s" ao lado do Assistir).
- **Tempos**: quanto demorou a primeira análise (passo 2) e a exportação (passo 16).

**Se aparecer uma caixa com "Erro M4F-…" ou "Aviso M4F-…":** toque em **Copiar detalhes** dentro da caixa e cole o texto na sua resposta (traz o código, a versão e o navegador). A lista de todos os códigos está em [erros.md](erros.md).

**Vídeos diferentes (opcional):** um vídeo **sem som** mostra o aviso **M4F-202** e um vídeo **sem fala** mostra **M4F-306**; os dois continuam editáveis e exportam. No Chromium sem codificador H.264, o vídeo final traz o aviso **M4F-403**.

## Já sabemos que
- A barra de atalhos (Espaço, J, L, Ctrl+Z) aparece no pé do editor só em telas largas; os atalhos funcionam em qualquer tamanho com teclado.
- Mover a frase do gancho para o começo do vídeo **ainda não existe**: o gancho aparece como título de abertura.
- A IA opcional **ainda não foi testada de verdade num aparelho real**. As regras funcionam sem ela.
- Os emojis vêm de uma lista de 72; música, voz, filtros de cor, 3D e b-roll ainda não existem.
- A imagem de referência muda só as cores, não a posição das coisas na tela.
