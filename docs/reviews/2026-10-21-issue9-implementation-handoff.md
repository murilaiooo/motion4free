# #9 — IMPLEMENTED — NOT TESTED / AWAITING QA

Depends on Draft PR #97. Refs #9 and the task/budget part of #73. Keep issues open and PR unmerged.

## Root cause / changes

The app selected a single completer without shared request accounting, response reuse, provider health or per-task/project override. Added `src/ai/routing.ts` (policy, route parsers, conservative counters, private bounded cache, deduplication, cooldown/circuit), `src/app/settings/AiRouting.tsx` (functional advanced controls), transport hooks in `providers/client.ts`, effective choices in `AiOptions.tsx`, stable project scope in App, task contexts in RangePanel/ClipMaker, connection-test accounting in AiSection, SettingsScreen project context, error catalog/docs, ADR-0030, manifests and changelog. Existing tests preserved.

## Exact independent QA instructions (not executed)

1. In Brave with no API key and no external consent, exercise global and per-task/project rules/local settings in two projects, editor brief, local revision and clip ranking. Confirm no remote inference, no project/history mutation on settings change, and no retranscription. A project override beats the global task choice; inheriting restores it.
2. Using synthetic provider responses and synthetic keys, explicitly choose/confirm a remote model. Preview/authorize its exact body. Verify effective model ID in all three tasks; switch key/account and check every override/cache from that provider is invalidated. Real restricted API keys are solely for independent QA after mocks.
3. Set max requests to 0, then 1. Connection tests, regular generations, repair attempts, 4xx/5xx and timeouts count only after authorization and before fetch. Cancel before authorization: no request/counter increment. Confirm limits block a second send and rules/manual editing remain available. Change limits explicitly and check the new cap/output token field/timeout is applied.
4. Same prompt/context/model/account/task/project/version twice: one external send, then tab-memory cache reuse. Changing any identity or repair text misses cache. Concurrent identical requests must not double-send. Clear cache during a pending request and revoke key while hashing: no stale response can be applied/reinserted. Reload clears response content; storage contains only counters/preferences/health.
5. Mock 429 with Retry-After seconds, future HTTP date, absent/invalid header; no traffic before cooldown ends, including catalog/connection checks and account replacement. Three transport/5xx failures open a 60s circuit. A previously-started success must not shorten newer cooldown. No automatic provider switch or retry.
6. Reopen project and a second tab; check persisted project usage and Web Locks reservation. Simulate blocked storage, failed writes and malformed counters. No silent undercount versus newer tab-memory reservations. Confirm storage clearing deletes all counters/health/preferences and cancels requests. Inspect project/export/log/URL/localStorage for absence of secrets/transcripts/responses.
7. Independently run meaningful regression/build/type/security checks and measure task quality. No performance-based model recommendation is claimed without those results.

## Risks / limitations

Local reservation is conservative accounting, not provider billing, real balance or a guaranteed dollar cap. Storage/lock restrictions reduce coordination to this tab; user controls provider spend caps. Cache retains model output in memory temporarily; no persistence. Explicit task choices replace automatic quality ranking until benchmarks exist. Non-enabled optional providers still require feasibility work. This branch is stacked on #97 and must be integrated only after QA of that dependency; version 0.29.0 anticipates #54's 0.28.0 release.

No tests, builds, typechecks, lint, validation commands, browser/app/manual checks, provider API requests or Actions dispatch were executed. No claim that the code works or issue acceptance is verified.
