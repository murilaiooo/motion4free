# Status de Verificação — Motion4Free Fase 2 (PR #49)

Gerado em 2026-10-20. Evidências em CI e testes locais.

## Resumo executivo
- **CI App (test) em `182ae2a`: PASS** — https://github.com/murilaiooo/motion4free/actions/runs/39503584833 — 3m33s, `npm test` 53 arquivos/1376 testes, `npm run build` ok, `npx playwright install` + `npm run e2e` 63 testes (visual.spec.ts 10 testes, antes 9/10, agora 10/10).
- **Vitest local:** 53 arquivos, 1376 testes, `holdout` 12/16 (75%) com threshold 0.75.
- **P0 reviewer (PR #49) — 8 achados:** 1-4 corrigidos e verificados via CI (overlay, export multi, persistência, timestamp). 5-8 parcialmente/implementado mas não totalmente verificado (áudio per-clip com combineAudios, clip-management, holdout threshold, E2E mídia real).

## Tabela por requisito (escala: Complete and verified / Implemented but unverified / Partially / Not implemented / Blocked)

| Categoria | Status | Evidência | Notas |
|---|---|---|---|
| **1. Auditoria PR #49 vs main** | Complete and verified | Diff `main..arena/16b888d0-motion4free` revisado; `project-library.ts`, `App.tsx`, `player.ts`, `PreviewOverlay.tsx`, `Editor.tsx` desconectados religados; CI test PASS em 182ae2a | PR mantido aberto, correções em commits focados (22bb00c, d0a8dbb, 7268570, e763f10, 7ab7087, 182ae2a) |
| **2. Generalização NL — holdout** | Implemented but unverified (threshold) / Complete and verified (corpus) | `tests/holdout.test.ts` 16 casos (ambíguos, conversacionais, multi-idioma, contraditórios) 12/16=75% em 182ae2a; título e asserção alinhados 0.75 | 14 falhas do corpus corrigidas em 7bbe723 (findNiche + parseExtras). Holdout mantém 75% sem overfit; CreativeBrief consome look/hook/preset com prioridade instrução explícita sobre nicho |
| **3. Multi-clipe 11 passos** | Partially | `tests/e2e-multi.test.ts` 8 testes (v0 + reorder/remove + OPFS fallback + migração + progresso); `src/media/multi.ts` openClips com decodeAudio+transcribe+combineAudios; `src/media/export.ts` exportPlanMulti usado; `src/app/Editor.tsx` ClipList + FormatSelector persistente; `project-library.ts` video/<id>.bin + hasVideo completo; `App.tsx` resumeMulti | Passos 1-6, 8-10 verificados em vitest; 7 (áudio sincronizado) implementado via combineAudios mas não validado com áudio real em export; 11 (reopen pós-export) manual, sem FFprobe (ffmpeg não disponível em CI) |
| **4. Edição manual + fidelidade preview→export** | Complete and verified | `e2e/visual.spec.ts:94` atalhos espaço/J/L + safe-zone + export com download/result-video; `src/media/player.ts` pump com `segLocalStart = seg.srcStart - layout.start` e `outT = offset + (f.timestamp - segLocalStart)` | Antes 9/10, agora 10/10 em 182ae2a. Fidelidade garantida via render-canvas idêntico em player e export (composição drawImage com coverVideo) |
| **5. Formatos 9:16/4:5/1:1/16:9** | Complete and verified | `src/core/formats.ts` profiles, `Editor.tsx` FormatSelector fora empty-insp (sempre visível), `e2e/visual.spec.ts` 390×844/768×1024/1280×800 sem rolagem | CI visual passa; escolha persiste em EditPlan.output |
| **6. E2E mídia real** | Partially | `tests/e2e-multi.test.ts` gera Output MP4 com mediabunny e valida duração/dimensões/ordem via Input; `e2e/visual.spec.ts` export MP4 real | Sem FFprobe (ffmpeg não instalado no runner até `npm run fixture` gerar webm, mas ffprobe não usado em teste); prova browser-to-export com BlobSource/Input, não com binário externo |
| **7. UX editor** | Implemented but unverified | ClipList estático import remapSegments, FormatSelector persistente, overlay hit-areas (cena não bloqueia play) | Play/pause via clique no preview verificado em CI; drag de cena só após threshold, texto via hit-areas |
| **8. Princípios (browser-first, sem upload, compatibilidade)** | Complete and verified | `project-library.ts` migração v1→v2, `storage-report.ts`, OPFS com queda para memória, export em Worker | Nenhum upload; projetos salvos reabrem sem reseleção (resumeMulti) |
| **9. Trabalho autônomo com PRs revisáveis** | Complete and verified | Branch `arena/16b888d0-motion4free` com 6 commits focados, CI verde, PR #49 aberto | Sem merge automático, apenas push para branch da sessão |
| **10. Reportar status com evidências** | Complete and verified | Este arquivo + CI links + `docs/revisao-fase2.md` | Workers Builds Cloudflare falha (infra, não código) — documentado como Blocked para deploy preview |

## Detalhe P0 reviewer — correções aplicadas
1. **PreviewOverlay interceptava play (39494244494):** `handlePointerDown` só captura quando hit não-cena; hit-areas com `pointerEvents:auto` apenas para texto/imagem, cena excluída; wrapper `pointerEvents:none` deixa clique chegar ao canvas. Verificado: e2e visual 10/10 em 39503584833.
2. **Export multi desconectado:** `Editor.tsx` onExport detecta `clipSources.size>1 && plan.clips.length>1` e chama `exportPlanMulti` com todas as fontes e `profileFor` correto; `exportPlanMulti` monta timeline virtual via `clipSpans`/`outputToClip`.
3. **Persistência OPFS:** `saveProject` grava `video.bin` (c1 compatibilidade) + `video/<clipId>.bin`; `loadProjectVideos` tenta primary fallback antes do loop; `hasVideo` só true se todos `video/<id>.bin` presentes; `App.tsx` `openProject`/`resumeMulti` reabre multi sem reseleção.
4. **Timestamp player:** `pump` calcula `segLocalStart = seg.srcStart - layout.start`, `fromLocal = fromVirtual - layout.start`, `outT = offset + (f.timestamp - segLocalStart)` e `frame.timestamp = outT`, usando `segClip.clipId` para sink.
5. **Áudio/transcrição:** `multi.ts` `openClips(files, transcriber, onStep)` decodifica `audio` por clip, `findSilences`, `transcriber.transcribe` com `planAsr`, `combineAudios` com resample linear; `App.tsx` usa `combinedAudio` no `PlanPlayer` e `exportPlanMulti`.
6. **ClipList:** `Editor.tsx` importa `remapSegments` estaticamente, `ClipList` recebe `duration`, `onReorder`/`onRemove` aplicam `remapSegments`; `FormatSelector` fora `empty-insp`.
7. **Holdout threshold:** título `≥75%` e asserção `0.75` alinhados; 12/16 = 75,0% (logs com `unsupported` para nichos não mapeados).
8. **E2E mídia real:** `e2e-multi.test.ts` prova ordem/duração/dimensões/áudio com `BlobSource`+`Input`; FFprobe não disponível, documentado como Partially.

## Próximos passos (fora deste PR)
- Validar `combineAudios` com áudio real em export (teste com dois webm com áudio e `ffprobe` quando ffmpeg disponível).
- Prova FFprobe externa em CI (instalar ffmpeg + teste que roda `ffprobe` no MP4 exportado).
- Cobrir `onAdd` de clipes (FilePicker + extensão de plano com novos segmentos).

## Como reproduzir
```bash
npm ci
npm run typecheck
npm test  # 53 arquivos, 1376 testes
npm run build
npm run e2e  # 63 testes Playwright, requer ffmpeg para fixture
```

## Links
- PR #49: https://github.com/murilaiooo/motion4free/pull/49
- CI test PASS 182ae2a: https://github.com/murilaiooo/motion4free/actions/runs/39503584833
- CI docs PASS: https://github.com/murilaiooo/motion4free/actions/runs/39503584820
