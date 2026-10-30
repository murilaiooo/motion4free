# #126 — assistente guiado de IA: primeiro incremento funcional (24/10/2026)

## Entregue neste PR

- A configuração conserva os modos já existentes: **regras locais**, **IA no navegador** e **API com chave própria**. Texto de apresentação encurtado, funcionalidades antigas e cofre mantidos.
- Antes do catálogo, o usuário seleciona **a finalidade**: interpretar pedidos, selecionar clipes, revisar uma edição ou transcrever áudio.
- Para **transcrição**, o catálogo textual fica oculto e um link abre a aba de transcrição local. Não há upload remoto de áudio por meio deste incremento. A transcrição remota precisa da #127, com endpoint, preço por unidade e autorização de mídia próprios.
- Para tarefas **de texto**, a chave/API e os modelos vêm do provedor já existente. A lista mostra oito opções inicialmente, separa preço zero *informado pelo catálogo*, cota condicional, pago ou não informado, exibe a data da consulta e deixa contexto/IDs no bloco Detalhes.
- Cada modelo tem botão **Testar este modelo** no próprio cartão. Sem consentimento de texto ele fica desativado; com consentimento, o aplicativo solicita autorização do corpo exato antes de enviar, e um modelo pago/indeterminado exige confirmação prévia adicional. Não executa testes automáticos de todos os modelos.
- Testes sintéticos por finalidade: edição pede JSON com `ritmo=rapido`, curadoria escolhe `melhor=B`, revisão pede `ajuste=amarelo`. Resposta não JSON ou não aderente é falha, mesmo em HTTP 200. A UI apresenta sucesso/erro com código e tempo aproximado da tentativa.
- Após resultado válido, **Usar nesta tarefa** grava a rota global para esta tarefa via infraestrutura existente `taskRoutes`. As rotas opcionais por projeto e os limites permanecem intactos. **Usar este** continua selecionando o padrão geral sem garantir teste, com indicação explícita.
- Troca/revogação de credencial invalida catálogo e teste em andamento; chave não entra no `m4f-ia`, cache de modelo ou output de diagnóstico.
- Card de status mostra quando falta abrir chave/autorização. Não afirma que catálogo, teste mínimo ou nome de modelo garantem qualidade, crédito, preço de produção ou ASR.

## QA

- `tests/provider-microtest.test.ts` valida as três tarefas textuais, resposta inválida, não envio antes de consentimento, guarda de chave e corpo sintético com mocks.
- `e2e/issue126-model-picker.spec.ts` testa navegação em Brave, transcrição não compatível, consentimento por request, cancelar e autorizar, teste no mesmo cartão, confirmação extra de modelo pago, rota por tarefa e recusa de falso positivo HTTP 200.
- `e2e/issue73-consent.spec.ts` preserva a segurança de consentimento existente.
- `e2e/byok-identity.spec.ts` foi atualizado para a regra atual: consentimento geral não substitui a autorização de cada body; resposta vazia é M4F-1217, não sucesso.

**Resultado local (Windows/Brave, 24/10/2026):** `npm run typecheck` passou; `npm test` **93 arquivos / 1.719 testes** aprovados; `npm run build` passou, com gate de assets Cloudflare e cache estático versionado; **4/4 Playwright E2E no Brave** passaram para a nova seleção, consentimento existente, troca de credencial e respostas inválidas. Nenhuma chave real foi usada, toda rede simulada/interceptada. O teste funcional validou **a integração UI↔API simulada**, não a elegibilidade de um modelo real.

## Pendências antes de encerrar a #126

- Catálogo de capacidades com origem temporal, restrições reais por endpoint/modelo/região e filtros explicando incompatibilidade.
- Edição de lista e classificação por adequação com microbenchmark comparativo reproduzível em dados reais autorizados (o atual testa cumprimento de JSON, não qualidade criativa).
- Fontes/limites verificáveis de custo e cotas por conta, timestamps/TTL e estados de preço completos; a API não informa sempre os dados.
- Testar cofre bloqueado, 401/402/403/429, timeout, cache invalidado, recuperação e browsers/visuais/teclado de modo mais abrangente.
- Testes com pessoas leigas e tempo de configuração real. Testes com serviços reais apenas com autorização explícita para eventual cobrança.
- Integração segura de áudio por API e controles de consentimento específicos pertence à #127.

## Restrição de deploy

Integrar somente à branch `integration/pr-consolidation-20261024` por enquanto. **Não fazer merge à `main` ou deploy de produção** até os gates independentes de publicação e as etapas restantes da #126.
