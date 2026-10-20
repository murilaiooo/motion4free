# Fase 1 — primeiro MP4: plano de implementação

> Formato Superpowers `writing-plans`. Quem executa pode não ter contexto nenhum do projeto: cada tarefa traz os arquivos exatos, o teste, o código e o comando de verificação. Executar as tarefas **em ordem**, uma por vez, com TDD (escrever o teste, ver falhar, implementar, ver passar, commitar).

**Objetivo:** num site estático, a pessoa escolhe um vídeo seu falando e baixa um MP4 9:16 com silêncios cortados, legendas automáticas e um título animado na abertura, tudo processado no navegador.

**Arquitetura:** funções puras em TypeScript (`core`, `engine`, `analysis`, `editorial`, `render`) produzem e desenham um `EditPlan` validado por zod. As camadas de navegador (`media` com Mediabunny/WebCodecs, `asr` com Whisper em Worker, `app` com React) só leem o arquivo, transcrevem, chamam as funções puras e exportam. A exportação chama `drawFrame(plano, t)` quadro a quadro; a prévia é uma exportação curta, então prévia = MP4.

**Stack:** Node 22, TypeScript 7.0.2, Vite 8.3.4, React 19.3.1, Mediabunny 1.61.6 (+ @mediabunny/aac-encoder 1.61.6), @huggingface/transformers 4.3.1, zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1. Decisões em [ADR-0005](../../decisions/0005-stack-v1.md).

**Spec:** [v1 consolidada](../specs/2026-10-20-motion4free-v1-design.md) · **Plano mestre:** [fases e gates](2026-10-20-plano-mestre.md)

**Validação prévia:** todo o código abaixo foi executado num protótipo em 20/10/2026: `npm test` → 10 arquivos, 28 testes passando; `npm run typecheck` sem erros; `npm run e2e` → 1 teste passando no Chromium, gerando MP4 1080×1920 (VP9 de reserva, AAC) com 3,1 s a partir de um vídeo de 6 s com pausas.

## Restrições globais (valem para todas as tarefas)
- Tempo sempre em **segundos** (`number`). `src` = tempo no original; `out` = tempo no vídeo editado. Nunca misturar.
- Arquivos em `src/core`, `src/engine`, `src/analysis`, `src/editorial`, `src/render` **não** usam APIs de navegador (exceto tipos de canvas em `render`) e têm teste em `tests/`.
- Toda entrada externa ao motor (arquivo salvo, futura IA) passa por `parseEditPlan` antes de uso.
- Nenhum envio de mídia para a rede. Única rede permitida: download do modelo (Hugging Face) e do runtime ONNX (jsdelivr).
- Textos de interface em português do Brasil, sem jargão.
- Commits em inglês no formato `feat:`, `test:`, `chore:`, `ci:`, `docs:`. Um commit por tarefa.
- Versões de dependência exatas (sem `^`).

## Estrutura final de arquivos
```text
LICENSE (já existe)          package.json  package-lock.json  tsconfig.json  vite.config.ts
index.html                   playwright.config.ts
.github/workflows/app-ci.yml
scripts/make-fixture.sh      scripts/prune-dist.mjs
src/main.tsx
src/core/types.ts            src/core/schema.ts
src/engine/timeline.ts
src/analysis/silence.ts
src/editorial/cuts.ts        src/editorial/captions.ts    src/editorial/auto-edit.ts
src/render/easing.ts         src/render/layout.ts         src/render/scenes.ts   src/render/frame.ts
src/media/splice.ts          src/media/input.ts           src/media/audio.ts     src/media/codecs.ts   src/media/export.ts
src/asr/words.ts             src/asr/protocol.ts          src/asr/whisper.worker.ts   src/asr/transcriber.ts
src/app/pipeline.ts          src/app/App.tsx              src/app/app.css
tests/*.test.ts              e2e/primeiro-mp4.spec.ts
```

---

## Tarefa 0 — Esqueleto do projeto

**Arquivos:** criar `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx` (provisório); alterar `.gitignore`.

**Passo 1.** Na raiz do repositório:

```bash
npm init -y
npm install --save-exact react@19.3.1 react-dom@19.3.1 mediabunny@1.61.6 @mediabunny/aac-encoder@1.61.6 @huggingface/transformers@4.3.1 zod@4.6.7
npm install --save-exact --save-dev typescript@7.0.2 vite@8.3.4 vitest@5.0.5 @vitejs/plugin-react@6.1.2 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node @playwright/test@1.64.1
```

**Passo 2.** Ajustar o `package.json` (manter as dependências que o npm escreveu):

```json
{
  "name": "motion4free",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build && node scripts/prune-dist.mjs",
    "build:e2e": "VITE_FAKE_ASR=1 vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test",
    "fixture": "bash scripts/make-fixture.sh"
  }
}
```

**Passo 3.** Criar os arquivos de configuração:

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "e2e", "vite.config.ts"]
}
```

`vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

`index.html`

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Motion4Free — teste</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Passo 4.** Acrescentar ao `.gitignore`:

```text
# Playwright
test-results/
playwright-report/
e2e/fixtures/
```

**Passo 5.** Verificar: `npx vitest run --passWithNoTests` termina com sucesso.

**Commit:** `chore: scaffold Vite + React + TypeScript app`

---
## Tarefa 1 — Contratos e validação

Define os tipos do plano de edição e o validador que barra qualquer coisa fora do esquema (inclusive tipos de cena desconhecidos).

**Arquivos:** criar `src/core/types.ts`, `src/core/schema.ts`; teste `tests/schema.test.ts`.

**Passo 1 — teste que falha.**

`tests/schema.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';

const valid = {
  version: 1,
  output: { width: 1080, height: 1920, fps: 30 },
  segments: [{ srcStart: 0, srcEnd: 2.5 }],
  captions: [{ id: 'c1', text: 'Olá', start: 0, end: 1, wordIds: ['w1'] }],
  scenes: [{ id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 1.5 }],
};

describe('parseEditPlan', () => {
  it('aceita um plano válido', () => {
    expect(parseEditPlan(valid)).toEqual({ ok: true, plan: valid });
  });

  it('rejeita segmento invertido', () => {
    const r = parseEditPlan({ ...valid, segments: [{ srcStart: 3, srcEnd: 1 }] });
    expect(r.ok).toBe(false);
  });

  it('rejeita tipo de cena desconhecido (nada de código livre)', () => {
    const r = parseEditPlan({ ...valid, scenes: [{ ...valid.scenes[0], kind: 'eval' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('scenes.0.kind');
  });
});
```

**Passo 2.** `npx vitest run tests/schema.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/core/types.ts`

```ts
/** Tempo sempre em segundos (number). "src" = tempo no vídeo original; "out" = tempo no vídeo editado. */

export interface Word {
  id: string;
  text: string;
  start: number; // src
  end: number; // src
}

export interface TimeRange {
  start: number;
  end: number;
}

/** Trecho do original que entra no vídeo final, na ordem. */
export interface Segment {
  srcStart: number;
  srcEnd: number;
}

export interface Caption {
  id: string;
  text: string;
  start: number; // out
  end: number; // out
  wordIds: string[];
}

export type SceneKind = 'kinetic-title';

export interface SceneInstance {
  id: string;
  kind: SceneKind;
  text: string;
  start: number; // out
  end: number; // out
}

export interface OutputProfile {
  width: number;
  height: number;
  fps: number;
}

export interface EditPlan {
  version: 1;
  output: OutputProfile;
  segments: Segment[];
  captions: Caption[];
  scenes: SceneInstance[];
}

export const REELS_PROFILE: OutputProfile = { width: 1080, height: 1920, fps: 30 };
```

