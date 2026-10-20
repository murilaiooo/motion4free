# ADR-0018 — Editor completo: hit-testing, bounds e operações manuais (v0.13.0)

**Data:** 2026-10-20
**Status:** ACEITA (parcial: fundações concluídas; manipulação direta na prévia e inspetor pendentes).

## Contexto
Plano §3 Frente 3: arrastar legenda/título/emoji na prévia com alças, guias de encaixe, mover legenda “todas vs só esta”, posições normalizadas no plano, inspetor contextual, adicionar/remover elementos, editar palavras na transcrição cortando vídeo, dividir/aparar segmentos.

## Decisão
1. **EditPlan v6** unificado (src/core/schema.ts): `edits`, `clips`, `format` coexistindo; `migratePlan` encadeada v5→v6 com `safeParse` early-return.
2. **Operações manuais** em `src/editorial/ops.ts` (`splitAtCursor`, `trim`, `deleteWords`) com `M4F-510–517` e `1014` em `src/core/errors.ts`/`docs/erros.md`; respeitam `locked` (M4F-504).
3. **Render puro** em `src/render/*`: `layout.ts` (hit-testing, `boundsFor`, `elementBounds`), `frame.ts` (`framingFor` com `SourceFrame`), `captions.ts`/`emoji.ts`/`kit.ts` com testes `tests/scenes.test.ts`, `tests/motion-frame.test.ts`.
4. **Assembly/retakes** em `src/editorial/assembly.ts`/`retakes.ts` (`removeRetakes`, tentativas repetidas) com testes `tests/assembly.test.ts`, `tests/retakes.test.ts`.
5. UI de manipulação direta (drag, snap, teclado) adiada para próximo PR; base de 60 fps e undo/redo preservados.

## Consequências
- Prévia, inspetor e linha do tempo sincronizados via `look`/`hookStyle`; exportação reflete posições normalizadas.
- e2e pendentes: arrastar legenda e conferir pixels exportados, apagar palavra e ver duração, dividir/apagar segmento.
