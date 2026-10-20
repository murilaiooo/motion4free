# Roteiro de teste — Motion4Free v0.7.0 (Fases 1 a 5 + pedido com IA + movimento profissional)

Para quem vai testar. Não precisa instalar nada nem usar terminal. Leva uns 30 a 40 minutos.

**Antes de começar**
- Use o **Chrome ou o Edge do computador**, atualizados.
- Abra o **link de prévia** que veio na mensagem do PR (ou o endereço do Motion4Free). Confira no rodapé da página se está escrito **Motion4Free v0.7.0**.
- Separe **um vídeo seu falando**, de 30 a 90 segundos, com algumas pausas (pode ser gravado no celular). Se der, separe também uma **foto ou logo bem colorida**.
- Nada do vídeo sai do seu computador: tudo acontece dentro do navegador.

## Passo a passo

1. **Abrir o vídeo.** Clique na caixa tracejada e escolha o seu vídeo. Espere a barra de progresso. Na primeira vez o site baixa o "modelo de transcrição" (pode levar alguns minutos). *Anote quanto tempo levou.*
2. **Conferir o resumo.** Aparece "Original: X s · Editado: Y s". O editado deve ser mais curto (as pausas longas foram cortadas). Clique em **Assistir** e veja se o som e a imagem estão juntos e se nenhum corte comeu pedaço de palavra.
3. **Legendas.** Role até "Legendas". Corrija uma palavra errada (clique no texto, corrija, aperte Enter). Assista de novo: a legenda corrigida aparece no vídeo.
4. **Cortes.** Na linha do tempo, as partes listradas de vermelho foram cortadas. Clique numa delas e em **Restaurar este trecho**. Depois clique em **Desfazer** e **Refazer** e veja se tudo volta e vai de novo.
5. **Estilos.** Em "Estilo", toque em **Pop**, **Neon** (novo), **Editorial** e **Documental**. Cada um deve mudar letras, cores, animações e ritmo (não só a cor). Escolha o que mais gostou.
5b. **Movimento (novo na v0.7).** Escolha **Pop** e clique em **Assistir**. Repare:
   - as palavras da legenda entram **uma depois da outra**, com um pulinho; a **caixa amarela desliza** de uma palavra para a outra junto com a sua voz; a palavra falada cresce sem encostar nas vizinhas;
   - quando você faz uma pausa, a legenda **sai suavemente** (não some de uma vez);
   - o título de abertura **não repete** a mesma frase na legenda logo embaixo; o gancho alterna amarelo e branco;
   - num trecho longo sem corte, o vídeo **aproxima bem devagar**; no zoom de destaque do Pop há um "soco" com um tremor curto;
   - na parte de baixo, a legenda não passa por baixo dos botões do Instagram (fica no meio, um pouco mais estreita).
   Troque para **Neon**: legenda branca, poucas palavras por vez, a palavra falada acende em verde. Troque para **Editorial**: o título sobe de trás de uma linha invisível, com uma faixa escura suave atrás. *Conte se algum movimento pareceu exagerado, lento ou "travado".*
6. **Pedido por texto (sem IA).** Em "O que você quer?", deixe "Só regras" e escreva exatamente:
   *gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos*
   Toque em **Aplicar**. Deve acontecer: a **legenda fica verde** com a **palavra falada em amarelo**; aparecem **emojis a cada uns 3 segundos**, combinando com o que você fala (ex.: 💰 quando fala de dinheiro); o título de abertura passa a ser uma frase sua **diferente da mais óbvia**. Embaixo aparece **"Apliquei:"** (com o que mudou) e **"Ainda não sei fazer:"** (aqui deve dizer que entendeu tudo).
   - Teste também: *legenda grande em cima, amarela com contorno preto* (a legenda fica amarela e o contorno preto; o título de abertura desce para não ficar embaixo da legenda); *emojis grandes pulando nas palavras importantes*; *cortes rápidos e sem pausas* (o vídeo fica mais curto e a legenda continua junto com a voz); *legenda em minúsculas, fonte anton*.
   - Peça algo que o app ainda não faz: *legenda verde e música de fundo*. A legenda muda e "Ainda não sei fazer" mostra **música ou efeitos sonoros**.
   - Pedido que se contradiz: *bem animado mas sem efeitos* (não pode aparecer zoom nem flash) e *emojis a cada 3 segundos, mas sem emojis* (nenhum emoji).
