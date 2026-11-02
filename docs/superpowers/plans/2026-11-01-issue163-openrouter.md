# Issue #163 — resposta estruturada em modelos de raciocínio

> **For agentic workers:** usar superpowers:executing-plans, com TDD por tarefa.

**Goal:** impedir que raciocínio sem resposta vire M4F-1112 nos clipes.
**Architecture:** primeira chamada OpenRouter com esforço `none`; uma única recuperação com orçamento de raciocínio explícito e folga de saída. Cada envio conserva serviço/modelo, consentimento exato, cancelamento e reserva de orçamento. Resposta ainda passa pelo contrato de IDs reais dos clipes.
**Tech Stack:** TypeScript, Vitest, Playwright/Brave; nenhuma dependência nova.
**Spec:** issue [#163](https://github.com/murilaiooo/motion4free/issues/163), spec v1 e ADR-0005/0009/0028.

## Restrições

- Mesma pasta do projeto, branch `codex/issue-163-openrouter-thinking`, base PR #162 (`85848c7`); main preservada.
- Sem chave real, gasto, upload de mídia, GitHub Actions ou deploy. Dados sintéticos em toda prova automatizada.
- Novo erro M4F-1018 documentado; patch 0.37.1 preparado para publicação posterior.

## Foco da revisão

1. `content` vazio + `finish_reason:length`: recuperar uma vez, nunca aceitar um exemplo do raciocínio cortado.
2. HTTP 400 específico de raciocínio obrigatório: recuperar; 401/429/400 alheio não repetir.
3. Consentimento recusado, orçamento esgotado ou cancelamento: nenhum envio adicional.
4. JSON real em raciocínio terminado: aceitar somente objeto JSON completo e manter validação semântica de IDs.
5. Falha persistente: M4F-1018, preservar candidatos locais e parar outras janelas para poupar cota.

## Tarefa 1 — correção e prova de regressão

**Arquivos:** `src/ai/providers/{registry,client}.ts`, `src/ai/routing.ts`, `src/editorial/clip-discovery.ts`, `src/core/errors.ts`; testes `tests/openrouter-thinking.test.ts`, `tests/ai-routing-policy.test.ts`; E2E `e2e/issue163-openrouter.spec.ts`.

**Interfaces:** `providerCompleter`, `testModelForTask` e `testModel` mantêm assinaturas; recuperação interna reaproveita `CompletionOptions.authorize/beforeSend/signal`. `reserveRequest` considera o teto real `max_tokens` do pedido gerado.

- [x] Escrever testes de transporte simulado → leitor → descoberta real de clipes e observar falha na base.
- [x] Implementar esforço `none`, recuperação limitada, leitura segura e erro M4F-1018; acrescentar parada na descoberta.
- [x] Testar erro HTTP, cancelamento, consentimento, teto de orçamento, JSON/IDs e outros provedores.
- [x] Rodar suíte Vitest, TypeScript, build e E2E Brave com HTTP simulado; registrar evidência e limites.
- [x] Atualizar CHANGELOG, versão/lock, docs de erros e relatório com roteiro de teste sem terminal.
- [x] Revisar diff, fazer commit e abrir PR contra a branch da #162, sem merge/deploy.

## Progresso

- Baseline dirigida: 29/29 testes passaram em Windows (providers, clip-discovery-146, ai-json).
- A descrição da issue cita uma correção que não está na head remota da #162; implementar e provar neste patch.
- Revisão independente: segunda rejeição HTTP400 ainda repetia outra janela. Regressão RED→GREEN; agora terminal1018 com mensagem que cobre rejeição de configuração e saída esgotada.
- Resultado final e gate herdado: [relatório de evidência](../../release/ISSUE163-OPENROUTER-THINKING.md).
- Correção registrada em `d25d93f`; [PR #164 em rascunho](https://github.com/murilaiooo/motion4free/pull/164). Issue aberta até integração/aceitação; nenhum deploy.
