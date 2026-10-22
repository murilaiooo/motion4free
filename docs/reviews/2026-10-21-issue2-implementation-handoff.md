# #2 — IMPLEMENTED — NOT TESTED / AWAITING QA

Root cause: legal documentation grouped resources by family and the deployed footer linked only font/icon notices. There was no file-level inventory of source-imported font binaries, nor accessible license text for browser runtime packages.

Changed: public/asset-provenance.json records each unique font binary imported by src/media/fonts.ts and UI theme.css, package/version, source, SHA-256, bytes, usage, notice and modification/restriction notes. Includes the existing emoji subset separately. public/licencas-runtime.txt preserves installed root license/notice files for direct runtimes and known browser transitive dependencies; footer links both artifacts. Manifests, changelog and this handoff updated. This generated inventory reads package/source files; no app, build or verification command was executed.

Static facts: own scenes/UI remain original MIT. No Editonny/OpenReel media, SFX, music or 3D was imported. User-supplied media rights are not certified. Package metadata is not a legal certification of all embedded code. Imported font files are not automatically identical to a future build output; QA must map emitted assets later.

Release blockers: @mediabunny/aac-encoder@1.61.6 declares MPL-2.0, but README describes embedded FFmpeg WASM. MPL package metadata alone does not identify the embedded FFmpeg revision or establish fulfillment of corresponding-source/relinking requirements. The exact FFmpeg binary source/configuration must be obtained and retained before calling the audit complete. No fallback was silently removed. Remote Whisper/Qwen converter provenance and immutable per-file model records still need review. Complete transitive bundled mapping requires the separate QA build; #98 MediaPipe additions need extension after integration.

Primary references (read only): https://mediabunny.dev/guide/extensions/aac-encoder ; https://ffmpeg.org/legal.html ; installed package LICENSE/README files. No legal conclusion that all redistribution requirements are satisfied.

QA: inspect deployed footer links and complete notice texts; reconcile each emitted font/runtime asset against inventory; inspect modified emoji notice and reserved-name restrictions; complete embedded AAC/FFmpeg and remote-model source/notice review; include lazy worker chunks and separate direct/embedded licenses. Do not close issue based only on existence of this inventory. UNTESTED / AWAITING QA.
