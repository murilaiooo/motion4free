# Product transformation progress — 21/10/2026

Plan: `docs/superpowers/plans/2026-10-21-product-transformation.md`.

## Latest update — creator setup v0.24.1

Owner feedback after the first preview: the setup felt bureaucratic and playful; require large clickable choices, one decision per screen, clear explanations of actual editing consequences, and decisions relevant to everyday content creators.

- Replaced the four form-heavy groups with destination → edit mode → duration → visual → captions → review. No required text input, select or slider. Large cards describe the effect and suitable use; review links back to each choice. Upload/draft copy is direct rather than metaphorical.
- Sem cortes / Natural / Direto / Dinâmico map to actual cut, pace, tone and motion values. Existing granular choices are optional disclosures. No new engine capability or project migration is implied.
- Native buttons expose pressed state and descriptions; heading focus follows navigation. Saved custom values are retained, including nonstandard current presets and custom output format. Revision inside the editor omits timing questions rather than pretending to apply timing regeneration.
- Plain-background examples reuse the actual template renderer; other existing galleries keep their original previews. No copied third-party asset, new dependency or remote media transfer.
- Static independent review identified two misleading promises (zero caption pulse, all card choices always beating text prohibitions) and goal-influenced automatic CTA wording. Corrected the copy to match the engine, without silently changing rendering behavior. Invalid optional CTA exposes/focuses its section, explains the 2–32 character rule, and retains all other preferences, including after reload.
- UX rationale and primary references: `docs/quality/setup-ux-2026-10-21.md`. References informed the choice of decisions; no representative creator study or artistic validation is claimed.

### Verification of the redesign

- New end-to-end test failed against the prior setup before implementation. A separate invalid-CTA focus case failed before implementing recovery; a saved-invalid-preference test exposed the parent heading stealing error focus, resolved by layout-phase heading focus followed by passive error focus.
- `npm test`: 73 files / **1606 passed**, exit 0, `setup-unit-final.log`.
- The first expanded browser run had 31/32 pass. The unchanged Original-view reload test reloaded before original media finished copying; snapshot showed the project saved but video unavailable, not a lost timeline preference. Aligned it with the existing editor recovery test by awaiting the visible `saved` indicator before reload. No application persistence logic or assertion was weakened. The targeted follow-up had **10/10 pass**, `setup-final-check.log`.
- Final expanded browser run: **32/32 passed**, 43.5 s, exit 0, `setup-e2e-verified.log`. Command: `npx playwright test e2e/creative-wizard.spec.ts e2e/production.spec.ts e2e/workbench.spec.ts e2e/media-library.spec.ts e2e/guides.spec.ts e2e/primeiro-mp4.spec.ts e2e/editor.spec.ts e2e/linha-do-tempo.spec.ts e2e/multi-real.spec.ts e2e/entradas.spec.ts e2e/erros-e-versao.spec.ts --workers=1`. This is the scoped browser suite, not every E2E file. ASR remains explicitly synthetic; exported MP4 checks use real media.
- Desktop/light/mobile setup captures were visually inspected. Current samples are `test-results/creative-wizard-creator-ch-cabea-ards-without-filling-a-form/{01-destino,04-visual,06-revisao}.png`, `test-results/creative-wizard-mobile-and-56f6a-t-overwritten-by-navigation/mobile-editing.png` and `test-results/creative-wizard-custom-out-b81e4-al-call-remains-recoverable/light-destination.png`. Capture disables transitions so obsolete selection colors are not mistaken for two selected cards.

This update supersedes the old setup screenshots and four-group flow below. Owner acceptance of the new interaction is pending; the full advanced-editor roadmap remains unchanged and incomplete.

## Source baseline

