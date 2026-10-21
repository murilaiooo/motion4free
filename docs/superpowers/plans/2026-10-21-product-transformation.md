# Intent-first production and workbench implementation plan

> For agentic workers: execute inline using superpowers:executing-plans. User explicitly authorizes continuous implementation and independent technical decisions.

Goal: intent → media → validated edited draft → preview/export/customize, preserving existing projects.

Architecture: additive setup schema on the existing brief, pure editorial compiler, existing import/player/export/history, independent workspace layout state.

Tech stack: existing React/TypeScript/Vite/Zod/Mediabunny/Canvas2D/OPFS.

Spec: `docs/decisions/0025-intent-first-production.md` and the user's full product transformation request.

## Global constraints

Zero mandatory cost; browser-first; no silent uploads; original media preserved; deterministic validated operations; shared preview/export renderer; backwards compatible projects; specific M4F errors.

## Review focus

Invalid saved preferences; transcription unavailable; desired duration inside a sentence; manual work during revision; small viewport and interrupted resize. Each belongs to the tests below.

## Task 1 — Creative direction compiler

Files: `src/core/production.ts`, `src/core/brief.ts`, `src/editorial/production.ts`, `tests/production.test.ts`.

Interface: `creativeSetupSchema`, `DEFAULT_SETUP`, `compileCreativeBrief(setup)`, `produceFirstDraft(plan, context, silences, setup)`, `reviseCreativeDirection(plan, context, setup)`, `evaluateDraft(plan, context)`.

- [x] Write failing tests: setup validation; different styles/formats/cuts; sentence-safe target; silence/no speech fallback; no empty timeline; revision preserves manual changes and undo; project roundtrip.
- [x] Run new tests and observe failure, implement compiler, rerun scoped tests plus existing brief/cut/project sentinels.

## Task 2 — First-time journey

Files: `src/app/production/*`, `src/app/Landing.tsx`, `src/app/App.tsx`, `src/app/Editor.tsx`, `e2e/production.spec.ts`.

Interface: setup onComplete/onBack; preferences read/write with validation; first draft review using the existing player and exporter.

- [x] Write E2E for Start → setup → upload → real edited timeline → export MP4, revision and reload.
- [x] Build accessible progressive setup with visual presets, optional fields, explicit limitations and recoverable preferences. Keep legacy relink and long-video workflows intact.
- [x] Connect both single/multi import to the compiler. Add review actions and safe direction revision.
- [x] Run scoped E2E, inspect screenshots and exported media.

## Task 3 — Workbench OCU-01/02

Files: `src/app/workbench/*`, `src/app/Editor.tsx`, `tests/workbench.test.ts`, `e2e/workbench.spec.ts`.

Interface: versioned clamped layout; accessible pointer/keyboard separators; reset and persistent panel sizes. No media/render/schema changes in this task.

- [x] Write failing geometry/persistence tests and E2E for resizing, cancel/reset, keyboard and reload.
- [x] Implement persistent shell with stable player identity, narrow viewport handling and existing controls.
- [x] Verify 1024/1366/1920 widths, light/dark, editing/undo and playback continuity. Browser zoom and assistive-technology acceptance remain pending.

## Task 4 — Release gate and next roadmap

- [x] Run typecheck, full unit suite, production build and relevant E2E. Diagnose the baseline range-test expectation; final result: 1606 unit tests and 26 scoped browser tests pass.
- [x] Update version, changelog, error catalog, browser-only acceptance script and durable progress ledger with exact remaining OCU tasks.
- [x] Continue subsequent executable vertical slices: OCU-03 media library, OCU-19 platform/custom guides, atomic command foundation and MASTER-03 export preflight. Their unit/browser evidence is in the ledger. No claim that the full 24-task roadmap is complete.
- [ ] Owner acceptance with real-media transcription, editorial meaning, artistic quality, browser zoom and assistive technology. No publication before this gate.

## Additional implemented vertical slices

- `src/editorial/commands.ts`: validate the complete edit before mutating history; invalid commands leave undo/redo intact. Three tests pass. This is a foundation, not the complete OCU-07 action registry.
- `src/editorial/export-preflight.ts`: source ownership, valid segment boundaries and frame budget before encoding; wired to all export entry points. Four tests pass and scoped E2E generates real media.
- `src/app/workbench/MediaLibrary.tsx`: local thumbnails, metadata, grid/list, search and sorting. Browser test verifies sorting duplicate filenames does not reorder the video.
- `src/app/workbench/CompositionGuides.tsx`: suggested platform/custom safe margins, persisted independently from content. Browser test compares actual canvas pixels; no guide is exported. Optional alignment grid is not implemented.
- `src/editorial/scene-preservation.ts`: retain manual generated-scene changes/deletions through creative revision and subsequent requests/style/palette changes. Independent review findings were fixed and covered at the resolved-rendered-state level.

Rollback: changes remain a reviewable local diff on the pinned main baseline; no remote publication or project deletion. Existing media and v1–v6 migrations are retained.
