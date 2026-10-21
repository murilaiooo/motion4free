# #28 — IMPLEMENTED — NOT TESTED / AWAITING QA

Root cause: comparison remained prose; no common graph contract, absolute-time adapter boundary or inspectable same-input Canvas/Three implementation existed.

Changed: research/frame-compositor/{graph,canvas,three,main}.mjs, index.html, README, Three MIT notice; errors catalog/docs, manifests/changelog. Real independent Canvas2D and Three.js adapters consume a shared capped schema and time sampler. Explicit module loading, text/geometry only, disposal and same-path frame capture. Not integrated into production, no new dependency installed and no backend.

Exact QA instructions and remaining blockers are in the POC README. No tests, app launch, browser inspection, build, lint, typecheck, validation, benchmark, rendering/capture, media or API execution occurred. This is an implementation-ready research Draft, not evidence that it renders correctly or is faster. Final acceptance still needs browser/performance/audio/MP4 integration evidence and informed engine decision. Do not close issue or change ADR-0005 based on this PR.
