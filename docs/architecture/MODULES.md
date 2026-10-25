# Mapa dos módulos (estado do código v0.30.0)

Este é o mapa de entrada do código executado, não uma proposta de reescrita. Veja [ADR-0005](../decisions/0005-stack-v1.md) para as decisões aprovadas. O mapa não substitui os ADRs.

| Local | Responsabilidade e interface de integração |
| --- | --- |
| `src/app/` | Fluxos React, estado de tela, editor, importação, projetos, criador de clipes e configuração |
| `src/app/settings/` | Configuração de IA e permissões; chamadas e armazenamento reais ficam em `src/ai/` |
| `src/app/production/` | Interface do fluxo de produção e progresso |
| `src/app/workbench/` | Experiência experimental de edição e suas telas |
| `src/core/` | Contratos versionados, erros M4F, projeto, armazenamento e presets |
| `src/engine/` | Operações de timeline, clipes, histórico e mistura de música |
| `src/analysis/` | Funções de energia, silêncio, áudio, ASR e alinhamento |
| `src/asr/` | Transcritor local Whisper e Worker; não equivale a ASR por API externa |
| `src/editorial/` | Regras de edição, interpretação de pedido, seleção contextual, montagem e mapeamento para a gravação |
| `src/ai/` | Seleção de provedores, credenciais, consentimento, cotas, cache e execução |
| `src/media/` | Decodificação, player, exportação e Worker de vídeo |
| `src/render/` | Composição Canvas, cenas, legendas, máscaras e enquadramento |
| `worker/` | Cloudflare Worker para arquivos estáticos e espelhos de modelos autorizados |
| `tests/` | Testes Vitest de contratos e lógica; `e2e/` contém testes Playwright |
| `scripts/` | Builds, pré-verificação de arquivos e geração de mídia de teste |
| `docs/decisions/` | Decisões arquiteturais aprovadas; `docs/reviews/` guarda evidências históricas |
| `docs/release/` | Estado corrente de publicação, operação e passagem de bastão |

## Fluxos de dados que devem permanecer estáveis

1. Importação local: interface → `src/media/input.ts` / `multi.ts` → projeto persistido → plano de edição versionado.
2. Análise: dados de áudio → `src/analysis` → transcritor `src/asr` → trechos e palavras → `src/editorial`.
3. Edição: ações da interface → operações `src/engine` e `src/editorial` → histórico e armazenamento.
4. Prévia/exportação: plano e arquivos originais → `src/render` / `src/media` → arquivo de saída. Não considerar a UI de sucesso uma prova de MP4 válido.
5. IA por API opcional: chave em memória/cofre → consentimento do texto exato → domínio permitido em `src/ai/providers` → resposta validada → operação editorial. Nenhum vídeo deve ser enviado implicitamente.

## Dívida atual, sem refatoração especulativa

- Os relatórios do Vite apontam importações dinâmicas ineficazes nos fluxos `App.tsx`, `Editor.tsx`, mídia e projeto; otimizar somente após medir bundle e comportamento no Brave.
- A UI do seletor de modelos ainda não recomenda com base em validação real da tarefa. Ver issue #126.
- Roteamento de transcrição por API é uma frente distinta da interpretação de texto. Ver issue #127.
- Implementações experimentais em PRs #116 e #119 não fazem parte deste mapa de produção e exigem QA próprio.

**Critério de refatoração:** melhorar localidade e interface de um módulo com regressão demonstrada, sem substituir sistemas funcionais só por estilo arquitetural.
