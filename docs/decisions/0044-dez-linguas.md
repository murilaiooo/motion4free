# ADR-0044: As 10 línguas mais faladas na fala, na legenda e na tradução

- Data: 02/11/2026
- Estado: aceito
- Pedido: o responsável disse (02/11/2026 20:41) que espanhol e russo eram só exemplo, e que o reconhecimento da fala, a legenda e a tradução têm de valer para as 10 línguas mais faladas.

## Decisão

**Lista** (Ethnologue, total de falantes): inglês, chinês (mandarim), hindi, espanhol, francês, árabe, bengali, português, russo e urdu. Uma tabela só, `src/core/languages.ts`, guarda para cada língua o nome no Whisper, se o Parakeet a conhece, o código do M2M100, a escrita e a direção. A transcrição, as fontes, o desenho e a tradução leem dessa tabela.

**Fala.** O Whisper reconhece as 10. O Parakeet TDT v3 só conhece 25 línguas europeias, então `ladderForLanguage` o tira da escada quando o idioma escolhido é chinês, hindi, árabe, bengali ou urdu. Isso vale também para a conferência dupla, que fica sem segunda IA e avisa M4F-314. No modo automático, o modelo decide sozinho; a tela recomenda escolher o idioma nessas cinco línguas. As APIs de transcrição recebem o código ISO-639-1, que é o mesmo da tabela.

**Escrita na legenda.**
- *Fontes:* cada modelo de legenda tem a sua fonte. Para as escritas que essas fontes não têm, o app usa a Noto Sans (OFL-1.1, @fontsource, peso 700): SC para chinês, Arabic para árabe e urdu, Devanagari para hindi e Bengali para bengali. Essas famílias entram como reserva em todo `cssFont`, e o canvas só as usa nas letras que a fonte do modelo não desenha.
- *Download sob demanda:* as reservas só são baixadas quando o texto do vídeo tem essas letras. Do chinês, que tem 3,5 MB divididos em 100 pedaços por faixa Unicode, só vêm os pedaços com os caracteres usados. A tabela de faixas é gerada a partir do CSS dos pacotes por `scripts/gen-script-fonts.mjs`. Essas reservas não entram no cache offline.
- *Árabe e urdu:* as palavras são dispostas da direita para a esquerda, e o destaque da palavra falada anda nesse sentido.
- *Chinês (sem espaço entre palavras):*
  - cada caractere vira uma palavra, com o próprio tempo vindo do Whisper;
  - o espaço que o app guarda entre elas não aparece na tela, no SRT nem na tradução (`readableText`);
  - a legenda conta um caractere como duas letras e como meia palavra;
  - a linha quebra entre caracteres;
  - o fim de frase reconhece 。！？ । ؟ ۔.

**Tradução.** Inglês → português continua no OPUS-MT en-ROMANCE (ADR-0043), porque já foi corrigido e é menor. Qualquer outro par usa o **M2M100 418M** (Meta, MIT), que traduz diretamente entre 100 línguas, sem passar pelo inglês. As alternativas foram descartadas:
- NLLB-200 e SeamlessM4T têm licença CC-BY-NC, não comercial;
- um modelo OPUS-MT por par daria dezenas de downloads e deixaria pares sem cobertura;
- um LLM genérico inventa texto com mais facilidade.

A entrada do M2M100 é montada à mão (`src/translation/m2m.ts`): [código da origem, ...texto, `</s>`], com o código do destino em `forced_bos_token_id`. Assim não dependemos do pós-processador do transformers.js 4.x, o mesmo tipo de atalho que causou o #175. Cada trecho é conferido antes de a faixa trocar (`checkTranslation`):
- escrita do destino em pelo menos 60% das letras;
- urdu × árabe pelas letras próprias do urdu;
- nenhuma letra não latina num destino latino;
- texto que voltou na língua de origem, laço de repetição, tamanho e código interno (`__xx__`, `>>xx<<`).

A língua de origem é reconhecida pela escrita e, nas latinas, por palavras exclusivas de cada língua. A pessoa pode corrigir. Se o idioma escolhido não bate com a escrita da legenda, o app mostra M4F-320 antes de baixar qualquer coisa.

**Projeto salvo.** A faixa traduzida guarda `sourceLanguage` e `targetLanguage` entre as 10 línguas, e `active` passa a ser `original | translated`. Projetos da v0.42 a v0.44 (`'pt-BR'`) são lidos como inglês → português.

## Limites conhecidos (não verificados aqui)

- A qualidade real do Whisper e do M2M100 nessas línguas não foi medida: o ambiente de desenvolvimento não alcança o Hugging Face. Isso precisa de vídeos reais e de revisão humana por língua.
- O tamanho exato do download do M2M100 em int8 não foi conferido. A tela mostra os bytes reais durante o download.
- O M2M100 418M é um modelo pequeno: em frases idiomáticas ele erra mais que o OPUS-MT. A faixa traduzida é marcada como beta e a original fica guardada.

## Verificação posterior em 03/11/2026

O Brave no Windows carregou o M2M100 q8 e traduziu duas frases sintéticas de russo para português. “Доброе утро.” saiu como “Boa manhã.” e “Большое спасибо.” como “Muito obrigado.”. A primeira expressão pede revisão para “Bom dia.”. Essa amostra não qualifica outros pares nem legendas longas. A partir da v0.45.4 os pesos usam a revisão fixa `9c374f0b7aca709787cea97b047bfbbd1559d177`.

A faixa guarda o repositório e a revisão que o Worker reportou no resultado final. Corrigir uma legenda traduzida marca a legenda individual como editada manualmente. Faixas antigas sem esses campos continuam válidas; o editor não atribui retrospectivamente um modelo a elas.
