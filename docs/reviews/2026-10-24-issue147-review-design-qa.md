# Issue #147: clip-review redesign, decision and QA

Date: 2026-10-24. Base: `origin/main` `fec29fa`, branch `ux/147-clip-review-rebuild-20261024`.
Purpose: replace overlarge overlapping controls with understandable, compact clip review without changing the editing/render engines. Work remains unmerged pending real-media gates.

## Competitor workflow evidence and tradeoffs

| Reference | Browse/preview | Inspect/edit | Export and user choice | Motion4Free adaptation |
| --- | --- | --- | --- | --- |
| [Riverside Magic Clips](https://support.riverside.com/hc/en-us/articles/12124048765981-About-Magic-Clips) | Preview from candidate | Separate Edit action | Explicit Export | Separate Assistir, Editar and Gerar MP4; generated file is not promised prematurely |
| [Riverside Project panel](https://support.riverside.com/hc/en-us/articles/38427310555933-Project-panel-in-the-editor) | Clip collection browsed in a grid | Editing is distinct from browsing | Project assets and exports separated | Compact candidate list without opening full editors |
| [Vizard clip extension](https://help.vizard.ai/en/articles/8984381-how-to-extend-and-add-more-content-to-ai-generated-clips) | Candidate with source context | Restore adjacent speech when boundaries cut sentences | Manual selection | Expandable contextual transcript and phrase-step controls |
| [Descript Find Good Clips](https://feedback.descript.com/changelog/new-ai-action-find-good-clips) | Candidate passages in transcript | Select passage into composition | Compositions edited later | Keep source transcript accessible and existing editor handoff |
| [OpusClip UI study](https://screenrove.com/opus-clip) | Thumbnails support scanning | Candidate-specific review | Results-first navigation | Thumbnail, selection and concise actions; no invented virality score |

The first four references were checked against their published product documentation on 2026-10-24. Competitor features are workflow references, not code or visual assets.

## Two responsive directions considered

### A. Source preview rail + compact list (selected)

Desktop (1440px+):
```
┌ Header: source metadata and settings ─────────────────────┐
│ Results: N found / selected          [All] [None]         │
├ Source video (sticky, 280–330px) ┬ Clip thumbnail/title ──┤
│ Preview selected candidate        │ Times, source, hook   │
│ Source context and seek           │ [Play][Review][Edit]  │
│                                  │ [Generate]            │
│                                  ├ Candidate 2 ──────────┤
│                                  │ ...                   │
└──────────────────────────────────┴───────────────────────┘
[Selected count]                               [Generate selected]
```
Mobile:
```
Header / collapsed settings → video preview → candidate cards
Each card: thumbnail + title/time/status; two-row 2x2 actions.
Inspector opens inside chosen card; bottom selection bar remains outside content.
```
Pros: readable source-to-candidate comparison, little state churn, inherited editor and preview path. Cons: a sticky source rail can occupy unused space on very long lists; avoid making the rail excessively wide.

### B. Full-width results grid + inspector overlay (rejected)

Desktop: 3–4 candidate tiles per row; preview and transcript in modal on click.
Mobile: 1 tile per row and fullscreen drawer for transcript, back to grid.
Pros: dense scanning and source-reuse layout. Cons: added overlay focus handling, duplicate preview state, harder compare-to-source and risk of unsaved inspector edits; unjustified for 3–10 clips.

Decision: direction A, keeping the compact review within the existing ClipMaker data contract. No new dependencies, no remote uploads, no heuristic/ranking alterations.

## QA evidence recorded

- Pre-change reference: `docs/reviews/evidence/issue147/before-{1440x900,390x844}.png`.
- Rebuilt six-card layout: `after-*.png`, seven screen widths, `metrics.json`, `e2e/qa-clip-review.mjs`.
- Expanded matrix: `e2e/qa-clip-review-edge.mjs`; 0/1/3/8/10 cards at 390/768/1440, portrait and square input descriptors, zoom 125%/200% via effective CSS viewport; records in `evidence/issue147/edge/qa-edge-metrics.json`.
- Local status: 91 Vitest files, 1717 unit tests passed; TypeScript passed; Vite production build and distribution license audit passed. Latest build includes zero-results copy fixes.
- Full expanded matrix rerun on the local branch: **23/23 passed**. Keyboard inspector accessibility probe **2/2 passed** (Enter, focus, expanded semantics, no unlabeled controls). Source-preview seek to second candidate at **6.0s** verified in Brave.
- Synthetic fixture limitation: 12-second color-bar WebM has artificially stretched 145-second metadata and 433 fabricated word annotations. Consequently, its late-candidate thumbnails and seek timings are **not real-media proof**.
- A reproducible performance bug was found on zero results: detached video decoder was created despite zero candidate frames. `e2e/qa-clip-stills-empty.mjs` reproduced RED (1 detached decoder), then GREEN (0) after guard in `useClipStills`.
- The no-clips screen originally incorrectly said to press “Assistir” in a nonexistent card and displayed “Gerar e baixar os 0 escolhidos.” New `e2e/qa-clip-empty-copy.mjs` reproduced RED, then GREEN after coherent preview/disabled-action copy. User-facing product changes are limited to this review screen and thumbnail decoder.
- One local **actual browser export** using the same ClipMaker + real media engine produced 5.013333s H.264 1080×1920/AAC MP4, verified by FFprobe; `e2e/qa-clip-render-smoke.mjs`. `e2e/qa-clip-editor-handoff.mjs` passed isolated prepareClip/editor callback with a renamed title.
- **Actual batch export:** 2 of 2 independent source cuts (1–6s and 6–11s) successfully downloaded as H.264/AAC 1080×1920, each 5.013333s. FFprobe verified both. The original test falsely required a container duration <=5.000s; tolerance corrected to 4.9–5.2s without unnecessarily re-exporting both clips.
- **Real long-file processing:** A locally generated 122s H.264/AAC speech-and-silence source was imported through the app and transcribed by on-device Whisper small to 91 recognized words, reaching the review screen. Default medium-length setting produced zero candidates, exercising the empty state. This is actual application video/transcription, unlike the isolated synthetic context fixture.
- An initial CSS `zoom` simulation incorrectly preserved desktop media queries and reported narrow title width. Test changed to resize the effective CSS viewport. The 6 zoom scenarios then passed. One transient local dev-load timeout occurred during dependency optimization; don't classify it as an app visual defect without reproducing on a stable production build.
- Inspect mobile and desktop screenshots directly: dark canvas, restrained yellow accents, actions no longer overlap card text or transcript; long titles remain editable in the full inspector even if preview input elides.

## Full-app end-to-end validation (unblocked, test-only ASR)

- Regression in `e2e/qa-clip-full-flow.mjs` was **red** against the existing E2E transcriber (5 words / 0 clips). A deterministic long-transcription scenario was added only behind the existing `VITE_FAKE_ASR=1` build gate and `?asr=clips`; it is **not a real Whisper output**.
- `e2e/prepare-clip-qa-video.ps1` creates a local, gitignored 122-second H.264/AAC test video using Windows TTS and FFmpeg. No generated voice files are published. The repeat variant is 122 seconds of speech, with a matching 388-word synthetic transcript.
- The full application (not an isolated component), served from an `npm run build:e2e` **static preview**, generated **5 candidate clips** from the synthetic timed transcript, passed context-inspector interactions, inline and detailed renaming, all/none selection, source preview for candidate #2 (1:31 seek), actual `prepareClip` and editor navigation, then **resumed the results** with the title and 5/5 selected state preserved. No JS or browser-console errors on the static preview.
- The test-only transcriber reports `Transcrição sintética (teste local)` and cannot be mistaken for Whisper. This labeling regression itself followed red/green verification. `e2e/qa-clip-empty-transcription.mjs` confirmed `M4F-1102` when test ASR produces no words.
- The keyboard probe includes Enter, Space, Tab and Shift+Tab across mobile and desktop; it is not a screen-reader certification.
- Individual and two-item batch exports were truly rendered by the browser media engine and FFprobed, not simulated. Codec, dimensions and timing are recorded in `docs/reviews/evidence/issue147/edge/media-probe-results.json`; generated MP4 binaries are gitignored.

## Remaining boundaries and separate problems

- On-device **real** Whisper decoded 91 words and opened the review screen in one trial. Other trials returned `M4F-302` during model initialization. The model-loading issue is separate from this issue's UI redesign, and this QA must **not** imply it is fixed.
- Real Whisper has not yet generated meaningful long-media candidates in these tests; semantic candidate accuracy and end-to-end review on an authorized real recording remain separate quality gates (#10/#146 where relevant). Similarly, assistive-technology testing and reloading a clip session after full browser shutdown are not proven by the integration fixture.
- Production publication/version needs to be verified separately **after merge**; do not report the test-only synthetic ASR build as a production release.


## Final regression additions

- `e2e/qa-clip-footer-focus.mjs`: **20/20** last-card focus targets remained within the visible area above the fixed bulk toolbar (390×600, 390×844, 768×900 and 1440×900).
- `e2e/qa-clip-preview-pause.mjs`: reproduced a false “Reproduzindo da fonte” label after the source video was paused (RED). Updated the status to use actual `playing` state, then verified “Prévia pausada” (GREEN).
- Existing local Playwright/Brave `e2e/compact-notices.spec.ts` and the optional-setup case in `e2e/production.spec.ts` both passed after running `npm run fixture`. Initial failure was a missing, gitignored test fixture, not an application regression.
- `npm run typecheck` and the complete `npm test` suite were rerun after the QA harness changes: 91 files / 1717 tests passed. Publishable build and license audit are release gates; never deploy the `VITE_FAKE_ASR=1` QA bundle as production.
