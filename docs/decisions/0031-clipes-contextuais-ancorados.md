# ADR-0031 — Descoberta contextual por spans ancorados

21/10/2026. IMPLEMENTED — NOT TESTED / AWAITING QA. Ref #102; depende de #100 → #99 → #97. Baseado na spec/pesquisa do PR #101, com implementação independente; nenhum runtime/código/asset SupoClip/AGPL foi incorporado.

## Root cause

O caminho anterior só ordenava o top-N heurístico e aceitava um título livre limpo, sem ancorar seus fatos. Não podia descobrir um span fora da lista nem reparar contexto. A curadoria só nudgava palavras próximas de ±3s.

## Design

- Índice de até 200.000 palavras com IDs únicos, ordem e tempos conferidos. Mantém a transcrição original; não inventa diarização/confiança. Frases por pontuação/pausa/limite de 1.800 caracteres estimados; fronteira sem pontuação é incerta.
- Janelas JSON por frase de até 5.000 caracteres, com uma frase de overlap e avanço garantido até o fim. Input e prompt injection permanecem dados delimitados; consentimento real mostra todo o pedido.
- Gerador local explora todos os inícios de frase, com duração válida, reparo de antecedente próximo e pergunta final, flags de contexto. Pool reduzido de 600 para 200 entradas com dedupe temporal; lista de até 20 sugestões. O baseline antigo é opt-in e não compõe o pool limitado automaticamente.
- IA escolhida usa o mesmo prepareAi, orçamento, cooldown, cache e cancelamento. Propõe só IDs de começo/fim, título, setup/payoff existentes na janela e em ordem. Rejeita resposta inválida; não envia mídia, não aceita timestamps/fatos livres e não repete falhas pagando novas janelas. Cobertura parcial é explicitada.
- Título automático é uma sentença completa de até 60 caracteres, senão um rótulo neutro de tempo. Um recorte de palavras não pode retirar 'não/se/até' de uma alegação. Título humano é explícito e preservado ao mover bordas.
- UI permite ouvir com 6s de contexto, ler antes/depois, mover bordas por frase, editar título e selecionar propostas. Novos resultados não substituem seleções/artefatos de curadoria existentes; resultado tardio de outro trabalho é descartado. Ajuste de borda não faz render.
- Origem do derivado (ID SHA-256 de metadados, offset, duração original/derivada) persiste por clipId. originalOutputSpans compõe EDL/ordem da edição com a origem. Preview/export continuam usando a pipeline existente e o mesmo arquivo derivado. Original nunca é modificado; ampliar além do derivado exige a origem no Criador.

## Limits / QA gates

Pontuação de estrutura, pronomes/condições e âncoras de IDs não provam semântica, payoff real ou qualidade artística. Não há probabilidade de viralização, diarização, recorte de falante ou notas fabricadas em seis dimensões. Referência sem antecedente e frase interrompida são sinais conservadores; conteúdos ambíguos pedem revisão. Não foi medido CPU/RAM, nem comprovada a matriz PT/EN, ASR incompleto, números/negações/condições, fonte→derivado→output, codec ou paridade MP4. Dataset de 20 gravações autorizadas e avaliação cega são trabalho de QA. Nenhum teste ou validação foi executado.
