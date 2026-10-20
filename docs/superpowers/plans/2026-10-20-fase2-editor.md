# Fase 2 — editor básico: plano de implementação

> Formato Superpowers `writing-plans`, versão curta. Executar em ordem, com TDD nas camadas puras (teste primeiro, ver falhar, implementar, ver passar, commitar).

**Objetivo:** depois da edição automática, a pessoa assiste ao resultado com som, vê a linha do tempo, corrige legendas, restaura ou ajusta cortes, desfaz/refaz, fecha a aba e reabre o projeto; a exportação não trava a tela.

**Spec:** [v1](../specs/2026-10-20-motion4free-v1-design.md) · **Plano mestre:** [Fase 2](2026-10-20-plano-mestre.md) · **Stack:** [ADR-0005](../../decisions/0005-stack-v1.md) (sem dependência nova).

## Decisões
- **Fonte de verdade continua sendo o `EditPlan`.** O histórico guarda planos inteiros (são pequenos); cada operação é uma função pura `(plano, contexto) → plano`. O contexto (`duração`, `palavras`) não muda durante a edição.
- **Cortes são derivados**: corte = intervalo do original fora de todos os trechos mantidos. Ajustar ou restaurar um corte recalcula os trechos e reconstrói as legendas pelas palavras; o texto editado de uma legenda é preservado quando o grupo de palavras dela continua o mesmo (mesmos `wordIds`). Se o agrupamento mudar por causa do corte, a legenda volta ao texto transcrito (desfazer recupera).
- **Player** (`src/media/player.ts`): relógio = `AudioContext.currentTime` (ou `performance.now()` se o áudio não iniciar). Áudio = trechos mantidos emendados por `spliceAudio` (mesma função da exportação) num `AudioBufferSourceNode`. Vídeo = `CanvasSink` do Mediabunny percorrendo os trechos; cada quadro é desenhado por `drawFrame`, a mesma função da exportação, em meia resolução.
- **Linha do tempo no tempo do original**: mostra trechos mantidos, cortes (clicáveis para restaurar/ajustar), waveform (picos por coluna, função pura) e legendas. Clique num trecho mantido = ir para aquele ponto.
- **Projeto no OPFS** (`src/app/project-store.ts`), um projeto por navegador: `project.json` (plano, histórico, palavras, silêncios, avisos, dados do vídeo) validado por zod (`src/core/project.ts`) e uma **cópia** do vídeo (`video.bin`, melhor esforço). O original nunca é alterado. Se a cópia faltar, o app pede o vídeo de novo (M4F-604) e confere tamanho e duração (M4F-603).
- **Exportação em Worker** (`src/media/export.worker.ts`): o Worker abre o arquivo com Mediabunny, recebe o áudio já decodificado e roda o mesmo `exportPlan`. O áudio passa a usar `AudioSampleSource` (não depende de `AudioBuffer`, que não existe em Worker). Se o Worker não iniciar ou cair, a exportação roda na tela principal como antes.
- **Prévia de 10 s removida**: o player substitui.

## Tarefas
| # | Entrega | Arquivos | Testes |
|---|---|---|---|
| 1 | Códigos de erro novos (5xx edição, 6xx projeto, 7xx player) | `src/core/errors.ts`, `docs/erros.md` | `tests/errors.test.ts` |
| 2 | Histórico undo/redo genérico, limite 100 | `src/engine/history.ts` | `tests/history.test.ts` |
| 3 | Cortes derivados e operações: `listCuts`, `adjustCut`, `restoreCut`, `editCaptionText`, `withSegments` | `src/editorial/ops.ts` | `tests/ops.test.ts` |
| 4 | Waveform por picos | `src/analysis/waveform.ts` | `tests/waveform.test.ts` |
| 5 | Formato do projeto salvo + validação | `src/core/project.ts` | `tests/project.test.ts` |
| 6 | Exportação sem `AudioBuffer` + Worker com reserva na tela principal | `src/media/export.ts`, `export.worker.ts`, `export-client.ts` | e2e (MP4 válido) |
| 7 | Player em tempo real | `src/media/player.ts`, `src/app/Player.tsx` | e2e |
| 8 | Linha do tempo, painel de corte, lista de legendas, desfazer/refazer | `src/app/Timeline.tsx`, `Editor.tsx`, `App.tsx` | e2e |
| 9 | OPFS: salvar automático, reabrir, pedir vídeo de novo | `src/app/project-store.ts`, `App.tsx` | e2e |
| 10 | Versão 0.2.0, CHANGELOG, plano mestre | `package.json`, `docs/CHANGELOG.md` | todos |

## E2E (`e2e/editor.spec.ts`)
1. Editar legenda → texto novo aparece; desfazer volta; refazer reaplica.
2. Restaurar o corte do meio → duração editada sobe para ~6 s; desfazer volta.
3. Recarregar a página → edição continua lá (projeto do OPFS, com cópia do vídeo).
4. Apagar a cópia do vídeo no OPFS e recarregar → aviso M4F-604; escolher o vídeo → projeto volta.
5. Player toca e o tempo avança; exportação gera MP4 1080×1920 com AAC e duração igual à mostrada (teste existente, agora via Worker).

## Verificação
`npx tsc --noEmit` · `npx vitest run` · `npm run build` · `npm run fixture && npx playwright test`.

## Fica para depois
- Arrastar as bordas do corte com o mouse (nesta fase: botões ±0,1 s e campos numéricos).
- Criar um corte novo a partir da linha do tempo; vários projetos salvos.
- Comparação automática quadro a quadro player × MP4 (gate da fase é conferência humana).
