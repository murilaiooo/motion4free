# ADR-0002 — IA local-first, decisões pequenas, quotas controladas

- **Estado:** proposto, aguardando aprovação da especificação.
- **Contexto:** APIs gratuitas têm quotas por modelo/projeto/org e não sustentam serviço ilimitado sem restrições.
- **Escolha proposta:** regras e classificadores/embeddings locais primeiro; modelo local quando hardware permitir; APIs gratuitas e autorizadas somente para decisões criativas complexas; fallback offline sem bloquear edição.
- **Nunca:** credenciais do mantenedor no browser; modelo executar código arbitrário; criar contas múltiplas para contornar limits; enviar mídia sem consentimento.
- **Consequências:** qualidade criativa variável por hardware/cota; transparência; benchmarks por tarefa; validação semântica e humana essencial.
- **Prova decisiva:** fluxo completo com todas APIs bloqueadas e comparação local vs híbrido em conjunto de testes.
- **Referências:** [engine](../ai/decision-engine.md), [custo/quotas](../ai/routing-and-costs.md).
