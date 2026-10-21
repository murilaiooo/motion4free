# #102 — IMPLEMENTED — NOT TESTED / AWAITING QA

Stack: #100 → #99 → #97. Keep #102 open and this PR Draft/unmerged. Current main and PR #101 research were read before implementation; no upstream code/license transplant.

## Changed files / actual correction

- `editorial/clip-context.ts`: ID/time-checked full transcript index, complete/uncertain sentence boundaries, bounded overlapping windows, antecedent/final/question flags and boundary repair.
- `editorial/clip-candidates.ts`: candidates from all sentence starts, bounded pool/dedupe, conservative structural ranking, complete-sentence/neutral titles, sentence-level curation. Existing `highlights.ts` baseline preserved and extended only with optional evidence metadata.
- `editorial/clip-discovery.ts`: optional new-span proposals per window, strict JSON/word-ID/order/duration/setup/payoff grounding, no free model title/timestamps, explicit partial coverage on failure/quota.
- `app/ClipMaker.tsx`: default local context path, genuine full-transcript reanalysis, cancellation and stale-response protection, context playback/text, sentence edges, editable title and preserved manual selections/artifacts.
- `editorial/clip-source-map.ts`, `app/clip-pipeline.ts`, `pipeline.ts`, `App.tsx`, `Editor.tsx`, `core/project.ts`: persistent source provenance and current EDL-to-original mapping, shown in Mídia. No source file changes or new renderer/ASR/audio stack.
- Error catalog/docs, manifests/changelog, ADR-0031 and this handoff.

## Exact independent QA (not executed)

1. Unit/static/build checks are for QA. Construct PT-BR/EN/code-switch transcripts with stable IDs: all windows must progress, cover each word through the final minute and stay under bounds; duplicates, out-of-order/invalid times, no text, huge words and long unpunctuated phrases must fail/flag honestly.
2. Use an authorized video with calm strong story beyond the old top-N, weak high-energy intro, 'isso/ela/that' missing antecedent, delayed answer beyond duration, a question without payoff, negation, quantity/condition and unfinished ending. Inspect repaired source-word bounds and fewer/unselected review candidates. Never infer semantic truth from punctuation or numeric score.
3. Mock AI proposing a new valid span outside the old list; reject invented IDs/timestamps/titles, reversed/out-of-window spans, title without negation, setup after payoff, empty/malformed/duplicate output and prompt injection in transcript. Confirm complete-sentence or neutral titles, dedupe and partial coverage warnings. Quota/timeouts/429/cancellation must keep local candidates and stop further sends. Test with no key/offline first; real restricted credentials solely for independent QA.
4. In Brave, read before/after, play context and confirm it does not alter actual cut; move each boundary by whole sentence, edit title, select/deselect and reanalyze. Existing selections/manual titles/rendered artifacts must remain. New candidates are unselected. Cancel/back/switch project and release a delayed response: no stale mutation/progress. Check keyboard controls and no black screen.
5. After explicit selection, inspect source→derived→output timing, words/captions/audio, rotations, cuts/reorder, save/reopen and original provenance mapping. Compare preview and actual MP4. Original source must remain untouched. Expanding beyond the derived asset requires the original in ClipMaker; do not claim full original restoration from the small saved derivative alone.
6. Measure cold/warm download, full 2h transcript CPU/peak memory, local/BYOK quotas, codec/export cost and responsiveness. Use 20 authorized, annotated recordings and blinded reviewers unfamiliar with originals for standalone/payoff/title truth; compare baseline/local/new BYOK. Record failures and negative results. No performance/quality improvement is claimed here.

## Limits and blockers for full acceptance

This implements index/windows, local/new grounded AI discovery, curation and provenance. Heuristic structural checks and valid evidence IDs are not proof of understanding; six-dimensional human-calibrated scoring, topic-level semantic diversity and diarization/speaker crop remain unproven. #54 provides a separate optional face-track Draft PR and does not identify speakers. The current editor still uses a derived clip for bounded audio/memory; arbitrary restoration beyond it requires relinking the long source and a separate large-media lifetime policy. That extension and blinded benchmark require QA/design evidence before changing the established media pipeline. Existing ASR/source-map/render integration was reused.

No tests, builds, typechecks, lint, validation commands, browser/app/manual checks, media import/render/playback/export, inference or provider API requests, or Actions dispatch were executed. Existing tests untouched. Version is an integration target, not a verified release.

## Static follow-up (still UNTESTED)

Source map now omits encoder padding and clamps both source/output spans to the recorded original/derived duration. AI setup/payoff IDs must each be strictly ordered and unique. Local exploration visits every sentence start with up to nine boundary candidates around min/ideal/max durations via monotone search, instead of all start/end pairs; it is a bounded structural shortlist, not exhaustive semantic search. QA must include padding, repeated/overlapping timestamps, long transcripts and compare candidate diversity. No execution performed.
