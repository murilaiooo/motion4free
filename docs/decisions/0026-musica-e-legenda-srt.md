# ADR-0026 — Música de fundo e legenda em arquivo (v0.26)

**Status:** aceito (21/10/2026)

## Contexto
Na comparação com o OpenCut (plano de integração, tarefas OCU-21/22), o responsável escolheu começar por música de fundo e legenda em arquivo `.srt`. Criadores pedem as duas coisas com frequência: música por baixo da fala e legenda para subir no YouTube ou abrir em outro editor.

## Decisões

### 1. Uma faixa de música, guardada no projeto
- O plano ganha `music?: { name, volume, duck } | null` (campo opcional; projetos antigos abrem iguais). Assim volume, abaixamento, tirar e trocar entram no desfazer e nas versões.
- O arquivo fica em `projects/<id>/music.bin` (um por projeto; escolher outra substitui). Tirar a música só limpa o plano: o arquivo continua, para o desfazer trazer de volta.
- A música é lida pelo decodificador do próprio navegador (`decodeAudioData`), sem enviar nada. Limites: 60 MB de arquivo e 10 minutos (o máximo de um vídeo montado).

### 2. Mesma mistura na prévia e no MP4
`src/engine/music-mix.ts` (puro, testado em `tests/music-mix.test.ts`) recebe a fala já montada no tempo do vídeo final e soma a música:
- começa junto com o vídeo, entra em 0,4 s e sai em 1,5 s no fim. Não se repete: música curta acaba e fica silêncio.
- "Abaixar na fala": blocos de 20 ms com voz (RMS acima de cerca de −34 dBFS) baixam a música para 30% do volume escolhido. Ela começa a baixar 80 ms antes da fala, segue baixa por mais 300 ms e sobe devagar.
- Nunca passa de 1 (sem estalo).
O player e as duas exportações (um vídeo e vários clipes) chamam a mesma função. O vídeo sem som passa a sair com faixa de áudio quando há música.

### 3. Legenda .srt do vídeo editado
`src/editorial/subtitles.ts` (puro, testado em `tests/subtitles.test.ts`) usa as legendas resolvidas (`resolvePlan`): o texto corrigido, os tempos depois dos cortes e das edições manuais, sem as legendas escondidas, em ordem e sem sobreposição. O botão fica na aba Legendas.

### 4. Erros próprios
- M4F-203: música ilegível.
- M4F-204: música grande demais.
- M4F-205: o projeto tem música, mas o arquivo sumiu.
- M4F-206: não foi possível guardar a música.
- M4F-523: não há legenda para baixar.

## Fora desta versão
- Importar `.srt`: as legendas do app vêm da fala transcrita. Uma legenda de fora precisa casar palavra por palavra com a fala para o destaque funcionar; fica para depois, se for pedido.
- Mais de uma música, posição inicial da música e corte da música: depende do modelo de várias faixas de áudio (OCU-22, parte de áudio).

## Não verificado
Nada disto foi testado nesta sessão (regra do responsável: ele roda os testes). Antes de afirmar que funciona, é preciso:
- rodar `tests/music-mix.test.ts`, `tests/subtitles.test.ts` e `e2e/musica.spec.ts`;
- exportar um MP4 real com música e ouvir.
