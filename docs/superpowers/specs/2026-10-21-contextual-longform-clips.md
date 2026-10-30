# Especificação de produto: Criador de Clipes Contextual vNext

**Data:** 21/10/2026. **Status:** proposta técnica pronta para implementação por gates, sem alterar runtime. **Referência auditada:** [SupoClip @ 01daf777](../../research/2026-10-21-supoclip-deep-dive.md). **Decisão:** usar o editor existente como etapa seguinte; nenhuma nova infraestrutura central, upload silencioso, pagamento obrigatório ou transplante automático de código AGPL.

## Resultado esperado para o criador

A pessoa fornece uma gravação longa (podcast, entrevista, live gravada, aula ou conversa), escolhe um objetivo simples e recebe **somente sugestões defensáveis** de vídeos curtos para Shorts, Reels e TikTok. O algoritmo detecta ideias com começo, meio e fim, oferece um título fiel, explica o motivo da seleção e permite revisar o trecho com contexto antes de editar/exportar. Não promete views.

### Primeiro uso, máximo cinco ações

1. **Escolher vídeo local.** Mostra duração/tamanho e compatibilidade. Reaproveitar a interface de upload atual, não impor novo login.
2. **Escolher objetivo** (padrão: “Melhores momentos”; opcionais: insights, história, humor, controvérsia factual, tutorial), público, quantidade desejada e duração. Predefinições recomendadas, controles avançados recolhidos.
3. **Analisar**: progressos separados para leitura, transcrição, exploração dos assuntos, checagem de contexto e ranking. Explicar quando a transcrição será enviada a provedor externo, com consentimento.
4. **Revisar melhores momentos**: cartões com player começando alguns segundos antes, transcrição destacada, título editável, motivo, nota editorial compreensível e aviso se falta contexto; botão **“Ajustar contexto”** abre bordas com palavras/frases.
5. **Editar ou exportar**: abrir no editor do Motion4Free com mídia de origem e cortes reversíveis, ou exportar clipe individual/em lote. Nunca gerar MP4 em lote sem seleção explícita. Manter resultados ao navegar entre seções.

### Padrões editoriais

- **Standalone**: quem não assistiu ao original entende quem/que situação/qual problema está sendo discutido.
- **Hook honesto**: primeiros ~1–3 segundos criam curiosidade sem prometer informação que não aparece.
- **Payoff**: antes de terminar, entrega resposta, lição, punchline, demonstração ou conclusão coerente. Uma pergunta cortada antes da resposta é rejeitada.
- **Fidelidade**: não separar “não” de seu predicado, não inverter condição (“se”), não omitir fonte/quantificador, não manipular falas para alegar algo não dito. Títulos devem ter evidência no corpo.
- **Som e cadência**: evitar início/fim abrupto de fonemas, silêncios mortos e costuras com estalo; preservar pausas dramáticas quando significativas.
- **Diversidade**: preferir assuntos diferentes na lista. Evitar múltiplas versões do mesmo trecho sem pedido explícito.
- **Qualidade sobre quantidade**: se pediu 10 e só existem 3 bons, entregar 3 e explicar. Não recortar os primeiros 30 segundos como se fossem destaque.
- **Idiomas**: preservar língua da fala; calibrar PT-BR, EN, code-switching e sotaques, sem heurísticas só em inglês.

## Pipeline funcional

### Fase A: interpretar, não simplesmente fatiar

Entrada canônica: `LongAnalysis` com `words`, `silences`, `energy`, `durationSec`, modelo ASR e avisos. Índice de transcrição precisa de identidade estável de palavras, ID de sentença/tópico, tempo absoluto, status de confiança e falante quando conhecido. Janelas por linhas/frases com overlap e limite adaptável a token budget, não apenas segundos. Incluir cobertura de TODO o vídeo, com casos de fala em outra língua.

### Fase B: gerar mais candidatos que a lista final

Manter a heurística atual `findMoments` como um baseline e candidato, **não como universo fechado**. Gerar mais janelas de frases/histórias (inclusive inícios fracos reparáveis, respostas interessantes iniciadas por pergunta anterior). Permitir LLM opcional devolver IDs de palavras/frases existentes de novas sugestões, nunca cortes livres sem validação. Rejeitar saída sem ancoragem, com números inventados, span fora do vídeo ou contextos conflitantes. Fallback local pleno quando IA indisponível.

### Fase C: construir mini-história

Para cada candidato:
- identificar abertura, setup suficiente, desenvolvimento e payoff;
- procurar referências sem antecedente (“ele”, “isso”, “como falei”);
- verificar pergunta↔resposta e tese↔exemplo;
- expandir no original quando falta contexto próximo sem destruir o gancho;
- permitir corte mais curto **somente** se a ideia permanece íntegra;
- bloquear finais em conjunção, meio de frase, argumento inacabado ou próximo tópico;
- marcar `needsReview` quando resolução automática não for confiável.

Não inventar falas, intercalar comentários de diferentes minutos nem substituir visual por voz sintética. Cold-open repetido e reordenação não linear só no modo avançado, visíveis na timeline e desativados por padrão.

### Fase D: classificar, justificar, comparar

Expor 6 dimensões com evidência: `hook`, `standalone`, `payoff`, `specificity`, `delivery` (ritmo e expressividade), `shareability`. Regras de triagem:

- Qualquer `standalone` ou `payoff` flag **reprovado** → não promover automaticamente aos melhores momentos, independentemente de energia/hook.
- Falta de evidência de uma dimensão → indicar “não avaliado”, não inventar 100.
- Título não sustentado pela fala → retirar/revisar título.
- Ranking relativo global entre janelas, com dedupe temporal e por assunto; permitir seleção humana, não esconder descartes.
- Score 0–100 deve ser rotulado **“nota editorial estimada”**. Não apresentar como taxa provável de viralização.

