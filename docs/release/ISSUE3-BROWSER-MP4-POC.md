# Evidência de exportação MP4 no navegador — issue #3

Data local: 24/10/2026. Branch `qa/3-browser-mp4-proof-20261024`, derivada de `integration/pr-consolidation-20261024`. Sem deploy.

## O que foi realmente executado

**Navegador:** Brave no Windows. `CHROMIUM_PATH` apontou explicitamente para Brave; não confundir com teste independente em Edge ou Chrome, que não estavam instalados nesse PC.

**Fluxo:** importar uma gravação sintética `fala-com-pausas.webm` (arquivo de vídeo+áudio válido, criado por FFmpeg em `npm run fixture`), aplicar corte automatizado/remoção de pausa, editar uma legenda no editor, salvar e exportar um MP4 no worker local. Inspecionar MP4 com FFprobe, ler um quadro com FFmpeg. Nenhuma chamada de API paga, upload de vídeo ou servidor remoto de renderização.

| Medida observada no Brave | Valor |
| --- | ---: |
| Codec de vídeo | H.264 (FFprobe `h264`) |
| Codec de áudio | AAC (FFprobe `aac`) |
| Resolução | 1080 × 1920 |
| FPS médio | 30 |
| Duração MP4 | 3,114667 segundos |
| Tamanho MP4 | 1.364.781 bytes |
| Tempo até edição pronta após seleção da mídia | 350 ms |
| Tempo da ação Exportar até aparecer Download | 856 ms |
| JS heap estimado via CDP antes do export | 12.608.056 bytes |
| JS heap estimado via CDP após o export | 14.070.500 bytes |
| Renderização | worker (atributo `data-export-where=worker`) |

Amostra independente no Brave: a regressão `QA real: clipes horizontal+vertical em formato horizontal (1920×1080), com áudio no MP4` também passou (um cenário, arquivo realmente exportado e conferido com FFprobe).

**Segundo navegador executado:** o Chromium 1243 instalado localmente (executável distinto do Brave; não é uma instalação de Google Chrome/Edge) passou no mesmo teste de exportação: H.264/AAC, 1080 × 1920, 30 FPS, 3,114667 s, 1.362.525 bytes, importação 413 ms, exportação 876 ms, JS heap antes 12.800.232 e após 12.257.788 bytes. A primeira tentativa pelo Playwright padrão não iniciou por ausência do headless-shell correspondente à versão instalada; o teste foi executado com o binário Chromium existente, sem instalar software novo.

**Limitação importante:** as medidas de heap são apenas dois snapshots do JS heap do renderer; não são pico de RAM, uso total do processo, cache de frames, GPU, nem custo de download dos modelos. Tempos refletem este hardware e arquivo pequeno, não SLA. O vídeo contém fala e cortes *sintéticos*; não prova lip-sync com seres humanos, estabilidade em duas horas de gravação ou qualidade editorial. A matriz de dispositivos/navegadores e stress pertence às issues #4, #12 e #102.

## Reproduzir

1. Preparar Node compatível, FFmpeg/FFprobe no PATH e dependências `npm ci`.
2. `npm run fixture`.
3. Definir a variável `CHROMIUM_PATH` para `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`.
4. `npx playwright test e2e/issue3-mp4-spike.spec.ts --reporter=line`.
5. `npx playwright test e2e/qa-regression.spec.ts -g formato.horizontal --reporter=line`.
6. Inspecionar a saída `test-results/...` (artifacts locais gerados pela execução). O novo teste anexa `mp4-spike-evidence.json` sem dados privados.

Essa é uma **prova técnica de viabilidade** e não certificação final da distribuição. A `main` e a versão pública permanecem protegidas pelos gates do `docs/release/RUNBOOK.md`.
