# Editorial Decision Engine: precisão com modelos gratuitos

**Hipótese:** bons resultados emergem de restrições, bons candidatos e referências, não de pedir a uma IA genérica que edite tudo.

## 1. Hierarquia de decisão
- **Determinismo primeiro:** formato, transcrição temporal, silêncio, limites de áudio, alinhamento, zoneamento de texto e aplicação de templates são código.
- **Classificador/embeddings locais:** reconhecer eventos (lista, número, comparação, preço, chamada para ação, alerta) e buscar cenas.
- **Modelo de linguagem:** comparar 3–5 opções de gancho, narrativa, cenas e ritmo; responder em JSON validado.
- **Segundo modelo apenas em alta incerteza:** nunca usar votação entre muitos modelos por padrão. Erros podem ser correlacionados.
- **Sem modelo:** aplicar regras conservadoras e oferecer revisão manual; não fingir qualidade equivalente.

## 2. Pré-processamento como vantagem competitiva
Anotar cada frase com `id,start,end,original_text,transcript_confidence,voice_quality,topic,face_position,speaker` e evidências da mídia. Identificar listas, moedas, datas, porcentagens, correções, negação, contexto e eventuais falhas acústicas. Consolidar tomadas repetidas, mantendo histórico.

## 3. Ganchos
Algoritmo gera top K de frases completas com autonomia de sentido. Filtros: comprimento compatível, voz inteligível, contexto suficiente, falta de contradição, no invented data. Avaliação semântica com critérios: especificidade, clareza, curiosidade, tensão, representatividade, coesão com restante da história. A frase escolhida deve caber no começo da timeline, mas **o gancho não precisa acabar aos 3 s**, salvo solicitação explícita; a primeira informação interessante deve ocorrer no intervalo solicitado.

Regras **nunca** permitem remover ressalva/negação para aumentar impacto; se nenhum gancho existir, usar texto fiel derivado de fonte confirmada ou recomendar regravação, com indicação clara.

## 4. Microdecisões, prompts especializados
Uma chamada = uma decisão. Exemplos de tarefas:
- `rank_hooks(candidate_ids, criteria)`
- `choose_story_blocks(candidate_blocks, max_duration, required_claims)`
- `choose_motion_scene(phrase_id, compatible_scene_ids_including_none)`
- `classify_transition(change_type, visual_rhythm)`
- `explain_revision(scope, prior_decisions)`

Saída estrita por schema, limitada a IDs existentes; validação local de enums, duração, consistência semântica e evidência. Reparo de JSON só se formato falhar. Resposta inválida -> fallback determinístico, não loop infinito.

## 5. Biblioteca semântica e few-shot
Indexar o catálogo com:
`scene_id, when_to_use, when_not_to_use, semantic_tags, supported_format, min_max_duration, required_facts, face_safe_region, visual_weight, style_family, asset_ids, license`.
Embeddings produzidos na publicação e, quando necessário, localmente. `topK` reduz tokens; re-ranking por regras rígidas; IA só escolhe 3–5 compatíveis. Incluir sempre `none`.

Criar banco de decisões de referência: entrada real, alternativas, escolha de especialista, porquê, falhas comuns. Inserir 2–4 exemplos relevantes no prompt, não todo o manual.

## 6. Contexto persistente por projeto
- Cache de transcrição, keyframes, embeddings, candidatos, decisões e versão do motor.
- Revisão local reprocessa dependências afetadas; corte atualizado invalida tempos/legendas/cenas subsequentes.
- Plano reprodutível no projeto, com fingerprints de fontes, versão de modelo/prompt/catálogo.
- O usuário pode reverter e escolher manualmente.

## 7. Confiança corretamente calibrada
Não usar `confidence` autorreferida de LLM como probabilidade confiável. Estimar risco através de sinais observáveis (diferença de ranking, qualidade da transcrição, verificação semântica, consenso com regras, comportamento em benchmarks por gênero). Calibrar em dados rotulados. Encaminhar apenas escolhas incertas para modelo melhor/humano.

## 8. Falhas proibidas
Inventar preço, resultado, prova, marca, tratamento, depoimento, estatística; inverter `não`; escolher cena ilustrativa enganosa; sobrepor UI à face; repetir transições desnecessárias; gerar código executável; cortar palavra pela metade.

## Inspirações
- [Editonny suggest_visuals.py](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/helpers/suggest_visuals.py): detecção de tópicos, limites de frequência, prioridade de cena.
- [Semantic Router](https://github.com/aurelio-labs/semantic-router): roteamento por embeddings.
- [TypeChat](https://github.com/microsoft/TypeChat): tradução a tipos e validação.
- [Outlines](https://github.com/dottxt-ai/outlines): restrição de saídas, quando engine permite.
- [DSPy](https://github.com/stanfordnlp/dspy): otimização **offline durante desenvolvimento**, não por edição de usuário.

## Critério de sucesso
Aprovação técnica de JSON é necessária, mas não suficiente: benchmarks cegos e comparação qualitativa de motion/gancho são gate separado.
