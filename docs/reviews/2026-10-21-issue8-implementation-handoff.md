# #8 — IMPLEMENTED — NOT TESTED / AWAITING QA

Root cause: numeric/emphasis heuristics operated on isolated words; title extraction truncated the first four words, potentially losing a later negation/condition. Review only summarized scene counts, without source-word evidence or contextual caveats.

Changes: context-policy.ts detects conservative PT/EN lexical flags. selector.ts suppresses isolated numeric/keyword/zoom claims in flagged sentences and requires a complete short opening sentence. hooks.ts retains complete negations but excludes pause-only or dependent openings. decision-evidence.ts maps current scene windows through the EDL to source word IDs; production report and DraftReview show nearby-speech status and limitations. Core report type, manifests and changelog updated. Depends on #106 catalog.

Design: no fabricated confidence, automatic removals of speech, paid calls, embeddings download, logs or copied transcripts. Evidence is a bounded transient report of the current plan, not historical proof of why a model chose a scene. Existing manual scenes and explicit titles retain user control. More conservative heuristics may produce fewer effects/hooks, an intentional none fallback.

QA in Brave: compare 'não custa 50 reais', 'se vender 50 unidades', 'menos de 50', positive 50 reais; negation after word four; pause without punctuation; 'isso funciona' with antecedent; full independent negated hooks; PT/EN punctuation and ASR errors. Confirm source IDs/times after cuts, multiclips, manual scenes, undo/reopen and range changes. Check forbidden scenes, none mode and full captions retained. Human semantic review must assess false positives and omissions. No execution performed.

Remaining: local neural embeddings/model selection and benchmark-calibrated semantic policies are not supplied by this lexical correction. Shipping an unmeasured embedding similarity as semantic truth would not satisfy acceptance. Requires licensed model/authorized labeled material and QA on target browser hardware; no inference or benchmark may run in this implementation-only task. Issue remains open.
