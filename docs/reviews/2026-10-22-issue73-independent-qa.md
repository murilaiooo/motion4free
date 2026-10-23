# QA independente, issue #73, 22/10/2026

## Alvo e isolamento
- Fonte: PR #116, `review/integration-static-hardening` @ `1a67127499d0c88a98dd04fed358c4f977c34af4`.
- Correção original: PR #97, `fix/73-exact-consent-revocation` @ `cba10d0`.
- Testes feitos em worktree isolada, sem editar a raiz com alterações não commitadas.
- Navegador E2E: Brave instalado no Windows, executado via Playwright em perfil temporário.
- Tráfego de provedores: respostas sintéticas interceptadas no navegador. Nenhuma requisição real faturável foi feita.

## Comandos e resultados
- `npm ci --ignore-scripts --no-audit --no-fund`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK, com avisos de tamanho de chunks/imports ineficazes.
- `npm test` (integração inteira): **REPROVADO**, 1.664 passaram e 5 falharam em 4 arquivos. Exemplos: `tests/errors.test.ts`, `tests/framing.test.ts`, `tests/selector.test.ts`. Não atestar CI verde.
- `npx vitest run tests/issue73-consent-security.test.ts tests/providers.test.ts tests/provider-connection.test.ts`: **22/22 OK**, incluindo 6 testes novos.
- `npx playwright test e2e/configuracoes.spec.ts -g "Configurações abre no início" --reporter=line`: **1/1 OK** no Brave.
- `npx playwright test e2e/issue73-consent.spec.ts --reporter=line`: **1/1 OK** no Brave.

## Evidências novas
- Sem transmissão de texto antes de consentimento por solicitação.
- Cancelamento de solicitação bloqueia o fetch; modal nativo exibe body exato sem incluir chave.
- Corpo aprovado idêntico ao corpo observado na interceptação; pedido inclui instrução de sistema e exemplo.
- Depois de esquecer a chave, ela desaparece da sessão e não aparece no localStorage.
- Timeout cobre a leitura do corpo, incluindo depois dos headers; texto confidencial ecoado no erro remoto não é exibido.
- Seção de configurações abre e alterna sem erro de React no teste de fumaça.

## Pendências para aceitação
- Suite total permanece vermelha; não mesclar #116 diretamente.
- A PR #97 original não tem as correções posteriores de segurança/estado da #116; não mesclar a PR antiga sem integração seletiva.
- Faltam testes de duas abas e crypto assíncrono com atrasos, reload/cofre protegido, CORS/entitlement reais dos provedores, cenários 401/403/429 e testes de consentimento durante reparo/edição.
- A issue #73 também depende da integração/regras de roteamento da #9. Não declarar a issue concluída somente com estes testes.

**Decisão QA:** aprovação parcial dos cenários cobertos; **issue aberta, nenhuma PR de implementação pronta para merge em main**.
