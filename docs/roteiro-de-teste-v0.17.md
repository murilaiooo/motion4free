# Roteiro de teste da v0.17 — linha do tempo de editor

Sem instalar nada. Use o computador (Chrome ou Edge), com um vídeo seu de 20 s a 1 min em que você fala com pausas. Confira no rodapé se está escrito **Motion4Free v0.17.0**. Se algo der errado, clique em **Copiar detalhes** no aviso e me mande junto com um print.

## 1. A linha do tempo nova
1. Abra o vídeo e espere a edição automática.
2. Embaixo, a linha do tempo deve mostrar **Edição** selecionado e o vídeo em **blocos numerados** (um por pedaço), com a forma de onda do som por trás.
3. Abaixo dos blocos aparecem as faixas **Elementos** (títulos, números, emojis), **Legendas** e **Trechos**.
4. Clique em **Original**: deve aparecer a linha do tempo antiga (a gravação inteira, com os cortes listrados). Volte para **Edição**.

## 2. Dividir e apagar
1. Clique no meio do bloco 1. Ele fica com borda amarela, a agulha vai até ali e o painel da direita mostra **Pedaço 1 de N**.
2. Aperte **S** (ou o botão **Dividir**). O bloco vira dois e a duração do vídeo não muda.
3. Clique num dos dois e aperte **Delete**. O pedaço sai, o resto encosta e a duração diminui.
4. Aperte **Ctrl+Z**. O pedaço volta.

## 3. Copiar, recortar, colar e duplicar
1. Clique num bloco e aperte **Ctrl+C**.
2. Leve a agulha para o fim (tecla **End**) e aperte **Ctrl+V**. O pedaço aparece de novo no fim, com a mesma fala e as mesmas legendas. Dê play para conferir.
3. Com o bloco colado selecionado, aperte **Ctrl+X** (recortar). Ele sai. Leve a agulha ao começo (**Home**) e aperte **Ctrl+V**: ele entra no começo.
4. Clique num bloco e aperte **Ctrl+D** (duplicar). A cópia aparece logo depois dele.

## 4. Mudar a ordem e aparar
1. Arraste um bloco para a esquerda ou direita. Aparece uma linha amarela onde ele vai entrar; solte. Dê play: a ordem mudou e as legendas acompanham.
2. Passe o mouse na **ponta** de um bloco (o cursor vira ↔) e arraste. Para dentro, você apara; para fora, devolve um pedaço que tinha sido cortado.
3. No painel do pedaço, teste **Mover para antes / depois** e o **Zoom neste pedaço** (solte o controle e veja a prévia aproximar só ali).
4. Entre dois blocos com corte aparece uma **tesourinha vermelha**. Clique nela: abre o painel do corte, com **Restaurar este trecho**.

## 5. Elementos e legendas no tempo
1. Na faixa **Elementos**, clique num título ou emoji. O painel mostra **Aparece em / Some em**.
2. Arraste o bloco do elemento para outro ponto e solte: ele passa a aparecer ali. Puxe as pontas para mudar a duração.
3. Com o elemento selecionado, aperte **Ctrl+C**, mova a agulha e aperte **Ctrl+V**: uma cópia aparece na agulha.
4. Na faixa **Legendas**, clique numa legenda e puxe uma ponta: ela aparece mais cedo ou mais tarde (não passa da vizinha).
5. Com uma legenda selecionada, aperte o botão **Copiar** da linha do tempo. Deve aparecer o aviso **M4F-519** (legenda não copia sozinha).

## 6. Exportar
1. Depois de mudar a ordem e colar pedaços, clique em **Exportar** e baixe o vídeo.
2. Assista ao arquivo baixado: a ordem, as legendas e as animações devem ser as mesmas da prévia.

## O que me mandar
- O que ficou difícil de achar ou de entender.
- Se algo travou, sumiu ou ficou fora de sincronia (com print e **Copiar detalhes**).
- O que ainda falta para parecer um editor profissional para você.