`src/core/schema.ts`

```ts
import { z } from 'zod';
import type { EditPlan } from './types';

const time = z.number().finite().nonnegative();

const segment = z
  .object({ srcStart: time, srcEnd: time })
  .refine((s) => s.srcEnd > s.srcStart, { message: 'segmento com fim antes do início' });

const caption = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(120),
  start: time,
  end: time,
  wordIds: z.array(z.string()),
});

const scene = z.object({
  id: z.string().min(1),
  kind: z.literal('kinetic-title'),
  text: z.string().min(1).max(60),
  start: time,
  end: time,
});

export const editPlanSchema = z.object({
  version: z.literal(1),
  output: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().min(12).max(60),
  }),
  segments: z.array(segment).min(1),
  captions: z.array(caption),
  scenes: z.array(scene),
});

export type ParseResult = { ok: true; plan: EditPlan } | { ok: false; errors: string[] };

/** Toda entrada externa (arquivo salvo, IA no futuro) passa por aqui antes de chegar ao motor. */
export function parseEditPlan(input: unknown): ParseResult {
  const r = editPlanSchema.safeParse(input);
  if (!r.success) {
    return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, plan: r.data };
}
```

**Passo 4.** `npx vitest run tests/schema.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: add EditPlan contracts and zod validation`

---

## Tarefa 2 — Linha do tempo

Converte tempo do vídeo editado ↔ original atravessando os cortes.

**Arquivos:** criar `src/engine/timeline.ts`; teste `tests/timeline.test.ts`.

**Passo 1 — teste que falha.**

`tests/timeline.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { outputDuration, outputToSource, sourceToOutput } from '../src/engine/timeline';

const segs = [
  { srcStart: 1, srcEnd: 3 },
  { srcStart: 5, srcEnd: 6 },
];

describe('timeline', () => {
  it('soma a duração dos trechos', () => {
    expect(outputDuration(segs)).toBe(3);
  });

  it('mapeia saída -> original atravessando o corte', () => {
    expect(outputToSource(segs, 0)).toBe(1);
    expect(outputToSource(segs, 1.5)).toBe(2.5);
    expect(outputToSource(segs, 2)).toBe(5);
    expect(outputToSource(segs, 2.5)).toBe(5.5);
    expect(outputToSource(segs, 3)).toBeNull();
    expect(outputToSource(segs, -1)).toBeNull();
  });

  it('mapeia original -> saída e devolve null no trecho cortado', () => {
    expect(sourceToOutput(segs, 2)).toBe(1);
    expect(sourceToOutput(segs, 4)).toBeNull();
    expect(sourceToOutput(segs, 5.5)).toBe(2.5);
  });
});
```

**Passo 2.** `npx vitest run tests/timeline.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/engine/timeline.ts`

```ts
import type { Segment } from '../core/types';

export function outputDuration(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + (s.srcEnd - s.srcStart), 0);
}

/** Converte um instante do vídeo editado no instante correspondente do original. */
export function outputToSource(segments: Segment[], t: number): number | null {
  if (t < 0) return null;
  let offset = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (t < offset + len) return s.srcStart + (t - offset);
    offset += len;
  }
  return null;
}

/** Converte um instante do original para o vídeo editado; null se o trecho foi cortado. */
export function sourceToOutput(segments: Segment[], src: number): number | null {
  let offset = 0;
  for (const s of segments) {
    if (src >= s.srcStart && src < s.srcEnd) return offset + (src - s.srcStart);
    offset += s.srcEnd - s.srcStart;
  }
  return null;
}
```

**Passo 4.** `npx vitest run tests/timeline.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: add segment timeline mapping`

---

## Tarefa 3 — Detector de silêncio

Energia RMS em quadros de 20 ms; silêncio abaixo de −40 dBFS por pelo menos 0,45 s.

**Arquivos:** criar `src/analysis/silence.ts`; teste `tests/silence.test.ts`.

**Passo 1 — teste que falha.**

`tests/silence.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { findSilences } from '../src/analysis/silence';

const SR = 16000;

/** Gera tom de 220 Hz nos trechos "on" e silêncio no resto. */
function synth(totalSec: number, on: Array<[number, number]>): Float32Array {
  const s = new Float32Array(Math.round(totalSec * SR));
  for (const [a, b] of on) {
    for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR);
  }
  return s;
}

describe('findSilences', () => {
  it('encontra o silêncio longo entre duas falas', () => {
    const r = findSilences(synth(3, [[0, 1], [2, 3]]), SR);
    expect(r).toHaveLength(1);
    expect(r[0]!.start).toBeCloseTo(1, 1);
    expect(r[0]!.end).toBeCloseTo(2, 1);
  });

  it('ignora pausa curta (respiração natural)', () => {
    expect(findSilences(synth(2.3, [[0, 1], [1.3, 2.3]]), SR)).toHaveLength(0);
  });

  it('detecta silêncio no início e no fim', () => {
    const r = findSilences(synth(3, [[1, 2]]), SR);
    expect(r.map((x) => [Math.round(x.start), Math.round(x.end)])).toEqual([[0, 1], [2, 3]]);
  });
});
```

**Passo 2.** `npx vitest run tests/silence.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/analysis/silence.ts`

```ts
import type { TimeRange } from '../core/types';

export interface SilenceOptions {
  /** Abaixo deste nível (dBFS) o quadro conta como silêncio. */
  thresholdDb: number;
  /** Silêncios menores que isto são pausas naturais e ficam. */
  minSilenceSec: number;
  /** Tamanho do quadro de análise. */
  frameSec: number;
}

export const DEFAULT_SILENCE: SilenceOptions = { thresholdDb: -40, minSilenceSec: 0.45, frameSec: 0.02 };

/** Energia RMS por quadro, em dBFS (silêncio digital = -100). */
export function rmsDb(samples: Float32Array, sampleRate: number, frameSec: number): Float32Array {
  const frameLen = Math.max(1, Math.round(sampleRate * frameSec));
  const frames = Math.ceil(samples.length / frameLen);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * frameLen;
    const end = Math.min(samples.length, start + frameLen);
    for (let i = start; i < end; i++) {
      const v = samples[i]!;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - start));
    out[f] = rms > 1e-5 ? 20 * Math.log10(rms) : -100;
  }
  return out;
}

export function findSilences(samples: Float32Array, sampleRate: number, opts: SilenceOptions = DEFAULT_SILENCE): TimeRange[] {
  const db = rmsDb(samples, sampleRate, opts.frameSec);
  const frameLen = Math.max(1, Math.round(sampleRate * opts.frameSec));
  const totalSec = samples.length / sampleRate;
  const result: TimeRange[] = [];
  let runStart = -1;
  for (let f = 0; f <= db.length; f++) {
    const silent = f < db.length && db[f]! < opts.thresholdDb;
    if (silent && runStart < 0) runStart = f;
    if (!silent && runStart >= 0) {
      const start = (runStart * frameLen) / sampleRate;
      const end = Math.min(totalSec, (f * frameLen) / sampleRate);
      if (end - start >= opts.minSilenceSec) result.push({ start, end });
      runStart = -1;
    }
  }
  return result;
}
```

**Passo 4.** `npx vitest run tests/silence.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: add RMS silence detection`

---

## Tarefa 4 — Cortes protegidos

Transforma silêncios em trechos mantidos, com margem de 120 ms e sem cortar dentro de palavra reconhecida.

**Arquivos:** criar `src/editorial/cuts.ts`; teste `tests/cuts.test.ts`.

**Passo 1 — teste que falha.**

