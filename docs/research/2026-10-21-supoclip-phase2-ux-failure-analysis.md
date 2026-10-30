# SupoClip, segunda leitura: UX, limitações reais e oportunidades de diferenciação

**Data:** 2026-10-21 · **Upstream:** `01daf777ed129416270830a64c66052aa3c0f5c6` · **Natureza:** leitura estática com fontes verificáveis, sem benchmark de vídeo ou testes upstream executados. Complementa a [auditoria principal](2026-10-21-supoclip-deep-dive.md), a [spec](../superpowers/specs/2026-10-21-contextual-longform-clips.md) e o [plano TDD](../superpowers/plans/2026-10-21-contextual-longform-clips.md). Nenhuma alteração de runtime nesta fase.

## 1. O que aparece na interface realmente implementada

| Componente upstream | Implementação visível no código | O que aproveitar no Motion4Free |
|---|---|---|
| `frontend/src/components/home-app.tsx` | URL ou upload, template de caption, formato vertical/original e variações, opção de cortar pausa/fillers, fonte/cor/tamanho, indicadores do job | Input simples com controles avançados recolhidos; preservar nossos fluxos e permitir revisão ANTES de baixar |
| `frontend/src/components/app/generation-card.tsx` | cartão de geração com capa, estado, quantidade e nota superior | Biblioteca local por vídeo-fonte, retomada por cache e indicador de progresso verificável |
| `frontend/src/components/app/clip-wall.tsx` | clipes 9:16 em cards com título, duração, nota, player expandido e download/editor | Lista de candidatos, preview navegável, transcrição e notas explicadas |
| `frontend/src/components/app/clip-wall.tsx:ClipFocus` | modal com player, 4 barras `hook/engagement/value/shareability`, legenda textual, teclado j/k/setas | Substituir a centralidade de "viral score" por `contexto / conclusão / fidelidade`, mostrar justificativas ancoradas em frases; atalhos sem roubar teclas dos inputs |
| `frontend/src/components/editor/editor-workspace.tsx` | editor separado com save, export, undo/redo, splitter, ajuste de caption e combinação | Permanecer no editor único do Motion4Free, abrir candidato como projeto editável, sem perder relação com fonte longa |
| `frontend/src/components/editor/timeline.tsx` | segmentos recortáveis/divisíveis, troca de ordem e zoom | controles de aparar por frase + projeto reversível, não reescrever timeline existente |
| `frontend/src/components/app/clip-wall.tsx:ProcessingPanel` | estágios fetch/transcribe/find/render, progress bar, contador de ready | estágios explícitos e cancelar/retomar, distingindo análise de render/export |

Links de entrada: [home-app.tsx](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/frontend/src/components/home-app.tsx), [clip-wall.tsx](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/frontend/src/components/app/clip-wall.tsx), [generation-card.tsx](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/frontend/src/components/app/generation-card.tsx), [editor-workspace.tsx](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/frontend/src/components/editor/editor-workspace.tsx).

**Diferença crítica:** a UI do SupoClip mostra dados da seleção após gerar; **não comprova** que o algoritmo compreendeu o contexto por fora da transcrição. O score vem de julgamento por modelo sobre spans de texto. Uma captura com 90/100 não é métrica real de retenção de audiência. O Motion4Free precisa mostrar contexto anterior e posterior ainda no pré-render.

## 2. Auditoria de fragilidades: o que NÃO importar

### 2.1 Reparo de contexto é predominantemente inglês

`backend/src/media/timeline.py:_WEAK_OPENERS` usa termos como `yeah, yes, he, she, they`; `_BACK_REFERENCES` inclui `as i said` e `he made`. Os testes `test_clip_boundaries.py` também exemplificam inglês. Assim, **não há evidência nesse caminho de cobertura equivalente para PT-BR** (`isso, ela, aquele, conforme eu disse, é isso`) ou code-switching. Transcrever em PT-BR com Whisper não basta para reparar português. O Motion4Free deve separar heurísticas por idioma, com comportamento conservador quando idioma/antecedente incerto.

### 2.2 Cap temporal pode apagar conclusão

`timeline.py:clamp_keep_ranges_to_max_duration` limita a duração total depois que o trecho foi expandido para recuperar contexto; corta a parte final perto do teto, priorizando limite de sentença quando existe. Isso protege duração, mas **não garante payoff após o corte**. O nosso requisito é revalidar presença da resposta no **span final efetivamente renderizado**; se ultrapassar 60/90 s, oferecer alternativa mais longa/revisão, sem automaticamente retirar a resposta.

### 2.3 A mesma transcrição não representa vídeo inteiro

