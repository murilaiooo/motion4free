import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Synthetic media used by the E2E suites. They are not tracked by Git (see .gitignore);
 * this setup generates the missing ones with FFmpeg before any test runs (#155), so a
 * fresh checkout does not fail with ENOENT halfway through a test.
 */
export const E2E_FIXTURES = [
  'fala-com-pausas.webm',
  'sem-audio.webm',
  'curto.webm',
  'clip-red.webm',
  'clip-blue.webm',
] as const;

export default function globalSetup(): void {
  const missing = E2E_FIXTURES.filter((name) => !existsSync(join('e2e', 'fixtures', name)));
  if (missing.length === 0) return;
  const result = spawnSync(process.execPath, ['scripts/make-fixture.mjs'], { stdio: 'inherit', windowsHide: true });
  const still = E2E_FIXTURES.filter((name) => !existsSync(join('e2e', 'fixtures', name)));
  if (result.status !== 0 || still.length > 0) {
    throw new Error(
      `[SETUP] E2E fixtures missing (${still.join(', ') || missing.join(', ')}). ` +
        'Install FFmpeg (in PATH) and run "npm run fixture". This is an environment problem, not a product regression.',
    );
  }
}