`tests/cuts.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { planKeepSegments } from '../src/editorial/cuts';

const w = (id: string, start: number, end: number) => ({ id, text: id, start, end });

describe('planKeepSegments', () => {
  it('corta o silêncio do meio mantendo margens', () => {
    const segs = planKeepSegments(3, [{ start: 1, end: 2 }], []);
    expect(segs).toEqual([
      { srcStart: 0, srcEnd: 1.12 },
      { srcStart: 1.88, srcEnd: 3 },
    ]);
  });

  it('nunca corta dentro de uma palavra baixa que caiu no "silêncio"', () => {
    // o "não" foi falado baixinho em 1.7–1.9 e o detector achou que era silêncio
    const segs = planKeepSegments(3, [{ start: 1, end: 2.5 }], [w('não', 1.7, 1.9)]);
    const keepsNao = segs.some((s) => s.srcStart <= 1.7 && s.srcEnd >= 1.9);
    expect(keepsNao).toBe(true);
  });

  it('sem silêncios devolve o vídeo inteiro', () => {
    expect(planKeepSegments(5, [], [])).toEqual([{ srcStart: 0, srcEnd: 5 }]);
  });
});
```

**Passo 2.** `npx vitest run tests/cuts.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/editorial/cuts.ts`

```ts
import type { Segment, TimeRange, Word } from '../core/types';

export interface CutOptions {
  /** Margem preservada em volta da fala, para não comer consoantes. */
  padSec: number;
  /** Trechos de fala menores que isto, isolados, são descartados. */
  minKeepSec: number;
}

export const DEFAULT_CUTS: CutOptions = { padSec: 0.12, minKeepSec: 0.2 };

/**
 * Remove silêncios longos sem nunca cortar dentro de uma palavra.
 * Regra de proteção: se um silêncio detectado se sobrepõe a uma palavra
 * (transcrição diz que há fala ali), o silêncio é encolhido para fora da palavra.
 */
export function planKeepSegments(durationSec: number, silences: TimeRange[], words: Word[], opts: CutOptions = DEFAULT_CUTS): Segment[] {
  const cuts: TimeRange[] = [];
  for (const s of silences) {
    let start = s.start + opts.padSec;
    let end = s.end - opts.padSec;
    for (const w of words) {
      if (w.end <= start || w.start >= end) continue;
      // palavra dentro do silêncio: preserva a palavra e corta só o que sobra antes ou depois
      if (w.start - start >= end - w.end) end = Math.min(end, w.start - opts.padSec);
      else start = Math.max(start, w.end + opts.padSec);
    }
    if (end - start > 0.05) cuts.push({ start, end });
  }

  const keep: Segment[] = [];
  let cursor = 0;
  for (const c of cuts.sort((a, b) => a.start - b.start)) {
    if (c.start > cursor) keep.push({ srcStart: cursor, srcEnd: c.start });
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < durationSec) keep.push({ srcStart: cursor, srcEnd: durationSec });
  return keep.filter((s) => s.srcEnd - s.srcStart >= opts.minKeepSec).map(round);
}

function round(s: Segment): Segment {
  return { srcStart: Math.round(s.srcStart * 1000) / 1000, srcEnd: Math.round(s.srcEnd * 1000) / 1000 };
}
```

**Passo 4.** `npx vitest run tests/cuts.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: plan keep segments without cutting words`

---

## Tarefa 5 — Legendas

Agrupa palavras em legendas curtas no tempo do vídeo editado; descarta palavras cortadas.

**Arquivos:** criar `src/editorial/captions.ts`; teste `tests/captions.test.ts`.

**Passo 1 — teste que falha.**

`tests/captions.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildCaptions } from '../src/editorial/captions';

const w = (id: string, text: string, start: number, end: number) => ({ id, text, start, end });

describe('buildCaptions', () => {
  it('agrupa palavras e quebra no ponto final', () => {
    const words = [w('1', 'Hoje', 0, 0.3), w('2', 'eu', 0.3, 0.4), w('3', 'acordei.', 0.4, 0.9), w('4', 'Depois', 1.0, 1.3)];
    const caps = buildCaptions(words, [{ srcStart: 0, srcEnd: 2 }]);
    expect(caps.map((c) => c.text)).toEqual(['Hoje eu acordei.', 'Depois']);
  });

  it('respeita o limite de caracteres', () => {
    const words = [w('1', 'paralelepípedo', 0, 0.5), w('2', 'extraordinário', 0.5, 1)];
    const caps = buildCaptions(words, [{ srcStart: 0, srcEnd: 2 }]);
    expect(caps).toHaveLength(2);
  });

  it('desloca para o tempo editado e descarta palavras cortadas', () => {
    const words = [w('1', 'antes', 0, 0.5), w('2', 'cortada', 1.2, 1.6), w('3', 'depois', 2.1, 2.5)];
    const caps = buildCaptions(words, [
      { srcStart: 0, srcEnd: 1 },
      { srcStart: 2, srcEnd: 3 },
    ]);
    expect(caps.flatMap((c) => c.wordIds)).toEqual(['1', '3']);
    expect(caps[1]!.start).toBeCloseTo(1.1, 5);
  });
});
```

**Passo 2.** `npx vitest run tests/captions.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/editorial/captions.ts`

```ts
import type { Caption, Segment, Word } from '../core/types';
import { sourceToOutput } from '../engine/timeline';

export interface CaptionOptions {
  maxChars: number;
  maxDurationSec: number;
}

export const DEFAULT_CAPTIONS: CaptionOptions = { maxChars: 22, maxDurationSec: 1.6 };

/** Agrupa palavras em legendas curtas (estilo Reels) já no tempo do vídeo editado. */
export function buildCaptions(words: Word[], segments: Segment[], opts: CaptionOptions = DEFAULT_CAPTIONS): Caption[] {
  const placed = words
    .map((w) => {
      const start = sourceToOutput(segments, w.start);
      const end = sourceToOutput(segments, Math.max(w.start, w.end - 1e-3));
      return start === null || end === null ? null : { ...w, start, end: end + 1e-3 };
    })
    .filter((w): w is Word => w !== null);

  const captions: Caption[] = [];
  let group: Word[] = [];
  const flush = () => {
    if (group.length === 0) return;
    captions.push({
      id: `c${captions.length + 1}`,
      text: group.map((g) => g.text.trim()).join(' '),
      start: group[0]!.start,
      end: group[group.length - 1]!.end,
      wordIds: group.map((g) => g.id),
    });
    group = [];
  };

  for (const w of placed) {
    const text = [...group, w].map((g) => g.text.trim()).join(' ');
    const tooLong = text.length > opts.maxChars;
    const tooSlow = group.length > 0 && w.end - group[0]!.start > opts.maxDurationSec;
    const gap = group.length > 0 && w.start - group[group.length - 1]!.end > 0.6;
    if (group.length > 0 && (tooLong || tooSlow || gap)) flush();
    group.push(w);
    if (/[.!?]$/.test(w.text.trim())) flush();
  }
  flush();
  return captions;
}
```

**Passo 4.** `npx vitest run tests/captions.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: group words into short captions`

---

## Tarefa 6 — Matemática de render

Curvas de animação, recorte cover 16:9 → 9:16, área segura do Reels e quebra de texto.

**Arquivos:** criar `src/render/easing.ts`, `src/render/layout.ts`; teste `tests/render-math.test.ts`.

**Passo 1 — teste que falha.**

