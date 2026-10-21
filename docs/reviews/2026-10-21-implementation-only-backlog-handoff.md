# Motion4Free — implementation-only handoff

**UNTESTED / AWAITING QA.** Snapshot 2026-10-21; inspected main `84e13c644cbf556021ccf76b89feeb93d2d8c7e3`. Sixteen code Draft PRs, plus this documentation handoff. No issue closed or PR merged by this implementation session. No tests, builds, typechecks, lint, validation commands, browser/app/manual QA, media imports/render/playback/exports, model inference/provider credential requests, benchmarks or Actions dispatch executed. Existing tests were not modified. Commit messages include `[skip ci]` and commit hooks were disabled for these commits; this is not a claim about every external integration's behavior.

The declared D: workspace was unavailable; work used the existing authorized I:/codex repository/worktrees. Existing changes and branches were preserved, with clean branch switching and no reset. The previous #73 work was inspected first; PR #96 was concurrently merged by another session, and the new increment was separated into #97. Previously merged fixes #83/#84/#81/#82/#72/#53 were not reimplemented.

## Implementation reports

Every linked PR remains Draft. Its body and `docs/reviews/2026-10-21-issueN-implementation-handoff.md` on that branch contain exact changed files, root cause, design, limitations and QA instructions. Table lists current implementation heads and primary changed areas; these are code deliveries, not acceptance claims.