Seleção em `backend/src/ai.py` usa transcrição, sinais de áudio auxiliares e LLM. Detecção de rosto e cenas aparece na etapa de composição `media/reframing.py`, não como entendimento multimodal profundo na classificação inicial. Portanto, **slides, expressão facial, tela gravada, reação sem fala, visual de antes/depois e memes sem narração** podem não ser classificados corretamente. Marcar `visual_context_required` e tratar análise visual como feature separada, testada no navegador.

### 2.4 Nota de 0–100 não é previsão, e comparação global ainda é subjetiva

`candidate_rerank_system_prompt` orienta o LLM a distribuir valores e normalmente colocar o melhor em 80–95; `_rescale_virality` ajusta a soma das quatro dimensões depois do rerank. Mesmo que todos os cálculos estejam coerentes, **esse número é editorial e autorreferente, não calibrado com views/retention**. Não rotular como `probabilidade de viralizar`. Usar dimensões com semântica e evidências; abandonar score global quando a evidência é insuficiente.

### 2.5 Meta de quantidade pode forçar irrelevantes

`max_final_clips_for_duration` retorna até 20, base mínima nominal 5, enquanto `VideoService._build_fallback_segment` pode entregar o início da gravação quando não encontra nada. Isso pode estimular percepção de produtividade, não qualidade. No Motion4Free a saída vazia ou com 2 clipes é correta se nenhum outro tem arco completo. Exibir o motivo e permitir busca manual.

### 2.6 Edição/revisão pode falhar se perder a fonte original