`tests/render-math.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { easeOutBack, easeOutCubic, progress } from '../src/render/easing';
import { coverCrop, reelsSafeArea, wrapText } from '../src/render/layout';

describe('easing', () => {
  it('começa em 0 e termina em 1', () => {
    for (const f of [easeOutCubic, easeOutBack]) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
  });
  it('progress satura fora do intervalo', () => {
    expect(progress(-1, 0, 1)).toBe(0);
    expect(progress(0.5, 0, 1)).toBe(0.5);
    expect(progress(9, 0, 1)).toBe(1);
  });
});

describe('layout', () => {
  it('recorta vídeo horizontal 16:9 para 9:16 pelo centro', () => {
    const r = coverCrop(1920, 1080, 1080, 1920);
    expect(r.h).toBe(1080);
    expect(r.w).toBeCloseTo(607.5, 3);
    expect(r.x).toBeCloseTo((1920 - 607.5) / 2, 3);
  });
  it('vídeo já vertical não é recortado', () => {
    expect(coverCrop(1080, 1920, 1080, 1920)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });
  it('área segura fica dentro do quadro', () => {
    const a = reelsSafeArea(1080, 1920);
    expect(a.y + a.h).toBeLessThan(1920);
    expect(a.x + a.w).toBeLessThanOrEqual(1080);
  });
  it('quebra texto por largura', () => {
    expect(wrapText('um dois tres quatro', 9, (s) => s.length)).toEqual(['um dois', 'tres', 'quatro']);
  });
});
```

**Passo 2.** `npx vitest run tests/render-math.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/render/easing.ts`

```ts
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInCubic = (x: number) => Math.pow(clamp01(x), 3);
export const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = clamp01(x);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Progresso 0..1 de `t` dentro de [start, start+dur]. */
export const progress = (t: number, start: number, dur: number) => (dur <= 0 ? 1 : clamp01((t - start) / dur));
```

`src/render/layout.ts`

```ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Recorte do quadro de origem que preenche o destino sem distorcer (object-fit: cover, centralizado). */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const w = srcH * dstRatio;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / dstRatio;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

/** Área onde texto não é coberto pela interface do Instagram Reels (margens conservadoras). */
export function reelsSafeArea(w: number, h: number): Rect {
  const top = Math.round(h * 0.12);
  const bottom = Math.round(h * 0.22);
  const side = Math.round(w * 0.06);
  return { x: side, y: top, w: w - 2 * side, h: h - top - bottom };
}

/** Quebra texto em linhas que cabem em maxWidth, usando a função de medida do canvas. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
```

**Passo 4.** `npx vitest run tests/render-math.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: add easing and Reels layout helpers`

---

## Tarefa 7 — Cena título cinético e drawFrame

A função única que desenha cada quadro (vídeo, cenas, legenda). Usada pela prévia e pela exportação.

**Arquivos:** criar `src/render/scenes.ts`, `src/render/frame.ts`; teste `tests/frame.test.ts`.

**Passo 1 — teste que falha.**

`tests/frame.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { activeAt } from '../src/render/frame';

describe('activeAt', () => {
  it('inclui o início e exclui o fim', () => {
    const items = [{ start: 0, end: 1 }, { start: 1, end: 2 }];
    expect(activeAt(items, 1)).toEqual([{ start: 1, end: 2 }]);
    expect(activeAt(items, 2)).toEqual([]);
  });
});
```

**Passo 2.** `npx vitest run tests/frame.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/render/scenes.ts`

```ts
import type { SceneInstance } from '../core/types';
import { easeInCubic, easeOutBack, progress } from './easing';
import { reelsSafeArea, wrapText } from './layout';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const IN = 0.35;
const OUT = 0.25;

/** Cena "título cinético": palavras sobem com overshoot, fundo em faixa, saída rápida. Função pura do tempo. */
export function drawKineticTitle(ctx: Ctx, scene: SceneInstance, t: number, w: number, h: number): void {
  const pIn = easeOutBack(progress(t, scene.start, IN));
  const pOut = easeInCubic(progress(t, scene.end - OUT, OUT));
  const alpha = Math.min(1, progress(t, scene.start, IN * 0.6)) * (1 - pOut);
  if (alpha <= 0) return;

  const safe = reelsSafeArea(w, h);
  const fontSize = Math.round(w * 0.085);
  ctx.save();
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(scene.text.toUpperCase(), safe.w * 0.9, (s) => ctx.measureText(s).width);
  const lineH = fontSize * 1.1;
  const blockH = lines.length * lineH;
  const cy = safe.y + safe.h * 0.22;
  const rise = (1 - pIn) * fontSize * 0.8;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFD400';
  const barW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fontSize * 0.8;
  ctx.fillRect(w / 2 - (barW * pIn) / 2, cy - blockH / 2 - fontSize * 0.25 + rise, barW * pIn, blockH + fontSize * 0.5);

  ctx.fillStyle = '#111111';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, cy - blockH / 2 + lineH * (i + 0.5) + rise);
  });
  ctx.restore();
}
```

`src/render/frame.ts`

```ts
import type { EditPlan } from '../core/types';
import { reelsSafeArea, wrapText } from './layout';
import { drawKineticTitle } from './scenes';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function activeAt<T extends { start: number; end: number }>(items: T[], t: number): T[] {
  return items.filter((i) => t >= i.start && t < i.end);
}

/**
 * Desenha um quadro do vídeo final no instante `t` (tempo de saída).
 * `source` já vem recortado/escalado para o tamanho de saída.
 * A mesma função serve para a prévia e para a exportação: é isso que garante prévia = MP4.
 */
export function drawFrame(ctx: Ctx, plan: EditPlan, t: number, source: CanvasImageSource | null): void {
  const { width: w, height: h } = plan.output;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (source) ctx.drawImage(source, 0, 0, w, h);

  for (const scene of activeAt(plan.scenes, t)) drawKineticTitle(ctx, scene, t, w, h);

  const caption = activeAt(plan.captions, t)[0];
  if (caption) drawCaption(ctx, caption.text, w, h);
}

function drawCaption(ctx: Ctx, text: string, w: number, h: number): void {
  const safe = reelsSafeArea(w, h);
  const fontSize = Math.round(w * 0.062);
  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const lines = wrapText(text, safe.w, (s) => ctx.measureText(s).width);
  const lineH = fontSize * 1.2;
  const baseY = safe.y + safe.h - lines.length * lineH;
  lines.forEach((line, i) => {
    const y = baseY + lineH * (i + 0.5);
    ctx.lineWidth = fontSize * 0.18;
    ctx.strokeStyle = '#000';
    ctx.strokeText(line, w / 2, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, w / 2, y);
  });
  ctx.restore();
}
```

**Passo 4.** `npx vitest run tests/frame.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: add kinetic title scene and frame compositor`

---

## Tarefa 8 — Edição automática por regras

Junta cortes, legendas e um título de abertura com as primeiras palavras da primeira frase.

**Arquivos:** criar `src/editorial/auto-edit.ts`; teste `tests/auto-edit.test.ts`.

**Passo 1 — teste que falha.**

`tests/auto-edit.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';
import { autoEdit, openingTitle } from '../src/editorial/auto-edit';

const w = (id: string, text: string, start: number, end: number) => ({ id, text, start, end });

describe('autoEdit', () => {
  const words = [w('1', 'Três', 0.1, 0.4), w('2', 'dicas', 0.4, 0.8), w('3', 'rápidas.', 0.8, 1.2), w('4', 'Primeiro', 2.6, 3.0)];

  it('gera um plano válido pelo schema', () => {
    const plan = autoEdit(4, [{ start: 1.3, end: 2.5 }], words);
    expect(parseEditPlan(plan).ok).toBe(true);
    expect(plan.segments).toHaveLength(2);
    expect(plan.scenes[0]?.text).toBe('Três dicas rápidas');
  });

  it('título para na primeira frase', () => {
    expect(openingTitle([w('1', 'Oi.', 0, 0.2), w('2', 'Tudo', 0.3, 0.5)])).toBe('Oi');
  });

  it('sem fala não cria título', () => {
    expect(autoEdit(3, [], []).scenes).toEqual([]);
  });
});
```

