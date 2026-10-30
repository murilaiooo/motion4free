import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { generateOfflineShell } from './generate-offline-shell.mjs';

process.env.VITE_FAKE_ASR = '1';
await build();
// O E2E deve verificar exatamente o mesmo inventário de recursos do build
// publicado: sem WASM ONNX externo enorme e sem assets sem licença aprovada.
await import('./prune-dist.mjs');
generateOfflineShell();
execFileSync(process.execPath, ['scripts/audit-licenses.mjs', '--dist'], { stdio: 'inherit' });
