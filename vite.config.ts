import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Commit do build: variável da Cloudflare (Workers Builds) ou git local. */
function commit(): string {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'local';
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // O parakeet.js importa `onnxruntime-web`; o Transformers.js usa `onnxruntime-web/webgpu`. Apontar os
    // dois para a mesma entrada evita carregar o runtime (e o .wasm de ~25 MB) duas vezes (ADR-0039).
    alias: [{ find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/webgpu' }],
  },
  worker: { format: 'es' },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
