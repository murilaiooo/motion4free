# QA e integração isolada da #102 (22/10/2026)

## Estado

Branch `fix/102-contextual-clips-main-20261022` nasce em `main` commit `1e08d2a` da #73. Usa somente os componentes necessários da PR #105 e correções #102 revisadas em #116. Não incorpora MediaPipe #54, experimentos motion, dataset cego, licenças #2, ou configurações de outras issues.

## Correções implementadas por revisão de código

- Índice integral de transcrição por IDs e tempos; descoberta local a partir dos inícios de frases em toda a gravação; avisos conservadores de antecedente/pergunta/conclusão.
- Janelas para IA limitada por bytes de UTF-8, expansão temporal onde cabe, até 2048 janelas planejadas e **no máximo 32 consultas** distribuídas em fontes muito extensas; cobertura incompleta explicitada. A cota da conta externa pode variar; nunca troca provedor automaticamente.
- Resposta de IA não determina títulos, fatos ou timestamps livres: somente IDs conferidos. Fallback local caso a IA falhe ou a janela não comporte contexto.
- Reanálise preserva seleções alteradas manualmente, títulos, bordas e downloads; apenas um render concluído que realmente mude é revogado.
- Mapa da gravação de origem persiste e limita `sourceEnd` ao fim solicitado; evita atribuir padding de codificação a conteúdo inexistente. Preserva origem editável no arquivo derivado sem modificar o original.
- Testes de comparação do contexto com a referência anterior; registros PT/EN; 40 mil palavras, fim da gravação, bytes/Unicode, limite de chamadas, IDs inventados e fonte truncada.

## Gates não executados / não certificados

A publicação dos commits da PR #105 acionou workflows App e Documentation que falharam **antes de iniciar qualquer step**, em cerca de 2 segundos, sem logs disponíveis. Isso **não comprova falha de código nem aprovação de testes**. Para fechar #102, executar `npm ci`, `npm run typecheck`, `npm test`, `npm run build` e testes reais no Brave em branch isolada, com fontes autorizadas. O benchmarking exige 20 gravações autorizadas anotadas e avaliação cega de contexto/setup/payoff, sincronismo, CPU/RAM, e comparação baseline/local/IA opcional. Não usar dados inventados como prova. Manter PR como Draft até gates completos.