### Fase E: montar vídeo editável e contextual

Um `ClipCandidate` referencia a gravação original por `sourceId` e IDs de palavras; alterações produzem `SourceSpan[]`. Criar `OutputSpan[]` mapeando tempo original para tempo final em todas as operações. Legendas e áudio seguem spans reais. Reaproveitar editor, templates, enquadramento, renderer e export existentes. Não renderizar/exportar antes da revisão do candidato; permitir preview rápido no original.

## Contrato de dados/validação

`Candidate` contém `sourceId`, `candidateId`, `wordSpans`, `topicId`, `hook`, `setup`, `payoff`, `title`, `evidenceWordIds[]`, notas por dimensão, `selectionReason`, `uncertaintyFlags[]`, `analysisMode`, `modelName` e revisão do schema. Não persista chaves nem textos enviados a APIs em logs. IDs devem existir no índice atual da transcrição; fim precisa ser maior que início; spans ordenados para fluxo linear; quaisquer repetições são explícitas e têm provenance. Regras **não aceitam timestamps ou texto da IA como fatos**. Gerar título a partir do transcript validado.

## Modos de execução/privacidade

- **Regras locais (padrão)**: gratuito, sem chave e sem rede além do carregamento de assets/modelos explicitado na aplicação.
- **IA no dispositivo**: se o hardware suporta e a pessoa escolhe. Avisar memória, download, tempo e eventuais limitações.
- **IA de provedor (BYOK)**: somente depois de consentimento contextual, integração da issue [#73](https://github.com/murilaiooo/motion4free/issues/73), transparência sobre trechos transmitidos, preço/cotas no provedor e política de retenção. Não enviar vídeo bruto por padrão. Sem fallback silencioso de gratuito para pago. Falha → sugestão local claramente marcada.
- A indisponibilidade de IA nunca transforma corte aleatório em um suposto momento viral.

## Interface e mensagens

Exemplos de UX:
- **“Encontramos 4 momentos completos. Outros 6 trechos tinham uma abertura forte, mas não traziam a conclusão.”**
- **“Este corte começa com ‘isso’ sem explicar a que se refere. Inclua a frase anterior.”**
- **“A análise por IA não está disponível. Mostramos candidatos encontrados no dispositivo.”**
- **“Nota de qualidade editorial: 82/100. Não é previsão de visualizações.”**

Botões reais, sem efeito decorativo: **Ouvir com contexto**, **Ajustar início/fim por frase**, **Ver transcrição**, **Reescrever título a partir da fala**, **Descartar**, **Comparar candidatos**, **Abrir no editor**, **Baixar**. Erros visíveis ganham código `M4F-xxx` e documentação, conforme `AGENTS.md`.

## Casos obrigatórios de aceitação

1. **Referência ausente**: “ela fez isso...” sem pessoa/objeto antes → expandir ou não recomendar.
2. **Resposta atrasada**: pergunta forte no minuto 3, resposta real no minuto 5 → não publicar só a pergunta como resposta; separar quando não cabe duração ou marcar revisão.
3. **Negação**: “NÃO recomendo” nunca virar “recomendo”; “não é eficaz” não pode sair “é eficaz”.
4. **Número/condição**: “até 30% se...” não vira “30% para todos”.
5. **Fim de frase**: último segundo não perde punchline ou verbo; não arrastar início de novo assunto.
6. **Sotaque e code-switch**: português/inglês/termos mistos sem títulos em outro idioma por engano.
7. **Podcast dois falantes**: crop segue falante correto ou recua para split/wide; legenda do falante correto quando diarização confiável.
8. **Duplicidade**: mesmo momento no overlap das janelas aparece uma só vez.
9. **Assunto genérico**: alta energia, nenhum payoff → não lidera o ranking.
10. **ASR ruim, sem fala, vídeo curto demais, áudio ausente, limitação de RAM, offline, quota/API/CORS**: fallback honesto ou erro acionável.
11. **Source-map**: trim, split, salto, remoção de pausa e reedição mantêm palavras/áudio/legendas e vídeo de origem corretamente alinhados.
12. **Prévia vs export**: mesmo enquadramento, duração, áudio e sobreposições; não perder o texto no vídeo gerado.
13. **Sem dados externos**: rede observada sem request contendo mídia/chave/transcrição para terceiros sem consentimento.
14. **Não regressão**: fluxo atual de clipes/editor/export, projetos salvos e navegador Brave continuam funcionando.

## Critério de aceitação de qualidade

Criar conjunto inicial de **20 vídeos autorizados** (expansível a 50–100) com anotação humana dos trechos bons/ruins, não-respostas, contextos, palavras críticas e alternativas. Teste cego com pelo menos 2 pessoas avaliando sem assistir ao original: **“entendi o assunto?”, “recebi payoff?”, “o título descreve mesmo o vídeo?”**. Calcular top-k relevância com humanos, taxa de cortes sem contexto, cortes sem payoff, alteração de sentido e consistência temporal; comparar versão anterior/novo local/novo BYOK. Definir metas estatísticas só depois de baseline medido, sem prometer melhoria inventada. Zero regressão comprovada em negação/números/sincronia nos testes de controle. Guardar resultados em `docs/ai/evaluation.md` ou relatório vinculado.

**Revisão humana continua obrigatória para publicar conteúdo sensível/factual.** A ferramenta ajuda o editor a escolher, não substitui checagem de fatos nem tem como garantir viralização.
