# #11 — IMPLEMENTED — NOT TESTED / AWAITING QA

Depends on #99, which depends on #97. Keep issue open and PR Draft/unmerged.

Root cause: BriefPanel and RangePanel awaited a model and applied results through callbacks that captured an older plan/history/selection. Subsequent edits or selection changes could therefore be replaced by a late result. Existing Creative Setup → upload → analysis → draft/review flow already exists in production.ts and App; it was preserved.

Changed files: `src/app/use-edit-request.ts` (plan/selection lifetime), `BriefPanel.tsx` and `RangePanel.tsx` (guard every async boundary/progress/error, explicit cancellation), `Editor.tsx` (range plan revision), `AiOptions.tsx` (propagate abort to remote requests/consent, suppress late local results), error catalog/docs and version manifests/changelog.

QA (not executed): In Brave, delay a synthetic remote response. While a general or range request is pending, edit a caption, change manual overlay/framing, undo/redo, change selected range bounds, close/reopen/switch project, then resolve the old request. The current edit/history/selection must be unchanged; no stale result, progress or error may reappear. Try two successive requests/cancellation; the older completion must not clear the newer progress. Cancel at consent, model preparation, network/body read and local inference. Confirm remote abort and no follow-up repair; a shared local download may finish but its result must not apply. Then submit a new valid request to the current selection and verify normal undo/redo/project reopen and preview/export consistency. Run independent regression/build checks and real creative-flow QA; none was performed here.

Limitations: cannot undo already-billed provider requests. Local shared model initialization/generation may continue after the edit request is abandoned; only its application is cancelled. Creative quality, first useful information within 3s, semantic cut safety and actual MP4 output remain independent QA gates, not claimed verified by this change. No tests were changed or executed, no browser/application opened, no media imported/rendered/exported, no validation command or Actions dispatch.
