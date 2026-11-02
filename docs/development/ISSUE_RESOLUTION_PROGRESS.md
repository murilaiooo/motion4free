# Issue resolution progress (checkpoint)

Working document for the "resolve every open GitHub issue" mission (started 2026-11-02, requested by the
product owner). It is a development checkpoint so another session can resume; GitHub issues remain the record.

## Initial state (2026-11-02 19:30 UTC)

- `main` = `fc94016` (v0.41.0). v0.38–v0.41 were merged without running tests.
- Open issues: #170, #171, #172, #173, #175, #176. Open PR: #174 (draft, multilingual ASR + EN→PT-BR translation).
- Unit suite on `main`: **25 failing / 2000** (see "Regressions" below). Browser suite: 7 failing.
- Cloud environment: `huggingface.co` and the production site are **blocked** by the environment's network
  policy, so model-backed tests (translation, ASR models, WebLLM) cannot run here. npm works.
  E2E: `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test`.

## Inventory and classification

| Issue | Priority | Class | Notes |
|---|---|---|---|
| #175 EN→PT translation leaks `>>pt_BR<<`, French/Spanish | P1 | Unresolved → **fixed in code, awaiting real-model test** | Root cause proven (see ADR-0043). Needs model-backed run + owner acceptance on the real video before closing. |
| #171 Multilingual ASR (auto/PT/EN/RU) | P1 | Partially implemented | Auto/PT/EN wired through Whisper worker, remote API and settings (from #174). Russian/other languages, per-segment language, WER fixtures not done. |
| #172 Subtitle translation, more pairs | P2 | Partially implemented | EN→PT-BR beta track with reversible original. Other pairs, per-segment retranslation, provenance schema not done. |
| #176 Prompt audit + benchmarks | P2 | Unresolved | Inventory doable here; A/B benchmarks need models (blocked here) and human review. |
| #170 Hardware profiles, RTX 5060 | P2 | Blocked by external requirement | Needs the owner's RTX 5060 + Brave measurements. |
| #173 Stronger local LLMs | P2 | Blocked by #176 baseline and #170 measurements | Needs real model runs. |

## Regressions found on `main` (fixed in v0.42.0)

Real defects: Gigante title text dark on dark panel; Foco quote mark outside the square frame; orphan last word
when the character limit was hit; Luxo captions below the 6.2% readability floor; three new templates reused other
templates' title faces. The other failures were fixtures not updated for intended v0.41 changes (depth layers,
v1 styles migrate without `fx`, 18 templates, Gigante as setup default, Foco one word at a time, 16% size cap) and
one timing-dependent check (pedido-ia now seeks instead of racing play/pause).

## Work log

| Date (UTC) | Item | Result |
|---|---|---|
| 2026-11-02 | #175 root cause | transformers.js 4.x never calls `MarianTokenizer._encode_text`; language code was plain text. Reproduced with the library's real tokenizer in `tests/marian-input.test.ts`. |
| 2026-11-02 | #175 fix | Input ids built like Python Marian; per-passage validation (`translation-check.ts`); atomic track replacement; M4F-318/319; cue length follows the template. |
| 2026-11-02 | v0.42.0 | PR #177 merged (`main` 05cc565); #174 closed as superseded; #175 and #171 commented. #175 stays open until the real-model test. |
| 2026-11-02 | #176 slice A | Prompt inventory (`docs/development/PROMPT_INVENTORY.md`); jury no longer scores no-speech scenes, has anchors and a text-only rule; range-scope examples; PT/EN requests; dead `moments-ai.ts` removed (v0.42.1). |
| 2026-11-02 | Suites | Unit 2015/2015, typecheck, build + license audit pass; full Playwright run 131 passed / 7 failed → the 7 fixed and re-run (40/40 in those files) + new `issue175-translation.spec.ts` passes. |

## Current state

- `main` has v0.42.0. Branch `claude/project-thread-hxiuyn` holds v0.42.1 (#176 slice A).
- #175 is waiting for the model-backed verification (the owner's test).

## Next steps

1. Run the translation with the real model (needs `huggingface.co` allowed in the environment, or the owner's
   test on the preview/production in Brave). Pin the model revision once fetched.
2. #171: add Russian and other Whisper languages to the source-language setting with honest support labels;
   record detected language; fixtures need consent-cleared audio.
3. #176: measured A/B baseline needs real models (owner's PC). The inventory and the concrete defects are done.
4. #170/#173: prepare a local benchmark page/script the owner can run on the RTX 5060; leave issues open with
   precise blockers.
