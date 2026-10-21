# Plano TDD: seleção de clipes longos com contexto e payoff

**Origem:** [análise SupoClip](../../research/2026-10-21-supoclip-deep-dive.md) e [spec aprovada para execução somente após revisão/gate](../specs/2026-10-21-contextual-longform-clips.md). **Status:** plano proposto, **nenhum passo de runtime executado nesta pesquisa**. Usar `AGENTS.md`, ADRs, planos correntes e verificar branch/main no momento do código. Evitar escopo misto; alterações locais existentes no PC são de outro trabalho e devem ser preservadas.

## Regra operacional

Trabalhar em branch isolada e PR pequeno por conjunto. Antes de mudar código, confirmar se outro PR/issue já entregou a capacidade. Nunca fazer `git reset --hard`, sobrescrever arquivos uncommitted nem disparar Actions repetidos (cota pode estar esgotada). Testes locais dirigidos primeiro; executar testes de render real **apenas quando houver alteração que o exige**, usando clipes curtos de fixture legalmente autorizada. Não transformar a integração numa migração para Next.js, Python, Redis, servidor ou AssemblyAI obrigatório. Registro de versão/CHANGELOG/códigos de erro é obrigatório quando houver alteração publicada de produto.

## PR A. Fundação narrativa e índice de transcrição (P0)

**Arquivos candidatos:** `src/editorial/clip-context.ts`, `clip-windows.ts`, `tests/clip-context.test.ts`, `tests/clip-windows.test.ts`. Reutilizar `core/types.ts:Word`, `editorial/hooks.ts` e `clip-pipeline.ts:LongAnalysis`.

1. Estabelecer IDs estáveis para palavras/sentenças, versão de índice, idioma/falante opcional, offsets e texto do original. Guardar somente dados locais em formato versionado.
2. Segmentar em frases com pontuação e pausas, mas **não supor pontuação ASR perfeita**. Registrar bordas com confiança baixa. Janelas adaptáveis por frases, overlap com antecedente e contexto de resposta, cobertura até o fim; permitir AbortSignal/limite de memória.
3. Detectar de forma conservadora pronomes sem antecedente, concordância isolada, back-reference, pergunta sem resposta, marcadores de negação/condição, início de novo tópico e payoff ausente. Não afirmar compreensão semântica no fallback determinístico quando evidência é insuficiente.
4. API pura proposta: `buildTranscriptIndex(words, opts)`, `partitionContextWindows(index, budget)`, `evaluateStandalone(span, index)`, `repairSentenceBounds(span, index, policy)`.
5. Testar texto misto PT/EN, minuto > 100, silêncio curto, palavra duplicada, frases sem pontuação, nenhuma palavra, transcrição parcial, fronteiras e efeitos de navegação/cancelamento.
6. Aceitar quando qualquer span retornado aponta para palavras existentes e nenhuma operação altera transcrição/bruto, troca “não” por “sim” ou perde fim de sentença nos fixtures críticos.

## PR B. Descoberta de candidatos para TODO o vídeo (P0)

**Arquivos:** `src/editorial/clip-candidates.ts`, `tests/clip-candidates.test.ts`; ajustes mínimos em `highlights.ts` como fallback/compatibilidade.

1. Preservar `findMoments` como baseline. Criar propostas por frases completas, tópicos e perguntas-respostas, inclusive fora do top-N heurístico.
2. Limitar spans com durações configuráveis 15–30, 30–60, 60–90 s; suporte a duração natural sem forçar fim em posição arbitrária. Se narrativa não cabe, preferir rejeitar ou oferecer corte revisável.
3. Aplicar filtros de contexto e concluir payoff antes do top-k. Não atribuir excelente score só por volume, pergunta ou número.
4. Conservar identidade de candidatos para revisão, seleção e cache; dedupe por overlap relativo ao menor span, tema repetido e limiar configurável. Não remover por engano perguntas distintas num mesmo tópico.
5. Testar caso em que melhor história tem voz calma e baixa energia; intro alta energia fica abaixo. Testar resposta com setup anterior, 2 partes sem nexo e “5 candidatos, só 2 completos”.
6. Aceitar quando análise da gravação inteira não depende de cortar a lista por um top-N precoce e candidato fora do baseline pode emergir validamente.

