# Issue #117 — eventos visuais ancorados por palavra (incrementos testados em 24/10/2026)

## Decisão arquitetural

Aproveitamos a POC `src/editorial/semantic-cues.ts` (agendamento puro por `wordId`) e a **mesma função `drawFrame`** usada pelo player e exportação em Worker. Nenhum SDK, API paga, ativo visual de terceiro, rastreador externo ou motor paralelo foi acrescentado. A implementação foi feita em uma worktree separada. O diretório principal e a branch `main` não foram tocados.

O evento `semanticCues?: SemanticWordCue[]` é campo opcional do `EditPlan` v6; planos antigos sem o campo continuam válidos. Contém ID, palavra da transcrição e seu snapshot de texto/tempo da origem, início/fim escolhido, deslocamento de -30 a +30 quadros, duração limitada em quadros. O esquema exige IDs seguros, máximo de 60 eventos, timestamps finitos e intervalos curtos. O arquivo original da pessoa nunca é alterado.

**Como usar:** no editor abra **Legendas → Texto falado → Destaques nas palavras**. A lista mostra até 12 palavras perto da agulha. Escolha uma, clique **Destacar palavra**. Para cada palavra, escolha no seletor **Movimento**: **Destaque (cor e peso)**, **Sublinhado animado** ou **Pulso suave**. É possível voltar a uma palavra marcada, trocar âncora/estilo, ajustar o início, remover e desfazer/refazer. Os três estilos aproveitam o renderizador tipográfico da legenda, sem criar objeto desconectado da fala. Sem transcrição aparecem instruções simples, sem opções impossíveis.

## Semântica de renderização e segurança da edição

- Agendador transforma cada palavra da mídia original em quadros exatos da timeline editada, limitado pelas bordas de cada segmento. Copiar o segmento repete o destaque; excluir/retalhar a palavra inteira ou parte dela suprime o evento; mover o segmento muda seu instante no resultado sem perder a âncora.
- Reordenar **clipes de arquivos diferentes** recalcula os tempos da origem pela identidade do clip e palavra, sem “mover” o destaque para um vídeo errado. Se o clipe fonte for excluído, remove o evento da cópia editada.
- Trechos com **quiet** ou **locked** suprimem o desenho semântico, e mudar evento dentro de trecho travado é recusado.
- Se a legenda for corrigida, o efeito só pode aparecer quando **o ID e o texto normalizado ainda correspondem ao snapshot original**, e quando `wordIds`/tokens continuam alinhados 1:1. Mesmo se a correção mantiver a quantidade de palavras, uma palavra substituída não é enfatizada. Nada é reancorado automaticamente após troca de narração; verifique antes de escolher outra palavra.
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

## Incremento 2 — três tratamentos visuais por palavra (#117, 24/10/2026)

- A propriedade opcional `semanticCues[].effect` admite somente `emphasis`, `underline` ou `pulse`; sua ausência mantém **exatamente o destaque antigo**, preservando projetos existentes e versões salvas. Valores desconhecidos são recusados pelo schema.
- **Destaque:** a palavra escolhida usa a fonte de ênfase, cor e escala do estilo. **Sublinhado animado:** traço que cresce da esquerda para a direita sob a palavra, durante a fala, na cor do estilo. **Pulso suave:** adiciona até 0,24 à escala e volta ao tamanho normal no primeiro e último quadro do evento, sem uma transição brusca no final. Não usa WebGL, câmera ou serviços externos.
- Se a pessoa corrigir uma legenda com **o mesmo número de tokens**, mas alterar a palavra associada ao `wordId`, o sistema não renderiza efeito sobre o texto substituto. Também diferencia duas ocorrências com o mesmo texto.
- A interface permite trocar o movimento do evento sem perder o deslocamento ou o vínculo com a origem; mudar o efeito participa do desfazer, refazer, projeto salvo e reabertura. Cortes, duplicações, ordenação de clipes e trechos quiet/locked continuam usando a mesma agenda por quadros.
- TDD: o teste de escolha de efeito falhou antes do setter; os testes de desenho falharam antes da implementação; os testes de correção textual e borda de pulso também reproduziram falhas reais antes das correções.
- **QA final:** `npm run typecheck`, **96 arquivos / 1.736 testes unitários**, `npm run build` com verificação dos assets, `git diff --check` e **4/4 E2E no Brave**. O E2E exportou um MP4 **via Worker com `pulse` ativo** (duração FFprobe 3,114667 s; 1.298.393 bytes; vídeo 1080×1920, áudio AAC). O FFmpeg decodificou dois quadros. Os testes `semantic-render.test.ts` verificaram a diferença de desenho nos quadros com `underline` e `pulse` em 24/30/60 fps e a ausência de efeito em palavras corrigidas. O teste do MP4 **não** é inspeção visual humana nem comprova equivalência pixel a pixel com a prévia.

### Teste manual rápido no Brave

1. Abra a branch de integração no Brave (build local); importe um vídeo curto em que a fala tenha sido transcrita.
2. Entre em **Legendas → Texto falado → Destaques nas palavras**, escolha uma palavra próxima da agulha e clique **Destacar palavra**.
3. Troque **Movimento** entre Destaque, Sublinhado animado e Pulso suave. Use a palavra na lista para navegar até o instante. Avance quadro a quadro para conferir entrada e saída.
4. Teste desfazer/refazer, salve, feche/reabra o projeto e confirme que o movimento continua. Exporte um vídeo curto e compare a região da palavra com a prévia.
5. Corrija a palavra na legenda e confira que o efeito antigo não migra para outra palavra. Se a gravação mudar, verifique o alinhamento antes de criar novo evento.

## Limites e próximo gate

**São dois incrementos funcionais da #117, não a certificação de todas as animações por palavra.** Há um seletor simples para três movimentos por ocorrência; ainda faltam controles de duração e curva, outros efeitos, revisão visual com pessoas e gravações reais, vídeos longos/multiclipe, hardware/codec/memória e paridade de imagem preview/MP4. Nenhum desses testes mede criatividade ou viralização.

A PR vai para `integration/pr-consolidation-20261024` somente. `main`/Cloudflare continuam bloqueadas pelos gates de release, licenciamento #2 e QA #10.
