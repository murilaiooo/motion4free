# ADR-0007 — Editor da Fase 2: histórico, projeto no OPFS, player e exportação em Worker

**Data:** 2026-10-20
**Status:** ACEITA. Complementa o [ADR-0005](0005-stack-v1.md); nenhuma dependência nova.

## Contexto
A Fase 2 ([plano](../superpowers/plans/2026-10-20-fase2-editor.md)) pede edição manual com desfazer/refazer, projeto que sobrevive a fechar a aba, prévia em tempo real igual ao MP4 e exportação sem travar a tela, tudo no navegador e sem custo.

## Decisão
- **Histórico de planos inteiros** (`src/engine/history.ts`, limite 100). Um `EditPlan` tem poucos KB; guardar o estado inteiro é mais simples e mais seguro do que inverter operações. Operações são funções puras em `src/editorial/ops.ts`.
- **Cortes derivados dos trechos mantidos.** Não há lista de cortes separada que possa divergir. Mudar trechos reconstrói as legendas pelas palavras e preserva textos editados cujo grupo de palavras não mudou.
- **Projeto no OPFS** (armazenamento privado do navegador, só no dispositivo): `project.json` validado por zod ao abrir e uma cópia do vídeo. O arquivo original da pessoa nunca é aberto para escrita. Se o navegador apagar a cópia, o app pede o arquivo de novo (M4F-604) e confere tamanho e duração (M4F-603). Gravação via `createWritable` (Chrome/Edge/Firefox); onde não existe, aviso M4F-601 e a edição segue sem salvar.
- **Player**: relógio do Web Audio, áudio emendado pela mesma `spliceAudio` e quadros pela mesma `drawFrame` da exportação (em meia resolução). Quadros vêm do `CanvasSink` do Mediabunny, trecho a trecho.
- **Exportação em Worker** (`src/media/export.worker.ts`): Mediabunny, WebCodecs e `OffscreenCanvas` funcionam em Worker. O áudio passou de `AudioBuffer` (inexistente em Worker) para `AudioSample`. Se o Worker falhar, a exportação roda na tela principal como na Fase 1.

## Alternativas descartadas
- IndexedDB para o projeto: funciona, mas o OPFS lida melhor com o arquivo de vídeo grande e é a recomendação do ADR-0005.
- `FileSystemFileHandle` do arquivo original (File System Access API): só Chrome/Edge e exige permissão a cada sessão; a cópia no OPFS é transparente.
- `<video>` nativo como fonte do player: seeks nas emendas causam atraso e não garantem o mesmo quadro que a exportação.

## Consequências
- O projeto ocupa no navegador aproximadamente o tamanho do vídeo; escolher outro vídeo apaga o projeto anterior.
- Player e MP4 usam o mesmo desenho; diferenças possíveis ficam restritas à resolução (prévia em meia resolução) e ao momento exato de troca de quadro.