## PR C. IA opcional com seleção semântica ancorada (P0/P1)

**Arquivos:** `src/editorial/clip-grounding.ts`, `clip-rank.ts`, adaptar `moments-ai.ts`, `AiOptions.tsx` somente conforme #73, testes sem chamadas reais.

1. Tipos de saída: `candidateId` ou `firstWordId/lastWordId`, `claim/antecedent/payoff word IDs`, `reason`, `title`, dimensões de nota e eventuais bandeiras de incerteza. Evitar confiar em horários/títulos gerados sem prova.
2. Para cada janela, enviar ao modelo apenas dados necessários com IDs/tempos; preservar prompt de sistema acima de transcrição não confiável. Limitar bytes/tokens e não persistir texto sensível em logs.
3. Validar schema, IDs, ordem/duração, integridade de negação, correspondência real do título com fala e existência de payoff. LLM pode **propor candidatos novos** e expansão/redução de bordas, diferentemente do rerank somente atual.
4. Comparar globalmente top candidatos entre janelas, com fallback ao rank local se a IA falhar. A pontuação final é relativa/editorial, não “chance de viral”.
5. Impor um só job ativo por projeto ou cancelar anterior, timeouts, limites de quota, nenhuma mudança silenciosa de modelo/provedor; integração com BYOK seguro da #73.
6. Testar JSON parcial, duplicatas, ID inventado, prompt injection dentro da fala, idioma diferente, modelo sem CORS, timeout, quota, recusa, resposta vazia, contaminação entre projetos. **Nenhum teste com chave real no repo.**
7. Aceitar quando IA nunca move vídeo para span sem ID verificável, não vaza mídia, e falta da IA preserva experiência útil offline.

## PR D. Source-map não destrutivo e edição (P0 antes de export novo)

**Arquivos:** `src/editorial/clip-source-map.ts` (ou reutilizar EDL existente), `editorial/clip-plan.ts`, `app/clip-pipeline.ts`, `tests/clip-source-map.test.ts`.

1. Modelo `SourceSpan[]` + `OutputSpan[]` explicitando ordem do output, inclusive cortes separados, com sourceId e timeline de origem.
2. Compor/trim/split/merge/remover silêncio/reordenar por operações reversíveis; recomputar palavras e captions no output final preservando a relação com o original.
3. Não fazer render intermediário por candidato só para ajustar limites; reutilizar `cutRange`/export existente na etapa de render escolhida. Preferir caminho já suportado para não introduzir bug de mux/sync.
4. Cobrir duração real vs duração teórica, boundaries de keyframe, áudio multi-stream, formato vertical/original, seek, zero spans e spans inválidos.
5. Regressão: export e player com os mesmos frames/legendas/áudio, recuperando projeto após reload; rollback fácil caso a nova timeline falhe.

## PR E. UX de curadoria contextual (P1)

**Arquivos:** `src/app/ClipMaker.tsx`, `clips.css`, UI de preview/estado existente, `e2e/clips-contextual.spec.ts`.

1. Configuração simples com presets, número e duração; avançado opt-in. Mostrar transcrição e resultados em ordem com evidências reais, motivo e aviso de confiabilidade.
2. Botão `Contexto` toca ~5–10 s anteriores/depois sem editar; controles para borda por frase e edição manual com preview rápido. Nunca alterar hidden state/seleção do usuário ao trocar modo de IA.
3. Seleção em lote é explícita, revisão individual, abrir no editor ou baixar por clipe. “Nenhum clipe completo” é estado válido com instruções concretas.
4. Progresso granular, cancelar e retomar via cache, comportamento estável no Brave, teclado/acessibilidade, português claro. Evitar modal preto, botões inertes e render desnecessário.
5. E2E fixture curta e mock ASR/IA; capturas e asserts de todos os controles **uma vez por fluxo**, sem repetição de testes caros.