**Passo 2.** `npx vitest run tests/auto-edit.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/editorial/auto-edit.ts`

```ts
import { REELS_PROFILE, type EditPlan, type SceneInstance, type TimeRange, type Word } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { buildCaptions } from './captions';
import { planKeepSegments } from './cuts';

/**
 * Edição automática da Fase 1, 100% por regras (sem IA):
 * corta silêncios longos, gera legendas e abre com um título cinético
 * usando as primeiras palavras da primeira frase.
 */
export function autoEdit(durationSec: number, silences: TimeRange[], words: Word[]): EditPlan {
  const segments = planKeepSegments(durationSec, silences, words);
  const captions = buildCaptions(words, segments);
  const total = outputDuration(segments);
  const scenes: SceneInstance[] = [];
  const title = openingTitle(words);
  if (title && total > 1.5) {
    scenes.push({ id: 's1', kind: 'kinetic-title', text: title, start: 0, end: Math.min(2.2, total) });
  }
  return { version: 1, output: REELS_PROFILE, segments, captions, scenes };
}

export function openingTitle(words: Word[], maxWords = 4): string | null {
  const picked: string[] = [];
  for (const w of words) {
    const clean = w.text.trim();
    if (!clean) continue;
    picked.push(clean.replace(/[.,!?;:]+$/, ''));
    if (picked.length >= maxWords || /[.!?]$/.test(clean)) break;
  }
  const text = picked.join(' ').trim();
  return text.length > 0 ? text.slice(0, 60) : null;
}
```

**Passo 4.** `npx vitest run tests/auto-edit.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: add rule-based auto edit`

---

## Tarefa 9 — Emenda de áudio

Concatena os trechos mantidos do áudio com fade de 8 ms em cada emenda.

**Arquivos:** criar `src/media/splice.ts`; teste `tests/splice.test.ts`.

**Passo 1 — teste que falha.**

`tests/splice.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { spliceAudio } from '../src/media/splice';

describe('spliceAudio', () => {
  it('concatena só os trechos mantidos', () => {
    const ch = Float32Array.from({ length: 10 }, (_, i) => i);
    const [out] = spliceAudio([ch], 10, [{ srcStart: 0, srcEnd: 0.3 }, { srcStart: 0.6, srcEnd: 0.8 }], 0);
    expect(Array.from(out!)).toEqual([0, 1, 2, 6, 7]);
  });

  it('aplica fade nas emendas', () => {
    const ch = new Float32Array(100).fill(1);
    const [out] = spliceAudio([ch], 100, [{ srcStart: 0, srcEnd: 0.5 }, { srcStart: 0.5, srcEnd: 1 }], 0.05);
    expect(out![0]).toBe(0);
    expect(out![49]).toBe(0);
    expect(out![25]).toBe(1);
  });
});
```

**Passo 2.** `npx vitest run tests/splice.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/media/splice.ts`

```ts
import type { Segment } from '../core/types';

/**
 * Junta os trechos mantidos de cada canal de áudio, com fade curto
 * em cada emenda para não estalar.
 */
export function spliceAudio(channels: Float32Array[], sampleRate: number, segments: Segment[], fadeSec = 0.008): Float32Array[] {
  const ranges = segments.map((s) => [Math.round(s.srcStart * sampleRate), Math.round(s.srcEnd * sampleRate)] as const);
  const total = ranges.reduce((acc, [a, b]) => acc + (b - a), 0);
  const fade = Math.round(fadeSec * sampleRate);
  return channels.map((ch) => {
    const out = new Float32Array(total);
    let o = 0;
    for (const [a, b] of ranges) {
      const len = Math.max(0, Math.min(b, ch.length) - a);
      out.set(ch.subarray(a, a + len), o);
      for (let i = 0; i < Math.min(fade, len); i++) {
        const g = i / fade;
        out[o + i]! *= g;
        out[o + len - 1 - i]! *= g;
      }
      o += b - a;
    }
    return out;
  });
}
```

**Passo 4.** `npx vitest run tests/splice.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: splice audio with click-free fades`

---

## Tarefa 10 — Palavras do Whisper

Normaliza a saída do Whisper em `Word` com ids estáveis.

**Arquivos:** criar `src/asr/words.ts`; teste `tests/words.test.ts`.

**Passo 1 — teste que falha.**

`tests/words.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { chunksToWords } from '../src/asr/words';

describe('chunksToWords', () => {
  it('limpa espaços, numera e trata fim ausente', () => {
    const words = chunksToWords(
      [
        { text: ' Olá', timestamp: [0, 0.4] },
        { text: ' ', timestamp: [0.4, 0.5] },
        { text: ' mundo.', timestamp: [0.5, null] },
      ],
      10,
    );
    expect(words).toEqual([
      { id: 'w1', text: 'Olá', start: 0, end: 0.4 },
      { id: 'w2', text: 'mundo.', start: 0.5, end: 0.8 },
    ]);
  });
});
```

**Passo 2.** `npx vitest run tests/words.test.ts` → FALHA (módulo inexistente).

**Passo 3 — implementação.**

`src/asr/words.ts`

```ts
import type { Word } from '../core/types';

export interface AsrChunk {
  text: string;
  timestamp: [number, number | null];
}

/** Converte a saída do Whisper (chunks por palavra) em Words com ids estáveis. */
export function chunksToWords(chunks: AsrChunk[], durationSec: number): Word[] {
  const words: Word[] = [];
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text) continue;
    const start = Math.max(0, c.timestamp[0]);
    const end = Math.min(durationSec, c.timestamp[1] ?? start + 0.3);
    if (end <= start) continue;
    words.push({ id: `w${words.length + 1}`, text, start, end });
  }
  return words;
}
```

**Passo 4.** `npx vitest run tests/words.test.ts` → PASSA. `npm run typecheck` → sem erros.

**Commit:** `feat: convert Whisper word chunks to words`

---

## Tarefa 11 — Leitura do vídeo e do áudio (navegador)

Abre o arquivo local com Mediabunny, recusa formatos ilegíveis e vídeos acima de 3 min, decodifica o áudio e gera a versão mono 16 kHz para análise e transcrição. Sem teste de unidade (depende de WebCodecs); coberto pelo teste de ponta a ponta da Tarefa 15.

`src/media/input.ts`

```ts
import { ALL_FORMATS, BlobSource, Input, type InputAudioTrack, type InputVideoTrack } from 'mediabunny';

export interface OpenedMedia {
  input: Input;
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  durationSec: number;
  width: number;
  height: number;
}

export class MediaError extends Error {}

/** Abre o arquivo local sem enviar nada para servidor nenhum. */
export async function openMedia(file: Blob): Promise<OpenedMedia> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  if (!(await input.canRead())) throw new MediaError('Formato de arquivo não reconhecido.');
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new MediaError('O arquivo não tem vídeo.');
  if (!(await video.canDecode())) throw new MediaError('Este navegador não consegue ler o vídeo deste arquivo.');
  const audio = await input.getPrimaryAudioTrack();
  const durationSec = await input.computeDuration();
  if (durationSec > 180) throw new MediaError('Nesta versão de teste o vídeo pode ter no máximo 3 minutos.');
  return { input, video, audio, durationSec, width: video.displayWidth, height: video.displayHeight };
}
```