| Issue | Draft / head | Root cause and implemented correction | Primary files/areas | QA focus |
|---|---|---|---|---|
| #73 | [#97](https://github.com/murilaiooo/motion4free/pull/97) · cba10d0 | Async credential/catalog results could outlive identity/consent; vault epochs, revocation, cancellation and exact outbound payload approval | ai/providers, OutboundConsent, AiOptions, Settings | key changes, lock/delete/cross-tab, late replies, pagination, payload cancel/repair |
| #54 | [#98](https://github.com/murilaiooo/motion4free/pull/98) · 8c7b7d3 | smart framing never produced local face tracks; bounded CPU worker and shared persisted tracks | media face worker/analysis, framing panel, pipeline/project/preview/export | face/no-face/gaps, manual override, undo/reopen, preview/export sync, download/privacy |
| #9 | [#99](https://github.com/murilaiooo/motion4free/pull/99) · efb9d94 | No task/project budget or shared cooldown; routes, conservative reservations, cache/dedupe and provider circuit policy | ai/routing, provider client, settings routing, App/ClipMaker | task override, allowance/races, 429/5xx/cooldown, cache invalidation, no paid fallback |
| #11 | [#100](https://github.com/murilaiooo/motion4free/pull/100) · f3486b3 | Late async revision could overwrite newer edits; immutable scope/lifetime cancellation | use-edit-request, BriefPanel, RangePanel, AiOptions | edit/undo/project/range change during inference, cancel, no stale results |
| #102 | [#105](https://github.com/murilaiooo/motion4free/pull/105) · 528f44b | AI only reranked top-N; full-transcript bounded ID-grounded discovery/curation and provenance | clip-context/candidates/discovery/source-map, ClipMaker, pipeline/project/App/Editor | full recording, grounded spans/title, context/negations, quotas/cancel, source mapping and actual MP4 |
| #27 | [#103](https://github.com/murilaiooo/motion4free/pull/103) · a0aae25 | Guided defaults overwrote explicit free prompt; unified field precedence and visible conflicts | editorial/production, precedence docs | prompt/preset conflicts, prohibitions, manual/locks/palette |
| #6 | [#104](https://github.com/murilaiooo/motion4free/pull/104) · 51fed10 | Text-pattern cleanup/short keep filtering could erase speech; preserve uncertain/repeated words, review markers and short voiced spans | analysis/asr-merge, cuts, transcript/persistence | quiet negations/repeats, short edge words, silence union, sync/audio, review markers |
| #7 | [#106](https://github.com/murilaiooo/motion4free/pull/106) · 71c8348 | Example catalog had no real per-kind records; eleven original semantic/license cards and auto bounds | motion/catalog, core/schema, editorial/selector | each kind/variant, none, short/long list, manual scenes, face occlusion/seek/export |
| #8 | [#107](https://github.com/murilaiooo/motion4free/pull/107) · bb643ad | Isolated highlights/four-word titles could lose qualifiers; conservative claim guards and transient context evidence | context-policy, selector/hooks, decision-evidence, DraftReview | negated/conditional/comparative claims, incomplete/anaphoric hooks, source IDs after cuts |
| #29 | [#108](https://github.com/murilaiooo/motion4free/pull/108) · 950e1d9 | Storyboard/review remained proposal; strict current-edit graph/beat report and explicit repetition hide | core/editorial creative-plan, StoryboardReview, Editor | resolved hidden/retimed elements, caps, manual/lock protection, one undoable action |
| #2 | [#109](https://github.com/murilaiooo/motion4free/pull/109) · 08a4ce8 | Family docs/footer omitted file/runtime provenance; static file hashes/notice inventory and public links | asset-provenance.json, licencas-runtime.txt, Landing | emitted assets/notices, exact embedded FFmpeg source and remote-model audit |
| #12 | [#110](https://github.com/murilaiooo/motion4free/pull/110) · 3865a13 | No static CSP; privacy policy still docs-only; headers, current flows and honest capacity/settings snapshot | public/_headers, SECURITY.md | deployed CSP with WASM/WebLLM/AAC/MediaPipe/BYOK, actual account cost/security review |
| #28 | [#111](https://github.com/murilaiooo/motion4free/pull/111) · 84c2885 | No comparable executable composition foundation; isolated absolute-time Canvas/Three adapters | research/frame-compositor, errors | arbitrary seek/frame capture, allocation, CPU/GPU; audio/MP4 integration still pending |
| #26 | [#112](https://github.com/murilaiooo/motion4free/pull/112) · fa963ee | Palette presets did not supply three structures; minimal, lit 3D diagram and documentary graphs | research/frame-compositor compositions/source capture | same source/annotations, structure/3D/seek, stale capture, audio/MP4 and blind critique |
| #10 | [#113](https://github.com/murilaiooo/motion4free/pull/113) · 507c35a | No rights-bearing recording/label/split contract; source/person/hash leakage rejection | quality/dataset | real rights and human labels, group leakage, invalid anchors, actual model/baseline evaluation |
| #30 | [#114](https://github.com/murilaiooo/motion4free/pull/114) · c70382c | Paper-only blind intake; separate private key/reviewer package, evidence/abstention form and descriptive report code | quality/blind-review, research/blind-review | genuine blind sessions, private data, rubric/evidence/preferences, report calculations and professional reviewers |

## Integration order and material risks

- Stack A: #97 → #99 → #100 → #105. #98, #103 and #104 are separate main-based changes.
- Stack B: #106 → #107 → #108; separate child #113 → #114 starts from #106.
- Stack C: #111 → #112. These are research entry points, outside the production app entry, with no production engine change.
- #109 and #110 are separate main-based branches. Licenses from #98 and research Three must be reconciled after integration. #110 CSP permits known runtime origins but has no execution evidence.
- Multiple branches touch manifests/changelog, errors catalogs and some editorial/UI files. Versions 0.27.6–0.33.1 are proposed integration targets, not verified releases; QA/integrator must resolve versions/locks/import conflicts deliberately and verify the final combined head. No integration branch was merged to mask these conflicts, and no green CI claim is made.
- Lexical context guards are conservative and may yield fewer effects/hooks. Valid IDs, structural reports, graph schemas and distinct layouts do not prove narrative quality, face safety or professional motion. Face tracking is spatial continuity, not speaker identity/diarization.
- The existing AAC fallback embeds FFmpeg: exact source/configuration/obligations are still a license-release blocker, not solved by MPL package text. Remote model file/converter provenance also needs completion.

## Remaining historical issues / concrete blockers

