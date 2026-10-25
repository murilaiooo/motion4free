# OpenReel como base da timeline — auditoria verificável (#5)

**Data:** 24/10/2026 (horário local da investigação; runs do GitHub em 25/10 UTC).
**Upstream fixado:** [Augani/openreel-video, `367d7e90b61b5181f9861b852bb8b9d7a7d2954a`](https://github.com/Augani/openreel-video/tree/367d7e90b61b5181f9861b852bb8b9d7a7d2954a).
**Produto testado:** [app.openreel.video](https://app.openreel.video/) no Brave para Windows.
**Destino de comparação:** Motion4Free v0.30.1, `main` após PR #143.

## Veredito

**Não adotar/forkar OpenReel como motor principal do Motion4Free.** Manter o `EditPlan` v6, timeline local, Canvas2D `drawFrame`, WebCodecs/Mediabunny e seu histórico. O OpenReel é **um editor verdadeiro e um benchmark útil**, não apenas uma landing page, mas substituí-lo exigiria migrar simultaneamente um modelo de `Project/Timeline/Track/Clip` e um motor de exportação inteiro sem evidência de preservação de todos os projetos, âncoras de palavras, seleções e ajustes manuais do Motion4Free. O custo e risco da substituição superam o benefício comprovado. Não copiar módulos ou importar dependências nesta issue.

**Reutilização futura permitida:** conceitos observados — operações tipadas/reversíveis, snapping com alvos explícitos, presets de export, UX de guias e edição por tracks — somente em pequenas entregas locais, sob issues já existentes (#11, #28, #27) e novo teste de paridade preview/MP4. Nada foi instalado no runtime do Motion4Free.

## Provas realizadas (e seus limites)

### 1. Código original executado, sem modificá-lo

Clone raso em pasta **ignorada** fora do checkout ativo: `I:\codex\motion4free\.local\upstream\openreel-issue5`. Commit original `367d7e9`; **8.591 caminhos Git** (contagem de `git ls-files`; não é contagem de linhas ou apenas código). Monorepo `pnpm@11.7.0`, `@openreel/core@0.1.0`, `@openreel/web@0.1.2`. `pnpm` instalado temporariamente com Corepack, dependências apenas de `@openreel/core` com `--frozen-lockfile --ignore-scripts` e 325 pacotes, sem introduzir pacotes ao Motion4Free.

Duas execuções independentes do Vitest do upstream, todas aprovadas:

| Grupo | Suites / testes | Arquivos executados |
| --- | ---: | --- |
| Timeline, posição, exportação e timing de áudio | **4 / 96 PASS** | `src/timeline/clip-manager.test.ts`, `timeline-items.test.ts`, `src/export/export-engine.test.ts`, `mp4-audio-timing.test.ts` |
| Importação, legendas, execução de ações/undo e criação | **5 / 58 PASS** | `src/media/media-import-service.proxy.test.ts`, `src/text/subtitle-engine.test.ts`, `src/actions/action-executor.test.ts`, `action-types.test.ts`, `src/actions/handlers/creation.test.ts` |
| **Total direcionado** | **9 / 154 PASS** | **Não** equivale a todos os testes do upstream |

**Importante:** `src/export/export-engine.test.ts` substitui o renderizador/encoder por mocks; os 51 testes dessa suite **não provam, isoladamente, pixels nem um arquivo exportado**. A exportação real foi verificada separadamente, diretamente no app público no Brave (abaixo). O teste de `subtitle-engine` prova lógica de legenda, mas não foi realizado E2E de legenda embutida no MP4 do OpenReel.

### 2. Fluxo real no Brave com mídia sintética autorizada

No site de produção do **próprio OpenReel**, novo projeto Vertical 1080×1920 → import local `e2e/fixtures/fala-com-pausas.webm` (aprox. 6 s) → duplo clique no item de mídia → **Keep Current** no aviso de proporção (fonte 1280×720) → videoclipe inserido na timeline e botão Export habilitado.

- **Undo após importar:** clipe sai da timeline e botão Export fica desabilitado; **Redo:** clipe volta e Export é reabilitado.
- Selecionando o clipe, entrada em `Playhead timecode` aceita `2` segundos. **Split here** habilita, e cria **duas ocorrências visíveis** de `fala-com-pausas.webm`; **Undo** reverte a divisão a uma ocorrência. Controle `Trim start/end` apareceu habilitado com playhead no intervalo. **O gesto de trim não foi executado no browser**; sua regra foi exercitada pelos testes do `ClipManager`.
- **Exportação real via browser:** modo `Export Video`, `Download to this device`, arquivo baixado `New Vertical Video.mp4`. `ffprobe`: **6.033333 s**, **4.943.173 bytes**, H.264 **1080×1920**, áudio **AAC**. `ffmpeg` extraiu um quadro de 1 s convertido para 32×32 RGB (3.072 bytes), comprovando decodificação. Nenhuma exceção `pageerror` observada neste fluxo.
- O editor possui UI **Text** e **Add captions**, e testes do `SubtitleEngine` passaram. **Não comprovado** neste escopo: editar legenda e conferir correspondência de pixels/áudio no MP4 do OpenReel. Não anunciar isso como E2E concluído.
- Não foram utilizados mídia privada, contas pagas ou chaves de API.

## Matriz de cobertura e decisão

| Capacidade / risco | Evidência OpenReel | Motion4Free existente | Decisão |
| --- | --- | --- | --- |
| Importação | WebM sintético apareceu na biblioteca e timeline no Brave; sete testes de import por proxy | `src/media/input.ts`, múltiplos testes E2E de mídia | **Não trocar**; comportamentos equivalentes no caminho prioritário |
| Split/trim | Split + undo **ao vivo**, 36 testes de `ClipManager` (inclusive trim, locks, limites) | `src/editorial/manual.ts`, `src/engine/timeline.ts`; testes E2E de timeline | **Adaptar apenas ideias** de snapping/ações se surgir problema específico |
| Captions/texto | `subtitle-engine.test.ts` 8 PASS; UI de Text/Add captions presente; sem MP4 de legenda E2E | `src/render/captions.ts`, wordIDs, SRT, efeitos por palavra #117 | **Preservar mecanismo próprio** e verificações de origem |
| Undo/redo | Ação reversível após importar e dividir **verificada no Brave**; `action-executor.test.ts` 39 PASS | `src/engine/history.ts`, persistência e versões existentes | **Não substituir** um histórico funcional |
| Exportação | 51 testes do engine com mocks; **MP4 real H.264/AAC 1080×1920 validado separadamente** | Canvas2D comum à prévia/export + Mediabunny; MP4 real local com FFprobe | **Não introduzir encoder concorrente** |
| Motion/preview | Renderizadores e componentes próprios no upstream; **não medida paridade** preview↔MP4 | `drawFrame`, presets, motion #117 | **Sem prova** de benefício de troca; benchmark futuro isolado |
| Contrato de projeto | OpenReel `Project` inclui `Timeline`, `tracks`, `clips`, `subtitles`, `mediaLibrary` | `EditPlan` v6, `segments`, `captions.wordIds`, `ranges`, cenas, histórico e âncoras | **Incompatível sem adaptador bidirecional e migração testados**, não importar formatos cegamente |
| Performance/custo | Nenhum benchmark isonômico RAM/CPU/codec em longa duração; monorepo maior **não prova** app mais lento | Runtime mais enxuto sem segundo motor | Sem mérito medido para reescrever, **nenhuma alegação de superioridade de velocidade** |
| Licenças/dependências | Raiz upstream MIT; `@openreel/core` declara FFmpeg packages, GSAP, Three, MediaPipe, shaders etc; web inclui `posthog-js` | Motion4Free mantém stack já decidida (ADR-0005); nenhum pacote novo nesta pesquisa | **Licença da raiz não autoriza automaticamente copiar assets/shaders/modelos** |
| Privacidade | `useAnalytics.ts` só inicializa PostHog se **duas variáveis** `VITE_PUBLIC_POSTHOG_KEY`/`HOST` existirem; não está provado se estão ativas no site hospedado | Browser-first, sem telemetria do responsável | Não presumir coleta do OpenReel por padrão; evitar introduzir instrumentação opcional sem discussão |

### Fonte primária e arquivos que sustentam a decisão

- [Timeline e modelos do OpenReel](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/packages/core/src/types/timeline.ts)
- [ClipManager e testes](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/packages/core/src/timeline/clip-manager.ts)
- [ActionExecutor e testes](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/packages/core/src/actions/action-executor.test.ts)
- [Subtitle engine](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/packages/core/src/text/subtitle-engine.test.ts)
- [Export engine — cuidado com mocks](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/packages/core/src/export/export-engine.test.ts)
- [Dependências core](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/packages/core/package.json), [web](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/apps/web/package.json) e [analytics opcional](https://github.com/Augani/openreel-video/blob/367d7e90b61b5181f9861b852bb8b9d7a7d2954a/apps/web/src/hooks/useAnalytics.ts)
- Arquitetura vigente do Motion4Free: [ADR-0005](../../decisions/0005-stack-v1.md). [Decisão final desta avaliação](../../decisions/0032-openreel-not-primary-timeline.md).

## Critério de conclusão da issue #5

O objetivo da #5 é **avaliar** adotar/adaptar/descartar, não integrar obrigatoriamente. Há código original verificado e prova real de import/split/undo/export, prova unitária de trim/caption e decisão arquitetural motivada. **Resultado:** descartar OpenReel como base substituta; monitorar padrões úteis sem incorporar runtime.

**Limites que não se devem apagar:** sem importação de projeto OpenReel no M4F; sem teste de trim ao vivo; sem captions E2E/MP4 no upstream; sem avaliação humana de qualidade visual; sem benchmark de longa duração. Nenhum destes testes comprova que a qualidade criativa do Motion4Free é superior à do OpenReel. A ausência de migração intencional decorre da decisão de não trocar o motor, não de uma alegação de incompatibilidade absoluta.

Issue #5 pode ser **encerrada como avaliação concluída/alternativa descartada**, com este relatório, **sem fechar** as issues de motion, editor avançado, QA humano e direitos de terceiros.
