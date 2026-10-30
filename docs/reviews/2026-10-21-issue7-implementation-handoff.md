# #7 — IMPLEMENTED — NOT TESTED / AWAITING QA

Root cause: runtime had original scene implementations and heuristics, but only an example catalog schema in the research document. No per-kind provenance, limitations or common automatic-selection bounds existed.

Changed: src/motion/catalog.ts (eleven exhaustive, typed records and rejection policy); src/core/schema.ts (reuse the existing parameter schema); src/editorial/selector.ts (filter automatic proposals); manifests, changelog and catalog documentation.

Design: original MIT implementations only. Scene fields use existing schema, timeline and duration bounds. Face safety describes risks rather than promising detection. Supported variations refer to existing renderer parameters. Manual and persisted scenes are not silently discarded by a new policy. No-animation remains an empty scene list / existing prohibitions; captions are independent.

QA in Brave: create a spoken sequence with a number, enumeration, question, introduction and closing CTA; inspect generated parameters/time windows and none mode. Check short clips, long lists, forbidden kinds, changed styles, manually edited scenes, undo/redo and project reopen. Compare arbitrary preview seeks and exported MP4 frames for each original scene and composition variant, with a face in center and near edges. Inspect typography/font notices and every provenance path. All acceptance remains UNTESTED.

Remaining blockers: this catalogs the implemented original subset, not the complete Editonny archive. External assets need item-level permission/provenance before import; visual readability, face occlusion and arbitrary seek evidence belong to QA. Engineering bounds are conservative policy values, not measured visual quality. A candidate rejected by bounds yields no animation rather than substituting unrelated content.
