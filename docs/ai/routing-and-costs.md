# IA local-first e roteamento de cotas gratuitas

**Objetivo:** custo monetário zero sem depender de cota ilimitada de APIs. O modelo gratuito não opera diretamente o renderizador.

## Ordem de escolha
1. **Sem IA generativa:** regras editoriais, VAD/waveform, metadados, semântica determinística, seleção objetiva.
2. **Modelo local no navegador:** WebLLM (quando hardware permitir), Transformers.js para classificação/embeddings/transcrição.
3. **API externa gratuita e opcional:** usada apenas para gancho, narrativa ou ambiguidade que justifique a chamada.
4. **Fallback conservador:** resultado coerente com regras, qualidade criativa potencialmente inferior, sem bloqueio de editor.
5. **Intervenção manual:** usuário pode escolher gancho/cena; preservar edições existentes.

## Política de quotas
- Adaptadores por provedor `capabilities, context_limit, json_mode, models, safety, rate_limit, transport`.
- Métricas por modelo/tarefa: validade de JSON, adequação semântica, latência, cobertura de idioma, regressões, limite restante quando fornecido.
- `429` e `Retry-After`: backoff, circuit breaker, cooldown; evitar tempestades de retry.
- Cache idempotente por assinatura dos dados+versão de prompt+versão da biblioteca.
- Budget explícito: número máximo de tentativas por tarefa e projeto, escalonamento apenas quando risco/valor justificar.
- Evitar chamada em operações determinísticas e edições de estilo triviais.
- Não usar várias chaves/contas para contornar quotas ou termos; limites podem ser por projeto/organização.

## Segurança de credenciais
- **Nunca publicar segredo no front-end** nem em exemplos, GitHub Actions, logs ou projeto do usuário.
- BYOK apenas se houver integração apropriada ao provedor para apps client-side; preferir OAuth/token delegado quando suportado.
- Uso de chave do mantenedor requer pequeno proxy seguro com quotas, autenticação, rate limiting, abuso e armazenamento seguro (custo operacional a medir); **não é solucionado por hosting estático**.
- Privacidade: por padrão, mídia/transcrição ficam localmente. Opt-in informado para texto/frames enviados, especificando provedor e política de dados.
- Não enviar vídeo bruto se texto derivado for suficiente.
- Proteger contra prompt injection vindo da própria transcrição: fala do vídeo é DADO, nunca instrução para o agente.

## Provedores candidatos (a confirmar no dia da integração)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits): quotas e termos variam por modelo/projeto.
- [Groq rate limits](https://console.groq.com/docs/rate-limits): quotas organizacionais/modelo.
- [OpenRouter free models](https://openrouter.ai/models?max_price=0): modelos livres e limites variáveis.
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/): conferir cota real antes de depender.
- [LiteLLM](https://github.com/BerriAI/litellm): estudar estratégias de fallback e circuit breakers; instalar servidor LiteLLM não é obrigatório.
- [WebLLM](https://github.com/mlc-ai/web-llm): inferência local, limites por GPU/memória.
- [Transformers.js](https://github.com/huggingface/transformers.js): pipelines locais.

## Matriz de operação
| Estado | Gancho | Motion | Corte | Export |
|---|---|---|---|---|
| API disponível e autorizada | ranking assistido | escolha IA+regras | local | local |
| APIs esgotadas, modelo local apto | modelo local | semântico local | local | local |
| Sem WebGPU e API | regras e seleção do usuário | cenas óbvias ou nenhuma | local se codec permitir | conforme codec |
| Codec não suportado | mostrar limitação/alternativa | prévia se possível | conforme decoder | formato compatível ou bloqueio honesto |

## Risco estrutural
Gratuidade por usuário não implica gratuidade ilimitada para o mantenedor. Transferência de modelos, armazenamento CDN, abusos e comunicação com APIs podem ter custos ou limites. **Proibir na UI promessas como “IA ilimitada, sem custo, qualquer dispositivo”** até provas de carga, orçamento e termos.

## Métricas de operação
`local_decision_ratio, tokens_per_project, external_requests_per_project, fallback_rate, blocked_rate, cache_hit_rate, offline_completion_rate, human_override_rate, export_success_rate`. Não registrar transcrições privadas em telemetria sem escolha do usuário.
