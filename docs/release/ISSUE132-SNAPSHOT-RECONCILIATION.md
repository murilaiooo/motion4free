# Issue #132 — reconciliação integral do snapshot local (24/10/2026)

Fonte: commit 0a138b5, branch sync/local-product-work-20261022, comparada com main inicial e integração atual. A branch e o checkout principal foram PRESERVADOS sem reset nem exclusão.

RESULTADO: 48 caminhos examinados. 18 idênticos por blob SHA, 30 presentes porém atualizados, 0 ausentes. Nenhum arquivo antigo desapareceu.

## Critérios de decisão

- IDÊNTICO: conteúdo binário byte a byte preservado no staging. Nenhum port necessário.
- EVOLUÍDO: conteúdo presente com alterações posteriores. Manter revisão atual, não substituir código atualizado pelo snapshot. Diferenças inspecionadas e principais contratos verificados por E2E; isto não equivale a uma prova exaustiva de todo comportamento.
- AUSENTE: exigiria port explícito, revisão e testes; não há casos nesta comparação.
- Números de linhas +/- indicam diff entre o snapshot e o staging, não fornecem equivalência semântica.

## Inventário e decisão, arquivo por arquivo

| Arquivo | Estado | Linhas +/− | Decisão |
| --- | --- | ---: | --- |
| `docs/CHANGELOG.md` | EVOLUÍDO | 130/0 | Manter implementação atual; versão antiga obsoleta |
| `docs/decisions/0025-intent-first-production.md` | IDÊNTICO | — | Preservado integralmente |
| `docs/erros.md` | EVOLUÍDO | 47/2 | Manter implementação atual; versão antiga obsoleta |
| `docs/quality/acceptance-v0.24.md` | EVOLUÍDO | 4/4 | Manter implementação atual; versão antiga obsoleta |
| `docs/quality/setup-ux-2026-10-21.md` | IDÊNTICO | — | Preservado integralmente |
| `docs/quality/transformation-progress.md` | IDÊNTICO | — | Preservado integralmente |
| `docs/superpowers/plans/2026-10-21-product-transformation.md` | IDÊNTICO | — | Preservado integralmente |
| `e2e/creative-wizard.spec.ts` | EVOLUÍDO | 3/3 | Manter implementação atual; versão antiga obsoleta |
| `e2e/guides.spec.ts` | IDÊNTICO | — | Preservado integralmente |
| `e2e/linha-do-tempo.spec.ts` | EVOLUÍDO | 25/0 | Manter implementação atual; versão antiga obsoleta |
| `e2e/media-library.spec.ts` | IDÊNTICO | — | Preservado integralmente |
| `e2e/multi-real.spec.ts` | IDÊNTICO | — | Preservado integralmente |
| `e2e/production.spec.ts` | IDÊNTICO | — | Preservado integralmente |
| `e2e/workbench.spec.ts` | EVOLUÍDO | 7/5 | Manter implementação atual; versão antiga obsoleta |
| `package-lock.json` | EVOLUÍDO | 2/2 | Manter implementação atual; versão antiga obsoleta |
| `package.json` | EVOLUÍDO | 3/3 | Manter implementação atual; versão antiga obsoleta |
| `scripts/build-e2e.mjs` | EVOLUÍDO | 2/0 | Manter implementação atual; versão antiga obsoleta |
| `src/app/App.tsx` | EVOLUÍDO | 143/35 | Manter implementação atual; versão antiga obsoleta |
| `src/app/Editor.tsx` | EVOLUÍDO | 151/22 | Manter implementação atual; versão antiga obsoleta |
| `src/app/Landing.tsx` | EVOLUÍDO | 20/12 | Manter implementação atual; versão antiga obsoleta |
| `src/app/Templates.tsx` | EVOLUÍDO | 11/1 | Manter implementação atual; versão antiga obsoleta |
| `src/app/TopBar.tsx` | EVOLUÍDO | 42/18 | Manter implementação atual; versão antiga obsoleta |
| `src/app/production/CreativeSetup.tsx` | EVOLUÍDO | 17/17 | Manter implementação atual; versão antiga obsoleta |
| `src/app/production/DraftReview.tsx` | EVOLUÍDO | 1/1 | Manter implementação atual; versão antiga obsoleta |
| `src/app/production/SetupAdjustments.tsx` | EVOLUÍDO | 13/12 | Manter implementação atual; versão antiga obsoleta |
| `src/app/production/SetupChoices.tsx` | IDÊNTICO | — | Preservado integralmente |
| `src/app/production/preferences.ts` | IDÊNTICO | — | Preservado integralmente |
| `src/app/production/production.css` | EVOLUÍDO | 96/15 | Manter implementação atual; versão antiga obsoleta |
| `src/app/workbench/CompositionGuides.tsx` | IDÊNTICO | — | Preservado integralmente |
| `src/app/workbench/EditorWorkspace.tsx` | EVOLUÍDO | 25/8 | Manter implementação atual; versão antiga obsoleta |
| `src/app/workbench/MediaLibrary.tsx` | EVOLUÍDO | 11/2 | Manter implementação atual; versão antiga obsoleta |
| `src/app/workbench/layout.ts` | IDÊNTICO | — | Preservado integralmente |
| `src/app/workbench/workbench.css` | EVOLUÍDO | 2/5 | Manter implementação atual; versão antiga obsoleta |
| `src/core/brief.ts` | IDÊNTICO | — | Preservado integralmente |
| `src/core/errors.ts` | EVOLUÍDO | 34/2 | Manter implementação atual; versão antiga obsoleta |
| `src/core/production.ts` | IDÊNTICO | — | Preservado integralmente |
| `src/editorial/brief-apply.ts` | EVOLUÍDO | 2/2 | Manter implementação atual; versão antiga obsoleta |
| `src/editorial/commands.ts` | EVOLUÍDO | 7/2 | Manter implementação atual; versão antiga obsoleta |
| `src/editorial/export-preflight.ts` | EVOLUÍDO | 1/1 | Manter implementação atual; versão antiga obsoleta |
| `src/editorial/ops.ts` | EVOLUÍDO | 2/2 | Manter implementação atual; versão antiga obsoleta |
| `src/editorial/production.ts` | EVOLUÍDO | 2/1 | Manter implementação atual; versão antiga obsoleta |
| `src/editorial/scene-preservation.ts` | IDÊNTICO | — | Preservado integralmente |
| `src/media/export.ts` | EVOLUÍDO | 25/18 | Manter implementação atual; versão antiga obsoleta |
| `tests/commands.test.ts` | EVOLUÍDO | 1/1 | Manter implementação atual; versão antiga obsoleta |
| `tests/export-preflight.test.ts` | EVOLUÍDO | 1/1 | Manter implementação atual; versão antiga obsoleta |
| `tests/production.test.ts` | IDÊNTICO | — | Preservado integralmente |
| `tests/sequence.test.ts` | IDÊNTICO | — | Preservado integralmente |
| `tests/workbench.test.ts` | IDÊNTICO | — | Preservado integralmente |

