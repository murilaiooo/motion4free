import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const audit = path.join(root, 'scripts', 'audit-licenses.mjs');
const run = (...args: string[]) => spawnSync(process.execPath, [audit, ...args], { cwd: root, encoding: 'utf8' });
const fixture = () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'm4f-license-'));
  mkdirSync(path.join(folder, 'assets'));
  for (const name of ['licencas-fontes.txt', 'licencas-icones.txt', 'licencas-bibliotecas.txt'])
    copyFileSync(path.join(root, 'public', name), path.join(folder, name));
  writeFileSync(path.join(folder, 'index.html'), '<html lang="pt-BR"></html>');
  writeFileSync(path.join(folder, 'assets', 'example-abc123.js'), 'export default true;');
  copyFileSync(path.join(root, 'src/assets/emoji/m4f-emoji.woff2'), path.join(folder, 'assets/m4f-emoji-abc123.woff2'));
  return folder;
};

describe('issue #2: auditoria offline de licenças, fail closed', () => {
  it('grafo de runtime e avisos determinísticos permanecem consistentes com o lockfile', () => {
    const res = run('--check');
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('LICENSE AUDIT PASS');
    expect(res.stdout).toContain('"lockedRuntimePackages":100');
  });
  it('aceita build com JS próprio, avisos, fontes documentadas e Noto imutável', () => {
    const dir = fixture();
    try { const res = run('--dist-dir', dir); expect(res.status, res.stderr).toBe(0); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('valida a distribuição sem git no PATH (Cloudflare/Linux)', () => {
    const dir = fixture();
    try {
      const res = spawnSync(process.execPath, [audit, '--dist-dir', dir], {
        cwd: root, encoding: 'utf8', env: { ...process.env, PATH: '' },
      });
      expect(res.status, res.stderr).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('rejeita mídia nova sem proveniência antes da publicação', () => {
    const dir = fixture();
    try {
      writeFileSync(path.join(dir, 'assets', 'misterio.mp3'), 'not cleared for distribution');
      const res = run('--dist-dir', dir);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain('SEM LICENÇA APROVADA');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('rejeita fonte sem registro e emoji alterado', () => {
    const dir = fixture();
    try {
      writeFileSync(path.join(dir, 'assets', 'fonte-desconhecida-latin-400-normal-abc.woff2'), 'fake');
      const res = run('--dist-dir', dir);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain('Fonte não inventariada');
      rmSync(path.join(dir, 'assets', 'fonte-desconhecida-latin-400-normal-abc.woff2'));
      writeFileSync(path.join(dir, 'assets', 'm4f-emoji-abc123.woff2'), 'changed');
      const again = run('--dist-dir', dir);
      expect(again.status).not.toBe(0);
      expect(again.stderr).toContain('Noto modificado');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
