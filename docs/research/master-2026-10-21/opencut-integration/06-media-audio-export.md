# Media Room: importação, áudio, legendas, velocidade, persistência e export

Este arquivo traduz subsistemas Classic para o M4F existente sem transformar o projeto em fork. **Ordem:** UI segura primeiro, depois alterações persistidas por domínio, e por fim performance/exports com provas.

## M01 — Biblioteca de arquivos e inspector de mídia (OCU-03)

**Classic:** `components/editor/panels/assets/views/assets.tsx`, `assets-panel-store.tsx`, `media/use-file-upload.ts`, `media/processing.ts`, `media/thumbnail.ts`, `media/use-paste-media.ts`, `media/types.ts`. Tem grid/list, sort por name/type/duration/size, import e drag para timeline. **M4F:** `ClipList.tsx`, `App.tsx` com import, `project-store.ts` OPFS, media multi-source e `MAX_CLIPS=30`. **MVP:** mostrar arquivos com thumbnail local gerada/cached, nome, duração, proporção, estado de vínculo, filtro/vídeo/áudio/imagem quando suportado; clicar foca item, duplo clique preview; Add to timeline reutiliza pipeline atual. Ordenação de biblioteca não reordena o vídeo final (só operação dedicada). Import múltiplo continua com limite e avisos M4F específicos. Não persistir blob gigante em localStorage. Drag&drop mantém origem/referência, não reupload. **Teste:** arquivo removido, OPFS vazio/corrompido, 30 clipes, sem permissões storage, reload, duplicate names, economia de memória de thumbnails.

## M02 — Paste/drag do clipboard (OCU-03, fase B)

Classic `media/use-paste-media.ts` separa paste de texto vs File. Adicionar listener só com foco no workspace, verificando `ClipboardEvent.clipboardData.files`, respeitando input/textarea/contenteditable e consentimento do navegador; nome/ext/MIME validados, cancelamento e duplicata coerentes. A mesma `onAddClips` deve cuidar do arquivo como file picker. **Não:** substituir paste de elemento já existente nem capturar texto quando usuário edita legenda. Testar ctrl+v mídia vs elemento/texto, 0/1/N files, uso de clipboard bloqueado.

## M03 — Áudio multitrack e volume/solo/mute (OCU-22)

**Classic:** `core/managers/audio-manager.ts`, `media/audio.ts`, `timeline/components/audio-volume-line.tsx`, `timeline/audio-state.ts`, `timeline/audio-separation/*` e `commands/timeline/element/toggle-source-audio-separation.ts`. **M4F:** `analysis/waveform.ts`, `src/media/export.ts`, `EditTimeline.tsx` já exibem onda real; isso NÃO equivale a tracks independentes.

**Especificação:** documento de áudio representa `AudioTrack{id, kind:'voice'|'music'|'sfx', clips:[{sourceId, startOut, srcIn, srcOut, gain, fades}], muted, solo}`. Precisamos definir storage/OPFS/relink e engine mix antes de UI. MVP 2 pistas: voz do vídeo e música local do usuário; volume em dB e fade in/out, sem música remota. O mixer/renderer de áudio faz soma fora do canvas, respeitando sobreposição e retime; headphone playback e MP4 têm o mesmo mix. Mute/solo afetam preview, decisão de export para solo precisa ser explícita. **Testes:** sem áudio, stereo/mono, áudio longo/curto, taxa de amostra diferente, clipping, ganho negativo, áudio ao mudar video source, 30fps 29.97fps, sincronia de palavras.

## M04 — Master limiter (OCU-22, fase C)

**Classic:** `media/audio-mastering.ts` usa `DynamicsCompressor` (threshold -1 dB, ratio 20, attack .001s, release .12s), teto 0.98, e `OfflineAudioContext`. **Não** declarar que isso equivale a loudness LUFS. No M4F: analisar clipping, ganho, headroom; limiter opt-in ou default explicitamente aprovado; comparar onda/nivel após mix, evitar normalizações múltiplas ou distorção. **Teste:** pico antes/depois, ausência de NaN, silêncio, janela longa, AAC final, browsers suportados, volume percebido.

## M05 — Retime/velocidade do clipe (OCU-23 se roadmap for estendido; antes disso usar OCU-10 temporal)

**Classic:** `speed/components/speed-tab.tsx`, `retime/*`, `core/managers/timeline-manager.ts`. Tem constante speed e opção maintain pitch. No M4F: criar rate explícita por segmento, com semantics `outLen = sourceLen / rate`, snap em ticks, congelamento/transições fora do escopo; playback áudio respeita rate quando suportado, fallback indicado, e captions/added/out ranges seguem output. **Não** fazer UI de speed sem export correto. First milestone: rate 0.5–2, 1x identidade, não alterar fonte original; maintain-pitch como feature separada após dispositivo/capability/qualidade. **Teste:** fala acel./lenta, legendas sincronizadas, trim após speed, segment reorder, export real, 29.97 e áudio.

