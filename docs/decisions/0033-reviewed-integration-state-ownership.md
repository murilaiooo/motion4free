# ADR-0033 — Estado versionado na integração revisada

Status: implementação Draft, UNTESTED / AWAITING QA. Data: 2026-10-21.

## Contexto

A revisão estática das entregas #97–#115 encontrou contratos que cada branch isolada não preservava na composição: metadados de origem e rastreamento disputavam os mesmos campos; análises de rosto sobrescreviam o banco usado por versões anteriores; sugestões confundiam seleção automática com curadoria; IDs cegos se repetiam entre rodadas.

## Decisões

- Integrar os heads originais numa branch isolada, sem merge em main ou de PRs no GitHub. A revisão entrega um head combinado; os antigos Drafts continuam como histórico das implementações, não como o alvo final de QA.
- Guardar o caminho de rosto em banco imutável e a seleção no `ClipRef.faceTrackId`: `undefined` lê o formato legado por ID do clipe, `null` declara ausência, string seleciona uma análise. Manter entradas referenciadas por desfazer/refazer/versões nomeadas. Descartar resultado se o histórico mudou durante a análise.
- Distinguir seleção manual (`selectionEdited`) de defaults automáticos. Regenerar preserva trabalho humano e artefatos, mas pode substituir defaults. Reanálise por IA preserva as seleções atuais. Abrir um projeto não altera a propriedade do download já gerado.
- Manter a transcrição ambígua em vez de remover repetições por proximidade textual. Marcar revisão humana e usar silêncio medido como evidência para limpeza conservadora.
- Janelas de IA usam custo UTF-8 após escape, sobreposição temporal quando cabe e limite de 32 chamadas distribuídas. Contexto local usa teto de 3.000 bytes para a mensagem, reservando espaço no modelo de 4.096 tokens; isso é limite conservador, não contagem exata do tokenizer. Cobertura insuficiente é declarada, mantendo candidatos locais.
- Pacotes/respostas cegos v2 incluem UUID opaco por preparação. O curador cria nova identidade a cada rodada; a seed controla ordem, não identidade nem sigilo. Rejeitar pacotes v1 sem adivinhar a rodada. O UUID não autentica arquivos de vídeo nem substitui conferência do curador.
- Notificações de preferências cancelam imediatamente pedidos em andamento; callbacks de credenciais primeiro releem o estado persistido. O cofre só altera a lista de membros depois da gravação; revogação usa também a propriedade de sessão.

## Consequências e limites

Schemas de projetos mantêm compatibilidade com metadados opcionais antigos. Pacotes cegos experimentais v1 devem ser recriados; a chave privada v2 contém `{version, packageId, entries}`. Nenhuma migração inventa associação de respostas antigas.

Análise de rosto continua experimental e espacial, sem identificar falante. Ativá-la preenche a tela com zoom mínimo 1, preservando offsets/zoom compatíveis; desfazer recupera o estado anterior. Negação e histórias locais continuam heurísticas. O cache pode ter seu timer atrasado por suspensão da aba; sua validade é conferida em acesso e revogação o limpa.

Não se alterou CSP para adicionar `unsafe-eval`: leitura do MediaPipe 1.1.1 e dos caminhos browser de AAC/WebLLM não mostrou necessidade. O helper dinâmico do ONNX foi encontrado, mas sua invocação no caminho selecionado não ficou provada por leitura; a compatibilidade do runtime com CSP permanece cenário de QA. Licenças embutidas/remotas continuam parcialmente pendentes.

Nenhuma execução/medição foi feita. A decisão depende de QA do head combinado antes de merge, divulgação ou alegação de correção verificada.
