# ADR-0016 — Projetos, armazenamento e cota local (v0.11.0)

**Data:** 2026-10-20
**Status:** ACEITA (parcial: núcleo e tipos concluídos; UI de gestão e tela de armazenamento em progresso).

## Contexto
O responsável pediu “Meus projetos”, ver GB ocupados e poder apagar, e remover o vídeo atual sem perder o arquivo original no disco. Plano em [plano-produto-final.md](../superpowers/plans/2026-10-20-plano-produto-final.md) §3 Frente 1. Regras base: browser-first, sem envio de vídeo, M4F-xxx para erros, versão no rodapé ([AGENTS.md](../../AGENTS.md)).

## Decisão
1. **EditPlan passa a `clips` + `segments` + `format`** (src/core/schema.ts, v6 parcial) para suportar múltiplos vídeos e formatos; migração v5→v6 (framing `fill|cover`) e preenchimento de `clips: []` quando ausente.
2. **Tipos de projeto** em `src/core/types.ts` (ProjectMeta, storage estimate) e **formatos** em `src/core/formats.ts` (9:16, 1:1, 4:5, 16:9) com `navigator.storage.estimate()` e `persist()`.
3. **Correções de migração**: `migratePlan` com `earlyReturn` via `editPlanSchema.safeParse` e preenchimento condicional (`!('clips' in current)`) para não quebrar projetos v0.10 salvos; `LEGACY_FRAMING` `fill→smart` unificado.
4. **Splice** em `src/media/splice.ts` não mescla faixas “touching” quando `SpliceJoins.clips.length>0` (preservar bordas de clipe para multi-clip), teste em `tests/loudness.test.ts`.
5. **Correção de tipos de mídia** revertida para single-clip (`OpenedMedia` single) para manter `tsc --noEmit` verde; `src/media/sources.ts` e `src/render/framing.ts` introduzidos.

## Consequências
- Projetos v0.10 abrem sem perda; testes de projeto/schema passam após correção `framing`.
- UI de “Meus projetos” e tela Armazenamento ainda pendentes (próximo incremento da v0.11).
- Novos arquivos: `src/core/formats.ts`, `src/analysis/loudness.ts`, `src/engine/clips.ts`, `src/render/framing.ts`, `src/media/sources.ts` + testes.
- M4F futuros: cota excedida, persistência negada.
