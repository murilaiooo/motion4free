# Cloudflare Workers AI na conta do usuário — investigação #191

Em 03/11/2026, o catálogo de escopos respondeu ao GET anônimo em `/client/v4/oauth/scopes` com HTTP 400, código Cloudflare 9106 e resultado nulo (cabeçalhos de autenticação ausentes). A consulta não usou credenciais. A evidência comprova a exigência de autenticação nesse endpoint. Consentimento, inferência, telemetria e cobrança continuam sem prova com conta real. [Catálogo oficial de escopos](https://developers.cloudflare.com/api/typescript/resources/iam/subresources/oauth_scopes/methods/list/)

## Conexão e permissões

Uma aplicação de navegador pode usar Authorization Code com PKCE S256 e autenticação do cliente `none`. Registrar a URI de retorno e a origem CORS exatas, gerar verifier por tentativa e validar o state ao voltar. O cliente nasce privado, restrito a membros da conta que o registrou. Para atender outros usuários, a Cloudflare exige verificação de domínio e dados públicos da aplicação. Tornar o cliente público é irreversível. O usuário escolhe a conta e pode revogar a autorização. [Registro e PKCE](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/) · [Consentimento e revogação](https://developers.cloudflare.com/fundamentals/oauth/authorizing-an-application/)

Para uma prova de inferência direta, a referência de execução lista Workers AI Read e Write como permissões aceitas, e o guia de token personalizado indica Read e Edit. Registrar o menor conjunto que efetivamente funciona e seus IDs retornados pelo catálogo autenticado. Separar analytics opcional e implantação de Worker da autorização de inferência. A permissão OAuth Clients Write é usada pelo responsável pelo registro. [Execução REST](https://developers.cloudflare.com/api/resources/ai/methods/run/) · [Guia de token](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) · [Registro do cliente](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/)

## Worker na conta escolhida

Um Worker pode receber o binding `AI` e executar `env.AI.run(modelo, entrada)` sem embutir uma chave no navegador. O binding autoriza a chamada interna, enquanto o acesso à URL pública precisa de proteção própria. Para o piloto, proteger produção e prévias com Access, limitar ao proprietário e verificar cada rota antes de habilitar inferência. Validar origem, método, modelo, tamanho e limite de saída no Worker. Exigir consentimento explícito para qualquer dado enviado. [Binding Workers AI](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/) · [Cobertura do Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## Consumo e custo

A franquia publicada é 10.000 Neurons por dia com reinício às 00h UTC. Workers Free bloqueia ao esgotar. No Workers Paid, o excedente custa US$ 0,011 por 1.000 Neurons. Alguns modelos exigem meio de pagamento. Restringir a prova a uma conta Free, um modelo elegível e texto sintético. O painel Workers AI expõe uso em Neurons. [Preços e exceções por modelo](https://developers.cloudflare.com/workers-ai/platform/pricing/)

| Modelo | Neurons por milhão de tokens de entrada | Neurons por milhão de tokens de saída |
| --- | ---: | ---: |
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | 4.119 | 34.868 |
| `@cf/meta/llama-3.2-11b-vision-instruct` | 4.410 | 61.493 |
| `@cf/meta/m2m100-1.2b` | 31.050 | 31.050 |

Para transcrição, `@cf/openai/whisper-large-v3-turbo` usa 46,63 Neurons por minuto de áudio. Um trecho decodificável de 30 segundos estima 23,315 Neurons. Essa tarifa não comprova qualidade, idiomas nem precisão de timestamps. [Tabela de áudio](https://developers.cloudflare.com/workers-ai/platform/pricing/#audio-models)

Para 1.000 tokens de entrada e 100 de saída, o primeiro modelo estima 7,61 Neurons usando a tabela de 03/11/2026. Registrar modelo, contagens e data do preço. Essa estimativa cobre só a chamada calculada. [Tabela de preços](https://developers.cloudflare.com/workers-ai/platform/pricing/)

O GraphQL disponibiliza agregados por dataset e a Cloudflare desaconselha usar esses dados como medição de cobrança. O schema é dinâmico. Antes de montar uma consulta, inspecionar campos disponíveis em `viewer.accounts`, unidade, janela, permissões e disponibilidade na conta Free. Esta investigação não confirmou dataset/campo consultável para Neurons dessa conta. Se indisponível, apresentar uso como desconhecido e encaminhar ao painel. O total das chamadas do editor exclui outros consumidores da mesma conta. [Limites da API analítica](https://developers.cloudflare.com/analytics/graphql-api/#limitations) · [Introspecção](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/introspection/)

## Gate em conta real

A hipótese da issue é `aiInferenceAdaptiveGroups.sum.totalNeurons`. Até a introspecção autenticada e a leitura da conta, manter esse campo como candidato. A API de Billable Usage é alfa e o painel de cobrança usa dados diários e exige Billing Read no modelo Pay-as-you-go. Consultar essa fonte só mediante autorização separada, para conciliação posterior. Os créditos pré-pagos do AI Gateway têm contabilização própria. [API de cobrança](https://developers.cloudflare.com/api/resources/billing/subresources/usage/) · [Painel e periodicidade](https://developers.cloudflare.com/billing/manage/billable-usage/) · [Pagamento com créditos](https://developers.cloudflare.com/workers-ai/platform/pricing/#pay-with-ai-gateway-credits)

1. Abrir o cliente privado no navegador, escolher a conta de teste, completar PKCE, recusar analytics opcional e confirmar o tratamento de cancelamento e revogação.
2. Confirmar o plano Free e a franquia no painel. Com consentimento, enviar uma única entrada sintética limitada e registrar modelo, resultado e horários, sem identificadores ou tokens.
3. Verificar em uma janela privada que todas as rotas de inferência, inclusive prévias, barram visitantes. Repetir autenticado com a origem real do editor para verificar sessão e CORS.
4. Comparar antes/depois no painel com os campos obtidos por GraphQL no mesmo dia UTC. Registrar atraso, granularidade e divergência. Sem essa medição, a interface só pode informar a estimativa local ou a indisponibilidade.

## Prova pública no Brave, 03/11/2026

No site Motion4Free, o rodapé informava v0.45.1 (40ef39e). A resposta HTML tem `connect-src` com uma lista de provedores que não inclui `api.cloudflare.com`. Um GET de identificação com credencial intencionalmente inválida falhou no Brave antes de obter uma resposta legível. Isso estabelece uma barreira na origem do editor.

Separadamente, enviamos OPTIONS com a origem do editor, método POST e cabeçalhos solicitados `authorization,content-type`. A API GraphQL respondeu 400. A rota de inferência com ID de conta fictício respondeu 405. Nenhuma dessas duas respostas forneceu `Access-Control-Allow-Origin`. Não foram enviados áudio, credenciais válidas ou pedidos de inferência. A resposta para a conta fictícia não certifica o comportamento de uma conta habilitada.

O MCP no Codex e a CLI do desenvolvedor têm autenticação própria. O sucesso do login nessas ferramentas não comprova login, inferência ou leitura de consumo pelo navegador do usuário final. Mantemos o provedor experimental fora do produto até a prova da arquitetura na conta de teste.
