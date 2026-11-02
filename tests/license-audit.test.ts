import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(res.stdout).toContain('"lockedRuntimePackages":105');
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

/** CLI real num projeto mínimo isolado, simulando alternância Linux/Windows sem rede. */
function platformFixture() {
  const folder = mkdtempSync(path.join(tmpdir(), 'm4f-license-platform-'));
  for (const relative of ['scripts', 'public', 'src/assets/emoji', 'node_modules/@img/os-a', 'node_modules/@img/os-b'])
    mkdirSync(path.join(folder, relative), { recursive: true });
  copyFileSync(audit, path.join(folder, 'scripts/audit-licenses.mjs'));
  for (const name of ['licencas-fontes.txt', 'licencas-icones.txt'])
    copyFileSync(path.join(root, 'public', name), path.join(folder, 'public', name));
  for (const name of ['m4f-emoji.woff2', 'OFL.txt'])
    copyFileSync(path.join(root, 'src/assets/emoji', name), path.join(folder, 'src/assets/emoji', name));
  writeFileSync(path.join(folder, 'package-lock.json'), JSON.stringify({ packages: {
    '': { dependencies: { '@img/os-a': '1.0.0', '@img/os-b': '1.0.0' } },
    'node_modules/@img/os-a': { version: '1.0.0', license: 'MIT', optional: true },
    'node_modules/@img/os-b': { version: '1.0.0', license: 'MIT', optional: true },
  } }));
  const licenseA = path.join(folder, 'node_modules/@img/os-a/LICENSE');
  const licenseB = path.join(folder, 'node_modules/@img/os-b/LICENSE');
  const notices = path.join(folder, 'public/licencas-bibliotecas.txt');
  writeFileSync(licenseA, 'MIT License\nCopyright (c) Linux fixture rights holder\n');
  const invoke = (...args: string[]) => spawnSync(process.execPath, [path.join(folder, 'scripts/audit-licenses.mjs'), ...args], { cwd: folder, encoding: 'utf8' });
  const dispose = () => {
    const target = path.resolve(folder);
    if (!target.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(target).startsWith('m4f-license-platform-')) throw new Error('unexpected fixture target');
    rmSync(target, { recursive: true, force: true });
  };
  return { invoke, notices, licenseA, licenseB, dispose };
}

describe('notices entre plataformas preservam copyright', () => {
  it('regenerar em outra plataforma conserva licença ausente e acrescenta a nova', () => {
    const f = platformFixture();
    try {
      expect(f.invoke('--write-notices').status).toBe(0);
      rmSync(f.licenseA);
      writeFileSync(f.licenseB, 'MIT License\nCopyright (c) Windows fixture rights holder\n');
      expect(f.invoke('--write-notices').status).toBe(0);
      const text = readFileSync(f.notices, 'utf8');
      expect(text).toContain('Copyright (c) Linux fixture rights holder');
      expect(text).toContain('Copyright (c) Windows fixture rights holder');
      expect(f.invoke('--check').status).toBe(0);
      rmSync(f.licenseB);
      expect(f.invoke('--check').status).toBe(0);
    } finally { f.dispose(); }
  });

  it('check aceita licença arquivada de pacote ausente e recusa alteração da licença presente', () => {
    const f = platformFixture();
    try {
      expect(f.invoke('--write-notices').status).toBe(0);
      rmSync(f.licenseA);
      expect(f.invoke('--check').status).toBe(0);
      writeFileSync(f.licenseA, 'MIT License\nCopyright changed without review\n');
      const result = f.invoke('--check');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Avisos de bibliotecas desatualizados');
    } finally { f.dispose(); }
  });

  it.each(['version', 'spdx', 'origin'])('não reaproveita notice de %s diferente', kind => {
    const f = platformFixture();
    try {
      expect(f.invoke('--write-notices').status).toBe(0);
      rmSync(f.licenseA);
      const old = readFileSync(f.notices, 'utf8');
      const modified = kind === 'version' ? old.replace('os-a@1.0.0', 'os-a@9.0.0')
        : kind === 'spdx' ? old.replace('os-a@1.0.0 | SPDX MIT', 'os-a@1.0.0 | SPDX ISC')
        : old.replace('https://www.npmjs.com/package/%40img%2Fos-a', 'https://unreviewed.example/os-a');
      writeFileSync(f.notices, modified);
      expect(f.invoke('--check').status).toBe(1);
    } finally { f.dispose(); }
  });
});
