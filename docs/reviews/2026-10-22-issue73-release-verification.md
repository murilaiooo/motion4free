# Motion4Free #73 — Verificação independente para integração na main (22/10/2026)

## Escopo exato e preservação de trabalho
- Base: `origin/main` em `84e13c6`, worktree isolada `fix/73-qa-release-20261022`.
- Implementação validada: commits de #97 (consentimento, revogação, paginação, timeout, privacidade) e do roteamento de #99 necessário para seleção por tarefa/projeto e orçamento previsto na #73.
- Correções seletivas de ownership, sincronização entre abas, proteção do cofre, preferências, cancelamento e cache extraídas de `review/integration-static-hardening`; **nenhuma outra feature experimental da PR #116 foi integrada**.
- Política CSP para os arquivos estáticos conferida a partir da revisão de #12, sem mover mídia nem credenciais para servidores.
- Nenhuma edição na raiz `I:\codex\motion4free`, que continua contendo trabalho local não commitado. Não foram feitas chamadas autenticadas com chaves verdadeiras, compra de tokens, upload de vídeos ou exportações longas.

## Provas automatizadas
1. `npm ci --ignore-scripts --no-audit --no-fund`: passou.
2. `npm test` (Vitest): todos os testes passaram na branch focada, incluindo 6 novos casos de consentimento/HTTP e 4 novos testes de ciclo do cofre, cancelamento e outras abas. As 5 falhas da branch experimental #116 não existem nesta integração isolada; a única divergência de documentação M4F-1218/1219/1220 foi corrigida.
3. `npm run typecheck` e `npm run build`: passaram. Build de produção remove WASM de 25,6 MiB excedente do artefato de teste (via `scripts/prune-dist.mjs`). Não publicar `build:e2e` como build de produção.
4. Brave real com Playwright: `e2e/issue73-consent.spec.ts` passou. Mock de catálogo/geração do Groq; antes do consentimento, nenhuma transmissão; autorizar envia exatamente o corpo exibido; cancelar não envia; revogar apaga chave da sessão e impede plaintext em localStorage.
5. Brave smoke de Configurações: abertura, seis seções, fechamento/reabertura e ausência de erros de React passaram.
6. Vault: segredo cifrado persistido, senha não armazenada, um provedor removido sem perder outro, lock, evento de outra aba e cancelamento de deriva/criptografia assíncrona ao apagar cofre, todos aprovados.
7. Diagnóstico de CORS no Brave via `http://localhost:4173`: com chaves **sintéticas e inválidas** e texto artificial, GET /models e POST /generate retornaram HTTP observável (logo CORS pré-auth foi legível, sem proxy):
   - OpenRouter: modelos 200, geração 401;
   - Groq: 401/401;
   - Gemini: 400/400;
   - OpenAI: 401/401;
   - Anthropic: 401/401.
   Isso **não** atesta saldo, assinatura, entitlement nem geração autenticada em cada conta. O app separa esses estados por design. Não usar esses probes em CI.
8. Cloudflare local `wrangler dev --local`: startup OK, `_headers` processou 1 regra. HEAD / respondeu CSP, X-Frame-Options DENY, Referrer-Policy no-referrer e nosniff. Brave abriu a versão real da Worker, exibiu Configurações/IA e painel Groq, sem exceções nem violações CSP no cenário testado.

## Arquitetura e limites honestos
- Não há proxy do Motion4Free para credenciais ou solicitações pagas; a mídia continua local. O Worker do projeto já existe para obter arquivos públicos de modelos, não intermedeia chaves de API.
- O padrão usa regras sem chave; IA local opcional requer browser/hardware compatível. API é opt-in e pode gerar custo somente na conta do usuário.
- Falha/cancelamento não troca automaticamente para modelo pago, não retransmite e não remove edição manual.
- Um bloqueio por CORS, uma credencial inválida, uma conta sem saldo e falta de permissão são estados diferentes; modelos listados não são garantia de execução.
- As provas não cobrem cobrança/entitlement de contas reais nem todas as GPUs, navegadores, codecs ou serviços externos. Isso não pode ser prometido por testes sintéticos.
- O roteador avançado foi integrado por ser dependência funcional da #73, mas a issue autônoma #9 mantém seus próprios critérios de benchmark/regressão para revisão independente.

## Aceitação
Os gates técnicos e as jornadas com dados sintéticos essenciais da issue #73 passaram na branch limpa. Publicar via PR dedicada apontada a `main` e verificar que o SHA chegou à branch de destino antes de fechar. O relatório da primeira rodada em `2026-10-22-issue73-independent-qa.md` refere-se à branch experimental combinada #116, não a esta correção isolada.

## Último gate antes do merge
- `npm test`: **85 arquivos e 1.679 testes aprovados, 0 falhas** (v0.29.1).
- `npm run typecheck` e `npm run build`: 0 erros; avisos de tamanho de chunks e importações redundantes não bloqueiam compilação.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades informadas, inclusive baixas/moderadas, em 75 dependências de produção (`npm audit` reporta 0 no total).
- Artefatos de diagnóstico e o script de probe CORS transitório foram excluídos antes do commit; testes determinísticos permanecem versionados.
