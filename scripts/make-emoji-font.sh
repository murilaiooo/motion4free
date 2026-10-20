#!/usr/bin/env bash
# Gera src/assets/emoji/m4f-emoji.woff2: subconjunto da fonte Noto Color Emoji (OFL-1.1, Google)
# só com os emojis de EMOJI_SET (src/core/emoji.ts). Formato COLRv1 (vetorial, colorido), igual no
# player e na exportação (Worker). Não roda no build nem na CI: o arquivo gerado fica no repositório.
#
# Origem: pacote npm @fontsource/noto-color-emoji@5.3.2, arquivo files/noto-color-emoji-emoji-400-normal.woff2
# Requisitos (só para quem regenera): node/npm e Python 3 com fonttools + brotli (pip install fonttools brotli).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

(cd "$WORK" && npm pack --silent @fontsource/noto-color-emoji@5.3.2 >/dev/null && tar xzf fontsource-noto-color-emoji-5.3.2.tgz)
SRC="$WORK/package/files/noto-color-emoji-emoji-400-normal.woff2"

# texto = os emojis entre aspas simples da constante EMOJI_SET, mais o seletor de variação FE0F
node -e '
const s = require("fs").readFileSync(process.argv[1], "utf8");
const block = s.slice(s.indexOf("EMOJI_SET"), s.indexOf("] as const"));
const set = [...block.matchAll(/'"'"'([^'"'"']+)'"'"'/g)].map((m) => m[1]);
process.stdout.write(set.join("") + "️");
' "$ROOT/src/core/emoji.ts" > "$WORK/text.txt"

mkdir -p "$ROOT/src/assets/emoji"
pyftsubset "$SRC" --text-file="$WORK/text.txt" --drop-tables+=SVG --layout-features='*' --flavor=woff2 \
  --output-file="$ROOT/src/assets/emoji/m4f-emoji.woff2"
cp "$WORK/package/LICENSE" "$ROOT/src/assets/emoji/OFL.txt"
ls -l "$ROOT/src/assets/emoji/m4f-emoji.woff2"