## M06 — Legendas de arquivo SRT/ASS (OCU-22, fase B)

**Classic:** `subtitles/parse.ts` escolhe por extensão `.srt` ou `.ass`, `srt.ts` e `ass.ts` parse/diagnóstico; `subtitles/insert.ts` cria elementos. **M4F:** legenda nativa ASR por palavra em `Transcript.tsx`, `core/types.ts` `Caption`, `editorial/captions.ts`, `SidePanels.tsx`. **Não duplicar:** permitir importar SRT/VTT/ASS em formato de cues intermediário `{start,end,text,style?}` com validação; converter tempo para output, reconciliar `Captions` com documento atual, conferir overlaps, tamanho de arquivo e encoding; não remover ASR automaticamente. ASS rich styles devem ser explicitamente limitados ou definidos, não alegar suporte integral. Exportar SRT separado posteriormente com texto revisado e tempos output. **Teste:** UTF-8 com acentos, 0/negativo, overlaps, multiline, timestamp 00:00:01,230, import duas vezes, undo, export onde voz e vídeo foram cortados.

## M07 — Sounds picker e provenance (P2, opcional)

Classic `sounds/components/assets-view.tsx`, `use-sound-search.ts` trazem descoberta. Para M4F `sem custo obrigatório`, áudio externo deve ser opcional, licenciado e offline-friendly; **nada de depender de CDN/API terceirizada**. MVP favorável: adicionar arquivos locais WAV/MP3/AAC quando browser puder decodificar, mostrar amostra/duração, waveform cache; priorizar direitos autorais/atribuição.

## M08 — Formato, export e preflight (MASTER-03/04)

**Classic:** `services/renderer/scene-builder.ts`, `scene-exporter.ts`, `compositor/frame-descriptor.ts`, `components/editor/export-button.tsx`, `core/managers/renderer-manager.ts`; `docs/effects-renderer.md` explica render de passes. **M4F:** `src/media/export.ts`, `src/render/frame.ts`, `src/core/formats.ts` suportam 9:16,4:5,1:1,16:9 e MP4 multiclipes.

**Preflight separado:** função pura `buildExportPlan(EditPlan,Capabilities)` retorna `frameCount`, `duration`, `sources`, `warnings`, `audioPlan`, `estimatedMemory`, `encoderProfile` ou erro `M4F-xxx`. Conferir arquivo ausente, codec suportado, trim válido, aspect ratio, fps, storage e fonte. **Evitar:** silent H264 degradation, export sem áudio, clips com dois frames iguais após seek, UI que mostra um motion e MP4 exporta outro.
- **Formato:** não acoplar CSS do player à resolução MP4. `drawFrame` recebe profile e timestamp em output. Testar primeiro/último quadro, transições, caption no limite, mask/opacity/keyframe e sincronismo áudio.
- **Falha parcial:** limpar resources, mostrar erro com código, nunca destruir projeto. Continuar a editar depois de erro.
- **Performance:** caminhos multi-clipe e vídeos longos (v0.22 ClipMaker) passam por benchmark com limites explícitos, release de `AudioBuffer`, `VideoFrame`, URL object e OPFS relink.

## M09 — Performance e caching

Classic `diagnostics/render-perf.ts`, `media/waveform-summary.ts`, `core/managers/diagnostics-manager.ts`. M4F já usa peak index para onda real. Instrumentar P50/P95 preview frame render (local, sem telemetria), render de timeline com 1/10/30 arquivos, CPU/RAM medidos localmente quando API permite, context loss e import. Thumbnail cache limitado/LRU; `URL.revokeObjectURL`; serializar arquivos por nome+fingerprint. **Não** colocar caching de media em Redux/Zustand sem motivo.

## M10 — Escopo de compatibilidade por feature

| Feature | Arquivos M4F impactados | Dependências | Critério funcional mínimo |
|---|---|---|---|
| Biblioteca UI | `ClipList.tsx`, `SidePanels.tsx`, novo pane | OCU-01/02 | arquivos acessíveis, não reordena timeline |
| Audio tracks | `core/schema.ts`, `types.ts`, `media/export.ts`, player/Timeline | timebase, commands | música+voz audível no preview e MP4 |
| Speed | `engine/timeline.ts`, `editorial/clip-ops.ts`, `media/export.ts`, inspector | tick/fps, export QA | rate real sem desync |
| Subtitle import | `editorial/captions.ts`, `core/schema.ts`, inspector | schema vNext | timings preservados no MP4 |
| Preflight/export | `media/export.ts`, `core/errors.ts`, `docs/erros.md` | timeline parity | aviso antes, error code |
| GPU optional | `render/frame.ts`, capability detection | spike | fallback sem crash |

## Gates: importar não é integrar

Marcar "concluído" só com interface utilizável, arquivo real, compatibilidade de projeto, zero upload silencioso, licença e benchmark mínimos. Não publicar claim de suporte completo SRT/ASS, áudio avançado ou 4K sem provas.
