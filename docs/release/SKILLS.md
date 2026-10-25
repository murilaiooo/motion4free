# Uso de skills nesta revisão

Revisão iniciada em 24/10/2026 sobre `main` SHA `941b791`. As cópias locais das skills do Matt Pocock foram inspecionadas em `.agents/skills` do workspace principal; a branch de release está isolada para não sobrescrevê-las.

| Skill | Aplicação real ou motivo da não execução integral |
| --- | --- |
| `codebase-design` | Vocabulário de módulo, interface, seam, profundidade e teste de deleção para delimitar mudanças pontuais sem reescrever sistemas |
| `diagnosing-bugs` | Reproduziu `npm run fixture` quebrando no Windows/WSL; verificou a saída após a correção |
| `tdd` | Critérios de comportamento e 3 testes do novo gate de arquivos da Cloudflare. **Não** foi um ciclo red→green estrito, pois o primeiro teste foi adicionado após a implementação |
| `implement` | Correção funcional de geração de fixtures e proteção da build |
| `code-review` | Revisão focada do diff e dos comandos executados, sem alegar revisão externa ou subagente independente |
| `writing-for-agents` | Referências canônicas e passagem de bastão nos documentos deste diretório |
| `pr` | Estrutura de evidência, risco de merge e reversibilidade no PR |
| `handoff` | Continuidade documentada em STATUS/RUNBOOK, sem dados privados |
| `improve-codebase-architecture` | Leitura da orientação e análise preliminar, mas HTML/grilling não concluídos: nenhuma refatoração ampla foi justificada |
| `domain-modeling`, `research`, `triage`, `to-spec`, `to-tickets`, `wayfinder`, `retro` | Consideradas. Tickets/spec existentes cobrem o backlog, e esta entrega de correção limitada não exige inventar novas abstrações ou duplicar decisões |
| `implement-spec`, `setup-pre-commit`, `prototype`, `grilling`, `grill-with-docs`, `ask-matt`, `setup-matt-pocock-skills` | Não executadas: não se exigiu protótipo/entrevista, nem instalação adicional em máquina já configurada |

**Superpowers:** a metodologia de plano → implementação → verificação e TDD foi respeitada no escopo da correção; não se atribui execução de skills Superpowers sem verificar seus arquivos e sua disponibilidade efetiva. Não foram criados agentes paralelos nem resultados simulados.

Ver [STATUS](STATUS.md) para evidências de execução; a lista de skills lidas não constitui prova de uso completo.
