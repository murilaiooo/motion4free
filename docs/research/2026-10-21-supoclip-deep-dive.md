# SupoClip → Motion4Free: auditoria técnica e manual de aproveitamento

**Inspeção:** 21/10/2026. **Upstream congelado:** [FujiwaraChoki/supoclip @ 01daf777ed129416270830a64c66052aa3c0f5c6](https://github.com/FujiwaraChoki/supoclip/tree/01daf777ed129416270830a64c66052aa3c0f5c6). **Motion4Free inspecionado no PC:** checkout local `31b83cd2674ace2c4397379057912690344f607f`, com alterações locais não commitadas de outros trabalhos. **Método:** clone público para diretório separado, leitura de fontes e testes existentes, comparação com `src/app/ClipMaker.tsx`, `src/app/clip-pipeline.ts`, `src/editorial/highlights.ts` e `moments-ai.ts`. **Escopo:** pesquisa estática e especificação, sem execução de pipeline SupoClip, sem copiá-lo ou integrá-lo ao runtime. Não confundir arquivos de teste encontrados com testes executados.

## 1. Decisão principal

**Adotar os algoritmos e contratos como referência para uma implementação independente em TypeScript, não instalar o SupoClip inteiro.** O SupoClip depende de Python/FastAPI, FFmpeg nativo, Redis/ARQ, PostgreSQL, processamento em servidor, APIs opcionais de LLM, AssemblyAI ou Whisper local. O Motion4Free é browser-first, sem servidor obrigatório, custo obrigatório zero e mídia local por padrão. A licença upstream é **AGPL-3.0**: copiar arquivos de código ou assets é uma decisão jurídica/arquitetural separada, com cumprimento da licença, notices e distribuição do código correspondente. Não copiar prompts ou arquivos para o produto. Ver [LICENSE](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/LICENSE) e [AGENTS.md](../../AGENTS.md).

**Objetivo do produto:** cada clipe precisa funcionar SEM o vídeo original: identificar assunto, abrir com contexto/gancho verdadeiro, desenvolver um ponto e terminar com entrega/conclusão, sem inventar ou trocar sentido, sem cortar nomes, negações, números, exemplos e respostas necessários. Uma pontuação automática não prova potencial de viralização.

## 2. Fluxo real do SupoClip, por código

```text
YouTube / upload → adquirir vídeo → extrair áudio do stream correto
 → transcrever + palavras/timestamps (+ falantes quando disponível)
 → formatar falas em linhas com tempos
 → análise por LLM do próprio transcript, com sinais auxiliares
 → janelas sobrepostas se vídeo longo
 → validar spans, reparar limites, reconciliar texto com transcrição
 → deduplicar, comparar candidatos de janelas diferentes e reordenar
 → montar cortes com limites de frase, limpar pausas/fillers
 → preservar source_ranges e recasar a legenda na ordem renderizada
 → decidir layout vertical por rostos/falantes, legendas ASS, hook title
 → FFmpeg, salvar metadata/arquivos, preview/editor/export
```

Orquestração: [`services/video_service.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/services/video_service.py), [`services/task_service.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/services/task_service.py), [`workers/tasks.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/workers/tasks.py). UI/API usam Next.js e FastAPI, fila Redis/ARQ e banco PostgreSQL, SSE para progresso. Isso **não** é necessário para uma implementação local via Web Workers/IndexedDB/OPFS do Motion4Free.

### 2.1 Transcrição e sinais

- [`media/transcription.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/media/transcription.py): extrai áudio mono a 16 kHz, selecionando explicitamente a faixa que será renderizada. Adaptadores AssemblyAI, Whisper local ou legendas do YouTube. AssemblyAI recebe áudio fora do dispositivo: **não é processamento local** nem necessariamente gratuito. Legendas externas podem não ter timing de cada palavra; exigir alinhamento antes de karaoke/cortes finos.
- `media/timeline.py:687-803`: energia/picos e resumo auxiliar de sinais. Não confundir grito/volume com relevância narrativa; sinal acústico é complementar.
- `media/transcription.py:449-620`: cache de transcrição estruturada e formatação de blocos. Cache evita refazer ASR em revisões, precisa versão de schema e invalidação por identidade da mídia/modelo.
- No Motion4Free já existem `src/asr/transcriber.ts` (Whisper no Worker), `analysis/{energy,silence,asr-windows}.ts`, `app/clip-pipeline.ts` (palavras + silêncios + energia cacheados em arquivo local). **Reutilizar essa base**, sem duplicar transcritor.

### 2.2 Seleção semântica, núcleo mais valioso

[`backend/src/ai.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/ai.py) concentra o mecanismo:
- `TranscriptSegment` e `ViralityAnalysis`: span início/fim, texto, razão, relevância, título, eventual microgancho, subnotas de hook/engajamento/valor/compartilhamento (0–25 cada), total 0–100.
- Prompt restringe a **extração verificável** de intervalos contíguos, minimiza conclusões dependentes de contexto, exige abertura compreensível, ideia inteira e payoff, e proíbe inventar números ou fatos. Preferência 25–50 s; aceita 15–60 s.
- `split_transcript_into_windows`: se até **15 min**, passagem única; acima disso janelas de **12 min** com **2 min** de sobreposição, passo 10 min. Junta cauda curta. `_analyze_transcript_windows`: máximo **3** janelas concorrentes, com teto global, falhas parciais recuperáveis. O orçamento de contexto não precisa seguir esses números: medir capacidade real dos modelos no browser.
- `_validate_segments`: timestamps reconciliados com linhas; tolerância de snap de **8 s**; reparo de duração; reconstroi `text` do intervalo REAL da transcrição quando o LLM diverge; total das 4 notas é recalculado; títulos sanitizados. Cada trecho inválido é descartado, sem confiar cegamente no JSON.
- `dedupe_overlapping_segments`: remove duplicatas se a interseção supera **50% do menor intervalo**. `rerank_candidates`: uma segunda comparação entre TODOS os candidatos, mais justa que comparar notas atribuídas isoladamente. Fallback mantém ranking da primeira etapa se rerank falha.
- `max_final_clips_for_duration`: orçamento aproximado de **1 clipe por 5 minutos** com mínimo nominal 5 e máximo 20 (sujeito a configuração e disponibilidade de trechos); não inventar quantidade quando a fonte é fraca.
- `build_candidate_rerank_prompt` aceita contexto de desempenho histórico por criador como **desempate**, não justificativa para distorcer transcrição. O total 0–100 ainda é julgamento subjetivo do LLM, **não probabilidade de viralizar**.
- Há fallback que extrai o começo do vídeo se a IA não encontra nada em `VideoService._build_fallback_segment`: **não incorporar como “melhor clipe”**. No Motion4Free deve ser claramente rotulado “trecho de emergência, sem validação de qualidade”, ou preferir vazio + ajuste manual.

### 2.3 Limites de frases e contexto

[`media/timeline.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/media/timeline.py):
- `_opening_is_weak`, `_prefer_self_contained_start` detectam aberturas com pronome sem referente, concordância solta ou “como eu disse”; recuam até 2 frases em busca do contexto.
- `snap_keep_ranges_to_sentence_start` ajusta início para limite de sentença, com pequeno lead-in sem invadir palavra anterior.
- `extend_keep_ranges_to_sentence_boundary`, `_drop_dangling_tail` tentam terminar em frase concluída, ou remover a cauda que inicia novo assunto sem finalizar.
- `build_clip_keep_ranges` remove fillers opcionais e comprime pausas preservando pequenas folgas para não agredir a cadência nem criar estalos. **Cuidado:** remover “não”, qualificadores ou hesitações com valor expressivo muda o sentido; limpeza nunca deve operar sem revisão de palavras/negativas.
- `build_hook_teaser_range` oferece cold open de 2–5 s da mesma fala, **opcional**, podendo replay do trecho. Melhor padrão no Motion4Free: preservar cronologia; teaser só mediante prévia/controle do usuário.
- Regra editorial superior: o melhor `start` é a primeira frase que faz sentido, NÃO necessariamente a frase com maior palavra-chave. O melhor `end` é o payoff, NÃO um limite de segundos.

### 2.4 Timeline e preservação de fonte

[`clip_source_map.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/clip_source_map.py) representa lista ordenada de intervalos do vídeo original e preserva mapeamento após split/trim/remoção de pausas/repetição de hook. Os intervalos podem ser **não monotônicos** (teaser antes do corpo). `create_single_clip` guarda o mapa; `create_optimized_clip` renderiza esses intervalos e calcula legenda na timeline final.

**Para adaptar:** introduzir `SourceSpan {sourceId,start,end}`, `OutputSpan {sourceSpan,outStart,outEnd}`; validar integridade, monotonicidade somente quando exigida, proibir inversão/duração negativa, projetar palavras e legendas por span para a timeline final. Usar tipos/EDL existentes de `src/engine/timeline.ts`, `core/types.ts`, `editorial/sequence.ts`, `media/splice.ts`, sem gravar um MP4 intermediário só para descobrir a edição. Um projeto clipe deve manter vínculo com o original, ser editável e exportar como a prévia.

### 2.5 Render, crop e legendas

- [`video_utils.py:create_optimized_clip`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/video_utils.py): vários source ranges, render FFmpeg, compõe em 1080×1920 ou dimensão original. Legenda e enquadramento no MESMO passe quando possível. Existe stream copy para caso original sem legendas, com ressalva de precisão de keyframes a confirmar no Motion4Free.
- [`media/reframing.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/media/reframing.py): amostragem de vídeo a ~3 fps e ~480 px, detector facial YuNet (OpenCV ONNX) com fallback Haar, detecção de mudança de cena, trajetória de crop com mediana, zona morta, mola amortecida, limites de velocidade e fallback estático quando não há rostos suficientes. Consulte também `speaker_framing.py` (turnos/atividade de falantes) e `talking_head_layout.py` (variações para podcast). **Não copiar o ONNX ou fontes sem auditoria individual de licença.**
- [`media/captions.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/media/captions.py): ASS com timestamps e templates, títulos curtos, safe area e cálculo de posição baseado no layout. No navegador é preciso portar o **comportamento** à camada `src/render/captions.ts`/`src/editorial/captions.ts`, não instalar ASS/libass Python.
- [`broll.py`](https://github.com/FujiwaraChoki/supoclip/blob/01daf777ed129416270830a64c66052aa3c0f5c6/backend/src/broll.py): busca opcional na Pexels por conceitos. Depende de API, direitos de mídia e conectividade. Prioridade posterior; evitar overlays genéricos ou conteúdo sem licença auditável.
- `social/{youtube,tiktok,instagram}.py`: conexão/publicação e coleta de métricas via plataforma exigem OAuth, rede e permissões; **fora do núcleo local-first e sem backend**. O produto pode exportar arquivos e metadados para publicar manualmente. Métricas futuras precisam consentimento e prova de acesso viável.

## 3. Estado do Motion4Free e lacuna específica

| Capacidade | Já existe (código inspecionado) | Lacuna para qualidade |
|---|---|---|
| Transcrição | `clip-pipeline.ts:analyzeLong`, `asr/transcriber.ts` | ASR/confiança por palavra, diarização e manutenção de contexto em casos difíceis |
| Sinais | `editorial/highlights.ts`: frases, energia, ritmo, números, finais e dedupe sem sobreposição | Sinais de contexto/causalidade/antecedentes e payoff, diversidade de tópicos |
| IA opcional | `moments-ai.ts:rankMomentsWithAi` | **Só reordena lista predefinida; não propõe novos spans nem corrige cortes** |
| Limites | `highlights.ts` limita em pedaços inteiros; `nudgeMoment` oferece ajuste | Recusar início “isso/ela”, interrupção de resposta, negação separada, gancho sem entrega |
| Geração | `clip-pipeline.ts:prepareClip/renderClip` + editor/export existentes | Representar ranges editáveis, sem degradar preview/export/legendas |
| UX | `ClipMaker.tsx`: duração, contagem, visual, preview, lote, editor | Mostrar por que o trecho foi escolhido, confiança, contexto ausente, variações e revisão fácil |
| Escala | Vídeos de **2 min até 2 h** (`LONG_MIN_SEC`/`LONG_MAX_SEC`) | Controle de memória, análise por janelas, falha parcial, orçamento por modelo e duração |
| Testes | `tests/highlights.test.ts` e suites editor | Testes de compreensão humana, conteúdo narrativo adversarial e benchmark cego |

O escore heurístico atual soma pesos de hook/keyword/energia/ritmo/conclusão. Isso **não** é medição de compreensão nem de performance social. Manter o baseline determinístico, mas permitir que um seletor contextual forme candidatos novos e altere limites com validação da transcrição.

## 4. Arquitetura alvo, sem servidor e sem custo obrigatório

```text
localFile
  → existing analyzeLong (ASR + silences + energy + cached transcript)
  → transcriptIndex (sentenças, falantes disponíveis, tópicos, referências, tempos)
  → chunker com overlap por frase (não cortar história na borda)
  → candidate generator determinístico amplo (cobertura de todo o vídeo)
  → semantic proposer opcional (LLM local ou BYOK com consentimento)
  → grounding/range validator (span IDs + palavras reais, nunca tempo imaginado)
  → context repair (setup→tensão/insight→payoff, pergunta/resposta)
  → dimension scoring + diversidade + dedupe + rerank global
  → candidate inspector (antes/depois, notas explicadas, baixa confiança)
  → source-ranged editable project (editor existente)
  → render/captions/reframe/export existing
```

Separar funcionalidades em módulos puros testáveis:
- `src/editorial/clip-context.ts`: segmentos de fala, antecedentes, perguntas/respostas, começo/fim de ideia, negação, entidades, pontuação.
- `src/editorial/clip-windows.ts`: janelas de análise sobrepostas + agregação estável com budget/AbortSignal.
- `src/editorial/clip-candidates.ts`: gerar spans por tópicos e narrativas, com spans determinísticos de cobertura completa; *não escolher tudo por energia*.
- `src/editorial/clip-grounding.ts`: resolver IDs→words→seconds, validar contexto, título e score.
- `src/editorial/clip-rank.ts`: reordenar, dedupe por similaridade temporal e semântica, penalidades por falta de payoff, diversidade.
- `src/editorial/clip-source-map.ts`: ranges do original ↔ timeline montada, editar/trim/split sem perda de contexto.
- `src/app/ClipMaker.tsx`: workflow guiado/revisão, sem novo site separado ou renúncia ao editor atual.
**Nomes são sugestões para tarefas separadas, não arquivos existentes.**

### Esquema mínimo de candidato proposto (não confiar na saída do LLM)

```json
{
  "id": "c42",
  "sourceId": "local-media-id",
  "spans": [{"firstWordId": "w1023", "lastWordId": "w1122"}],
  "narrative": {"hookWordIds": ["w1023","w1032"], "setupPresent": true, "payoffPresent": true, "missingContext": [], "topic": "seguro do carro"},
  "scores": {"hook": 0, "standalone": 0, "payoff": 0, "specificity": 0, "delivery": 0, "shareability": 0, "confidence": 0},
  "title": "Título fiel ao conteúdo",
  "evidence": [{"kind": "payoff", "wordIds": ["w1102","w1122"]}],
  "status": "candidate"
}
```

As escalas são 0–100 **editoriais/experimentais**, não chances matemáticas de viralizar. `confidence` é inicialmente confiança de validação, não probabilidade de sucesso. Converter IDs para segundos usando apenas o índice real de palavras e validar fronteiras, limites de duração, língua, áudio e sobreposição. Sempre manter linha do tempo de origem auditável. Texto de transcrição é dado não confiável: nunca executá-lo como instrução de sistema.

## 5. Estratégia de decisão e controles

1. **Modo gratuito offline**: candidatos determinísticos com cobertura de frases e contexto, zero chamada externa. Se não houver clipe inteligível, explicar e oferecer escolha manual. Não preencher cota com clipes ruins.
2. **Modo IA local, quando dispositivo permitir**: LLM apenas sugere/avalia IDs de palavras; falha vira modo 1. Mostrar download do modelo e uso de RAM.
3. **Modo BYOK**: integrar com issue [#73](https://github.com/murilaiooo/motion4free/issues/73), seleção de provedor/modelo, custos/cotas reais, consentimento para enviar **texto transcrito** a terceiros, nunca vídeo bruto por padrão. CORS e assinatura de ChatGPT/Claude não significam acesso pago/grátis à API.
4. **Seleção em duas passagens**: janelas cobrindo a gravação inteira (overlap ~1–2 min como ponto de partida, não valor fixo), depois comparação global de candidatos sem depender do score local. Orçamento adaptativo por tamanho de transcript/modelo.
5. **Critério editorial**: premiar `standalone` e `payoff` antes de tamanho/energia. Um gancho sem resposta não deve entrar automaticamente no top 5.
6. **Variedade**: impedir 5 clipes sobre a mesma frase ou quase mesma história; permitir ao usuário preferir assunto, personagem, estilo, plataforma, público e duração.
7. **Aprovação humana**: lista ordenada com explicação, trechos anterior/seguinte, legendas e controles “incluir contexto”, “começar aqui”, “terminar após a resposta”, “por que este clipe?” e “descartar”.
8. **Mídia de terceiros**: exigir consentimento, origem/direitos, licença e opt-in; não criar integração automática com Pexels, stream ripper ou OAuth no núcleo.

## 6. Limitações e riscos encontrados

- O SupoClip usa LLM para dar notas subjetivas e um reranker que pede valores relativos. Sem dados de publicação avaliados, esses valores **não prevêem views**.
- A primeira passagem depende da qualidade do ASR; erros de negação/nomes/números podem gerar cortes errados mesmo com JSON válido.
- Janelas sobrepostas reduzem perda de contexto na fronteira, mas não resolvem dependências de vários minutos, resposta tardia ou referências visuais só compreensíveis olhando o vídeo.
- O reparo dos bounds por proximidade/tolerância pode trocar uma frase pela vizinha: exigir verificação de palavra/frase após mover bordas.
- Filtro de fillers/remontagem pode alterar cadência, sentido e sincronia. Guardar proveniência `sourceRanges`, histórico e prévia.
- SupoClip é stack servidor, usa APIs externas, quotas e deploy; não importar Docker, Prisma, Redis, PyPI, banco, pagamentos e worker para browser.
- Detecção facial em amostra esparsa pode errar em grupos, panorâmicas, rostos de B-roll; fallback para frame geral/pan manual quando confiança baixa.
- Publicação automática e “performance loop” não têm caminho browser-only garantido sem OAuth/infra; tratar como projeto separado, não vender como implementado.
- Licenças de ONNX YuNet, fonts, B-roll, vídeos, serviços e pesos devem ser auditadas separadamente; AGPL do projeto não implica que todo asset seja reutilizável indiscriminadamente.

## 7. Testes upstream examinados como referência

No clone existem `backend/tests/unit/test_ai_grounding.py`, `test_ai_windowed_selection.py`, `test_ai_prompt.py`, `test_clip_boundaries.py`, `test_clip_source_map.py`, `test_speaker_framing.py`, `test_face_detection.py`, `test_talking_head_layout.py`, `test_caption_render_roundtrip.py` e `backend/tests/integration/test_editor_roundtrip.py`, entre outros. **Não foram executados nem transplantados.** Cada teste novo no Motion4Free deve ser escrito em TS conforme interfaces reais e fixture própria.

Para manutenção futura, comparar [upstream pinned](https://github.com/FujiwaraChoki/supoclip/tree/01daf777ed129416270830a64c66052aa3c0f5c6) com main e revisar mudanças no schema de IA/captions. Não seguir main automaticamente.

## 8. Prioridades práticas

**P0: entendimento contextual + QA de corte.** P1: UX de curadoria, ranking comparativo e diversidade. P2: tracking/speaker-aware, legendas e acabamento visual. P3: B-roll seguro, feedback de performance voluntário, export de pacotes de publicação. Cada fase exige testes antes de alterar a geração do usuário. A especificação executável está em [Spec de clipes contextuais](../superpowers/specs/2026-10-21-contextual-longform-clips.md) e a decomposição em [Plano de implementação](../superpowers/plans/2026-10-21-contextual-longform-clips.md).

**Prova de conclusão não é “gerou MP4”.** É reproduzir o clipe sem o vídeo original e um humano conseguir responder: “do que se trata?”, “por que isso importa?” e “qual foi a conclusão?”, com zero distorção factual confirmada. Nenhuma garantia de viralização.
