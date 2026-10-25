import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Standalone Node .mjs CLI is deliberately not TypeScript-compiled.
import { inspectDist, MAX_ASSET_BYTES } from '../scripts/check-dist.mjs';

let dir: string | undefined;
function fresh(): string {
  dir = mkdtempSync(join(tmpdir(), 'm4f-release-'));
  return dir;
}
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = undefined; });

describe('production build asset gate', () => {
  it('accepts nested ordinary assets and required index', () => {
    const root = fresh();
    mkdirSync(join(root, 'assets', 'nested'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '<html></html>');
    writeFileSync(join(root, 'assets', 'nested', 'app.js'), 'console.log(1)');
    expect(inspectDist(root)).toEqual([]);
  });

  it('rejects missing index and nested files exceeding the Workers asset limit', () => {
    const root = fresh();
    mkdirSync(join(root, 'assets'), { recursive: true });
    writeFileSync(join(root, 'assets', 'huge.wasm'), 'x'.repeat(12));
    expect(inspectDist(root, 10)).toEqual([
      'Missing dist/index.html.',
      'Cloudflare per-file limit exceeded: assets/huge.wasm (12 bytes)',
    ]);
    expect(MAX_ASSET_BYTES).toBe(25 * 1024 * 1024);
  });

  it('rejects accidentally bundled credentials and diagnostic logs', () => {
    const root = fresh();
    writeFileSync(join(root, 'index.html'), '<html></html>');
    writeFileSync(join(root, '.env.production'), 'DUMMY=1');
    writeFileSync(join(root, 'debug.log'), 'test');
    expect(inspectDist(root)).toEqual([
      'Sensitive or diagnostic file must not be published: .env.production',
      'Sensitive or diagnostic file must not be published: debug.log',
    ]);
  });
});
