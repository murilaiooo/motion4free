# ADR-0019 — Múltiplos vídeos e formatos de saída (v0.14.0)

**Data:** 2026-10-20
**Status:** ACEITA (parcial: motor entregue; player/export multi-clip pendentes).

## Contexto
Plano §3 Frente 4: até ~30 clipes (escolha múltipla, ordem por data/nome ou drag), transcrição por clipe compartilhando modelo, plano como sequência de `segments` apontando para `clipId`, transições/crossfade/volume igualado, montagem automática (silêncios+retakes), formatos 9:16/1:1/4:5/16:9 com `cover/smart/fit+blur` e corte inteligente seguindo rosto, exportação fiel em todos os formatos.

## Decisão
1. **Motor multi-clip** (`src/engine/clips.ts`, `src/editorial/assembly.ts`): ordenação, gancho, receitas, `clips` no plano; `src/media/splice.ts` corrigido para não mesclar `touching` quando `joins.clips` presente.
2. **Formatos** (`src/core/formats.ts`, `src/render/framing.ts`): `OutputFormat` + `SourceFrame` normalizado; `format` no `EditPlan` com default `portrait`; `frame.ts` consome `framingFor`.
3. **Fontes múltiplas** (`src/media/sources.ts`): estrutura para decoder/player/export ler vários `File`s; tipos single-clip mantidos temporariamente em `src/media/input.ts|player.ts|export-client.ts` para `tsc --noEmit` verde; UI de reordenar clipes pendente.
4. **Loudness/normalização** (`src/analysis/loudness.ts`, `src/media/splice.ts`) com testes `tests/loudness.test.ts`, `tests/splice.test.ts` (faixa touching 0.5s isolada por `SpliceJoins`).

## Consequências
- Cortes/legendas/gancho/modelos/travas já operam sobre timeline montada em testes (`tests/clips.test.ts`, `tests/framing.test.ts`).
- Player e export multi-clip (File→Blob multi) na próxima iteração da v0.14; novos M4F: muitos clipes, total longo, clipe ilegível, memória.
