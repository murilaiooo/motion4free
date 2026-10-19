# Engenharia de vídeo e timeline — instruções dos repositórios

**Estado:** leitura de documentação + módulos-fonte; proposta de adaptação, **sem instalação, execução ou POC**. Não clonar upstream integralmente como se já fosse código do produto.

## 1. Editonny — conhecimento editorial e qualidade

**Upstream:** https://github.com/soumatheusgomes/editonny · licença do código first-party MIT, **mídia e fontes auditadas individualmente**.

### Instruções originais conferidas
- [SKILL.md](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/SKILL.md): resolve `<EDITONNY>/engine` e `visuals`, CLI e prioridades do agente.
- [WORKFLOW.md](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/WORKFLOW.md): inspeção de mídia -> transcrição real -> comparação de takes -> EDL -> motion/captions -> mix -> sample 8–15s -> export -> quality gate.
- [tighten_cut.py](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/helpers/tighten_cut.py), [suggest_visuals.py](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/helpers/suggest_visuals.py), [quality_gate.py](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/helpers/quality_gate.py).
- [visuals/README.md](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/README.md) e [THIRD_PARTY_NOTICES](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/THIRD_PARTY_NOTICES.md).

### Comandos ilustrativos do ORIGINAL (não executá-los como instalação do Motion4Free)
```text
python3 <EDITONNY>/scripts/editonny.py doctor
python3 <EDITONNY>/scripts/editonny.py catalog "three steps"
python3 <EDITONNY>/scripts/editonny.py helper transcribe /path/video.mp4 --edit-dir /path/edit
python3 <EDITONNY>/scripts/editonny.py new /path/project --edit /path/edit --style paper
python3 <EDITONNY>/scripts/editonny.py scene --project /path/project --use three-steps --start 5 --end 9
```

### Como adaptar
1. **Não incluir** engine Python/HyperFrames como dependência do site: portar algoritmos selecionados para TS/Workers, preservando licença/notices.
2. Criar `MediaProbe` (duração, FPS, orientação, audio, HDR) e `Transcript` com palavras, timestamps, sourceRef, incerteza.
3. Fazer `CutProposer` usando waveform/VAD/respiração **mais** integridade de frases e proteção de consoantes fracas; ajuste no arquivo de origem, não por velocidade de leitura.
4. Criar `EDL` imutável e não destrutiva; cuts completos, originais preservados, multilíngue, revisão por trecho só altera escopo solicitado.
5. Conservar princípios originais: não inverter negações, inventar valores, alterar rostos/provas ou cortar áudio em mudanças de faixa sem sync.
6. Portar regras de correspondência de conceitos e cenas de `suggest_visuals` **como candidatos**, sem transformar o catálogo fixo no limite criativo.
7. Criar sample real de 8–15s com corte difícil, texto, motion e áudio; rever MP4 exportado e manter artefatos de QA.

**Provas:** teste de respiração/voz baixa, correção de número, cortes expressivos, preview/export sincronizados e nenhuma informação fabricada.

## 2. OpenReel — base reutilizável de editor e agente

**Upstream:** https://github.com/Augani/openreel-video · repo declara MIT.

