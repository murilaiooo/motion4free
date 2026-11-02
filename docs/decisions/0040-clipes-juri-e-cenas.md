# ADR-0040 — Júri da IA, IA dos clipes e cortes para séries e filmes (v0.39.0)

Data: 02/11/2026 · Status: aceita (pedido do responsável: "cardápio maior de IAs… corte de clipes tem que ser perfeito pegando o contexto exato e as melhores partes de um vídeo longo; vai ser usado para cortar cenas de séries e filmes, vídeos longos do YouTube… IA assertiva sem ser extremamente pesada")

## Contexto
Até a v0.37 a IA só propunha trechos novos por janela da transcrição; a ordem final era a nota das regras. Não havia como escolher uma IA só para os clipes, cenas sem fala nunca apareciam e o corte caía no meio de um plano em séries e filmes.

## Decisão
1. **Júri da IA** (`src/editorial/clip-jury.ts`): uma chamada curta com os 12 melhores trechos (6 na IA do navegador, texto encurtado) pede notas 0–10 em gancho, história, autonomia e valor. Leitura tolerante (mesmas regras de `ai-json.ts`), 2 tentativas. A nota final = 50 % app + 50 % IA. A IA nunca muda bordas, texto ou título. Falha: M4F-1117 e ordem do app.
2. **IA dos clipes** (`ClipAiPicker` em `AiOptions.tsx`): usa a rota por tarefa que já existia (`taskRoutes['moment-ranking']`). Nenhum serviço novo, nenhum custo novo; chaves continuam onde estavam.
3. **Troca de cena** (`src/editorial/scene-cuts.ts` puro + `src/media/scene-cuts.ts`): histograma de luz e cor de quadros de 64 px, 10 por segundo, ±2,5 s em volta de cada borda; troca = diferença ≥ 0,35 e ≥ 3× a mediana (ideia clássica de detecção de corte, como no PySceneDetect, BSD-3; reimplementada, nenhum código copiado). A borda só se move se nenhuma palavra estiver no caminho. Falha é silenciosa (é só melhoria).
4. **Cenas sem fala** (`src/editorial/sound-moments.ts`): nos trechos sem palavras, a janela com som bem acima da mediana do vídeo (≥ 2 dB) vira candidata; nota máxima 70, começo/fim do vídeo pesam menos (abertura, créditos). Até 6 por vídeo.
5. **Regras sem IA**: energia dos 3 s iniciais entra no critério de energia; desvios de live/podcast perdem nota; trechos com > 70 % das mesmas palavras de conteúdo contam como repetidos.

## Alternativas descartadas
- Classificador de som (YAMNet/MediaPipe Audio): melhor para distinguir risada de música, mas é mais um download e precisa de teste em navegador real. Fica para depois.
- Modelo de visão por quadro (CLIP/VLM no navegador): pesado demais para vídeos de 2 h em máquinas comuns.

## Consequências
- Cada clipe gerado lê ~100 quadros minúsculos a mais (menos de 1–2 s na maioria dos aparelhos).
- Vídeo totalmente sem fala continua recusado (M4F de "sem fala"); cenas sem fala só aparecem junto de vídeos com alguma fala.
- Testado só por unidade e typecheck na nuvem; o teste no Brave fica com o responsável.
