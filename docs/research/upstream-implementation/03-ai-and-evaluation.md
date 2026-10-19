# IA gratuita, decisões criativas e laboratório — instruções dos repositórios

**Objetivo:** usar modelos gratuitos ou locais como **diretores criativos assistidos por dados**, não programadores com permissão de executar JS arbitrário. O motor editorial precisa entregar comandos válidos, coerência e personalização, com orçamento de tokens/tempo/previews.

## Fluxo de referência
```text
Prompt + preset + referências + transcrição com timestamps + evidências visuais
  -> normalizador de CreativeBrief + regras
  -> visão global: StyleDNA + Storyboard
  -> shortlist semântica de primitives/assets/ações
  -> LLM compara/completa SceneGraph declarativo (schema fechado)
  -> validador de fatos, proibições, tempos, licenças e performance
  -> draft atômico e sample no browser
  -> QA técnico + revisão visual seletiva -> commit ou rollback
```
**Modelos distintos só quando há ganho medido na tarefa.** Não usar “5 IAs votando” a cada vídeo, nem uma chamada por frame. A IA externa recebe só transcrição/keyframes autorizados com consentimento; vídeo original permanece local como padrão.

## 1. Transformers.js — especialistas sem API paga

**Fonte:** https://github.com/huggingface/transformers.js · Apache-2.0 para biblioteca, pesos possuem suas próprias licenças.
[README/quick tour](https://github.com/huggingface/transformers.js/blob/main/README.md).

### Instrução upstream
- Instalação da biblioteca `npm i @huggingface/transformers`; API `pipeline(task, modelId, options)`.
- Browser normalmente roda em WASM/CPU; selecionar `device:'webgpu'` apenas quando suportado.
- Reduzir download/RAM com quantização `dtype:'q8'` ou `'q4'` **quando modelo e backend aceitam**. Verificar precisão antes de escolher quantização.
- Tarefas suportadas: speech recognition, embeddings/feature extraction, classificação, object detection, segmentação etc. Tarefas são distintas, não um único modelo faz tudo.
- Preferir Worker para áudio/inferência pesada, cache versionado de pesos, cancelamento e relatório do progresso.

### Nossa adaptação
1. Worker de transcrição com linguagem detectada/selecionada, posterior alinhamento de palavras e pontos incertos; comparar pequenos modelos em português/inglês/acento/ruído.
2. Embeddings locais para frases, primitives, catálogos visuais e exemplos de estilo; pré-calcular índice do catálogo durante build.
3. Modelos de face/objetos opcionais para safe area/B-roll, com budget por keyframe.
4. Roteamento CPU/quantização vs WebGPU conforme capability report. **Não dizer “sem hardware” quando o dispositivo do usuário paga com RAM/CPU/energia**.

**Teste:** WER por língua, recall de palavras baixas, latência/MB, battery/mem, consistência de embeddings e reabertura de cache.

## 2. WebLLM — modelo textual no navegador

**Fonte:** https://github.com/mlc-ai/web-llm · Apache-2.0 (pesos/verificação separados).
- [Basic usage](https://github.com/mlc-ai/web-llm/blob/main/docs/user/basic_usage.rst): `CreateMLCEngine(modelId, {initProgressCallback})` assíncrono, `engine.chat.completions.create({messages})` e streaming.
- [Web Worker example](https://github.com/mlc-ai/web-llm/tree/main/examples/get-started-web-worker) para não congelar a interface.
- [JSON schema example](https://github.com/mlc-ai/web-llm/tree/main/examples/json-schema) para investigar outputs restritos **conforme modelo/engine suportar**.
- [Advanced usage](https://github.com/mlc-ai/web-llm/blob/main/docs/user/advanced_usage.rst): cache/integrações a validar.

### Adaptação
Carregar modelo somente ao selecionar recurso IA e hardware suficiente; mostrar tamanho real e progresso. Nunca embarcar dezenas de modelos. Usar diálogo com contexto sucinto: `CreativeBrief`, candidatos, frases com source IDs, StyleDNA parcial e schema. JSON validado externamente, `maxTokens`/tentativas finitas, caching e cancelamento de pedidos. Garantia de sintaxe não dá qualidade estética; medir com dataset.

**Teste:** output conforme schema, taxa de fallback, VRAM/mem, tempo primeiro download vs cache, execução sem rede após cache (se realmente possível).

## 3. Semantic Router — roteamento e thresholds calibrados

**Fonte:** https://github.com/aurelio-labs/semantic-router
- [Quickstart](https://github.com/aurelio-labs/semantic-router/blob/main/docs/get-started/quickstart.md): define `Route` com exemplos, `IndexedRouter` e encoder FastEmbed local; no exemplo Python `pip install "semantic-router[fastembed]>=1.0.0"`.
- [Calibration](https://github.com/aurelio-labs/semantic-router/blob/main/docs/user-guide/features/calibration.md): scores brutos de similaridade **não são probabilidades**; `router.fit(X,y)` em queries rotuladas **diferentes** das frases armazenadas, com exemplos `None`; medir ECE e usar `confidence_threshold`.

### Adaptação
Não precisamos rodar servidor Python. Portar o princípio para embeddings TS: rotas locais `numeric_claim, list, process, contrast, alert, no_animation, hook_candidates`; calibrar em corpus de frases reais, com casos “nenhuma rota”. Filtro rígido por duração, licença e fatos precede decisão do modelo; opt-out `none` sempre permitido.

**Teste:** precisão por gênero/idioma, FPR de dinheiro vs “valor” abstrato, falso “3 passos”, abstention rate e calibração fora do treino.

## 4. TypeChat — contratos fortes de edição por linguagem

**Fonte:** https://github.com/microsoft/TypeChat · [README](https://github.com/microsoft/TypeChat/blob/main/README.md).
- Instalação upstream `npm install typechat`.
- Define **tipos de operações permitidas** (discriminated union), monta prompt a partir de schema TS e valida saída.
- Se inválida, pode pedir reparo com LLM; isso gasta tokens, então **budget de no máximo N tentativas**.

### Adaptação
Definir `EditAction` e `CreativeAction` com `trim, set_hook, add_caption, add_motion, set_style, replace_asset, adjust_timing, lock_segment` em enums e source IDs existentes. Parser devolve plano de operações, **nunca string para avaliar como JS**, sem acesso a URLs/scripts arbitrários. Executor aplica sobre draft e comita atomicamente, inspirado no OpenReel.

**Teste:** prompts maliciosos na transcrição, IDs forjados, operação fora da duração, estados obsoletos, undo e rollback.

## 5. Outlines — geração restringida, sobretudo referência de engine

**Fonte:** https://github.com/dottxt-ai/outlines · [README](https://github.com/dottxt-ai/outlines/blob/main/README.md).
- Quickstart upstream é majoritariamente Python/Pydantic: `pip install outlines`, tipagem `Literal`, `Enum` e `BaseModel` em integração com motor suportado.
- Restrições podem ser aplicadas **durante decodificação**, mas não devem ser presumidas em todo WebLLM ou API de terceiros.

### Adaptação
Usar esquema JSON na camada TS/Zod/Ajv e output restringido se **o modelo real suportar**; do contrário aplicar validação e reparo limitado. Proteger referências e propriedades de nós de SceneGraph e fatos do vídeo; invalidar plano caso incompatível.

**Teste:** 100% das decisões aceitas pelo motor têm schema válido, mas pontuar qualidade semântica separadamente.

## 6. DSPy — otimização offline de prompts e few-shot

**Fonte:** https://github.com/stanfordnlp/dspy
- [First program](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/getting-started/first-program.md)
- [MIPROv2](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/api/optimizers/MIPROv2.md)
- [BootstrapFewShot](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/api/optimizers/BootstrapFewShot.md).
- DSPy é ferramenta majoritariamente Python de pesquisa/desenvolvimento, **não dependência obrigatória no editor browser**.

### Adaptação
1. Modelar tarefas em assinaturas `rank_hook`, `plan_beats`, `choose_scene`, `critique_style` com entradas verificáveis.
2. Construir dataset com decisões humanas, exemplos ruins, contrastes e “nenhum gancho”.
3. Métricas combinadas: escolha correta do hook, integridade factual, clareza, aderência ao estilo e avaliação humana.
4. Otimizar few-shot/prompt **no desenvolvimento** com orçamento gratuito estrito, salvar versão e comparar em held-out.
5. Exportar só prompt/exemplos/versionamento para runtime; **não rodar otimização para cada upload**.

**Teste:** comparação com baseline usando conjunto separado e sem “treinar no teste”; registrar custo de experimentos.

## 7. Promptfoo — regressão e comparações

**Fonte:** https://github.com/promptfoo/promptfoo · [README](https://github.com/promptfoo/promptfoo/blob/main/README.md); exemplos `examples/**/promptfooconfig.yaml`.

### Adaptação
- Configurar matriz **prompt × modelo × caso**, com fixtures anonimizadas de transcrição, frames autorizados, StyleDNA e cenas.
- Assertions determinísticas para schema/IDs/ausência de números inventados/negativas preservadas; métricas humanas para hierarquia, ritmo e originalidade contextual.
- Um erro criativo verificado vira fixture de regressão. Testar “mesma fala + 3 presets” e “mesmo preset + 3 vídeos”.
- Benchmarks locais/offline quando possível; chamadas a APIs devem ter limite de teste e sem credenciais no repositório.

**Teste:** reprodutibilidade por hash do corpus, versões dos prompts/modelos e avaliação com cegamento do nome da ferramenta.

## 8. Lição central do OpenReel para IA (fonte cruzada)
[docs/ai-editing.md](https://github.com/Augani/openreel-video/blob/main/docs/ai-editing.md): ferramenta fechada de ações, rascunho isolado, histórico, falha/cancelamento descarta rascunho, media refs não carregam blobs/keys, import/export validado. Essa arquitetura deve inspirar nosso executor, com segurança e privacidade antes de improvisar um orquestrador de agentes livre.

## Política por tipo de tarefa
| Decisão | Prioridade de executor |
|---|---|
| Detectar frame/codec/respiração/silêncio | Algoritmos locais |
| Alinhar fala/legenda | ASR local + validação acústica |
| Classificar frase e achar primitives | embeddings + regras locais |
| Escolher gancho/storyboard/StyleDNA | modelo local ou API grátis autorizada e benchmarkada |
| Gerar SceneGraph seguro | modelo retorna nós permitidos + validador |
| Aplicar mudanças | transação atômica, executor determinístico |
| Rejeitar cortes ruins, fora de quadro, erros | QA determinístico; visão opcional e revisão humana |
| Comparar qualidade editorial entre modelos | DSPy/Promptfoo **offline**, com dataset e orçamento |

**Limitação essencial:** qualidade de motion designer experiente é uma meta de benchmark cego. Nenhum repositório torna modelos gratuitos infalíveis. Presets e referências são direcionadores, não algemas criativas.

[Índice](INDEX.md) · [Composição](02-motion-and-composition.md) · [Matriz](05-integration-matrix.md).