### Entradas efetivamente verificadas
- [README](https://github.com/Augani/openreel-video/blob/main/README.md): multi-track, trim, captions, keyframes, color, áudio, MP4/WebM browser, armazenamento local.
- [AI editing](https://github.com/Augani/openreel-video/blob/main/docs/ai-editing.md): ferramenta de IA em **catálogo fechado**, mudanças feitas sobre rascunho isolado, confirmação atômica de um snapshot, undo, rollback em falhas e verificação de operações.
- [AGENT-GUIDE](https://github.com/Augani/openreel-video/blob/main/docs/AGENT-GUIDE.md): capacidades de agente, ferramentas, confirmação, dry run e limites de API/cotas. **Os guias descrevem modos de integração diferentes** (chat local/BYOK, desktop, serviço hospedado); confirmar no código da variante usada, não presumir uma configuração única de rede ou armazenamento.
- [composition-renderer.ts](https://github.com/Augani/openreel-video/blob/main/packages/core/src/animation/composition-renderer.ts): `CompositionRenderer` com `OffscreenCanvas`, `renderFrame(composition,time)`, render por layer, keyframes, easing, transform e blend. **Já existe parte da composição por frame**; avaliar antes de reconstruir.
- [export-engine.ts](https://github.com/Augani/openreel-video/blob/main/packages/core/src/export/export-engine.ts), [webcodecs-backend.ts](https://github.com/Augani/openreel-video/blob/main/packages/core/src/export/webcodecs-backend.ts), [browser-capabilities.ts](https://github.com/Augani/openreel-video/blob/main/packages/core/src/export/browser-capabilities.ts), [project-serializer.ts](https://github.com/Augani/openreel-video/blob/main/packages/core/src/storage/project-serializer.ts).

### Plano de aproveitamento
1. Abrir os pacotes core/editor/web, ler `package.json` e graph de dependências e executar os **comandos canônicos da revisão escolhida** em checkout descartável, depois de aprovação de implementação.
2. Mapear `Media, Timeline, Track, Clip, Transform, Keyframes, Effect, Transition, History, Export` para nosso `EditPlan/SceneGraph`.
3. Reutilizar `composition-renderer` somente se passar testes de vídeo real, cor, fontes, alpha, efeitos, seek arbitrário e memória. **Não assumir que o renderer 2D existente cobre 3D, masks complexas e nossa linguagem premium**.
4. Estudar profundamente o padrão **IA -> plano de operações validado -> draft isolado -> commit atômico/rollback**, para não perder edições do usuário quando LLM falha.
5. Preservar mídia original, refs/IDs, undo/redo, import de projeto sem URLs/chaves, handling de fontes ausentes e confirmação para efeitos destrutivos.
6. Implementar adapter fino para nosso `CreativeBrief/StyleDNA/SceneGraph`; evitar fork pesado de UI antes da prova técnica.
7. Rodar testes do upstream relevantes: build/typecheck/lint, testes de core/agent/web, e sample real. Não considerar “integração aprovada” por README.

**POC:** importar 1 vídeo, criar duas faixas + overlay autoral, exportar, reabrir projeto, alterar um trecho via operação atômica, testar rollback.

## 3. Mediabunny — leitura, codificação e mux

**Upstream:** https://github.com/Vanilagy/mediabunny · **MPL-2.0** (modificações em arquivos cobertos têm obrigações de disponibilização de código).

### Leia antes de codificar
- [Quick start](https://github.com/Vanilagy/mediabunny/blob/main/docs/guide/quick-start.md)
- [Writing media files](https://github.com/Vanilagy/mediabunny/blob/main/docs/guide/writing-media-files.md)
- [Supported formats/codecs](https://github.com/Vanilagy/mediabunny/blob/main/docs/guide/supported-formats-and-codecs.md)
- [Reading media files](https://github.com/Vanilagy/mediabunny/blob/main/docs/guide/reading-media-files.md)
- [Output formats](https://github.com/Vanilagy/mediabunny/blob/main/docs/guide/output-formats.md).

### Instrução concreta
- API de entrada: `Input`, `BlobSource`, `ALL_FORMATS` para mídia enviada pelo usuário.
- API de saída: `Output` + `Mp4OutputFormat` + um target (`BufferTarget` só para arquivos pequenos; streaming quando grande).
- `output.addVideoTrack(videoSource)`, `output.addAudioTrack(audioSource)`; considerar `CanvasSource` para frames gerados e fonte apropriada para áudio editado.
- Controlar timestamps de frames em uma base racional; **29.97 = 30000/1001**, não 29.97 exato; não emitir dois frames em mesmo timestamp devido a arredondamento.
- Testar codecs pela capacidade do **navegador/OS** antes de declarar H.264/AAC disponíveis. Container suportado não significa encoder disponível.
- AAC pode exigir extensão `@mediabunny/aac-encoder`, com licença e compatibilidade verificadas antes de ativar.
- Verificar áudio/vídeo, duração, drift, cor, bitrate e memória do arquivo **final**, não apenas evento de conclusão da API.

**POC:** Canvas com frame controlado + áudio sincronizado -> MP4 1080×1920 com cortes, duração correta, teste Chrome/Edge.

## 4. ffmpeg.wasm — fallback seletivo

**Upstream:** https://github.com/ffmpegwasm/ffmpeg.wasm · licença do wrapper repo não substitui análise dos codecs incluídos.

**Guia:** [Usage](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/website/docs/getting-started/usage.md).

O exemplo upstream instancia `FFmpeg`, `load({coreURL,wasmURL})`, `writeFile`, `exec([...])`, `readFile`. Usa `toBlobURL` por motivos de CORS e configurações de bundle. Variante multithread exige `SharedArrayBuffer` e isolamento cross-origin. O core é pesado.

**Adaptação:** instalar módulo WASM lazy somente para operação sem alternativa nativa (por exemplo, formato não suportado), não chamar para cada frame. Verificar build/browser/memória, erros de FFmpeg, tamanho de arquivos, codecs efetivos e limites do FS virtual.

**Teste:** mesma tarefa pequena com Mediabunny/WebCodecs vs WASM; medir tempo, pico de RAM, tamanho do bundle, arquivo válido e custo de energia.

## 5. Auto-Editor — modelo de corte automático

**Upstream:** https://github.com/WyattBlue/auto-editor · [skill oficial de edição](https://github.com/WyattBlue/auto-editor/blob/main/skills/auto-editor/SKILL.md).

No CLI original, momentos ativos/inativos são rotulados; expressão `audio`, `motion`, `blackdetect` e combinações booleanas classificam trechos. Margens temporais e suavização evitam cortes extremos (`--margin`, `--smooth`), com `--preview` sem export.

**Adaptação browser:** importar **conceitos** de atividade, margem pré/pós, minimum clip/minimum gap e preview de EDL; não transplantar CLI nativo. Pausas detectadas automaticamente são candidatas: uma respiração expressiva não é necessariamente silêncio descartável.

**Teste:** métricas de sílaba preservada, duração da frase, clipping/transição e preferência humana de pacing.

## 6. OpenTimelineIO — interoperabilidade, não renderização

**Upstream:** https://github.com/AcademySoftwareFoundation/OpenTimelineIO · Apache-2.0. [Quickstart](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/quickstart.md) explica `pip install opentimelineio` em virtualenv e adapters OTIO/OTIOD; outros formats exigem plugins.

**Adaptação:** aproveitar seus conceitos de timeline, source range, media reference, track/stack, transitions, IDs e interop; nosso projeto JSON versionado pode permitir conversão futura. OTIO nativo Python/C++ **não precisa entrar no bundle web** e não é encoder.

**Teste:** round-trip de EDL com takes, durações, source ranges, transições e refs sem perda.

## Dependências do percurso de referência
1. Validar leitura do arquivo com Mediabunny e preflight codecs.
2. Testar OpenReel renderer `renderFrame(...,time)` com nosso conceito de SceneGraph.
3. Validar mux MP4 do resultado usando o mesmo relógio de áudio/vídeo.
4. Integrar regras de cortes do Editonny/Auto-Editor e QA.
5. Somente então adicionar diretor de arte automático.

[Índice](INDEX.md) · [Motion](02-motion-and-composition.md) · [Matriz](05-integration-matrix.md).
