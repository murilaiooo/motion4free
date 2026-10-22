# ADR-0032 — OpenReel: manter stack v1 enquanto a comparação está pendente

Data: 2026-10-21. Decisão de implementação: preservar Canvas2D/Mediabunny/EditPlan da ADR-0005; adoção/fork de OpenReel fica adiada. **UNTESTED / AWAITING QA.** Esta decisão não conclui o spike #5 nem afirma que o candidato falha.

## Causa e decisão

O backlog histórico pede comparação real import/trim/caption/export/reopen/undo. A implementação atual já possui timeline, serialização, histórico e compositor próprios; trocar a base sem evidência comparável arriscaria persistência e preview/export. A missão desta sessão proíbe executar precisamente as provas que fundamentariam adoção. Não duplicar uma timeline inteira nem promover uma integração com base no README. Adaptar somente os princípios de operações declarativas, snapshot atômico e rollback já presentes no desenho; nenhuma cópia upstream foi feita neste incremento.

## Matriz estática de cobertura a comparar

| Operação | Motion4Free atual (fonte, não prova) | Entrada OpenReel no dossiê existente | Evidência pendente |
|---|---|---|---|
| Import/trim/múltiplos clipes | src/media, editorial/manual.ts, engine/clips.ts | core Media/Timeline/Clip e browser-capabilities | mesma mídia, codec, limites e falhas |
| Legendas/motion por frame | render/frame.ts, render/scenes.ts, core/types.ts | animation/composition-renderer.ts | texto/cor/alpha/seek e estruturas equivalentes |
| Exportação/áudio | src/media e export workers | export/export-engine.ts, webcodecs-backend.ts | MP4/áudio real e memória/latência |
| Reabertura/identidade | core/project* e EditPlan v6 | storage/project-serializer.ts | round trip, IDs, undo e mídia ausente |
| Operações de IA | editorial/commands.ts e histórico imutável | documentação de draft/commit/rollback | erro parcial, rollback e compatibilidade |

As referências upstream são as registradas em `docs/research/upstream-implementation/01-media-and-editor.md`, não uma nova auditoria de revisão executável. A declaração MIT do repositório não substitui inventário de cada pacote/binário/asset.

## Bloqueio e próximo trabalho

O protótipo adaptador OpenReel executável/comparativo continua **não entregue**. Para destravar: escolher e congelar revisão upstream e dependências, concluir auditoria de licenças, preparar checkout isolado e adaptar a mesma gravação autorizada/cenas; QA independente executa import/trim/caption/export/reopen/undo e mede memória/latência em Brave. Comparar com baseline #3; registrar também falhas e lacunas, depois atualizar esta ADR para adotar/adaptar/descartar com evidência. A POC #111 Canvas/Three não é uma prova de OpenReel. Não fechar #5 por este documento.
