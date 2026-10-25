# Checkpoint — issue #147 clip-review rebuild (2026-10-24)

**STATE: PAUSED AT USER REQUEST. Work in progress, not approved for production or merge.**

Branch: `ux/147-clip-review-rebuild-20261024`  
Primary worktree: `I:\codex\motion4free\.local\variantes\issue147-rebuild-20261024`  
Baseline: `origin/main` at `fec29fa` (v0.30.2). Original checkout `I:\codex\motion4free` was not modified.

## What exists
- Structural rebuild of Clip Creator review UI in `src/app/ClipMaker.tsx`, `clips.css`, `ClipReviewWorkspace.tsx`, `ClipReviewCard.tsx` and `useClipStills.ts`.
- Compact browse cards with thumbnails from locally decoded original video, selected counts, select all/none, renamed clips, context inspector, phrase-boundary controls, source preview, existing per-clip render/download/editor handoff. Settings collapsible on mobile; dynamic render jobs retained.
- Isolated test-only fixture page `e2e/clip-review-lab.html` and `e2e/clip-review-lab.tsx`, plus scripts `qa-clip-review.mjs`, `qa-before-clip-review.mjs`.
- Before/after screenshots and measured browser geometry in `docs/reviews/evidence/issue147`. These use **synthetic** subtitles and a 12s synthetic video in a 145s metadata simulation, not a real 2m25 transcript; do not market them as real footage quality.
- Local `npm run typecheck` and `npm run build`: PASS. Browser smoke for six cards in 1920x1080, 1440x900, 1366x768, 1280x720, 1024x768, 768x900, and 390x844: PASS (no page errors, no horizontal overflow or action outside cards; select all/none, title rename, preview and inspector exercised).
- Test screenshots **reviewed manually** at 1440px and 390px. Appearance is materially better; test footage's color bars are not product artwork.

## Still needed before PR/merge/closing #147
1. QA screenshots and navigation at 125% and 200% zoom and with 0/1/3/8/10 cards, long captions and portrait/square source.
2. Validate actual source-video import and end-to-end processing through original app, not only the isolated review fixture; check all selection, preview, rename, contextual playback, per-card and batch MP4, and editor handoff using synthetic input media. No expensive repeated export.
3. Confirm thumbnails never misidentify a candidate when a source clip ends, and seek does not leave residual decoder CPU/memory; test no-audio/incomplete ASR.
4. Test keyboard-only and screen-reader labeling; confirm mobile overflow at 200% zoom and footer never covers final action.
5. Review before/after at all viewports; compare two documented wireframe directions and reconcile actual design.
6. Run full unit tests, typecheck, build, targeted Brave E2E. The six GitHub Actions workflows remain disabled by user instruction.
7. Review PR in small scope. Merge only after all failures are resolved, then verify actual Cloudflare version and actual final UI.

**No main merge, no issue closure, no background work. User paused to play CS. Resume only on explicit user request.**
