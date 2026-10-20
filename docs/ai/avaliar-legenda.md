# Como medir o acerto da legenda num vídeo real

Desde a v0.8.0 (ADR-0013). Tudo roda no navegador; o vídeo não sai do computador. Não precisa de terminal.

## Passo a passo
1. Abra o endereço do app com **`?avaliar`** no fim (ex.: `https://…/?avaliar`). Use Chrome ou Edge no computador.
2. **Escolha o vídeo** (o mesmo do teste, por exemplo o de 145 s).
3. **Cole o que foi dito de verdade** na caixa de texto. Precisa ser o texto exato da fala, palavra por palavra (pode digitar ouvindo o vídeo, ou corrigir à mão a legenda do app e colar). Pontuação e maiúsculas não contam.
4. Escolha o **modelo**: "Precisa" e "Rápida" usam a mesma escolha automática do editor; as opções "Só …" forçam um modelo para comparar (sem reserva).
5. Clique em **Transcrever e medir**. Na primeira vez com cada modelo, ele é baixado (o turbo tem cerca de 1,4 GB).

## O que aparece
- **Acerto** (= 1 − WER) e **WER** (taxa de erro por palavra: trocas + faltas + sobras, dividido pelas palavras ditas). "80% de acerto" é WER 20%.
- Quantas palavras foram ditas, quantas a legenda tem, trocas, faltas e sobras.
- **Sem a limpeza de alucinações**: o mesmo resultado antes de tirar laços e frases inventadas (mostra quanto a limpeza ajudou ou atrapalhou).
- **Ignorando acentos**: quanto do erro é só acento.
- **Erros mais comuns** ("dito → legenda") e a **comparação palavra a palavra** (amarelo = trocada, vermelho = faltou, azul = sobrou).
- **Tempo de cada palavra** (início e fim em segundos): para conferir a sincronia, dê play no vídeo e compare com alguns pontos.
- Tempo total gasto (inclui o download na primeira vez; rode de novo para ver só a transcrição).

## Como reportar
Copie para o feedback: o modelo, o acerto, a duração do vídeo, o tempo gasto e os 5 erros mais comuns. Compare "Precisa" e "Só Whisper base (processador)" no mesmo vídeo para ver a diferença entre a v0.8 e a v0.7.

## Para desenvolvedores
- WER puro em `src/analysis/wer.ts` (`wordErrorRate`, `align`, `topErrors`), testado em `tests/wer.test.ts`. Normalização: minúsculas, NFC, sem pontuação, hífen e barra separam palavras; acentos contam (opção `ignoreAccents`). Números escritos ("três" × "3") contam como erro: na referência, escreva como o Whisper costuma escrever, ou anote à parte.
- A página está em `src/app/Evaluate.tsx`: mesmo caminho do editor (silêncios → `planAsr` → Worker → `mergeWindows` → `cleanTranscript`).
- O ambiente de desenvolvimento não alcança o Hugging Face nem tem placa de vídeo: os números de acerto e tempo só existem depois de rodar no computador de alguém. Não publicar números sem esse teste.
