# ADR-0025 — Briefing antes da mídia e produção verificável

Data: 21/10/2026. Status: aceita para implementação incremental.

## Contexto e decisão

O pedido de transformação autoriza execução contínua e decisões técnicas autônomas. A base é main `31b83cd`, v0.23.1. O PR #67 continua draft e contém somente pesquisa; o PR #55 contém QA antigo com conflitos. Nenhum deles será sobrescrito ou integrado implicitamente.

O objetivo é abrir o site, definir intenção, importar mídia e receber um primeiro rascunho editado que possa ser exportado ou personalizado. Preservamos React, Canvas2D, Mediabunny, OPFS, a transcrição local, o histórico e as migrações v1–v6. Substituir a engine agora perderia implementações comprovadas sem resolver a entrada do produto. Um editor paralelo também duplicaria estado. A escolha é integrar onboarding e planejamento puro à engine atual, depois extrair o shell redimensionável.

`CreativeSetup` é entrada versionada e validada. É guardada opcionalmente no CreativeBrief existente, sem mudar a versão do EditPlan ou remover campos de projetos antigos. Preferências sem mídia ficam em localStorage; projetos continuam no OPFS. Texto livre usa o intérprete existente, nunca executa código. Escolhas explícitas prevalecem sobre o texto livre nos mesmos campos. Preferências de público, referência e preservação são contexto; qualquer interpretação não suportada é informada, nunca descrita como aplicada.

`CreativeSetup → CreativeBrief → EditorialPlan → EditPlan validado → drawFrame` usa decisões determinísticas, sem rede ou IA obrigatória. Cortes respeitam palavras e margens; duração desejada só encerra em limite de frase, sem remontar o discurso. Sem fala confiável, preservar conteúdo e informar a limitação. O gancho atual destaca uma frase real como título, sem alegar reordenar a fala. Música automática, análise visual de cenas e efeitos sonoros ainda não estão implementados: aparecem como limitações, não controles fictícios.

A revisão usa o player e exportador existentes. Alterar direção em projeto aberto cria uma operação reversível e preserva segmentos, elementos manuais e travas; regenerar timing será uma ação separada futura. A avaliação apresenta métricas técnicas e alertas; não é uma nota de qualidade artística.

## Aceite e riscos

- Setup permite voltar, pular opcionais, salvar preferências e recuperar rascunho após reload.
- Formato, estilo, ritmo, cortes, legenda, cor, transição, movimento e CTA alteram o plano real.
- Nenhum primeiro rascunho válido pode ter timeline vazia; falha mantém as preferências e mídia original intactas.
- Revisão oferece Exportar e Personalizar; projetos antigos continuam abrindo.
- Layout tem limites, reset, teclado, cancelamento de gesto e persistência independente do undo audiovisual.
- Testes puros, E2E com ASR sintético explicitamente identificado e MP4 real. Qualidade Whisper e julgamento editorial com vídeos reais continuam sob aceite humano.

## Fontes e licença

Lidos os 11 documentos do dossiê OpenCut em `2ff57e3`, além dos ADRs e código atual. Referências de comportamento: Classic `cf5e79e` (`editor/panel-store.ts`, `animation/keyframes.ts`) e rewrite `e668010` (`components/resizable.rs`, `routes/editor.tsx`). Reutilização conceitual; nenhum código ou asset upstream copiado. O editor web do rewrite ainda mostra Coming soon. Não dependemos de APIs/plugins/headless anunciados.
