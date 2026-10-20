// A Cloudflare aceita no máximo 25 MiB por arquivo. O runtime ONNX já é
// carregado do CDN jsdelivr pelo Transformers.js, então a cópia local é removida.
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/assets';
const LIMIT = 25 * 1024 * 1024;
for (const name of readdirSync(dir)) {
  const path = join(dir, name);
  const size = statSync(path).size;
  if (size > LIMIT) {
    if (!name.startsWith('ort-wasm')) throw new Error(`Arquivo grande inesperado no build: ${name} (${size} bytes)`);
    unlinkSync(path);
    console.log(`removido ${name} (${(size / 1048576).toFixed(1)} MiB), servido pelo CDN`);
  }
}
