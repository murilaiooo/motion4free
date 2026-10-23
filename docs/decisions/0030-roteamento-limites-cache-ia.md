# ADR-0030 — Roteamento explícito e limites de IA

21/10/2026. IMPLEMENTED — NOT TESTED / AWAITING QA. Refs #9 e #73; depende do Draft PR #97.

A seleção global existente não tinha controles por tarefa, reserva de uso, cache, cooldown nem circuito. A nova política mantém a escolha humana: sem ranking inventado de modelos ou migração automática para pago. Projeto → tarefa global → escolha geral é a ordem. As três tarefas reais são pedido/gancho, revisão de trecho e ranking/títulos de clipes; não expor tarefas sem implementação.

Limites locais contam cada envio autorizado, inclusive conexão/reparo/falha. Reserva conservadora: bytes UTF-8 do corpo + teto de tokens de saída. Isso é uma unidade local de orçamento, não contagem real de tokens, saldo nem limite financeiro externo. Usar também spend caps no provedor. Contadores contêm só quantidade/estimativa por ID de projeto (ranking usa hash de metadados do arquivo). Navegadores com Web Locks serializam reservas por origem; sem storage/locks, a garantia é apenas nesta aba. A interface explica isso.

Respostas ficam só em memória, até 20, TTL 10 minutos. SHA-256 da versão, projeto, tarefa, modelo, credencial opaca e mensagens evita igualdade parcial de prompts. Pedidos simultâneos idênticos compartilham a promise; falhas não são cacheadas. Qualquer troca de credencial e a limpeza de respostas invalidam gerações antigas. Nenhum segredo entra na assinatura ou nos contadores, e o hash da mensagem não é persistido.

O transporte central aplica cooldown por provedor, independente da chave (não contornar cota). `Retry-After` aceita segundos ou data HTTP, mínimo 1s; ausente/inválido usa 60s. Três falhas de transporte/5xx abrem circuito por 60s; sucesso em voo não pode apagar um 429 mais recente. Sem retry automático. Cancelamento/consentimento mantém as garantias do #97.

Preços/saldo reais só podem ser afirmados com dados oficiais de cada serviço. Esta entrega não inventa saldo nem ranking de desempenho; comparação de modelos, CORS e qualidade são gates de QA. Preferências por projeto permanecem locais neste navegador, separadas do plano/histórico e sem retranscrição. A exportação das preferências existente só contém metadados, sem chaves.
