# Real hardware measurement protocol (#170, #173, #176)

Since v0.44.0 the app records a measurement for every real transcription and every local-AI reply
(`src/core/perf-log.ts`, stored only in the browser under `m4f.perf.v1`). Settings → Transcription →
"Performance measured on this computer" shows the list and copies an English report. The report contains
only the app version, browser, GPU description and timings; no file name, caption text, request or key.

What is recorded:

- **Speech recognition:**
  - model id and device (`webgpu`/`wasm`), plus whether this was the main or the double-check pass;
  - requested language;
  - seconds of speech heard and load time (download + model setup);
  - listening time and its multiple of real time;
  - whether the model was cached, and how many fallbacks happened before it;
  - the M4F code when a model failed.
- **Local AI (WebLLM):**
  - model key and load time (first reply after loading);
  - prompt/reply tokens and prefill/decode tokens per second, as WebLLM reports them;
  - total reply time and the M4F code on failure.

Not recorded, because the browser cannot measure it honestly: VRAM use, GPU utilisation percentage, power.
`navigator.deviceMemory` is system RAM (capped at 8) and the report labels it "(not VRAM)".

## Owner run (RTX 5060, Brave on Windows)

1. Settings → Transcription → "Delete measurements".
2. Run each case twice (cold = first download, warm = second time). Use the same video for every mode:
   - a 30 s, a 5 min and (if possible) a 30 min video;
   - "Precise" mode, "Fast" mode, and "Precise" with the double check on.
3. Settings → AI: run one whole-video request with each local AI size (light, standard, strong).
4. Settings → Transcription → "Copy performance report" and paste it into #170.
5. Repeat steps 1–4 on a weaker machine (integrated GPU or no WebGPU) if one is available.

These numbers are the baseline that #170 (profiles), #173 (model candidates) and #176 (prompt A/B) compare
against. No speed claim should be made before a report exists.
