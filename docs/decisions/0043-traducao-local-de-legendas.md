# ADR-0043 — Tradução local de legendas (inglês → português do Brasil)

Data: 02/11/2026. Status: aceita (beta). Issues: #175 (defeito), #172 (tradução em geral), #171 (idioma da fala).

## Contexto

O PR #174 trouxe a primeira tradução de legendas: o modelo OPUS-MT en-ROMANCE (Helsinki-NLP, conversão ONNX
`Xenova/opus-mt-en-ROMANCE`, pesos CC-BY-4.0) roda no navegador, em WASM, sem enviar texto nem áudio. No
primeiro teste real (vídeo em inglês, 33 s) as legendas traduzidas saíram com `>>pt_BR<<` escrito na tela e
frases em francês ("C'est bizarre") e espanhol ("Algunos como tu...").

## Causa

O en-ROMANCE traduz para mais de 40 línguas e escolhe a de saída por um token no começo da frase
(`>>pt_BR<<`). No Python, o `MarianTokenizer` separa esse código e o envia como **um** token. No
`@huggingface/transformers` 4.x, `tokenizer(texto)` e o pipeline de tradução chamam `_encode_plus` →
`_tokenizer.encode` direto; o `MarianTokenizer._encode_text`, que trata o código, não é mais chamado. O código
vira texto comum (no melhor caso precedido de um `▁`; no pior, quebrado em `>`, `pt`, `_`, `BR`): o modelo não
recebe o idioma, copia os pedaços para a saída e escolhe o idioma mais provável do treino. O teste
`tests/marian-input.test.ts` reproduz isso com o tokenizer real da biblioteca.

## Decisão

1. **Entrada montada como no Python**: `[id do idioma, …peças do texto, </s>]` (`src/translation/marian.ts`),
   com `generate()` chamado direto (sem o pipeline). O código de idioma só é usado se existir no vocabulário do
   modelo carregado (`>>pt_BR<<`, depois `>>pt_br<<`, depois `>>pt<<`).
2. **Cada trecho é conferido antes de virar legenda** (`src/editorial/translation-check.ts`): recusa códigos e
   tokens internos, francês/espanhol/italiano, texto que voltou em inglês, repetição sem fim e texto muito maior
   que a fala. Não "limpa" o texto: tirar o `>>pt_BR<<` esconderia o francês. Um trecho ruim tenta o próximo
   código de português; se nenhum passar, **a faixa inteira é recusada** (M4F-318) e a legenda original fica.
3. **Troca atômica**: a faixa traduzida só entra no projeto depois que todos os trechos passam, e só se o
   projeto não mudou durante a tradução (M4F-317). Falha de download/início do modelo é M4F-319.
4. **Tamanho das legendas traduzidas** segue o tamanho médio das originais do modelo visual (18–42 letras) e a
   legenda fecha no fim da frase. Tempo por frase, nunca por palavra (sem karaokê inventado).

## Limites conhecidos

- A detecção de idioma usa palavras e sinais exclusivos de cada língua; em frases de uma ou duas palavras ela
  é fraca de propósito e só recusa com evidência clara. Não substitui revisão humana do sentido.
- O caminho de sucesso com o modelo real **não foi executado** no ambiente na nuvem (huggingface.co bloqueado
  pela rede do ambiente). A falha de download foi testada no navegador (`e2e/issue175-translation.spec.ts`).
  A #175 só fecha depois do teste com o modelo real e do OK do responsável no vídeo dele.
- A versão do modelo ainda é `main` no Hugging Face; fixar o commit exato junto com o teste real.
