# Handoff para IA executora — roteiro firme e sem bater cabeça

## Fontes obrigatórias, ordem

1. `AGENTS.md`, `package.json`, `docs/superpowers/plans/2026-10-20-plano-produto-final.md`, ADR-0005, ADR-0018..0023, docs/quality. **Atualizar se main mudou**.
2. `docs/research/master-2026-10-21/opencut-integration/README.md`, depois `02-workbench-ux-spec.md`, `03-workbench-build-playbook.md`, `08-execution-roadmap.md`, `10-qa-matrix.md`, `11-source-map-and-licenses.md`.
3. Verificar PRs abertos (inclusive PR #67 documentação, PR #55 QA e quaisquer novos); conferir arquivos atuais antes de editar. **Não confiar em resumo de v0.22.0 quando main já está v0.22.1**.
4. Para uma feature concreta, ler a seção exata de 04/05/06 e os arquivos upstream registrados em 11. Não fazer `git clone` integral dos dois upstreams se uma inspeção exata bastar; cache de evidências.
5. Fazer **apenas a próxima tarefa executável**. Primeiro OCU-01, a menos que já concluído em main/PR recente. Planos não são merge/implementação.

## Padrão de execução da IA

- Entrar em branch de feature limpa a partir da main mais nova; nunca commitar trabalho parcial em main.
- Declarar objetivo verificável: `PR scope`, `files expected`, `acceptance checks`, `rollback`.
- Ler código existente, reusar helpers; nenhum rewrite genérico de UI ou motor, nenhum arquivo duplicado.
- Criar patch mínimo, adicionar testes novos focados no comportamento alterado, avaliar regressões do escopo. **Uma rodada inicial de typecheck/test/build; repetir somente o teste diretamente afetado após uma correção e explicar motivo**, sem loop de CI.
- Em UI, preservar React component identity/player refs e `data-testid` (ou migrar E2E no mesmo PR); medir 1024/1366/1920 px e dark/light; rolagem/teclado.
- Em modelo, alterar schema + migrations + fixtures; aplicar comandos validados; uma ação de arraste -> um undo; testar saved projects reais sem sobrescrevê-los.
- Em mídia, verificar MP4 real/frame inicial e final/áudio/sync antes de afirmar "funciona"; renderer e export devem concordar; sem upload silencioso.
- Documentar autoria/license/notices, novos errors M4F-xxx, release notes e bump da versão para mudança publicada, segundo `AGENTS.md`.
- Abrir PR pequeno; informar ao responsável em português simples: o que mudou, como testar **na página**, limitações, link e status de testes. O usuário faz validação manual; nunca pedir que rode comandos técnicos por você.

## Handoff em inglês para colar em outra IA

> **Role:** Senior lead frontend/video editor engineer for Motion4Free.
>
> **Repository:** `murilaiooo/motion4free`. **Goal:** evolve the existing browser-first video editor into a polished, OpenCut-inspired editing workstation without replacing its engine.
>
> **Read first:** `AGENTS.md`; `docs/research/master-2026-10-21/opencut-integration/README.md`; `02-workbench-ux-spec.md`; `03-workbench-build-playbook.md`; `08-execution-roadmap.md`; `10-qa-matrix.md` and source map `11-source-map-and-licenses.md`. Check the current main branch, open PRs, ADRs and product plan to avoid duplicate work.
>
> **Work ONE task at a time. Start with OCU-01 (resizeable workspace shell) unless already implemented.** Preserve the present editor's 8 tabs, preview, timeline, inspector, asset import, local storage, undo, export, shortcuts and existing test IDs. Do not change media/render/schema during a UI-only task. Use the OpenCut Classic working 3-panel workbench and the new OpenCut's shell/theming patterns as references; the new OpenCut editor is unfinished. Never fork/wholesale-copy their stacks.
>
> **Rules:** zero mandatory paid services; no silent uploads; TypeScript/Vite/React/Mediabunny/Canvas2D/OPFS remain; no breaking saved projects. Use small PRs, specific acceptance tests and a concise Portuguese browser-only manual test. No looping repeated CI jobs; report blocked quotas truthfully. Build first, inspect results, fix root cause once, and rerun only impacted checks. Keep license provenance. Version/changelog/error codes follow AGENTS.md. Do not merge without gates; never claim untested behavior works.
>
> **Deliver:** scoped code PR, summary of exact files, evidence and remaining blockers. Proceed to the next task only after current task's gate.

## Formato do relatório ao fim de cada PR

```text
TASK: OCU-XX — título
BASE: main@<sha>  PR: #<n>
SCOPE: <arquivos e módulos>
IMPLEMENTADO: <funcionalidades verdadeiras>
NÃO FEITO: <futuros recursos, explicitly>
VERIFICAÇÃO: <comando/caso => passou/falhou/não executado>
REGRESSÕES: <saved project, undo/redo, preview/export, layout>
LICENÇAS: <third-party reused? yes/no; NOTICE>
TESTE MANUAL (PT-BR): 3 a 6 passos na UI
BLOCKERS: <apenas reais>
NEXT: <OCU-XX>
```

## Decisão sob ambiguidade

Use o padrão mais simples do M4F que atinge o contrato de produto. Anote tradeoff em ADR curto se mudar arquitetura. Não travar perguntando opções técnicas. Se não há hardware, browser, crédito de CI ou code ownership, conclua até o limite verificável, declare o que não foi testado e deixe a sequência documentada. Não falsificar screenshots/logs.