`src/media/audio.ts`

```ts
import { AudioBufferSink, type InputAudioTrack } from 'mediabunny';

export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Decodifica o áudio inteiro (limite de 3 min na Fase 1 mantém isso em memória). */
export async function decodeAudio(track: InputAudioTrack, durationSec: number): Promise<DecodedAudio> {
  const sampleRate = track.sampleRate;
  const numCh = Math.min(2, track.numberOfChannels);
  const total = Math.ceil(durationSec * sampleRate);
  const channels = Array.from({ length: numCh }, () => new Float32Array(total));
  const sink = new AudioBufferSink(track);
  for await (const { buffer, timestamp } of sink.buffers()) {
    const offset = Math.round(timestamp * sampleRate);
    for (let c = 0; c < numCh; c++) {
      const data = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const start = Math.max(0, offset);
      const skip = start - offset;
      const len = Math.min(data.length - skip, total - start);
      if (len > 0) channels[c]!.set(data.subarray(skip, skip + len), start);
    }
  }
  return { channels, sampleRate };
}

/** Mono 16 kHz para o Whisper e para a análise de silêncio. */
export async function toMono16k(audio: DecodedAudio): Promise<Float32Array> {
  const len = audio.channels[0]!.length;
  const mono = new Float32Array(len);
  for (const ch of audio.channels) for (let i = 0; i < len; i++) mono[i]! += ch[i]! / audio.channels.length;
  const outLen = Math.ceil((len * 16000) / audio.sampleRate);
  const ctx = new OfflineAudioContext(1, outLen, 16000);
  const buf = ctx.createBuffer(1, len, audio.sampleRate);
  buf.copyToChannel(mono, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}
```

**Verificação:** `npm run typecheck` → sem erros.

**Commit:** `feat: open local media and decode audio`

---

## Tarefa 12 — Codecs e exportação MP4

Escolhe H.264 quando existir, senão VP9/AV1 com aviso; registra o encoder AAC em WASM só se o navegador não tiver um. A exportação percorre cada quadro de saída, pede ao Mediabunny o quadro do original correspondente (já em cover 1080×1920), desenha com `drawFrame` e codifica; o áudio é emendado com `spliceAudio`.

`src/media/codecs.ts`

```ts
import { canEncodeAudio, canEncodeVideo, type VideoCodec } from 'mediabunny';

export interface CodecChoice {
  video: VideoCodec;
  /** true quando caímos fora do H.264: o MP4 abre no navegador, mas alguns apps podem recusar. */
  degraded: boolean;
}

let aacReady = false;

export async function chooseCodecs(width: number, height: number): Promise<CodecChoice> {
  if (!aacReady && !(await canEncodeAudio('aac'))) {
    // encoder AAC em WebAssembly, carregado só quando o navegador não tem um nativo
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
  }
  aacReady = true;
  for (const video of ['avc', 'vp9', 'av1'] as const) {
    if (await canEncodeVideo(video, { width, height })) return { video, degraded: video !== 'avc' };
  }
  throw new Error('Este navegador não consegue gerar vídeo. Use o Chrome ou o Edge atualizados no computador.');
}
```

`src/media/export.ts`

```ts
import { AudioBufferSource, BufferTarget, CanvasSink, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import type { EditPlan } from '../core/types';
import { outputDuration, outputToSource } from '../engine/timeline';
import { drawFrame } from '../render/frame';
import type { DecodedAudio } from './audio';
import { chooseCodecs } from './codecs';
import type { OpenedMedia } from './input';
import { spliceAudio } from './splice';

export interface ExportOptions {
  /** Exporta só os primeiros N segundos (prévia rápida). */
  maxDurationSec?: number;
  /** 1 = 1080x1920; 0.5 = prévia leve. */
  scale?: number;
  onProgress?: (fraction: number) => void;
}

export interface ExportResult {
  blob: Blob;
  degraded: boolean;
  codec: string;
}

export async function exportPlan(media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, opts: ExportOptions = {}): Promise<ExportResult> {
  const scale = opts.scale ?? 1;
  const width = even(plan.output.width * scale);
  const height = even(plan.output.height * scale);
  const fps = plan.output.fps;
  const duration = Math.min(outputDuration(plan.segments), opts.maxDurationSec ?? Infinity);
  const frames = Math.floor(duration * fps);
  const codecs = await chooseCodecs(width, height);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = audio ? new AudioBufferSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const sink = new CanvasSink(media.video, { width: plan.output.width, height: plan.output.height, fit: 'cover', poolSize: 2 });
  const srcTimes = function* () {
    for (let i = 0; i < frames; i++) yield outputToSource(plan.segments, i / fps) ?? 0;
  };
  let i = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(srcTimes())) {
    const t = i / fps;
    drawFrame(ctx, plan, t, wrapped?.canvas ?? null);
    await videoSource.add(t, 1 / fps);
    i++;
    if (i % 10 === 0) opts.onProgress?.((i / frames) * 0.95);
  }

  if (audio && audioSource) {
    const trimmed = trimSegments(plan.segments, duration);
    const spliced = spliceAudio(audio.channels, audio.sampleRate, trimmed);
    const buffer = new AudioBuffer({ length: spliced[0]!.length, numberOfChannels: spliced.length, sampleRate: audio.sampleRate });
    spliced.forEach((ch, c) => buffer.copyToChannel(ch as Float32Array<ArrayBuffer>, c));
    await audioSource.add(buffer);
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video };
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function trimSegments(segments: EditPlan['segments'], maxOut: number): EditPlan['segments'] {
  const out: EditPlan['segments'] = [];
  let acc = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (acc + len <= maxOut) out.push(s);
    else {
      if (maxOut - acc > 0) out.push({ srcStart: s.srcStart, srcEnd: s.srcStart + (maxOut - acc) });
      break;
    }
    acc += len;
  }
  return out;
}
```

**Verificação:** `npm run typecheck` → sem erros.

**Commit:** `feat: export edit plan to MP4 with WebCodecs`

---

## Tarefa 13 — Transcrição em Worker

Whisper roda fora da thread da interface. Tenta WebGPU e cai para WASM quantizado. `FakeTranscriber` existe só para o teste automático (`VITE_FAKE_ASR=1`), que não pode baixar modelo.

`src/asr/protocol.ts`

```ts
import type { AsrChunk } from './words';

export type ToWorker = { type: 'transcribe'; audio: Float32Array; language: string };
export type FromWorker =
  | { type: 'progress'; stage: 'download' | 'transcribe'; fraction: number }
  | { type: 'done'; chunks: AsrChunk[]; device: string }
  | { type: 'error'; message: string };
```

`src/asr/whisper.worker.ts`

```ts
/// <reference lib="webworker" />
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { FromWorker, ToWorker } from './protocol';
import type { AsrChunk } from './words';

/** Modelo multilíngue pequeno; baixado uma vez e guardado no cache do navegador. */
export const MODEL_ID = 'onnx-community/whisper-base_timestamped';

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let device = 'wasm';

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (asr) return asr;
  device = 'gpu' in navigator ? 'webgpu' : 'wasm';
  const files = new Map<string, number>();
  const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
    if (p.status === 'progress' && p.file) {
      files.set(p.file, p.progress ?? 0);
      const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size / 100;
      post({ type: 'progress', stage: 'download', fraction: avg });
    }
  };
  try {
    asr = (await pipeline('automatic-speech-recognition', MODEL_ID, { device: device as 'webgpu', dtype: 'fp32', progress_callback })) as AutomaticSpeechRecognitionPipeline;
  } catch {
    device = 'wasm';
    asr = (await pipeline('automatic-speech-recognition', MODEL_ID, { device: 'wasm', dtype: 'q8', progress_callback })) as AutomaticSpeechRecognitionPipeline;
  }
  return asr;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  try {
    const model = await load();
    post({ type: 'progress', stage: 'transcribe', fraction: 0 });
    const out = await model(e.data.audio, {
      language: e.data.language,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const result = Array.isArray(out) ? out[0]! : out;
    post({ type: 'done', chunks: (result.chunks ?? []) as AsrChunk[], device });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
```

