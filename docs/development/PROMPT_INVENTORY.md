# Model-facing prompt inventory (#176, deliverable A)

Audited on `main` after v0.42.0 (2026-11-02). Every place where Motion4Free sends instructions or text to a
model. Each entry is classified as **active** (reachable from the UI), **test-only**, **legacy/removed** or
**non-LLM model parameter**. Privacy: all paths run locally (WebLLM/WASM) by default; API routes only run with
the per-task consent from Settings → AI (#73, #126).

| # | Task | Status | Call site → builder | Instruction / payload | Output contract → parser | Retry/repair |
|---|---|---|---|---|---|---|
| 1 | Whole-video brief ("Pedido") | Active | `app/BriefPanel.tsx` → `interpretLayered` → `editorial/ai-brief.ts` `buildAiMessages(scope 'video')` | `systemPrompt('video')` (field grammar, colour table, data-not-instruction rule) + `AI_EXAMPLES` (3 few-shot) + `<pedido>`, `<ganchos>`, `<transcricao>` (first 1,500 chars, sentence-aligned) | One JSON object → `parseAiReply` (per-field validation; invalid parts dropped and reported) | One repair turn with the parse problem (`repairInstruction`), reply token cap 500 |
| 2 | Selected-range edit ("Trechos") | Active | `app/RangePanel.tsx` → `interpretRangeLayered` (`editorial/range-ai.ts`) → `buildAiMessages(scope 'trecho')` | `systemPrompt('trecho')` adds the forbidden-field rule. **Since v0.42.1 uses `RANGE_EXAMPLES`**, which contain only range-legal fields. Before, it reused the whole-video examples that contained the forbidden `preset`/`cuts`/`wantsHook`/`hookStyle`. | Same parser; only range fields are kept (`rangeLook`), prohibitions are added on top | Same as #1 |
| 3 | Contextual clip discovery | Active | `app/ClipMaker.tsx` → `discoverContextualMoments` (`editorial/clip-discovery.ts`) | Up to 4 grounded spans per transcript window, word-ID anchors, "do not cut antecedent/negation/condition/number/answer"; window budget of 3,000 bytes local and 24,000 bytes API; max 32 windows | `{"spans":[{firstWordId,lastWordId,titleFirstWordId,titleLastWordId}]}` → validated against the window's IDs | Second attempt with a "previous reply was not valid JSON" suffix |
| 4 | Clip jury | Active | `app/ClipMaker.tsx` → `juryRank` (`editorial/clip-jury.ts`) | 4 criteria scored 0–10. **Since v0.42.1:** score anchors 0/3/5/8/10, an explicit text-only limitation and any input language; **no-speech scenes are no longer sent** (the model was asked to judge a visual moment it cannot see, and that invented score weighed 50%). Text truncated at 320 chars local, 700 chars API; 6 clips local, 12 API | `{"notas":[{n,gancho,historia,sozinho,valor}]}` → `parseJury` (tolerant field names, salvage) | Second attempt with a JSON-only suffix |
| 5 | Provider task micro-tests | Active (Settings "Test") | `ai/providers/client.ts` `MICROTESTS` | `{"ritmo":"rapido"}`, `{"melhor":"B"}`, `{"ajuste":"amarelo"}`; connection `{"ok":true}` | Field presence | None |
| 6 | Legacy moment ranking/titles | **Removed in v0.42.1** | `editorial/moments-ai.ts` had no production caller (only its own test) | Ranked rule candidates with a fixed Portuguese example | — | — |
| 7 | Subtitle translation EN→PT-BR | Active (beta) | `app/Editor.tsx` → `translation/en-pt.ts` → worker | No prompt: OPUS-MT language token `>>pt_BR<<` sent as one token (ADR-0043) | Per-passage validation `editorial/translation-check.ts`; atomic track replacement | Next PT token variant, then M4F-318 |
| 8 | Speech recognition parameters | Non-LLM model parameter | `core/asr-models.ts` `whisperOptions`, `asr/remote.ts` | `task: 'transcribe'`, language auto/pt/en (since v0.42.0); never Whisper `translate` | Word timestamps | Window retry with `no_repeat_ngram_size` |

## Known gaps (still open in #176)

- **Micro-tests (#5) do not exercise production schemas.** Passing `{"ritmo":"rapido"}` does not show that a model
  can produce the brief schema, word-ID spans or jury notes. Replacing them needs real-model runs to keep the
  test short enough for small local models.
- **Brief transcript budget (#1)** is the first 1,500 characters. Long videos are judged from their opening only.
- **Examples (#1, #2) are Portuguese.** The system prompt now accepts PT or EN requests and asks for the summary
  in the request's language. Whether small local models follow this needs a measured run.
- **No measured baseline yet.** A/B work (wording, number of examples, JSON mode, hierarchical context) requires
  running Qwen2.5 0.5B/1.5B, Qwen3 4B and the API models on fixed fixtures with human review. Models cannot be
  downloaded in the cloud environment (`huggingface.co` blocked), so this has to run on the owner's PC.

## Tests that guard the prompts

- `tests/ai-brief.test.ts`: whole-video and range examples parse with the production parser without dropped
  fields; range examples contain no forbidden field; `buildAiMessages` picks the scope's examples; the schema is
  listed in the system prompt.
- `tests/clip-v039.test.ts`: the jury never receives no-speech scenes, keeps their app score and maps notes back
  to the right clip; anchors and the text-only rule are present.
- `tests/translation-check.test.ts`, `tests/marian-input.test.ts`: translation input and output validation.
