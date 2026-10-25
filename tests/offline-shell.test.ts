import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GENERATOR = resolve('scripts/generate-offline-shell.mjs');

describe('partial offline app-shell generation (#4)', () => {
  it('caches only same-origin hashed static code and never model workers or user data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'm4f-sw-test-'));
    try {
      mkdirSync(join(dir, 'assets'));
      writeFileSync(join(dir, 'index.html'), '<script src="./assets/index-123.js"></script>');
      writeFileSync(join(dir, 'assets', 'index-123.js'), 'console.log("hello")');
      writeFileSync(join(dir, 'assets', 'layout-456.css'), '.app{}');
      writeFileSync(join(dir, 'assets', 'whisper.worker-5.js'), 'never cache');
      writeFileSync(join(dir, 'assets', 'webllm.worker-5.js'), 'never cache');
      writeFileSync(join(dir, 'assets', 'private.key'), 'private');
      const output = execFileSync('node', [GENERATOR, dir], { encoding: 'utf8' });
      const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
      expect(output).toContain('same origin');
      expect(sw).toContain('./assets/index-123.js');
      expect(sw).toContain('./assets/layout-456.css');
      expect(sw).not.toContain('whisper.worker-5');
      expect(sw).not.toContain('webllm.worker-5');
      expect(sw).not.toContain('private.key');
      expect(sw).toContain("if (url.origin !== self.location.origin) return");
      expect(sw).toContain("if (req.method !== 'GET') return");
      expect(sw).toContain("if (!ASSETS.has(url.pathname) || url.search) return");
      const first = sw;
      execFileSync('node', [GENERATOR, dir]);
      expect(readFileSync(join(dir, 'sw.js'), 'utf8')).toBe(first);
      writeFileSync(join(dir, 'index.html'), '<script src="./assets/index-abc.js"></script>');
      execFileSync('node', [GENERATOR, dir]);
      expect(readFileSync(join(dir, 'sw.js'), 'utf8')).not.toBe(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