### #3 — browser MP4 proof

No exporter rewrite is warranted from current issue evidence. Existing export code and historical QA are documented in PR #32/#52 and docs/QA-v0.15.1.md; those reports do not verify new changes. Remaining criterion is actual memory/latency and native H.264 on target browsers. This session cannot produce that evidence because builds/app/export/benchmark execution are expressly prohibited. QA must use an authorized reproducible source, record browser/hardware/codecs/resolution/FPS, wall time and peak RAM/GPU, inspect video/audio/sync/frames, and retain exact head/output evidence. Brave is primary; include Chrome/Edge where the original issue requires them. Keep #3 open.

### #4 — cache, OPFS and integrity

OPFS persistence/migration/recovery and byte progress already have implementations (PR #37/#50/#56/#70, core/storage-report). Remaining blocker is executed first/second-load comparison, refresh/offline/cache eviction, integrity/recovery/backup and byte-accurate progress observations. QA must compare fresh/cache-hit model loads, abort/resume/unknown Content-Length, refresh with a saved multiclips project, storage denial/eviction/partial files and recovery without silently replacing user media. Preserve originals and use disposable authorized copies for fault scenarios. No destructive fault injection or browser run was performed here. Keep #4 open.

### #5 — OpenReel comparative adoption

See ADR-0032. Current stack retained; no runtime adoption/fork or comparative adapter is claimed. Concrete dependencies: frozen upstream revision/per-file license/dependency inventory, same-source baseline #3 evidence, and independently executed import/trim/caption/export/reopen/undo/rollback comparison. A README-only migration would violate the issue's acceptance. Comparator implementation and proof remain outstanding; do not interpret the static coverage matrix as a completed spike. The Canvas/Three POC #111 does not satisfy OpenReel comparison. Keep #5 open.

### Partial acceptance beyond code increments

- #73/#9/#12: real provider/CORS/vault/CSP behavior, budget calibration and account billing/admin evidence still require independent QA. No real keys were used. Repository metadata read-only: private/main, description null/topics empty; protection endpoint reported unprotected, rulesets and private reporting state not established. No account setting changed.
- #7/#2: original implemented subset only; full Editonny asset inventory/import needs per-item rights and QA. No external media/3D/SFX/music copied.
- #8: local neural embedding selection/integration remains outstanding; no benchmark-backed semantic claim. Actual authorized labels and target-hardware evaluation are prerequisites to promoting such retrieval as a quality policy; lexical guards are not a substitute.
- #29/#28/#26: richer procedural/asset grammar, actual sample-based visual criticism, audio/MP4 integration and measured engine/design judgment remain incomplete. Storyboard is structural, not a global artistic generator.
- #102: full-transcript structural search is not calibrated semantic storytelling; six dimensions/topic diversity/speaker crop and 20 authorized-recording blind comparison remain pending. Restoring beyond a derived clip requires original-source access/relink policy. All sentence starts are explored with a bounded endpoint shortlist, not all possible semantic spans.
- #10/#30: curator must supply authorized source/reference recordings, genuine annotations/permissions, independent qualified reviewers and human measurements. No corpus or ratings were fabricated. Collection/report code has not been executed. No confidence/professional-equivalence claim.

## Concurrent changes and next owner

#80 is already CLOSED by another session after its [production acceptance comment](https://github.com/murilaiooo/motion4free/issues/80#issuecomment-6328194456) recorded public Worker redirect/CDN acceptance in Brave. This session read that comment only; no production requests or reopening were performed. PR #101 research and unrelated #55/#67 were left untouched.

Next: independent QA/integrator reviews #97 first, then its dependent stack, keeping every issue open/PR unmerged until independently accepted. Parallel branches must be reconciled by the designated integrator; follow their per-issue handoffs. #3/#4 measurements and #5 frozen comparator preparation are the remaining historical work, with authorized corpus/rights/human input required for creative acceptance. This handoff reports remaining work explicitly rather than treating it as solved.
