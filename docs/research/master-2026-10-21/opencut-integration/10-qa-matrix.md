# QA dirigido por risco: testes inéditos e evidências, sem loops

**Não executado nesta pesquisa.** A tabela é um plano para implementação futura, não relatório de aprovação. A suite já existente tem E2E, Vitest, Playwright e fixtures: nunca apagar ou repetir por reflexo sem relevância. `package.json`: `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`. Se um browser Playwright não está instalado, não modificar host sem necessidade; registrar blocker. Respeitar quota GitHub Actions.

## Protocolo para cada PR

1. Escolher exatamente **testes novos ligados a novas branches de código** e 1–3 sentinelas de regressão relacionadas; não rodar a bateria completa de todos os PRs históricos por hábito.
2. Antes do patch, registrar testes já existentes em `tests/`/`e2e/` (buscar paths reais), código e condição de falha alvo.
3. Executar typecheck + unit scoped; build apenas quando houver alteração de bundle/worker; E2E escopado no browser quando layout, input ou mídia. Executar suite geral no gate de release ou quando mudança arquitetural exigir.
4. Se falhar: identificar erro exato e causalidade; editar causa; rodar apenas teste afetado; se CI quota esgotada, não disparar workflow de novo.
5. Para toda alteração de render/codec/áudio: gerar ou inspecionar arquivo MP4 **real**; declarar resultado com arquivo/duração/fps/codec/áudio/frames sem inventar.
6. Guardar artefatos de QA/screenshot somente quando permitido; evitar mídia privada e PII, não subir vídeo de cliente ao GitHub.

## Matriz workbench (OCU-01..04)

| Caso único | Passo e asserção | Sinais de falha |
|---|---|---|
| WB-01 | abrir app 1920×1080, biblioteca+stage+inspector+timeline visíveis, sem scroll global | overflow/canvas recortado |
| WB-02 | arrastar handle biblioteca->preview até minimo, depois máximo; preview mantém proporção | pane negativo/player remontou |
| WB-03 | arrastar handle central vertical enquanto vídeo reproduz, sem perder tempo/áudio | player reinicializou |
| WB-04 | salvar layout, recarregar app, dimensões compatíveis; `Restaurar` volta defaults | localStorage state inválido |
| WB-05 | inserir `localStorage['m4f.workbench-layout.v1']` corrompido/números enormes; tela abre com defaults | crash/painel desaparece |
| WB-06 | reduzir largura 1024×768 e zoom 200%; inspector vira drawer, sem vídeo sobposto | scroll horizontal global |
| WB-07 | teclado Tab -> splitter, setas, Home/End, foco visível; screen reader label | separador inacessível |
| WB-08 | ativar 8 abas em ordem, verificar conteúdo e controles reais | conteúdo montado em duas abas |
| WB-09 | selecionar texto na preview e clipe na timeline; inspector alterna sem perder seleção | inspector stale |
| WB-10 | digitar título/caption, Espaço não pausar; Undo não desfaz resize de painel | hotkey leakage |
| WB-11 | escuro/claro + reduced motion + contraste em disabled/active | elementos invisíveis |
| WB-12 | MP4 export com workspace pequeno e modal aberto, acessível sem overflow | popup offscreen |

## Matriz timeline/actions (OCU-05..11)

| Caso | Aceite |
|---|---|
| TL-01 | com 1, 10 e 30 clips, zoom mínimo/máximo, régua e clips alinhados a pixel e scroll |
| TL-02 | pointerdown no splitter não seleciona segmento/caption nem inicia trim |
| TL-03 | split no primeiro frame e frame final recusa segmentos de duração 0; undo/redo exato |
| TL-04 | 100 sequências trim/move/undo com intervalos `[start,end)`, sem gaps/NaN |
| TL-05 | 23.976/29.97/59.94 e 30fps: source/out roundtrip dentro de política e lastFrame |
| TL-06 | Shift desativa snapping momentaneamente; ímã toggle persistido como UI; indica alvo correto |
| TL-07 | arrastar clipe mantendo selection e preview; commit único em history |
| TL-08 | digitar em caption e usar ctrl+a/c/x/v: altera texto, não clipe |
| TL-09 | colar/duplicar bloco no meio de vários clips preserva áudio/caption e fonte |
| TL-10 | bookmark com nota/cor e duração seek/reload/undo, não aparece MP4 |
| TL-11 | ripple off não desloca elementos não ligados; ripple on remapeia ranges sem negativo |

