# Main promotion evidence — Motion4Free #117 (2026-10-24)

## Scope and isolation

Selective backport from staging `integration/pr-consolidation-20261024` to a clean worktree from `origin/main` (baseline `941b791`). Adds **only the project's own word-anchored captions/motion code**, plus its tests, 2 new M4F error codes, and a Windows-portable FFmpeg synthetic-fixture script. No code/assets were copied from Hypit, Editonny, OpenReel or any other third party. No new npm dependency, hosted API, telemetry, or media upload. The primary working checkout was not changed.

The optional `semanticCues` property in the v6 plan is backward-compatible. Each word effect can be chosen as `emphasis`, `underline`, or `pulse`, with undo/redo, persistence, cuts, copy, and reordering. Preview and MP4 export share the same `drawFrame`. Old projects without the field retain existing rendering. The schema rejects unknown effect values, and corrected captions are never automatically re-anchored to another word.

Public site **before promotion** (fresh Brave request): HTTP 200, `Motion4Free v0.30.0 · 7ace86e` at `https://motion4free.murdokmurilo1.workers.dev/`. This is the known visible version for rollback comparisons, **not an identified Cloudflare deployment ID**.

## Local verification on the actual promotion branch

| Gate | Observed result |
|---|---|
| `npm run fixture` (Node directly invoking FFmpeg) | PASS — five synthetic local videos |
| `npm run typecheck` | PASS |
| `npm test` (Vitest) | **90/90 suites, 1,712/1,712 tests PASS** |
| `npm run build` | PASS, main's build script (TypeScript, Vite and pruning). No claim of staging asset preflight |
| `git diff --check` | PASS |
| `npx playwright test e2e/issue117-semantic-cue.spec.ts` on Brave | **4/4 PASS**: anchors, persistence, undo/redo, absence of speech, switching effect, actual Worker MP4 |
| FFprobe / FFmpeg on a short synthetic Worker MP4 | PASS — 3.114667 sec, **1,298,916 bytes**, audio + video tracks, decoded frames |
| Wider Playwright set: #117, first MP4, multiple real-structure synthetic clips and timeline | **12/13 PASS**; the only failure is `linha-do-tempo.spec.ts:80`, expected visible `M4F-519` |
| All-Playwright exploratory run | **Not green**. Stopped deliberately after 40 of 111 when baseline old error expectations and absent Windows screenshot baselines caused repeated failures |

### Baseline comparison: failures are pre-existing

A second, untouched detached worktree at **`origin/main` SHA `941b791`**, with the same Brave, synthetic media, and Playwright:

- `e2e/editor.spec.ts:15` expected visible `M4F-501`: **FAIL on clean main**, exactly matching the promotion branch; the companion real MP4 export test passed on clean main.
- `e2e/linha-do-tempo.spec.ts:80` expected visible `M4F-519`: **FAIL on clean main**, exactly matching the promotion branch.
- The wide run's `estilos.spec.ts` visual-snapshot failures were **missing `*-win32.png` references** rather than observed image mismatches. Playwright generated local comparison candidates in the isolated worktree. These were **not committed as baselines**.
- No claim that the whole E2E suite is green. Known UI error-message tests and screenshot-baseline provisioning deserve separately scoped bug fixes.

## Release constraints

GitHub Actions cannot run account jobs currently: prior PR #142 jobs were refused by **GitHub billing/spending limit**, not by test failures. Any new PR may report unstarted CI. No CI green claim. Cloudflare Workers may auto-deploy on merge to `main`. The release owner explicitly requested verified increments move to `main`, so publication needs a real-site smoke and a revert/Cloudflare rollback if production regresses. A green test on synthetic media is not blind evaluation with actual speech, nor approval of third-party assets: issue #2 rights review and issue #10 creative QA remain unresolved. No new third-party assets entered this patch.

**Manual post-deploy smoke:** open the public URL in Brave, verify footer `v0.30.1` + new git SHA, import a short clip, go to Legendas → Destaques nas palavras, choose the three styles, undo/reopen and export a short MP4 with speech and audio. If footer stays at v0.30.0, **deployment is not confirmed** even when GitHub merge succeeds. Use a reviewed `git revert` or verified Cloudflare rollback if the site is faulty; do not delete user data.
