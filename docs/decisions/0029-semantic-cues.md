# ADR-0029 — Âncoras semânticas para eventos de vídeo (proposta experimental)

**Data:** 21/10/2026  
**Status:** proposta, não ativada em produção  
**Motivação:** pesquisa independente do [Hypit](../research/updates/2026-10-21-hypit-engineering-audit.md).

## Contexto

O Motion4Free já tem `Word.id` com start/end na mídia original e suporta edição de segmentos, inclusive cópias e reordenação. As legendas são temporizadas por palavra; os eventos visuais de cenas ainda dependem principalmente de tempos absolutos na edição. Isso dificulta manter gráficos e chamadas sincronizados quando a timeline muda.

## Decisão

Introduzir incrementalmente um contrato próprio de evento semântico, referenciado por `wordId`, resolvido contra **todas as ocorrências completas** da palavra nos segmentos mantidos. A saída é um conjunto de janelas semiabertas `[startFrame,endFrameExclusive)`, com `segmentIndex` e ID de ocorrência. A decisão de qual evento adicionar continua pertencendo ao editor/seletores; a camada temporal não interpreta texto, não chama IA e não usa browser APIs.

A primeira POC está em `src/editorial/semantic-cues.ts`, com testes em `tests/semantic-cues.test.ts`. **Nenhum campo novo entra no EditPlan v6 nesta etapa** e nenhum comportamento do usuário muda. Integração de render, persistência, histórico, edição manual, migrações e export só após validação e plano específico.

## Invariantes obrigatórias

1. Não reaproveitar automaticamente ID antigo quando a fala muda ou é regravada. Mudança de narração exige novo alinhamento/verificação.
2. Se a palavra sumiu ou ficou incompleta após um corte, o evento não pode aparecer em horário arbitrário.
3. Cópias explícitas de um segmento geram ocorrências distintas, salvo regra de usuário que as desabilite na futura camada de edição.
4. A âncora é uma referência, nunca um comando. Entrada de LLM será validada por IDs reais e schemas fechados.
5. Preview e export usam a mesma janela resolvida e o mesmo relógio de frames.
6. Posição, estilo e trava alterados manualmente pelo usuário prevalecem sobre sugestões automáticas.
7. Código inspirado em conceitos técnicos deve ser original; não importar ou venderizar componentes do Hypit sem revisão de licença.

## Alternativas descartadas

- **`@hypit/hypit` como dependência:** licença modificada e execução Node/Chromium/serviços externos conflitam com o produto browser-first e a distribuição pretendida.
- **Procurar o texto da palavra a cada frame:** falha com repetições, homônimos, correção de transcrição e latência.
- **`sourceToOutput()` por evento:** retorna a primeira ocorrência e falha com duplicação.
- **Recalcular efeitos só após export:** gera divergência com o preview e prejudica a experiência de edição.

## Critério de aceitação para mudar para «aceito»

Testes unitários e typecheck, casos de áudio/fala/cortes e seek, E2E de projeto salvo/reaberto, inspeção de MP4 em 24/30/60 fps, privacidade e controle de edição manual. Não declarar implementada a experiência de usuário somente pela presença do agendador.