## Matriz visual, motion, export (OCU-12..21)

| Caso | Prova |
|---|---|
| FX-01 | posições, rotação, opacity e scale no preview/MP4 nos mesmos frames |
| FX-02 | keyframes step/linear/bezier: valores exatos no começo, meio e último frame |
| FX-03 | preview de curva não cria entradas undo, commit cria uma; cancel não altera plano |
| FX-04 | split de elemento com keyframe na emenda mantém movimento sem salto |
| FX-05 | retime sem desordenar keys, migração legacy sem perdida de texto/clip |
| FX-06 | máscara rectangle/ellipse dentro de preview: alpha, borda e feather sem vazar |
| FX-07 | duas masks independentes e layer overlap preservam composição |
| FX-08 | efeito blur/brightness ativado/desativado depois de reload e no arquivo exportado |
| FX-09 | GPU indisponível ou context lost degrada para CPU, aviso correto, editor não trava |
| FX-10 | safe zones TikTok/Reels/Shorts/custom sobrepostos apenas na UI; export limpo |
| FX-11 | background fill/fit/blur respeita 9:16/4:5/1:1/16:9 |
| FX-12 | fonte ausente/emoji invalido gera fallback e mensagem, vídeo permanece exportável |

## Matriz arquivos, áudio, tempo

| Caso | Prova |
|---|---|
| MD-01 | MP4 sem áudio, outro mono, outro stereo e um WAV: import/preview/export honestos |
| MD-02 | trim/corte antes e depois de fala e legendas: alinhamento em tempo de output |
| MD-03 | velocidade 0.5, 1, 2x em vídeo com fala; rate preserva tempo total, pitch suportado ou aviso |
| MD-04 | áudio de 10s em vídeo de 5s e 30s, fades/gain; sem travamento/estouro |
| MD-05 | SRT com BOM/acentos/multiline/overlap/import duplicado, sem sumir ASR |
| MD-06 | ASS básico e styling não suportado sinalizados, não prometer compatibilidade total |
| MD-07 | asset ausente/relink após reload e export preflight, OPFS não apagado |
| MD-08 | 30 clips e longa gravação >10min em hardware comum sem memória acumulada |
| MD-09 | primeiro e último frame real e 1 frame ao redor do corte/keyframe no MP4 |
| MD-10 | Firefox/Chromium suportados com codecs disponíveis; falha em browser incapaz sem corrupt project |

## Dados de teste e organização

Preferir gerar fixtures locais sintéticas **sem mídia com direitos**: quadro com contador/frame/timecode, barras, silêncio seguido de dois tones, frase gravada de teste com permissão, 2 clips diferentes e SRT curtinho. Nomear `fixture-<propriedade>.mp4` com metadados/resolução/fps e SHA; não versionar arquivos gigantes sem aprovação. Cada teste aponta para fixture SHA ou script reprodutor do repositório.

**Sentinelas UI reais do M4F:** `data-testid="timeline"`, `tl-split`, `tl-snap`, `tl-waveform`, `tl-el-*`, `tl-seg-*`, `player-canvas`, `play`, `export`, `download`, `version`, `framing-panel`. Preservar esses IDs em refactor ou atualizar seus consumidores no mesmo PR.

**Gráfico de prioridade de QA:** UI-only = WB-01..12 + mínimo de 3 interações reais e uma validação de export existente (sem regenerar vídeos se nenhum código render foi tocado e há prova atual). Engine temporal = TL/MD e MP4 obrigatório. Motion/mask/effects = FX + MP4 obrigatório. Mudanças de biblioteca = import/relink/clipboard cases, sem revalidar efeitos unrelated.

## Não interpretar evidência indevidamente

Passar typecheck não prova MP4; construir bundle não prova UI; screenshot não prova acessibilidade; source file upstream não prova ausência de bug. Diferenciar `passed`, `failed`, `not-run`, `blocked` em cada relatório. Nunca inventar números de performance.