`src/asr/transcriber.ts`

```ts
import type { Word } from '../core/types';
import type { FromWorker } from './protocol';
import { chunksToWords, type AsrChunk } from './words';

export interface Transcriber {
  transcribe(audio16k: Float32Array, durationSec: number, onProgress: (label: string, fraction: number) => void): Promise<Word[]>;
}

export class WhisperTranscriber implements Transcriber {
  transcribe(audio16k: Float32Array, durationSec: number, onProgress: (label: string, fraction: number) => void): Promise<Word[]> {
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data;
        if (m.type === 'progress') onProgress(m.stage === 'download' ? 'Baixando o modelo de transcrição (só na primeira vez)' : 'Transcrevendo a fala', m.fraction);
        if (m.type === 'done') {
          worker.terminate();
          resolve(chunksToWords(m.chunks, durationSec));
        }
        if (m.type === 'error') {
          worker.terminate();
          reject(new Error(m.message));
        }
      };
      worker.postMessage({ type: 'transcribe', audio: audio16k, language: 'portuguese' }, [audio16k.buffer]);
    });
  }
}

/** Usado só nos testes automáticos (VITE_FAKE_ASR=1): palavras fixas, sem baixar modelo. */
export class FakeTranscriber implements Transcriber {
  constructor(private chunks: AsrChunk[]) {}
  async transcribe(_audio: Float32Array, durationSec: number): Promise<Word[]> {
    return chunksToWords(this.chunks, durationSec);
  }
}

export const FAKE_CHUNKS: AsrChunk[] = [
  { text: ' Três', timestamp: [0.1, 0.5] },
  { text: ' dicas', timestamp: [0.5, 0.9] },
  { text: ' rápidas.', timestamp: [0.9, 1.4] },
  { text: ' Primeira', timestamp: [3.1, 3.6] },
  { text: ' dica.', timestamp: [3.6, 4.2] },
];
```

**Verificação:** `npm run typecheck` → sem erros.

**Commit:** `feat: add Whisper transcription worker`

---

## Tarefa 14 — Pipeline e interface

`analyze` executa: abrir → áudio → silêncios → transcrição → `autoEdit`. A interface tem um só fluxo: escolher vídeo, ver resumo, prévia de 10 s, gerar vídeo final, baixar.

`src/app/pipeline.ts`

```ts
import type { EditPlan } from '../core/types';
import { findSilences } from '../analysis/silence';
import { autoEdit } from '../editorial/auto-edit';
import { decodeAudio, toMono16k, type DecodedAudio } from '../media/audio';
import { openMedia, type OpenedMedia } from '../media/input';
import type { Transcriber } from '../asr/transcriber';

export interface Analysis {
  media: OpenedMedia;
  audio: DecodedAudio | null;
  plan: EditPlan;
  wordCount: number;
}

/** Passo a passo da Fase 1: abrir -> áudio -> silêncios -> transcrição -> plano automático. */
export async function analyze(file: File, transcriber: Transcriber, onStep: (label: string, fraction: number) => void): Promise<Analysis> {
  onStep('Abrindo o vídeo', 0);
  const media = await openMedia(file);
  if (!media.audio) {
    const plan = autoEdit(media.durationSec, [], []);
    return { media, audio: null, plan, wordCount: 0 };
  }
  onStep('Lendo o áudio', 0);
  const audio = await decodeAudio(media.audio, media.durationSec);
  const mono = await toMono16k(audio);
  onStep('Procurando silêncios', 0);
  const silences = findSilences(mono, 16000);
  const words = await transcriber.transcribe(mono.slice(), media.durationSec, onStep);
  const plan = autoEdit(media.durationSec, silences, words);
  return { media, audio, plan, wordCount: words.length };
}
```

`src/app/App.tsx`

```tsx
import { useMemo, useState } from 'react';
import { FAKE_CHUNKS, FakeTranscriber, WhisperTranscriber } from '../asr/transcriber';
import { outputDuration } from '../engine/timeline';
import { exportPlan } from '../media/export';
import { analyze, type Analysis } from './pipeline';

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; label: string; fraction: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

interface Result {
  url: string;
  name: string;
  degraded: boolean;
  preview: boolean;
}

export function App() {
  const transcriber = useMemo(() => (import.meta.env.VITE_FAKE_ASR === '1' ? new FakeTranscriber(FAKE_CHUNKS) : new WhisperTranscriber()), []);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const step = (label: string, fraction: number) => setStatus({ kind: 'working', label, fraction });
  const fail = (err: unknown) => setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });

  async function onFile(f: File) {
    setFile(f);
    setResult(null);
    setAnalysis(null);
    try {
      const a = await analyze(f, transcriber, step);
      setAnalysis(a);
      setStatus({ kind: 'ready' });
    } catch (err) {
      fail(err);
    }
  }

  async function onExport(preview: boolean) {
    if (!analysis || !file) return;
    try {
      step(preview ? 'Gerando prévia de 10 segundos' : 'Gerando o vídeo final', 0);
      const out = await exportPlan(analysis.media, analysis.audio, analysis.plan, {
        maxDurationSec: preview ? 10 : undefined,
        scale: preview ? 0.5 : 1,
        onProgress: (f) => step(preview ? 'Gerando prévia de 10 segundos' : 'Gerando o vídeo final', f),
      });
      if (result) URL.revokeObjectURL(result.url);
      const base = file.name.replace(/\.[^.]+$/, '');
      setResult({ url: URL.createObjectURL(out.blob), name: `${base}-motion4free${preview ? '-previa' : ''}.mp4`, degraded: out.degraded, preview });
      setStatus({ kind: 'ready' });
    } catch (err) {
      fail(err);
    }
  }

  const busy = status.kind === 'working';
  const plan = analysis?.plan;

  return (
    <main className="app">
      <h1>Motion4Free</h1>
      <p className="sub">Versão de teste: tudo acontece no seu computador. Nenhum vídeo é enviado para a internet.</p>

      <label className={`drop ${busy ? 'disabled' : ''}`}>
        <input type="file" accept="video/*" disabled={busy} data-testid="file-input" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {file ? `Vídeo: ${file.name}` : 'Clique para escolher um vídeo seu falando (até 3 minutos)'}
      </label>

      {status.kind === 'working' && (
        <div className="status" role="status">
          <span>{status.label}…</span>
          <progress value={status.fraction} max={1} />
        </div>
      )}
      {status.kind === 'error' && (
        <p className="error" role="alert">
          Algo deu errado: {status.message}
        </p>
      )}

      {analysis && plan && (
        <section className="summary" data-testid="summary">
          <p>
            Original: <b>{analysis.media.durationSec.toFixed(1)} s</b> · Editado: <b data-testid="out-duration">{outputDuration(plan.segments).toFixed(1)} s</b> ·{' '}
            {plan.segments.length} trechos · {plan.captions.length} legendas · {analysis.wordCount} palavras reconhecidas
          </p>
          <div className="actions">
            <button disabled={busy} onClick={() => onExport(true)}>
              Ver prévia (10 s)
            </button>
            <button disabled={busy} className="primary" onClick={() => onExport(false)} data-testid="export">
              Gerar vídeo final
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="result">
          <video src={result.url} controls playsInline data-testid="result-video" />
          {result.degraded && <p className="warn">Seu navegador não gera H.264. O vídeo funciona aqui, mas o Instagram pode recusar. Para o arquivo final, use Chrome ou Edge no computador.</p>}
          <a href={result.url} download={result.name} data-testid="download">
            Baixar {result.preview ? 'prévia' : 'vídeo'} ({result.name})
          </a>
        </section>
      )}
    </main>
  );
}
```

