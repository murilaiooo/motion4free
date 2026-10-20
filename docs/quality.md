# Verificação de qualidade — Motion4Free

> **Atualizado na Fase 1 (20/10/2026):** o app existe e tem verificações automáticas.

## Verificações do app (Fase 1)
| Comando | O que verifica |
|---|---|
| `npm run typecheck` | Tipos de todo o código (TypeScript estrito) |
| `npm test` | Testes de unidade das camadas puras: contratos, linha do tempo, silêncio, cortes protegidos, legendas, render, emenda de áudio |
| `npm run build` | Build de produção e remoção do `.wasm` do ONNX acima de 25 MiB |
| `npm run fixture && npm run e2e` | Ponta a ponta no Chromium: vídeo com pausas → análise → exportação → MP4 conferido (1080×1920, AAC, duração) |

A CI (`.github/workflows/app-ci.yml`) roda os quatro em todo PR. O Chromium de testes não tem H.264, então a CI valida o caminho de reserva (VP9 + AAC em WASM); o caminho H.264 é validado no teste manual no Chrome, conforme o [plano mestre](superpowers/plans/2026-10-20-plano-mestre.md).

## Histórico (antes do app)
Integração do Vibe Coding Toolkit adaptada ao estado documental do repositório.

## Evidência atual
- GitHub Actions `Documentation check`: valida arquivos obrigatórios e links Markdown relativos. Ver [Actions](https://github.com/murilaiooo/motion4free/actions).
- Submódulo `vibe-coding-toolkit`: confirma presença e pin do upstream no Git; **não comprova instalação/ativação de CLIs e skills**.
- Arquivos `PRODUCT.md`, `AGENTS.md`, `CLAUDE.md`, documentos de arquitetura e revisão: estrutura de contexto.
- Nenhum editor/benchmark de Motion4Free executado.

## Verificação de conteúdo sem app
1. Verificar árvore e revisão do submódulo: `git submodule status`.
2. Verificar que as referências na documentação são arquivos existentes ou URLs externos.
3. Conferir se modificações de requisitos atualizam `PRODUCT.md`, spec, ADR e critérios de aceitação.
4. Exigir avaliação de licenças e provenance antes de versionar assets ou modelos.

## Testes a implantar **depois** que stack e spec forem aprovadas
- `lint`, `typecheck`, `test`, `build` com comandos da stack realmente escolhida.
- QA de media: MP4 real reproduzível, A/V sync, legendas, waveform, EDL, safe area, tempos, CPU/GPU e memória.
- QA de scene graph: render determinístico por timestamp, export/preview paritários, sources licensed, segurança contra conteúdo não confiável.
- QA criativa: comparação cega humana com trabalhos de motion designers; mesma gravação sob briefs distintos; penalização de resultados genéricos.
- Harness engineering: testes de autorização, recuperação de contexto, escopo e ambiente isolado sem executar ações fora do projeto.
- Security: inspeção de segredos, dados privados, prompt injection na transcrição, APIs externas opt-in.

## Ferramentas do upstream (sob demanda)
- [Prompt de revisão de código](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/03-multi-agent-code-review.md)
- [Prompt de revisão de segurança](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/13-security-review.md)
- [Avaliação de harness](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/14-harness-evaluation.md)
- [Guia de quality gates](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/tools/06-eslint-biome-quality-gates.md)

A configuração ESLint/Next não está aplicada porque ainda não existe stack definida. Não instalar regras genéricas sobre um código que ainda não existe.

## Plano de regressão de UX inspirado no Editonny atualizado

**Pendente de implementação/stack.** As suítes [`quality.spec.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/e2e/quality.spec.ts), [`locale.spec.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/e2e/locale.spec.ts) e [`draft.test.ts`](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/request/draft.test.ts) servem como **padrões de testes**, não como evidência de qualidade do Motion4Free.

| Camada futura | Casos mínimos para especificar | Evidência |
|---|---|---|
| Contratos de brief | Schema inválido/corrompido, enums e IDs falsos, texto grande, preset parcial, prioridades, proibição `none`, locks, rollback e versões antigas | Tests unitários, golden cases por idioma |
| i18n | pt-BR/en-US/es na interface, links localizados, labels e IDs estáveis; manter gravação/transcrição no idioma original | Testes unitários e de navegação |
| UI/design tokens | Dois temas, todas as variantes usadas, sem overflow, contraste, foco, teclado, leitor de tela, headings/landmarks, reduced-motion e sem erros de console | Testes de componentes + Playwright/axe, desktop e viewport móvel |
| Storage e links | Bloqueio/corrupção/quota, perda de cache, fallback temporário visível, duas abas, URL pública sem dados privados, restauração de projeto | Fixtures e testes de recuperação |
| Timeline/mídia | Waveform de áudio **real**, timebase de FPS não inteiro, cortes, seek fora de ordem, legendas por palavra, safe areas e sincronização após revisão | Frames e áudio capturados, tolerâncias numéricas fixadas previamente |
| Preview/export | Mesma composição no mesmo frame, MP4 com vídeo + áudio, codecs detectados por browser, memória e arquivos originais preservados | Arquivos MP4 reproduzidos e inspecionados, não só status verde da UI |
| Arte e semântica | Três briefs da mesma gravação, avaliação cega de direção de arte, integridade de fatos/negações, anti-repetição e plano B sem API | Dataset permitido, notas humanas, pior caso e logs de decisões |

**Não reproduzir as exclusões de legendas ilustrativas do axe upstream** em legendas reais. Legibilidade do conteúdo exportado precisa de testes próprios sobre fundos móveis e safe areas; ausência de erro em DOM não comprova acessibilidade de vídeo.

A CI do Editonny testa seu site Next.js; a nossa CI só deve receber comandos de build, lint, TS e Playwright **depois que a stack for aprovada**, com falhas e artefatos acessíveis. Enquanto o app não existir, manter o `Documentation check` sem afirmar que valida vídeo. O resultado verde do [CI do Editonny](https://github.com/soumatheusgomes/editonny/actions/runs/39210390804) não substitui nenhum teste local.
