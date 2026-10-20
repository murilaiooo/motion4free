#!/usr/bin/env bash
# Gera um vídeo de teste de 6 s: tom em 0–1.4 s e 3.0–4.3 s, silêncio no resto.
# VP9/Opus porque o Chromium do Playwright não lê H.264; o Chrome de verdade lê os dois.
set -euo pipefail
mkdir -p e2e/fixtures
ffmpeg -y -loglevel error \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=6" \
  -f lavfi -i "sine=frequency=220:sample_rate=48000:duration=6" \
  -filter_complex "[1:a]volume='if(between(t,0,1.4)+between(t,3.0,4.3),0.5,0)':eval=frame[a]" \
  -map 0:v -map "[a]" -c:v libvpx-vp9 -b:v 1M -deadline realtime -c:a libopus -shortest e2e/fixtures/fala-com-pausas.webm
# Entradas estranhas (v0.7): vídeo sem faixa de som (2 s) e vídeo de 1 s.
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=30:duration=2" \
  -c:v libvpx-vp9 -b:v 500k -deadline realtime e2e/fixtures/sem-audio.webm
ffmpeg -y -loglevel error \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=1" \
  -f lavfi -i "sine=frequency=220:sample_rate=48000:duration=1" \
  -c:v libvpx-vp9 -b:v 1M -deadline realtime -c:a libopus -shortest e2e/fixtures/curto.webm
