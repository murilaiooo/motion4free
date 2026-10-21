# Implemented increment — UNTESTED / AWAITING QA

`src/core/creative-plan.ts` and `src/editorial/creative-plan.ts` define and derive a structural storyboard, existing-element reference graph and bounded human review. Editor offers beat seek and one explicit undoable repetition-hiding action per click. This does not analyze visual samples or generate new artistic compositions. See `docs/reviews/2026-10-21-issue29-implementation-handoff.md` for limits and QA.

The broader architecture below remains a proposal beyond this increment.

# Creative Director Agent — IA como diretora de arte, não simples seletora de catálogo

**Status:** arquitetura alternativa recomendada na [auditoria](../reviews/2026-10-18-premium-creative-audit.md), ainda não aprovada/implementada.

## Por que ampliar a proposta inicial
O sistema inicial restringia IA a microdecisões e `scene_id`. Essa restrição aumenta segurança, mas gera teto de personalização. Nosso objetivo é **uma direção global coerente e cenas autorais compostas com peças existentes**, não código arbitrário gerado sem controle.

## Hierarquia criativa
```text
User Prompt + Preset + Brand + Reference Assets
  -> CreativeBrief normalizado e constraints
  -> Media Understanding (fala + frames + ritmo + rosto + cenário)
  -> Creative Director: StyleDNA, narrativa, ritmo e identidade
  -> Storyboard: shot beats, purpose, asset requests, motion strategy
  -> Scene Composer: gramática visual + catálogo + ativos licenciados
  -> Deterministic Renderer: mesmo tempo no preview/export
  -> Multimodal QA + heuristic QA + human preview
  -> Revisão localizada com histórico
```

### 1) Compreensão editorial multimodal
LLM não precisa olhar todos os quadros: receber keyframes relevantes, descrições locais, transcrição alinhada, shot boundaries, música e sinais visuais. Quando visão remota estiver disponível, envio somente com autorização e minimizar dados transmitidos. Um modelo só textual **não deve fingir que viu** vídeos.

### 2) Direção artística global e StyleDNA
Decidir hierarquia visual, paleta, tipografia permitida, acabamento 2D/3D, composição, linguagem de câmera, easing, ritmo de cuts, uso de silêncio, gravidade/energia de movimentos e coerência de marca. Vincular a escolhas reais do usuário; evitar “estética genérica de IA”.

### 3) Planejador narrativo
Uma passagem global: pontos de história, surpresa, proof, tensão, hook, chamada para ação quando autorizada, pontos onde imagem deve **explicar** e não adornar. Depois planejar scenes localmente com restrições. IA pequena pode receber subtarefas, mas não pode substituir o plano global.

### 4) Scene Composer
Produzir **scene graphs declarativos, parametrizados e versionados**, combinando primitivos vetoriais, texto, imagens, fotos locais, 3D, máscara, gráficos, shader, legendas, sons e keyframes. O modelo não tem permissão de execução de JS; nós gráficos/capacidades são registrados e testados, sujeitos a limites de recursos.

### 5) Asset Curator
Buscar primeiro nos arquivos do usuário e biblioteca legalmente redistribuível. Marcar relevância e proveniência. Imagens sem contexto, assets comuns e cópias de referências sem autorização são recusadas. Sem geração de imagens/vídeos externa paga ou scraping arriscado como default.

### 6) Crítico e reparador
Primeira amostra renderizada serve como entrada para revisão técnica (black frame, layout, captions, cenas fora de tempo) e, quando houver capacidade, crítica visual: hierarquia, ritmo e legibilidade. Juízo estético de IA é **hipótese** e pode errar; múltiplas passagens são condicionais, custo/compute limitado. A IA pode propor revisão, nunca assumir aprovação visual humana quando exigida.

## Como impedir explosão de quotas
- Uma chamada global de direção por projeto/estilo quando necessário; mudanças locais não refazem tudo.
- Geração de cenas por lote curto com contratos restritos; não uma chamada por frame.
- Busca de assets/ícones/primitivos local; respostas incluem IDs, bounds e parâmetros.
- Condensar contexto de prompts com referências indexadas localmente; dados de transcrição são sempre não confiáveis.
- Iteração critic/revise limitada por regras de orçamento e pontos de falha, não sempre.
- Cache por hash/versão/escopo; escolher modelos com benchmark por tarefa.
- Em modo sem modelo capaz, usar “preset + composição conservadora” claramente identificado.

## Resultado proposto: CreativePlan
```json
{
  "briefRef": "b1",
  "styleDnaRef": "s1",
  "storyboard": [
    {
      "beatRef": "beat-07",
      "purpose": "visualize_causal_chain",
      "sourcePhraseIds": ["phrase-018"],
      "sceneGraphRef": "sg-018",
      "assetRefs": ["asset-user-003"],
      "why": "demonstra relação causal da fala"
    }
  ],
  "review": {
    "requiresHumanAttention": false,
    "warnings": []
  }
}
```
Refs só podem apontar a dados existentes e recursos autorizados.

## Exemplos de decisão válida e inválida
**Válida:** expressão “três alternativas” -> diagrama de bifurcação com três caminhos e rótulos realmente pronunciados, estilo da marca, tempos calibrados, animação progressiva.

**Inválida:** ícone de dinheiro e moedas girando porque o modelo leu “valor” no sentido abstrato; cena de estatística fabricada; repetição de mesmo contador em cinco momentos diferentes.

## Limites que nunca escondemos
- IA gratuita, principalmente a local pequena, pode não alcançar julgamento visual de motion designer experiente em tarefas altamente abertas.
- Criar composição avançada do zero exige biblioteca de primitivos rica, curadoria e bons dados de benchmark.
- Não há garantia de originalidade absoluta nem de qualidade idêntica offline/sem GPU.
- Proibir promessas de background cloud sem recursos; “background” aqui significa **Web Workers/orquestração durante a sessão web**, não processamento ilimitado em servidores.
