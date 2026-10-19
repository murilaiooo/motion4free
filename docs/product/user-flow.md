# Jornada de edição: Reels com gancho e motion design

## Exemplo de pedido
> “Edite esse vídeo para o formato Reels do Instagram com formato viral, gancho nos 3 primeiros segundos e motion design alinhado com o que eu tô falando no vídeo. Adicione transições modernas e cortes de respiração.”

### Passo 1 — Traduzir intenção, sem prometer viralidade
Compilar pedido em perfil `reels_dynamic`, proporção 9:16, objetivo de gancho 0–3s, cadência dinâmica, remoção de pausas **não intencionais**, legendas sincronizadas, transições sem excesso e animações semanticamente justificadas. Pedidos claros como “9:16” são resolvidos por regras, sem consulta externa.

### Passo 2 — Análise local
- Ler duração/fps/orientação/audio/codecs. Criar proxy quando viável.
- Extrair voz e transcrever na língua original, com timestamps e confiança.
- Montar mapa de frases, pausas, ruídos, tomadas repetidas, falhas e faces.
- Guardar resultados e assinaturas no projeto local para não refazer trabalho.

### Passo 3 — Candidatos a gancho
Buscar 3–5 frases completas que possam abrir o vídeo sem contexto artificial. Regras excluem negações invertidas, números incertos ou declarações inconclusas. O modelo compara por clareza, curiosidade, especificidade e aderência ao restante da história. Seleção aponta IDs de trechos reais, nunca texto inventado.

### Passo 4 — Selecionar história e EDL
Escolher blocos que preservem premissas, explicação, prova e conclusão. Ajustar duração ao material realmente útil. O corte ocorre com marcação em waveform/fps e margem para consoantes fracas; pausas expressivas são protegidas.

### Passo 5 — Motion design semântico
Regras detectam menções a número, lista, contraste, preço, alerta e processo. Busca semântica no catálogo devolve poucas cenas candidatas, incluindo `none`. Modelo decide por ID e justifica. O motor aplica parâmetros, temporização e posição sem cobrir rosto nem falsificar fatos.

### Passo 6 — Transições, legendas e som
Corte seco é padrão de falas contínuas; transição visual fica reservada a mudanças reais de ideia. Legendas usam palavras efetivamente pronunciadas. Música/SFX somente com direitos e sem competir com a voz.

### Passo 7 — Sample e QA
Renderizar uma amostra representativa (8–15s) com transição, fala, legenda e animação. Verificar artefatos de corte, enquadramento, clipping, sincronismo, tempo, áudio e texto. Métricas alertam, mas não substituem verificação audiovisual e aprovação quando solicitada.

### Passo 8 — Exportação e revisão
Render local MP4, salvar projeto, mostrar decisões e eventuais incertezas. Pedido “troque o gancho” reexecuta somente a seleção e os segmentos dependentes, preservando transcrição e cache.

## Exemplo de contrato de decisão (conceitual)
```json
{
  "profile": "reels_dynamic",
  "source_phrase_ids": ["p_29", "p_04", "p_12"],
  "hook_phrase_id": "p_29",
  "motion": [{"scene_id": "revenue-counter", "source_phrase_id": "p_12"}],
  "transition_style": "restrained_modern",
  "requires_review": []
}
```
Não é schema de produção. Referências precisam existir e todos os tempos e parâmetros devem ser validados por execução determinística.
