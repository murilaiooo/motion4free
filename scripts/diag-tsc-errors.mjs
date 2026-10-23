import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const run = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'], {
  cwd: process.cwd(), encoding: 'utf8', timeout: 180000, maxBuffer: 5 * 1024 * 1024,
});
const report = [
  'DIAGNOSTIC ONLY, DO NOT SHIP IN MAIN',
  'tsc_exit_code=' + run.status,
  'execution_error=' + (run.error?.message || 'none'),
  (run.stdout || '').slice(0, 120000),
  (run.stderr || '').slice(0, 12000),
].join('\n');
writeFileSync('dist/qa102-typecheck-only.txt', report);
console.log('[diagnostic] TypeScript result collected in preview artifact (not production)');