Issue upstream [#205](https://github.com/FujiwaraChoki/supoclip/issues/205), aberta em 18/10/2026: relato reproduzível de editor que falha em tarefas do YouTube porque o arquivo fonte foi descartado após processamento e é baixado novamente; bot-check e tratamento genérico do erro impedem edição, apesar de clipes prontos. É relato de issue, não reprodução realizada nesta análise. **Mitigação arquitetural no Motion4Free:** projeto local mantém referência explícita ao arquivo original/handle e cópias versionadas apenas quando autorizadas; detecta fonte ausente e pede relink com identificação segura, sem download ou upload silencioso. Já existem recursos de relink: reutilizar, não duplicar.

### 2.7 Repetir cold-open pode piorar narrativa

`ai.py` permite `hook_start_time/end_time`; `media/timeline.py` monta trecho curto posterior antes do corpo do clipe. Isso é bom em alguns formatos de teaser, mas pode repetir punchline, inverter causa e efeito, induzir interpretação errada ou criar dois momentos iguais. Deixar desligado por padrão; ativação explícita, tempo extra e QA semântico + áudio.

### 2.8 Custo/operação e privacidade não são equivalentes

LLM pode ser OpenRouter, OpenAI, Anthropic, Gemini ou Ollama; o SupoClip pode usar AssemblyAI, YouTube e estoque B-roll por Pexels; frontend inclui login, cobrança, banco e worker. Não assumir API grátis, CORS compatível ou ausência de upload. Motion4Free continua sem servidor próprio de mídia, com ASR local e BYOK por consentimento conforme [#73](https://github.com/murilaiooo/motion4free/issues/73). Não reutilizar SDKs Python em site estático.

### 2.9 Retentativas e timeout precisam de orçamento transparente

`ai.py:_run_transcript_analysis` aceita até 3 tentativas transitórias (429/5xx/timeout de rede), com backoff exponencial; janela até 10 min/limite global ~30 min. Esse comportamento pode gerar demora e custo externo para usuário, mesmo com retry “correto”. Nossa solução: budget por tarefa (tempo, chamadas, tokens), possibilidade de abort, cache e falha parcial; jamais repetir request pago automaticamente sem avaliar política de idempotência, limite e estado.

## 3. Aprendizados demonstrados pelos testes do SupoClip

São **casos codificados no repositório**, não relatos de testes executados por esta auditoria:
- [`test_ai_windowed_selection.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/tests/unit/test_ai_windowed_selection.py): 60 min → seis janelas, 2 min de overlap, 100+ minutos preservados, detecção de duplicatas, rerank após janelas, fallback se uma janela falhar, respeito a número máximo de clips, teaser revisado.
- [`test_ai_grounding.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/tests/unit/test_ai_grounding.py): construir texto do span real e rejeitar timestamps que não correspondem às bordas transcritas.
- [`test_clip_boundaries.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/tests/unit/test_clip_boundaries.py): voltar à frase anterior para pronome sem referente, concordância ou back-reference; filler não provoca recuo desnecessário; preferir sentença e limitar duração.
- [`test_editor_roundtrip.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/tests/integration/test_editor_roundtrip.py): referência de contract roundtrip de mídia, edição, export e persistência; não é diretamente executável no browser (usa PostgreSQL + FFmpeg nativo).

### Fatos vs hipóteses

- **Fato de código:** há validação de timestamp, escala temporal, dedupe, rerank, source-map, legendas por palavra, falante/crop após análise, UI com quatro notas.
- **Inferência fundamentada:** corte sem contexto ainda pode ocorrer, sobretudo em PT-BR, payoff distante, visual sem fala e com teto estrito.
- **Ainda não medido:** melhoria real de precisão, qualidade de 9:16, tempo da análise, consumo real de hardware, qualidade de legenda na mistura de idiomas, ganho de engajamento ou conversão em Reels/TikTok.
- **Não realizado:** testes upstream, integração AGPL, benchmarking em vídeos humanos, teste E2E no Brave do novo motor.

## 4. Proposta própria superior: hierarquia de aprovação

```text
Candidato > integridade da fala > contexto completo > payoff presente
          > fidelidade de título > áudio utilizável > variedade temática
          > força do gancho > ritmo/visuais > recomendação para revisão
```

- **Bloqueios fortes:** afirmação invertida; negação perdida; duas pessoas atribuídas erroneamente; falseamento de números; resposta ausente; nenhum antecedente para o pronome inicial; áudio ausente sem contexto visual.
- **Avisos de revisão:** visual indispensável; diarização insegura; modelo ASR de baixa confiança; frase inicial dependente da anterior; limite de duração estourado; possível referência cultural/ironia não resolvida.
- **Otimização suave:** hook, ritmo, energia, gosto do criador, distribuição dos temas. Nenhuma delas pode sobrescrever bloqueios factuais.

## 5. Decisões de UX detalhadas e exemplos

**Card recomendado:**
- Título fiel à fala, com botão editar.
- `00:34:12–00:34:58 • 46 s`, assunto e trecho do resumo.
- `Contexto: completo`, `Conclusão: presente`, `Fidelidade: verificada automaticamente` (somente se houver evidência); se não houver, indicar `não avaliado`.
- `Ver antes/depois`, `Editar início/fim`, `Tocar isolado`, `Abrir no editor`, `Gerar MP4`.
- Trilha `Por que este?` cita as frases originais que justificam escolha; score secundário e com descrição.

**Card em revisão:**
- `Este trecho começa com “ela”, mas a pessoa só é apresentada 6 s antes.`
- `Incluir contexto` amplia no original mantendo sentido e revalida duração.
- Se conclusão fica depois do tempo máximo: `A resposta está fora do clipe. Aumentar para 68 s ou descartar?`
- Editor nunca exige reproduzir/exportar video completo para ajustar palavra.

**Exemplo anti-hype:**
- Fala: `Muita gente diz que investir nisso é garantido. Mas eu NÃO recomendo. O risco é enorme.`
- Título proibido: `O investimento que eu recomendo!`
- Cortar `mas eu NÃO` e deixar `recomendo` é regressão crítica.
- Aceitável: `Por que eu não recomendo esse investimento`, com a ressalva e motivo completos dentro do vídeo.

## 6. Onde investir primeiro

| Ordem | Trabalho | Justificativa |
|---|---|---|
| P0 | Span/index por palavra/frase, contexto e payoff, guardrails de negação | Corrige escolha ruim, raiz do problema relatado |
| P0 | Geração de candidatos em TODO o transcript (sem shortlist prematura) | Hoje a IA só reordena candidatos de `highlights.ts` |
| P0 | Validação real de bordas e título após qualquer ajuste | Corrige risco de distorção |
| P1 | Ranking comparativo/deduplicação + curadoria UX | Escolhas explicadas e rapidamente editáveis |
| P1 | Preservar source-map no editor e preview/export | Evita refazer trabalho e divergência audiovisual |
| P2 | Tracking de rosto/falante e legenda segura | Importante visualmente, mas não conserta clipe sem narrativa |
| P3 | B-roll e publicação, sob licença/permissão | Não deve bloquear seleção contextual |

Reaproveitar [issue #72](https://github.com/murilaiooo/motion4free/issues/72) para disponibilidade de IA local, [#54](https://github.com/murilaiooo/motion4free/issues/54) para smart crop e [#73](https://github.com/murilaiooo/motion4free/issues/73) para BYOK. Não abrir issue duplicada desses recursos.

**Próxima evidência necessária:** executar benchmark de seleção em transcrições/vídeos próprios e medir falhas factuais e clareza em avaliação cega. Não converter esta pesquisa em alegação de feature integrada.