## Revisão de mudanças significativas

- App.tsx/Editor.tsx: importação, edição, timeline, busca, revisões, projects, export e histórico permaneceram. A implementação posterior adiciona consentimento BYOK, audio/music, source maps, seleção múltipla, configurações e backup .m4f. Não restaurar hooks antigos.
- production/*: mesmas etapas e formatos do formulário original, agora com demonstrações de opções visuais, navegação refinada e alertas de revisão visíveis. Preferências preservadas.
- workbench/*: layout e resize persistem, controles reorganizados, reset de layout e thumbnails em fila para reduzir decodificações concorrentes.
- editorial/commands.ts, export-preflight.ts e production.ts: validadores e erros mais específicos, retenção da identidade dos planos e do histórico, sem voltar a dados tipados antigos.
- media/export.ts: código de mixagem/MP4 mais recente inclui áudio e novas mídias; ver provas MP4 no relatório de release.
- docs, e2e, testes e lockfiles: atualizados com componentes e asserts compatíveis, sem sobrepor as decisões posteriores de segurança, versões e testes.

## Provas de comportamento

- 10/10 E2E Brave aprovados na integração atual: creative-wizard, production, workbench, guides, media-library; no mesmo Windows, fixtures sintéticas de teste. Verificam escolha de fluxo, revisão de direção, posição/persistência do layout, guias e biblioteca sem alterar edição.
- 1714 testes unitários, TypeScript, build e preflight de assets aprovados no staging nos testes anteriores; provas independentes de MP4, backup OPFS e autorizações de IA constam em PR-CONSOLIDATION-20261024.md e ISSUE4-OFFLINE-STORAGE.md.
- Nenhuma avaliação humana de motion, vídeos reais longos, equivalência pixel a pixel ou Cloudflare live. Essas continuam nas issues #10, #102, #12. Esta issue trata só de perda de código entre snapshot e staging.

## Conclusão de reconciliação

Os 48 caminhos do snapshot existem na branch de integração: sem blobs ausentes, alterações intencionalmente evoluídas e QA focado aprovado. **Não mesclar a PR #122 original**, pois sobrescreveria reparos posteriores. Manter permanentemente o commit/branch do snapshot para rollback histórico. A #133 é separada e cuida das mudanças da PR #116.

