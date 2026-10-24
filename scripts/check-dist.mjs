// Non-destructive Cloudflare Workers Assets preflight.
// Vite's generated assets must not expose secrets or exceed Cloudflare's per-file limit.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

export function inspectDist(directory, maxBytes = MAX_ASSET_BYTES) {
  const problems = [];
  if (!existsSync(join(directory, 'index.html'))) problems.push('Missing dist/index.html.');
  if (!existsSync(directory)) return problems;

  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const fullPath = join(folder, entry.name);
      const name = relative(directory, fullPath).split(sep).join('/');
      if (entry.isSymbolicLink()) {
        problems.push(`Unexpected symbolic link in output: ${name}`);
      } else if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        if (/(^|\/)(?:\.env(?:\..*)?|\.git(?:\/|$)|[^/]+\.(?:pem|p12|key|log))$/i.test(name)) {
          problems.push(`Sensitive or diagnostic file must not be published: ${name}`);
        }
        const size = statSync(fullPath).size;
        if (size > maxBytes) problems.push(`Cloudflare per-file limit exceeded: ${name} (${size} bytes)`);
      } else {
        problems.push(`Unexpected file type in output: ${name}`);
      }
    }
  }
  if (existsSync(directory)) visit(directory);
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = inspectDist(resolve('dist'));
  if (issues.length) {
    console.error('Production asset preflight failed:\n' + issues.map(issue => '- ' + issue).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Production assets checked: index present, no known secret/diagnostic files or oversized files.');
  }
}
