# #54 — IMPLEMENTED — NOT TESTED / AWAITING QA

## Root cause

Face tracks were optional empty inputs of ClipFrames. Nothing produced, persisted or supplied them to preview/export. Single-video legacy framing bypassed ClipFrames altogether.

## Implementation and files

- `src/media/face.worker.ts`, `face-protocol.ts`, `face-analysis.ts`: pinned local MediaPipe/BlazeFace detection, fixed downloads, bounded sequential samples, spatial continuity, cancellation, timeout and worker cleanup.
- `src/render/framing.ts`: valid sample times, centered long-gap fallback, clamped interpolation.
- `src/core/project.ts`, `src/app/App.tsx`: optional bounded per-clip tracks in saved project, snapshot and both reopen paths.
- `src/media/sources.ts`, `player.ts`, `export.ts`, `export-client.ts`, `export-protocol.ts`, `export.worker.ts`, `src/render/frame.ts`: same track/time mapping in preview, arbitrary seek and all export paths; preserve manual single-video framing outside smart.
- `src/app/Editor.tsx`, `FramingPanel.tsx`: explicit analysis action/progress/cancel, no-face/failure messages, normal history activation, manual override, preserve edits made during analysis.
- Error catalog/docs, dependency manifests, changelog and ADR-0029. No existing test changed.

## Exact independent QA instructions (not executed)

1. In Brave, prepare authorized horizontal and portrait clips with known face positions, slow left/right movement, two people, shot changes, brief/long occlusion and no faces. Include rotated metadata and silent clips. Record expected crop positions by timestamp.
2. Open Mídia, choose a clip or all clips and analyze faces. Observe real downloads and network payloads: only public runtime/model GETs, no frames/video/audio/transcript/credentials uploaded. Check module-WASM loading in deployed production and dev; block downloads to confirm M4F-308 preserves the previous project/framing.
3. Confirm selected target isolation, source-local time after reorder/trim, smooth camera movement, no abrupt jumps, and stable repeated seeks before/after cuts. Manually adjust framing, then undo/redo. Compare the same timestamps in preview and actual MP4 in 9:16 and 16:9, including both export Worker and fallback, multiple clips, mask/manual transforms and music/audio gain.
4. Cancel before/after loading, during decode/inference, close/switch project, and immediately start another analysis. No partial track, late edit or leaked Worker/ImageBitmap may remain. Make an unrelated caption edit during analysis; completing the analysis must preserve it.
5. Save, reload, reopen, duplicate, export/import project and exercise removal/undo of clips. Persisted tracks must remain attached to the same source ID without retranscription or inference on reopen. Old projects without tracks keep their original behavior. Malformed/oversized/mismatched arrays are rejected.
6. All-no-face and partial-no-face cases must state the fallback accurately. Measure elapsed time, peak CPU/memory, network bytes cold/warm and responsiveness on representative hardware. No measurements are claimed here. Run appropriate regression/security/build/type checks independently.

## Risks and gate

The optional feature is labeled experimental and unverified. Short-range detector is unsuitable for distant/profile faces; selection follows spatial continuity, not speech or identity. Runtime/model download, cross-origin restrictions and worker/browser support remain QA gates. Fixed sampling can miss rapid movement. Track metadata is local derived data, not recognition data. Existing media is untouched.

No test runner, build, typecheck, lint, validation command, application/manual QA, inference, media import/render/playback/export or real provider/API test was run. Dependency manifest/lockfile generation used npm with scripts and audit disabled. Issue stays open, PR stays Draft and unmerged.
