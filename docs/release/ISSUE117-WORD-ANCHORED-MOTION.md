# Issue #117 — destaque visual ancorado por palavra (incremento testado 24/10/2026)

## Decisão arquitetural

Aproveitamos a POC `src/editorial/semantic-cues.ts` (agendamento puro por `wordId`) e a **mesma função `drawFrame`** usada pelo player e exportação em Worker. Nenhum SDK, API paga, ativo visual de terceiro, rastreador externo ou motor paralelo foi acrescentado. A implementação foi feita em uma worktree separada. O diretório principal e a branch `main` não foram tocados.

O evento `semanticCues?: SemanticWordCue[]` é campo opcional do `EditPlan` v6; planos antigos sem o campo continuam válidos. Contém ID, palavra da transcrição e seu snapshot de texto/tempo da origem, início/fim escolhido, deslocamento de -30 a +30 quadros, duração limitada em quadros. O esquema exige IDs seguros, máximo de 60 eventos, timestamps finitos e intervalos curtos. O arquivo original da pessoa nunca é alterado.

**Como usar:** no editor abra **Legendas → Texto falado → Destaques nas palavras**. A lista mostra até 12 palavras perto da agulha. Escolha uma, clique **Destacar palavra**. Pode voltar a uma palavra marcada, mudar a âncora, ajustar deslocamento, remover e desfazer/refazer. O efeito reforça a palavra no estilo existente (fonte/escala/cor de ênfase), não cria um objeto desconectado da fala. Sem transcrição aparecem instruções simples, sem opções impossíveis.

## Semântica de renderização e segurança da edição

- Agendador transforma cada palavra da mídia original em quadros exatos da timeline editada, limitado pelas bordas de cada segmento. Copiar o segmento repete o destaque; excluir/retalhar a palavra inteira ou parte dela suprime o evento; mover o segmento muda seu instante no resultado sem perder a âncora.
- Reordenar **clipes de arquivos diferentes** recalcula os tempos da origem pela identidade do clip e palavra, sem “mover” o destaque para um vídeo errado. Se o clipe fonte for excluído, remove o evento da cópia editada.
- Trechos com **quiet** ou **locked** suprimem o desenho semântico, e mudar evento dentro de trecho travado é recusado.
- Se a legenda for corrigida e não possuir mais correspondência 1:1 de índices `wordIds`/tokens, a ênfase por palavra fica desativada naquela legenda, em vez de destacar uma palavra errada; o texto original/transcrito continua salvo.
- Palavras repetidas só destacam o **ID escolhido**, não todas as ocorrências do mesmo texto.
- A renderização depende apenas do plano, instante e quadro de origem. O Worker recebe o plano já validado, sem cópia de chave ou transcrição enviada a servidor.
- `scheduledPlanCues` usa cache WeakMap por identidade imutável do plano; a interface usa busca binária e janela de 12 palavras para evitar ordenar toda a transcrição a cada frame.
- Falhas de edição têm códigos M4F-527 (âncora inválida) e M4F-528 (mais de 60 eventos), documentados em `docs/erros.md`.

## Testes reprodutíveis

1. `npm run fixture` (gera mídia sintética local).
2. `npm run typecheck && npm test && npm run build`.
3. `npx playwright test e2e/issue117-semantic-cue.spec.ts` com `CHROMIUM_PATH` apontando ao Brave.
4. Opcional: `ffprobe` e `ffmpeg` já usados pelo E2E sobre MP4 temporário, nenhum vídeo pessoal.

Evidências granulares:
- `tests/semantic-cues.test.ts`: 9 casos originais de alinhamento, bounds e retiming.
- `tests/semantic-word-edits.test.ts`: criação, frames 24/30/60 fps, cortes, cópia/reordenação, validade do plano, reversão, roundtrip, quiet/locked.
- `tests/clip-ops.test.ts`: movimento/remoção de arquivo multiparte, preservando IDs e tempos.
- `tests/semantic-render.test.ts`: chamadas reais ao `drawFrame` (RecordingContext), mudança mensurável de escala de uma palavra no quadro ativo, mesma escala fora do evento, repetição homônima distinta e cópia do segmento.
- `e2e/issue117-semantic-cue.spec.ts`: testes isolados do Brave de fluxo UX/salvar/recarregar/undo/redo, caso sem fala e **um MP4 exportado em Worker com destaque**, verificado pelo Mediabunny/FFprobe e com dois quadros decodificados por FFmpeg.
- Validação completa pós-correção dos erros de documentação: **96 arquivos / 1.731 testes unitários aprovados**, TypeScript, build de produção, pré-checagem de assets e diff limpo; **3/3 E2E no Brave**.
- MP4 sintético final do E2E: duração informada **3,114667 s**, **1.299.940 bytes**, trilhas de vídeo e áudio AAC, quadros decodificáveis. Sinal visual temporizado foi comprovado separadamente pelas chamadas ao renderizador compartilhado, não por uma inspeção cega humana do arquivo.

## Limites e próximo gate

**Este é apenas um incremento funcional da #117**, e **não uma certificação de todas as animações por palavra**. Ainda não há card completo para alterar o estilo/movimento por ocorrência nem parâmetros de animação individuais, o renderizador usa o destaque tipográfico existente. Falta avaliação visual com pessoas e gravações reais, MP4s grandes, long-form/multiclip com mídias reais e matriz completa de hardware/codec/memória. Não afirmar equivalência pixel a pixel entre vídeo e preview com base neste teste. Não há avaliação de criatividade/viralização.

A PR vai para `integration/pr-consolidation-20261024` somente. `main`/Cloudflare continuam bloqueadas pelos gates de release, licenciamento #2 e QA #10.