`src/app/app.css`

```css
:root { color-scheme: light dark; font-family: system-ui, sans-serif; --accent: #ffd400; }
body { margin: 0; background: Canvas; color: CanvasText; }
.app { max-width: 640px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { margin: 0 0 4px; }
.sub { opacity: 0.75; margin-top: 0; }
.drop { display: block; border: 2px dashed currentColor; border-radius: 12px; padding: 32px 16px; text-align: center; cursor: pointer; margin: 24px 0; }
.drop input { display: none; }
.drop.disabled { opacity: 0.5; cursor: progress; }
.status { display: grid; gap: 8px; margin: 16px 0; }
.status progress { width: 100%; }
.error { color: #d33; }
.warn { color: #b80; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
button { font: inherit; padding: 10px 16px; border-radius: 8px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
button.primary { background: var(--accent); color: #111; border-color: var(--accent); font-weight: 700; }
button:disabled { opacity: 0.5; cursor: progress; }
.result video { width: 100%; max-height: 70vh; background: #000; border-radius: 12px; margin: 16px 0 8px; }
```

`src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Verificação:** `npm run build` termina e imprime `removido ort-wasm-…wasm`; `npm run dev`, abrir `http://localhost:5173` no Chrome e escolher um vídeo curto: o resumo aparece e "Gerar vídeo final" baixa um MP4.

**Commit:** `feat: add Phase 1 UI and analysis pipeline`

---

## Tarefa 15 — Teste de ponta a ponta

Gera um vídeo de teste (tom com pausas), sobe o site com transcrição falsa, exporta e confere o MP4 baixado com o próprio Mediabunny em Node: 1080×1920, faixa AAC e duração igual à mostrada na tela.

`scripts/make-fixture.sh`

```bash
#!/usr/bin/env bash
# Gera um vídeo de teste de 6 s: tom em 0–1.4 s e 3.0–4.3 s, silêncio no resto.
# VP9/Opus porque o Chromium do Playwright não lê H.264; o Chrome de verdade lê os dois.
set -euo pipefail
mkdir -p e2e/fixtures
ffmpeg -y -loglevel error \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=6" \
  -f lavfi -i "sine=frequency=220:sample_rate=48000:duration=6" \
  -filter_complex "[1:a]volume='if(between(t,0,1.4)+between(t,3.0,4.3),0.5,0)':eval=frame[a]" \
  -map 0:v -map "[a]" -c:v libvpx-vp9 -b:v 1M -deadline realtime -c:a libopus -shortest e2e/fixtures/fala-com-pausas.webm
```

`playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run build:e2e && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
```

`e2e/primeiro-mp4.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';

test('vídeo com pausas vira MP4 editado, mais curto, com áudio', async ({ page }, info) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');

  const outDuration = page.getByTestId('out-duration');
  await expect(outDuration).toBeVisible({ timeout: 60_000 });
  const shown = Number((await outDuration.textContent())!.replace(' s', ''));
  expect(shown).toBeGreaterThan(2.5);
  expect(shown).toBeLessThan(3.6);

  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const path = info.outputPath('saida.mp4');
  await file.saveAs(path);

  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect(audio?.codec).toBe('aac');
  expect(Math.abs((await input.computeDuration()) - shown)).toBeLessThan(0.2);
});
```

**Passo 1.** `npm run fixture && npm run e2e` → 1 passed.
Neste ambiente sem Chromium padrão, usar `CHROMIUM_PATH=/caminho/do/chrome npm run e2e`.

**Commit:** `test: add end-to-end export test`

---

## Tarefa 16 — CI e build de hospedagem

`scripts/prune-dist.mjs`

```js
// Cloudflare Pages aceita no máximo 25 MiB por arquivo. O runtime ONNX já é
// carregado do CDN jsdelivr pelo Transformers.js, então a cópia local é removida.
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/assets';
const LIMIT = 25 * 1024 * 1024;
for (const name of readdirSync(dir)) {
  const path = join(dir, name);
  const size = statSync(path).size;
  if (size > LIMIT) {
    if (!name.startsWith('ort-wasm')) throw new Error(`Arquivo grande inesperado no build: ${name} (${size} bytes)`);
    unlinkSync(path);
    console.log(`removido ${name} (${(size / 1048576).toFixed(1)} MiB), servido pelo CDN`);
  }
}
```

`.github/workflows/app-ci.yml`

```yaml
name: App
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Gerar vídeo de teste
        run: |
          sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg
          npm run fixture
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
          retention-days: 7
```

**Verificação:** abrir o PR e confirmar o job `App` verde (typecheck, unidade, build, ponta a ponta).

**Commit:** `ci: run unit and end-to-end tests on every PR`

---

## Tarefa 17 — Documentação de desenvolvimento

- A `LICENSE` (MIT) já entrou na Fase 0; conferir que existe.
- No `README.md`, seção "Rodar localmente": `npm install`, `npm run dev`, `npm test`, `npm run fixture && npm run e2e`.
- Atualizar `docs/quality.md` com os comandos que agora existem.

**Commit:** `docs: document local development commands`

---

## Tarefa 18 — Publicar (ação única do murilo) e teste real

**Passo a passo para conectar a hospedagem (uma vez só, sem custo):**
1. Criar conta grátis em <https://dash.cloudflare.com/sign-up>.
2. No painel: **Workers & Pages → Create → Pages → Connect to Git**.
3. Autorizar o GitHub e escolher o repositório `murilaiooo/motion4free`.
4. Configurar: *Framework preset* = `None`; *Build command* = `npm run build`; *Build output directory* = `dist`; em *Environment variables* adicionar `NODE_VERSION` = `22`.
5. Clicar em **Save and Deploy**. O endereço fica parecido com `motion4free.pages.dev`, e cada PR passa a ganhar um link de prévia próprio.

**Teste real (gate da Fase 1, roteiro no [plano mestre](2026-10-20-plano-mestre.md#fase-1--primeiro-mp4)):** três vídeos reais exportados em H.264 no Chrome/Edge, abertos no celular, sem cortes comendo palavras, legendas ≥ 90% corretas, tempos de análise e exportação anotados.

**Se o teste real falhar:** cada problema vira uma tarefa nova neste plano, com teste que reproduz o caso antes da correção.

---

## Autorrevisão do plano
- Cobre todos os P0 técnicos da [spec v1](../specs/2026-10-20-motion4free-v1-design.md#6-fases-resumo-detalhes-no-plano-mestre) para a Fase 1: importar local, inspecionar, transcrever com tempo por palavra, cortar silêncio sem mutilar palavra, plano não destrutivo, legenda, uma cena sincronizada, exportação real, verificação do arquivo.
- Fica para a Fase 2: salvar/reabrir projeto e player em tempo real com som.
- Nomes usados nas tarefas tardias (`autoEdit`, `drawFrame`, `exportPlan`, `spliceAudio`, `chunksToWords`, `parseEditPlan`) batem com as definições das tarefas anteriores.
- Nenhum passo depende de serviço pago ou de chave.
