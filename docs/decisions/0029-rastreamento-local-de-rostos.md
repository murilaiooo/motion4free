# ADR-0029 — Rastreamento local de rostos por clipe

Estado: IMPLEMENTED — NOT TESTED / AWAITING QA, 21/10/2026. Ref #54.

## Problema

`ClipFrames` recebia um mapa vazio por padrão; não havia produtor de tracks nem persistência e transporte para os caminhos de prévia/exportação. Um cálculo puro de recorte não provava detecção real.

## Decisão

- Detecção opt-in na aba Mídia, em Worker descartável, com MediaPipe Tasks Vision 1.1.1 (versão fixada no lockfile). A versão tem `FilesetResolver.forVisionTasks(path, true)` e loader WASM de módulo, adequado ao `worker.format: es` existente. Não adaptar o loader clássico da 0.10.32 com eval/importScripts.
- BlazeFace short-range float16 versão 1 do Google; licença Apache-2.0 explícita no model card. Só runtime/modelo públicos são baixados dos endereços fixos; quadros não são enviados. Sem câmera, reconhecimento de identidade, identificação de falante ou backend.
- Um quadro de até 640px decodificado por vez, passo de 0,5 s, limite total de 12.000 quadros. O Worker recebe um ImageBitmap transferido e o fecha depois. Abort/timeout encerra o Worker e nenhum track parcial é aplicado.
- Preferência determinística por continuidade espacial, depois tamanho/confiança. Usa o caminho suavizado existente (zona morta, média e limite de velocidade). Buracos longos retornam suavemente para o centro. Não segue automaticamente quem está falando.
- `SavedProject.faceTracks` é metadado opcional derivado, por ID e tempo local de clipe, sem imagem/embedding. Formatos antigos permanecem legíveis. Validar limites e arrays de mesmo comprimento antes de abrir arquivo salvo.
- Preview, seek, export multi, export Worker e reserva recebem o mesmo track e calculam foco pelo mesmo tempo local. Vídeo único usa `SourceFrame` apenas com dados de rosto; fora de smart mantém a moldura manual antiga.
- A ativação é uma alteração normal no histórico. Conclusão usa o histórico mais recente, preservando edições concorrentes. Mover manualmente desativa o smart no alvo. Falha conserva estado anterior; nenhum rosto mostra M4F-309 e mantém opção manual.

## Licença e fontes primárias

- [Pacote e código MediaPipe](https://github.com/google-ai-edge/mediapipe), Apache-2.0; dependência npm `@mediapipe/tasks-vision@1.1.1`, sem código copiado/modificado.
- [Documentação de detecção Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js).
- [Model card BlazeFace short-range, licença e limites](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf).
- Pesos: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`.
- Runtime: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm`.

## Limites

Rostos pequenos, afastados, de perfil/ocultos, movimentos rápidos e múltiplas pessoas podem produzir erro; o modelo é de curta distância. Não há promessa de qualidade profissional. Um quadro RGBA 640x640 requer até 1,64 MB, mas isso não é medição do consumo total: WASM, decoder e GPU têm memória própria. CPU/memória/latência, CSP/CORS/CDN, downloads offline e paridade visual precisam ser medidos pela QA. Não foram executados testes, lint, builds, typechecks, inferência ou exportações.
