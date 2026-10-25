/**
 * Gate offline de licenças do Motion4Free — inventário npm + arquivos de saída.
 * Usage:
 * node scripts/audit-licenses.mjs --write-notices
 * node scripts/audit-licenses.mjs --check
 * node scripts/audit-licenses.mjs --dist [--dist-dir path]
 * Nunca chama rede nem GitHub Actions.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const writing = args.includes('--write-notices');
const auditDist = args.includes('--dist') || args.includes('--dist-dir');
const distIndex = args.indexOf('--dist-dir');
const distDir = distIndex < 0 ? path.join(root, 'dist') : path.resolve(args[distIndex + 1] || '');
const errors = [];
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const direct = Object.keys(lock.packages[''].dependencies || {});
const fonts = direct.filter(name => name.startsWith('@fontsource/'));
const fontNames = fonts.map(name => name.slice('@fontsource/'.length)).sort((a, b) => b.length - a.length);
const dir = name => path.join(root, 'node_modules', ...name.split('/'));
const sha = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const ALLOWED = new Set(['MIT', 'Apache-2.0', 'OFL-1.1', 'ISC', 'BSD-3-Clause', 'BSD-2-Clause', 'MPL-2.0', '0BSD', '(MIT OR CC0-1.0)']);
const native = name => name.startsWith('@img/') || name === 'sharp' || name === 'onnxruntime-node';
const noticePath = path.join(root, 'public', 'licencas-bibliotecas.txt');
function tracked() {
  const out = [];
  for (const dirname of ['src/assets', 'public']) {
    const scan = folder => {
      if (!fs.existsSync(folder)) return;
      for (const item of fs.readdirSync(folder, { withFileTypes:true })) {
        const filename = path.join(folder, item.name);
        if (item.isDirectory()) scan(filename);
        else if (item.isFile()) out.push(path.relative(root, filename).replaceAll('\\', '/'));
      }
    };
    scan(path.join(root, dirname));
  }
  return out;
}
const installed = new Map();
function add(name, parent) {
  if (installed.has(name)) return;
  const item = lock.packages['node_modules/' + name];
  if (!item) { errors.push('Não consta no package-lock: ' + name + ', requerido por ' + parent); return; }
  const packagePath = dir(name);
  let meta;
  if (item.optional || (auditDist && !writing && !args.includes('--check'))) {
    // Preview Cloudflare e builds locais dependem exclusivamente de metadados
    // imutáveis do lockfile. A checagem completa de LICENSE instalados ocorre
    // separadamente com npm run licenses:check no PC.
    if (!item.license) errors.push('Licença ausente no lockfile: ' + name);
    meta = {name, version:item.version, license:item.license, repository:null};
  } else {
    try { meta = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8')); }
    catch { errors.push('Falta package.json no npm instalado: ' + name); return; }
  }
  const license = meta.license || item.license;
  if (meta.version !== item.version) errors.push('Versão diverge do lockfile: ' + name);
  if (!license) errors.push('Licença ausente no metadata npm: ' + name);
  if (license && !ALLOWED.has(license) && !native(name)) errors.push('Licença nova exige revisão: ' + name + ' (' + license + ')');
  const repository = (typeof meta.repository === 'object' ? meta.repository?.url : meta.repository) || meta.homepage ||
    'https://www.npmjs.com/package/' + encodeURIComponent(name);
  let licenseFile = '';
  for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'COPYING']) {
    if (fs.existsSync(path.join(packagePath, filename))) { licenseFile = filename; break; }
  }
  installed.set(name, {name, version: meta.version, license, repository, packagePath, licenseFile, parent, nativeOnly:native(name)});
  for (const dep of Object.keys(item.dependencies || {})) add(dep, name);
  for (const dep of Object.keys(item.optionalDependencies || {})) add(dep, name + ' (opcional)');
}
for (const name of direct) add(name, 'raiz');
const packages = [...installed.values()].sort((a,b) => a.name.localeCompare(b.name));
const fingerprint = crypto.createHash('sha256').update(JSON.stringify(packages.map(p => [p.name, p.version, p.license]))).digest('hex');
function noticeText() {
  const lines = [
    'MOTION4FREE — LICENÇAS E AVISOS DE BIBLIOTECAS',
    'Inventário determinístico gerado do package-lock.json e metadados npm instalados.',
    'O lockfile inclui dependências transitivas e opcionais de Node/plataformas;',
    'isso NÃO significa que todas são incluídas no JavaScript publicado.',
    'Bibliotecas nativas Sharp/libvips/onnxruntime-node NÃO são enviadas pelo site.',
    'Fontes têm avisos em /licencas-fontes.txt; ícones em /licencas-icones.txt.',
    'Modelos de IA são obtidos sob demanda por URL externa, não incluídos aqui.',
    'MIT do Motion4Free não altera nenhuma licença de terceiros.',
    'Fingerprint SHA-256 do grafo: ' + fingerprint,
    '',
    'Pacotes do grafo de produção: ' + packages.length + ' (incluindo ' + fonts.length + ' famílias de fontes).',
    '',
  ];
  for (const item of packages.filter(item => !item.name.startsWith('@fontsource/'))) {
    lines.push('='.repeat(68));
    lines.push(item.name + '@' + item.version + ' | SPDX ' + item.license);
    lines.push('Origem: ' + item.repository);
    if (item.nativeOnly) lines.push('Dependência opcional/nativa, não distribuída no site estático.');
    if (item.licenseFile) {
      const licenseText = fs.readFileSync(path.join(item.packagePath, item.licenseFile), 'utf8').trim();
      if (Buffer.byteLength(licenseText) > 500000) errors.push('Aviso extraordinariamente grande: ' + item.name);
      lines.push('Aviso do pacote (' + item.licenseFile + '):');
      lines.push(licenseText);
    } else {
      lines.push('Pacote instalado sem arquivo LICENSE; licença consta no package.json.');
      lines.push('Antes de redistribuir arquivos separados, consultar upstream e sua licença.');
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\r\n/g, '\n').trimEnd() + '\n';
}
if (writing) fs.writeFileSync(noticePath, noticeText(), 'utf8');
else if (!fs.existsSync(noticePath)) errors.push('Avisos das bibliotecas ausentes');
else {
  const recorded = fs.readFileSync(noticePath, 'utf8').replace(/\r\n/g, '\n');
  if (!recorded.includes('Fingerprint SHA-256 do grafo: ' + fingerprint))
    errors.push('Licenças no aviso não correspondem ao grafo do lockfile.');
  if (args.includes('--check') && recorded !== noticeText())
    errors.push('Avisos de bibliotecas desatualizados; execute npm run licenses:update e revise o diff.');
}

const approvedSource = new Set([
  'public/_headers', 'public/licencas-fontes.txt', 'public/licencas-icones.txt',
  'public/licencas-bibliotecas.txt', 'src/assets/emoji/OFL.txt', 'src/assets/emoji/m4f-emoji.woff2',
]);
for (const filename of tracked())
  if (!approvedSource.has(filename)) errors.push('Recurso local novo sem revisão: ' + filename);
const originalEmoji = path.join(root, 'src/assets/emoji/m4f-emoji.woff2');
// O subset já foi verificado a partir de Noto Color Emoji OFL; impedir trocas
// silenciosas do binário sob o mesmo nome antes da próxima revisão de direitos.
const EXPECTED_EMOJI_SHA256 = '4a94180bd80e397ce112fe05b60943ba03c1c6e779a4226cf4a24fd037b72f0a';
if (!fs.existsSync(originalEmoji) || fs.statSync(originalEmoji).size > 200000) errors.push('Subconjunto de emoji ausente ou mudou de tamanho');
else if (sha(originalEmoji) !== EXPECTED_EMOJI_SHA256) errors.push('Fonte emoji de origem alterada: auditoria e notices precisam ser revisados.');
for (const name of ['licencas-fontes.txt', 'licencas-icones.txt'])
  if (!fs.existsSync(path.join(root, 'public', name))) errors.push('Aviso de licença ausente: ' + name);
const fontNotice = fs.readFileSync(path.join(root, 'public/licencas-fontes.txt'), 'utf8');
const records = [];
function classifyAsset(file, abs) {
  if (/^assets\/[a-z0-9-]+-latin-\d+-(?:normal|italic)-[A-Za-z0-9_-]+\.woff2$/i.test(file)) {
    const name = fontNames.find(font => file.startsWith('assets/' + font + '-latin-'));
    if (!name) errors.push('Fonte não inventariada: ' + file);
    else {
      const metadata = installed.get('@fontsource/' + name);
      if (metadata?.license !== 'OFL-1.1' || (args.includes('--check') && !metadata.licenseFile))
        errors.push('OFL/arquivo LICENSE indisponível para: ' + name);
      if (!fontNotice.toLowerCase().includes('- ' + name + ':'))
        errors.push('Falta atribuição desta fonte em /licencas-fontes.txt: ' + name);
    }
    return 'OFL-1.1 / @fontsource/' + name;
  }
  if (/^assets\/m4f-emoji-[A-Za-z0-9_-]+\.woff2$/.test(file)) {
    if (sha(abs) !== sha(originalEmoji)) errors.push('Subconjunto Noto modificado sem aprovação: ' + file);
    if (!fs.existsSync(path.join(root,'src/assets/emoji/OFL.txt'))) errors.push('OFL de Noto Emoji ausente');
    return 'OFL-1.1 / Noto Color Emoji (subconjunto)';
  }
  if (/^assets\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(file))
    return 'MIT (Motion4Free) + dependências em licencas-bibliotecas.txt';
  if (file === 'index.html' || file === '_headers') return 'MIT próprio';
  if (file === 'licencas-fontes.txt') return 'OFL-1.1 / avisos';
  if (file === 'licencas-icones.txt') return 'ISC/MIT / avisos';
  if (file === 'licencas-bibliotecas.txt') return 'aviso bibliotecas';
  errors.push('ARQUIVO DE PRODUÇÃO SEM LICENÇA APROVADA: ' + file);
  return 'NÃO REVISADO';
}
if (auditDist) {
  if (!fs.existsSync(distDir)) errors.push('Falta build dist: ' + distDir);
  else {
    function walk(folder) {
      for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
        const abs=path.join(folder,entry.name);
        if (entry.isDirectory()) { walk(abs); continue; }
        const filename=path.relative(distDir,abs).replaceAll('\\','/');
        records.push({file:filename,license:classifyAsset(filename,abs),sha256:sha(abs),bytes:fs.statSync(abs).size});
      }
    }
    walk(distDir);
    if (!records.some(r => r.file === 'licencas-bibliotecas.txt'))
      errors.push('Avisos das bibliotecas não distribuídos no build');
  }
}
if (errors.length) {
  console.error('LICENSE AUDIT FAIL\n' + errors.map(e => ' - ' + e).join('\n'));
  process.exitCode = 1;
} else {
  console.log('LICENSE AUDIT PASS ' + JSON.stringify({
    lockedRuntimePackages:packages.length, fontPackages:fonts.length,
    builtFiles:records.length, builtFonts:records.filter(r=>r.file.endsWith('.woff2')).length,
    builtBytes:records.reduce((sum,r)=>sum+r.bytes,0),offline:true,
  }));
}
if (args.includes('--manifest') && auditDist) {
  // Arquivo somente local: hashes são de uma build, não são versão do upstream.
  const filename=path.join(root,'.local-license-report.json');
  fs.writeFileSync(filename,JSON.stringify({files:records.sort((a,b)=>a.file.localeCompare(b.file))},null,2));
  console.log('Manifesto local: '+filename);
}
