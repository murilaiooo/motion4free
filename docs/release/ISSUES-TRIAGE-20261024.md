# Triagem executável de issues — Motion4Free (24/10/2026)

Fonte: GitHub `murilaiooo/motion4free`, após encerramento das 23 PRs antigas e das issues #3, #9 e #30. **21 issues abertas.** Staging: `integration/pr-consolidation-20261024`; `main` não foi alterada nem publicada nesta missão.

## Issues concluídas nesta missão

| Issue | Estado e evidência | Destino |
| --- | --- | --- |
| [#9](https://github.com/murilaiooo/motion4free/issues/9) | Concluída tecnicamente: 7 testes de budget, cache, cooldown e fallback, com 1.708 testes totais; não houve API paga | [PR #134](https://github.com/murilaiooo/motion4free/pull/134), merged no staging |
| [#3](https://github.com/murilaiooo/motion4free/issues/3) | Spike de MP4 comprovado em Brave e Chromium, áudio+vídeo, 30 FPS, H.264/AAC, duração, JS heap pontual e latência. Não é benchmark de vídeo longo | [PR #135](https://github.com/murilaiooo/motion4free/pull/135) e [evidência](ISSUE3-BROWSER-MP4-POC.md) |
| [#30](https://github.com/murilaiooo/motion4free/issues/30) | Consolidada, **não completada**: todos os critérios de blind-review e originalidade foram transferidos para [#10](https://github.com/murilaiooo/motion4free/issues/10), sem eliminar obrigações | #10 segue aberta |

## P0 e bloqueios de publicação

| Issue | Estado efetivamente conhecido | Próxima prova requerida |
| --- | --- | --- |
| [#2](https://github.com/murilaiooo/motion4free/issues/2) — licença e assets | **Pausada por decisão anterior do responsável**; não encerrar nem distribuir material de terceiros sem provenance | retomar autorização e auditar modelos, binários e todos os assets; avisos distribuídos |
| [#4](https://github.com/murilaiooo/motion4free/issues/4) — OPFS/cache | POC entregue e testada no staging: service worker versionado 11,4 MB (61 arquivos), reabertura offline OPFS, backup `.m4f` com checksums SHA-256 e restauração em outro perfil; QA com `QuotaExceededError` e falha de cópia | testes de campo pós-release com quotas reais/memória e CDN opcionais continuam como riscos conhecidos, sem declarar modo offline completo |
| [#5](https://github.com/murilaiooo/motion4free/issues/5) — OpenReel | comparação estática documentada, fork não adotado; nenhuma POC import/trim/caption/export/undo upstream testada | provar/parar o spike com matriz e decisão técnica explícita; não confundir com OpenCut |
| [#26](https://github.com/murilaiooo/motion4free/issues/26) — 3 composições | POC isolada na branch arquivada #116, não portada/homologada | rodar composições, export MP4 e revisão cega, licenças |
| [#102](https://github.com/murilaiooo/motion4free/issues/102) — clipes contextuais | Índice e seleção por contexto já integrados, acrescidos de [avisos lexicais PT/EN de negação, condição, comparação e referência](ISSUE102-CONTEXT-REVIEW.md) portados da #116; qualidade de narrativas independentes **não comprovada** | QA de gancho/antecedente/payoff com vídeos reais autorizados, WER, cortes e avaliação humana |
| [#117](https://github.com/murilaiooo/motion4free/issues/117) — eventos por palavra | Dois incrementos no staging: [eventos manuais por wordId](ISSUE117-WORD-ANCHORED-MOTION.md), com três estilos (destaque, sublinhado, pulso), sem regressão em projetos antigos, `drawFrame` em preview/export, undo/persistência e compatibilidade com cortes/duplicações/clipes/quiet/locked; MP4 sintético via Worker validado | ainda faltam controles avançados de duração/curvas e estilos, inspeção visual humana e stress com mídias reais |

## P1 de produto, IA e qualidade

| Issue | Estado e próximo gate |
| --- | --- |
| [#6](https://github.com/murilaiooo/motion4free/issues/6) — ASR/respiração | lógica local existe; faltam corpus humano, incertezas/negações e verificação de cortes sem perda de sentido |
| [#7](https://github.com/murilaiooo/motion4free/issues/7) — catálogo cenas | alterações experimentais na #116, precisam portar com licenças e teste real de preview/export |
| [#8](https://github.com/murilaiooo/motion4free/issues/8) — microdecisões | base determinística existe; falta provar contexto/negações e segurança end-to-end nos candidatos reais |
| [#10](https://github.com/murilaiooo/motion4free/issues/10) — benchmark e originalidade | incorpora integralmente #30; exige gravações autorizadas e pessoas avaliadoras; não tratar Vitest como nota humana |
| [#11](https://github.com/murilaiooo/motion4free/issues/11) — edição conversacional | histórico/revisões existem parcialmente; provar revisão local, 9:16, gancho real, persistência sem retrabalho |
| [#27](https://github.com/murilaiooo/motion4free/issues/27) — presets/brief | contrato atual existe parcialmente; avaliar variações realmente diferentes sem perder preferências |
| [#28](https://github.com/murilaiooo/motion4free/issues/28) — motores/SceneGraph | POC Canvas/Three no histórico #116, ainda sem benchmark de seek, GPU, áudio e export |
| [#29](https://github.com/murilaiooo/motion4free/issues/29) — Creative Director | specs e protótipos em #116, revisões e qualidade reais ainda não aferidas |
| [#54](https://github.com/murilaiooo/motion4free/issues/54) — faces | track inteligente em #116 não homologado; precisa teste com rosto real autorizado, save/reopen, preview/export |
| [#118](https://github.com/murilaiooo/motion4free/issues/118) — variantes A/B | contrato e UI ainda pendentes; dependerá da semântica #117 e estabilidade da edição |
| [#126](https://github.com/murilaiooo/motion4free/issues/126) — setup IA para leigos | Incremento funcional: finalidade primeiro, separação texto vs ASR, microteste por modelo com consentimento por request e rota por tarefa, preços conservadores; faltam compatibilidade/cotas realmente aferidas, microbenchmark e usuários reais. [Evidência](ISSUE126-GUIDED-AI.md) |
| [#127](https://github.com/murilaiooo/motion4free/issues/127) — ASR por API | especificação existente; sem endpoint de áudio integrado. Consentimento de texto não autoriza upload de áudio |

## Reconciliação e publicação

| Issue | Estado e próxima decisão |
| --- | --- |
| [#132](https://github.com/murilaiooo/motion4free/issues/132) — snapshot 48 arquivos | Concluída a reconciliação técnica, todos os 48 caminhos presentes no staging: 18 idênticos, 30 evoluídos, 0 ausentes; 10 E2E de criação/workbench no Brave passaram. Branch histórica preservada. [Relatório por arquivo](ISSUE132-SNAPSHOT-RECONCILIATION.md) |
| [#133](https://github.com/murilaiooo/motion4free/issues/133) — #116 (31 commits) | 13 conflitos de integração mapeados; migrar domínio a domínio com unit/E2E/MP4 e contratos atuais |
| [#12](https://github.com/murilaiooo/motion4free/issues/12) — publicar | custos, licença, política, GitHub Settings e hardware a auditar; só depois do runbook. Merge na `main` pode publicar automaticamente |

## Fila objetiva: fechar uma issue por vez

1. **#4 CONCLUÍDA no staging:** cache/offline medido, backup portátil e restauração em perfil limpo; evidencia em [ISSUE4-OFFLINE-STORAGE.md](ISSUE4-OFFLINE-STORAGE.md).
2. **#102:** corrigir o criador de clipes com histórias completas, não apenas trechos de alta energia; provar com corpus autorizado e casos de pronomes/negações.
3. **#126:** terminar o assistente de modelos adequado a usuários leigos, com teste por modelo e preços honestos. A UX #131 é somente o primeiro incremento.
4. **#133:** portar primeiro segurança/consentimento e correções de estado; depois mídia/face/clip context, cada uma com testes e PR pequena.
5. **#127 + #117:** ASR remoto autorizado e eventos visuais por palavra, cada qual isolado para não confundir consentimento de áudio e texto.
6. **#132 CONCLUÍDA no staging:** todos os 48 caminhos revistos, nenhum ausente; [relatório por arquivo](ISSUE132-SNAPSHOT-RECONCILIATION.md).
7. **#5/#28/#26/#10:** apenas encerrar mediante prova experimental e avaliação humana quando exigida. #2 só retomar com autorização do responsável.

**Política:** comentários/relatórios de triagem não concluem critérios de aceite. Issue só fecha com artefato e teste verificáveis, ou como duplicate/not_planned quando o escopo foi transferido integralmente e a decisão foi explicitamente registrada. Evitar novos PRs gigantes, merges forçados ou publicação da `main`.