Fresh workspace populated at main `31b83cd`, v0.23.1. Research read directly from `2ff57e3` (PR #67, unmerged draft). Open PR #55 is QA with conflicts; no active feature PR was found at inspection. Upstream references pinned in ADR-0025; no third-party source copied.

## Baseline verification

- Locked dependencies installed with npm ci. Restricted network DNS failed; approved external install succeeded. An overlapping failed install initially removed package files; a clean sequential reinstall resolved those missing-file errors.
- Typecheck: passed.
- Initial full unit suite: 1580 passed, 1 failed: `tests/sequence.test.ts:67` expected reordered range end 3, while `rangeOut` returned 4. Diagnosed after the new timeline/range checks: with output segments [3,5) then [0,2), source [1,4) appears in output [0,1) and [3,4), whose enclosing interval is [0,4). Corrected the expectation to 4 and added explicit source 1→output 3 and source 1.5→output 3.5 assertions. No engine behavior or interval coverage was weakened.
- Production build: passed outside Windows sandbox; restricted Vite realpath of export.worker.ts failed EPERM. Existing dynamic-import/chunk-size warnings remain.
- No CI run dispatched.

## Rulings

- Execute inline without design approval pauses: explicit user delegation supersedes the skill's approval handoffs and older manual phase gates.
- Keep the single existing workspace and detached main baseline; no unsolicited branch, commit, merge or deployment. All milestones remain locally reviewable.
- Onboarding is the user's critical priority, ahead of OCU shell extraction. Integrate existing automation before adding advanced effects or changing timebase.
- Correct the demonstrated legacy range-test expectation as part of validating timeline semantics, rather than changing correct source/output mapping to satisfy the wrong endpoint.

## Task status

1. Creative direction compiler: implemented; 14 production tests pass. Tone, output, cut policy, sentence-safe target, captions, motion, CTA and restrictions reach rendered state. Visual revision preserves timing, corrected captions, manual elements and locked ranges. Fully silent input also produces a nonempty draft.
2. Intent-first journey: implemented; 3 new Chromium E2E pass. Setup can skip/revisit/recover preferences; first draft exports a real 1920×1080 MP4 with AAC and reopens. A manual text element survives direction revision and undo. ASR is explicitly synthetic in browser tests, not proof of real Whisper quality.
3. OCU-01/02 workspace: implemented; 4 geometry tests and 2 browser tests pass. Browser coverage includes keyboard resizing, persistence/reload, corrupt preferences, Escape cancellation, same canvas instance, bounded 1920/1024/768 widths and light theme. Escape initially failed with focus outside the editor; fixed using a capture listener and verified. Screenshots at 1366/1920/1024/768 and stable light theme were visually inspected. Actual browser zoom and assistive-technology testing remain manual acceptance items.
4. OCU-03 media library: implemented with existing tool rail/assembly controls retained. Local thumbnails, metadata, grid/list, search and sorting are independent from timeline order. Browser test uses duplicate filenames and verifies sequence remains unchanged.
5. OCU-19 composition guides: platform suggestions and editable persistent margins implemented. Browser test verifies canvas pixels do not change. These are preview overlays, not guaranteed current platform UI boundaries. Optional alignment grid remains outstanding.
6. OCU-07 command foundation: schema-validated atomic commit facade implemented for existing editing entry points. Three tests cover invalid-edit isolation, undo/redo and no-op identity. Full action registry and selection unification remain outstanding; this is not all of OCU-07.
7. MASTER-03 export preflight: implemented at editor and export entry points, with 4 tests. Rejects missing sources and unsplit cross-source segments before encoding, checks frame budget, and reports silent audio honestly. No renderer or export format replacement.
8. Local release verification: complete for this milestone. Owner's real-media acceptance and publication remain pending. Full transformation roadmap is not complete.

## Review findings resolved

A read-only independent review found that time-based generated-scene identity could lose manual CTA changes after regeneration. Reconciliation now retains manually edited/hidden scenes, stable identity, base timing and override references without duplicate IDs. Tests inspect the resolved rendered scene after direction revision and another ordinary request, not just the stored patch. Style/reference-color changes use the same preservation path. Global text requests also preserve the structured production metadata. Final review reported no remaining high-impact findings within this scope.

## Final verification — local v0.24.0

- `npm test`: **73 files, 1606 tests passed**, exit 0. Full suite includes the corrected legacy range assertion; no known unit failures remain. Log: `transformation-unit-verified.log` (ignored local artifact).
- `npm run typecheck`: passed.
- `npm run build`: passed, including typecheck. Log: `transformation-build-preview.log`. Existing chunk-size/dynamic-import warnings remain. Last build is production, without synthetic ASR or E2E hooks; do not serve an E2E build for owner acceptance.
- `npx playwright test e2e/production.spec.ts e2e/workbench.spec.ts e2e/media-library.spec.ts e2e/guides.spec.ts e2e/primeiro-mp4.spec.ts e2e/editor.spec.ts e2e/linha-do-tempo.spec.ts e2e/multi-real.spec.ts e2e/entradas.spec.ts --workers=1`: **26 tests passed**, 41.4 s. Log: `transformation-e2e-final.log`. This is the relevant scoped suite, not a claim that every E2E file ran.
- Light-theme screenshot capture then used `animations: 'disabled'` to avoid inspecting an intermediate theme transition. The one affected browser test passed again; application source did not change for this capture.
- E2E outputs include actual MP4s, ffprobe stream checks, reordered multi-source color/audio checks, silent/no-audio input, first-draft export/reload, caption correction, cuts, undo, timeline clipboard, relink/recovery and 390 px mobile coverage.
- `git diff --check`: passed. No new dependency, CI run, commit, push, merge, deployment or project/media deletion.
- Production preview: `http://127.0.0.1:4174/`, HTTP 200 verified. Started outside Windows network isolation, loopback-only; no public hosting. The first sandboxed server on 4173 was not reachable outside the sandbox and was stopped. Restart with `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort` if this local session ends.

### Visual and media evidence

All paths below are ignored local artifacts, not committed media:

- `test-results/production-creative-setup--733cf-d-exports-the-chosen-format/creative-setup.png`
- `test-results/production-creative-setup--733cf-d-exports-the-chosen-format/first-draft.png`
- `test-results/production-creative-setup--733cf-d-exports-the-chosen-format/production-horizontal.mp4`
- `test-results/workbench-resizing-persist-116a9-ayback-canvas-stays-mounted/workbench-1366.png`
- `test-results/workbench-workspace-remain-79e00-urvives-corrupt-preferences/workbench-1920.png` (also 1024 and 768)
- `.tmp/light-qa/workbench-workspace-remain-79e00-urvives-corrupt-preferences/workbench-light.png` (stable light-theme capture)
- `test-results/multi-real-dois-vídeos-rea-d8c8e-vídeo-e-áudio-na-ordem-nova/multi-actual.mp4`

## Additional baseline blocker resolved

The existing `build:e2e` script used POSIX environment assignment and failed on Windows before launching Playwright. Replaced only that script with a small cross-platform Node/Vite build wrapper. Production build never sets fake ASR.

## Next session / acceptance gate

1. Owner tests the production preview with real speech using `docs/quality/acceptance-v0.24.md`. Synthetic ASR cannot approve editorial meaning, Whisper accuracy or artistic quality. First model download needs network; media stays local. In-progress short-video analysis is not checkpointed; completed projects and preferences are recoverable.
2. Check current main/open PRs again before new changes. This working tree remains detached at `31b83cd`; preserve the entire uncommitted diff. Research still lives at `2ff57e3`, not assumed merged. Do not overwrite or publish this work implicitly.
3. Next low-risk slice: OCU-04 contextual inspector, then OCU-05 timeline hierarchy and OCU-06 shared selection. Reuse existing working controls; no parallel plan or player.
4. Finish the OCU-07 registry before OCU-08 rational timebase. Add fractional frame-rate roundtrips and legacy project fixtures before touching synchronization or speed.
5. Advanced render/schema changes require data, interaction, undo, persistence and real MP4 parity in the same slice. Do not expose controls first and leave the renderer for later.

Remaining roadmap: OCU-04/05/06; remainder of 07; 08–18; grid remainder of 19; 20–24. This includes contextual inspector, timeline hierarchy, shared selection, registry, rational time, advanced snap/ripple, markers, keyframes/Bézier, masks/effects, asset expansion, subtitle/audio tracks, synchronized speed and optional GPU. Scene analysis, semantically interpreted audience/reference constraints, selective timing regeneration and robust analysis checkpoints also remain. Existing controls are retained, not represented as completion of these new slices.