6b. **(Opcional) Com IA.** Abra "IA opcional (avançado)". **IA no navegador**: escolha **Padrão** (recomendado; baixa cerca de 0,9 GB na primeira vez) ou **Leve** (computador mais fraco) ou **Forte** (placa de vídeo boa, ~2,3 GB). Escreva o mesmo pedido e mais algo com suas palavras, ex.: *quero um visual de festa junina com legenda laranja e emojis divertidos*. Confira se aparece "Apliquei (com a IA no navegador)", uma frase-resumo da IA e "Ainda não sei fazer". *Anote quanto tempo levou a primeira vez.* Se aparecer **M4F-1013**, escolha o modelo Leve. **Minha chave do Google Gemini** também funciona (só o texto vai para o Google).
7. **Gancho.** Em "Gancho", escolha uma das frases sugeridas. Ela deve aparecer como título no começo do vídeo e ser exatamente uma frase que você falou.
8. **Selecionar um pedaço.** Na linha do tempo, logo abaixo das legendas, há a faixa **"Trechos"**. Arraste o mouse nela por cima de um pedaço do meio do vídeo (uns 5 segundos). Abre o painel "Trecho selecionado".
9. **Pedir uma mudança só nesse pedaço.** Toque no exemplo **sem animação aqui**. Assista: naquele pedaço não deve haver animação, e **o resto do vídeo deve continuar igual** (mesmas animações, mesmas legendas, legenda junto com a voz). Depois escreva **destaque isso** e toque em **Aplicar no trecho**: deve aparecer uma palavra em destaque e um zoom só ali. Teste também **troca essa animação**, **mais calmo aqui** e **legenda vermelha aqui** (só aquele pedaço fica com a legenda vermelha).
10. **Ver o que mudou.** No quadro "O que mudou", leia a lista. Clique numa linha (a prévia vai até aquele segundo) e alterne **Antes** e **Depois** para comparar.
11. **Travar o pedaço.** No painel do trecho, toque em **Travar este trecho**. Agora troque o estilo (por exemplo para Documental) e faça outro pedido geral em "O que você quer?". O pedaço travado deve continuar **exatamente igual** ao que era; o resto muda. Tente corrigir uma legenda dentro do pedaço travado: deve aparecer o aviso **M4F-504**. Para liberar, clique no pedaço roxo na faixa "Trechos" e toque em **Destravar**.
12. **Versões.** Em "Versões", escreva um nome (ex.: *versão calma*) e toque em **Guardar versão**. Mude o estilo. Toque em **Restaurar** na versão guardada: o vídeo volta a como estava. **Comparar** mostra a versão na prévia sem mudar nada.
13. **Cores de uma imagem (opcional).** Em "Cores de uma imagem sua", escolha a foto ou logo colorida. As cores de destaque do vídeo devem passar a ser as da imagem, com a legenda ainda fácil de ler. **Voltar às cores do estilo** desfaz.
14. **Fechar e voltar.** Espere aparecer "Projeto salvo neste navegador." Feche a aba, abra o link de novo: o vídeo, as edições, os pedaços travados e as versões devem estar lá. (Se o site pedir o vídeo de novo com o aviso M4F-604, escolha o mesmo arquivo.)
15. **Gerar o vídeo final.** Toque em **Gerar vídeo final**, espere e toque em **Baixar vídeo**. Abra o arquivo no celular (ou suba como rascunho no Instagram) e confira: estilo certo, pedaço travado como você deixou, som junto com a imagem.
16. **(Opcional) Sem internet.** Com o site já aberto e o vídeo carregado, desligue o Wi-Fi e faça um pedido por texto e um pedido num trecho. Devem funcionar.

## O que nos contar

Responda no projeto do jeito que for mais fácil. Ajuda muito dizer:
- **Qual vídeo usou**: duração, gravado no celular ou câmera, em pé ou deitado.
- **Para cada passo**: deu certo? O que você esperava e o que aconteceu?
- **O segundo exato** onde algo ficou estranho (aparece em "0,00 s / 0,00 s" embaixo da prévia) e, se puder, um print.
- **Tempos**: quanto demorou a primeira análise (passo 1) e a geração do vídeo (passo 15).
- **Gosto**: o pedaço ajustado ficou do jeito que você pediu? Usaria algum estilo num post de verdade?

**Se aparecer uma caixa com "Erro M4F-…" ou "Aviso M4F-…":** toque no botão **Copiar detalhes** dentro da caixa e cole o texto na sua resposta (ele traz o código, o que aconteceu, a versão do app e o navegador). Não precisa explicar mais nada; o código já diz onde está o problema. A lista de todos os códigos está em [erros.md](erros.md).

**Vídeos diferentes (opcional, v0.7):** um vídeo **sem som** mostra o aviso **M4F-202** e um vídeo **sem fala** (só música ou silêncio) mostra **M4F-306**; os dois continuam editáveis e geram o vídeo final. No Chromium do computador sem codificador H.264, o vídeo final traz o aviso **M4F-403**.

## Já sabemos que
- Mover a frase do gancho para o começo do vídeo **ainda não existe**: o gancho aparece como título de abertura.
- A IA opcional (no navegador ou com sua chave do Google) **ainda não foi testada de verdade num aparelho real** (o ambiente de desenvolvimento não baixa os modelos). As regras funcionam sem ela, inclusive para o pedido do passo 6.
- Os emojis vêm de uma lista de 72; música, voz, filtros de cor, 3D e b-roll ainda não existem (aparecem em "Ainda não sei fazer").
- A imagem de referência muda só as cores, não a posição das coisas na tela.
- A aproximação lenta da câmera deixa a geração do vídeo final um pouco mais demorada em computadores sem placa de vídeo (até uns 40% em vídeos longos sem cortes).