## PR F. Enquadramento, captions e acabamento (P2)

**Arquivos:** `src/render/framing.ts`, `render/captions.ts`, `media` e testes existentes.

1. Spike **local** com amostragem leve para detectar rosto e troca de cena, se bibliotecas/weights legais/browser-safe comprovados; fallback crop central, split view e ajuste manual. Não importar detector Python/OpenCV.
2. Suavizar movimento de crop (zona morta, filtro/velocidade), evitar saltos em corte de câmera e entre falantes; nada de perseguir rosto em frame sem confiança.
3. Legendas por palavra/linha com presets originais, safe zones de plataformas, clipping/contraste e suporte a PT-BR. Transformações de texto precisam ser reproduzíveis na export.
4. Título fiel nos primeiros segundos, não tapar rosto/legenda/elementos de UI. Desligável e editável.
5. Testar muitos rostos, vídeo horizontal/vertical, baixa luz, nenhum rosto, texto comprido, emoji, fonte ausente e frame parity; medir uso de RAM.

## PR G. Benchmark editorial, regras de lançamento (P0 transversal)

1. Fixture anotada de falas e vídeos próprios/autorizados: 20 inicialmente, expansão programada a 50–100. Não baixar conteúdo protegido sem permissão.
2. Grupos: uma fala, dois falantes, ensino, humor, entrevista, pergunta sem resposta, antecedente ausente, negação, número, code-switch, vídeo sem fala, gravação de 2 h.
3. Comparar baseline `findMoments`, candidato contextual sem IA e contextual + IA autorizada com **mesmo conjunto**, sem vazamento dos exemplos de validação.
4. Métricas: Precision@K julgada por humanos, `standalone_pass_rate`, `payoff_pass_rate`, distorções de sentido/número/negação, erro de corte em palavra, WER/cobertura legenda, sync audiovisual, clipes duplicados, preview/export parity, RAM, latência e custo por vídeo.
5. Cada clipe deve ter explicação verificável por trecho e feedback humano. Estudar performance de redes sociais só se dados forem coletados com consentimento, com comparação controlada; nenhum “viral score” é dado observado de views.
6. Bloquear rollout em falha grave factual/sync/segredos, regressões em editor, ou P95 de memória inviável sem fallback. Ativar novo ranking atrás de opção/flag local inicialmente.
7. Atualizar `docs/ai/evaluation.md` com dados reais, versão, fixtures, ambiente Brave, método e falhas; não registrar resultado presumido. Fazer testes no navegador-alvo com vídeos autorizados e orçamento controlado.

## Ordem e dependências

```text
A (contexto/index) ──> B (candidatos) ──> C (IA opcional) ──> E (curadoria)
         └──────────────────> D (source-map) ──────────────────> F (render)
G (QA e fixtures) acompanha todas; #73 é dependência apenas do BYOK, não do modo local
```

### O que deliberadamente NÃO entrar nesses PRs

- Copiar e executar backend SupoClip, API hospedada ou dependências AGPL sem decisão jurídica completa.
- AssemblyAI obrigatória, Pexels automática, login/billing, publicação direta/analytics por OAuth e serviço de processamento central.
- Reescrever editor, export, ASR ou CSS global que outra frente está modificando.
- Afirmar “testado E2E” só porque existem testes unitários, PR ou screenshot.

**Gate de entrega:** cada PR tem testes locais específicos executados, resultado/limitações registrados, diff pequeno, documentação/erro/versão quando afetar produto; merge apenas quando conflitos e comportamento real forem verificados. A auditoria de hoje não altera os usuários, e a adoção de qualquer módulo novo exige implementação e QA efetivos.
