# Issue #163 — OpenRouter sem resposta após raciocínio

Data local: 01/11/2026. Patch preparado: **0.37.1**, branch `codex/issue-163-openrouter-thinking`, baseada na head `85848c7` da PR #162. Não publicado, sem merge na main.

## Causa e mudança

Na base, OpenRouter recebia esforço `low` e a leitura aceitava qualquer prosa de `reasoning`/`reasoning_content` quando `content` estava vazio. O leitor dos clipes tentava interpretar esse pensamento como JSON e terminava em M4F-1112. O microteste de conexão também podia anunciar sucesso só porque o modelo tinha pensado, sem responder.

O patch pede `reasoning.effort: none`. Saída vazia com `finish_reason:length`, raciocínio sem resposta ou HTTP 400 específico de raciocínio obrigatório permitem **uma** recuperação: `reasoning.max_tokens: 2048` e mais 2048 tokens no teto total. Não combina `effort` com `max_tokens` dentro de `reasoning`. Mesmas mensagens, serviço e modelo; sem troca silenciosa. Para a política padrão de 800 tokens, os tetos totais são 2848 e 4896, respectivamente. A reserva local considera esses tetos reais, além dos bytes conservadores de entrada; não é medição de cobrança.

Cada envio passa novamente por `authorize`, sinal de cancelamento, cooldown e `beforeSend`/reserva de uso. A autorização de lote, quando escolhida pela pessoa, continua limitada àquela análise/serviço/modelo. Recusar a recuperação ou esgotar orçamento impede a segunda chamada.

Somente um objeto JSON completo pode ser recuperado de raciocínio terminado; pensamentos cortados são descartados mesmo contendo exemplos JSON. IDs, durações, ordem e ancoragem de clipes continuam validados pelo motor existente. Falha persistente, incluindo segunda rejeição de configuração, vira **M4F-1018** e interrompe outras janelas, preservando os candidatos locais.

Referências primárias consultadas: [reasoning e limite compartilhado de saída](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [parâmetros de geração](https://openrouter.ai/docs/api_reference/parameters). A documentação confirma que raciocínio pode consumir toda a saída e que alguns modelos exigem raciocínio; não comprova que cada modelo respeita o orçamento.

## Evidência local

Windows, Node **24.19.0**, Brave **156.1.98.63**. Nenhuma chave real, crédito, áudio, vídeo ou transcrição privada enviado; todas as respostas OpenRouter foram simuladas.

| Verificação | Resultado |
| --- | --- |
| Baseline dirigida da #162 | 29/29 passaram; não cobria a falha |
| Teste novo antes da correção | 13 falhas / 20 casos, incluindo M4F-1112 no cenário de raciocínio sem resposta |
| Regressão final `tests/openrouter-thinking.test.ts` | 23/23 passaram, incluindo clipes de 30–60 s, IDs inventados recusados, HTTP400/401/402/403/429/500, microtestes, orçamento, consentimento e cancelamento |
| Revisão independente | Encontrou repetição em outra janela após duas rejeições HTTP400. Reproduzido com teste falhando; corrigido para M4F-1018 terminal; regressão passou |
| `npm run typecheck` | Passou |
| `npm test` | **1830 passaram / 1 falhou**, em 108 arquivos; falha herdada descrita abaixo |
| `npm run build` | Passou, incluindo inventário de licença do dist e limite de arquivos |
| Brave/Playwright | **6/6 passaram**: quatro cenários da #163 + consentimento/revogação #73 + configuração de IA |
| MP4/FFprobe | Não executado neste patch: não altera mídia, cortes, compositor ou exportação |
| OpenRouter/Nemotron real | Pendente de teste autorizado pelo responsável; simulações não comprovam disponibilidade ou qualidade do serviço |

Comandos reproduzíveis, a partir da raiz:

```powershell
npm test -- tests/openrouter-thinking.test.ts
npm run typecheck
npm test
npm run build
$env:CHROMIUM_PATH='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
npx playwright test e2e/issue163-openrouter.spec.ts e2e/issue73-consent.spec.ts e2e/ai-routing-simple.spec.ts --workers=1
```

### Falha herdada de licença — gate geral não verde

`tests/license-audit.test.ts`, caso “grafo de runtime e avisos determinísticos permanecem consistentes com o lockfile”, falha em `--check` porque o gerador depende dos arquivos LICENSE de pacotes instalados para cada plataforma. O aviso rastreado foi gerado em outro ambiente. O fingerprint do grafo continua correto; `--dist` passa.

Gerar novamente no Windows passou no teste, mas removeu avisos de pacotes Linux ausentes e acrescentou avisos Windows. Essa substituição foi **descartada**, preservando os direitos/notices anteriores. `scripts/audit-licenses.mjs`, `public/licencas-bibliotecas.txt` e o teste permanecem idênticos à base. Esta falha não é tratada como sucesso nem como autorização para publicar. A correção da portabilidade da auditoria deve preservar os avisos de todas as plataformas em trabalho separado.

Os seis workflows da conta foram consultados e permaneciam `disabled_manually`; nenhum workflow foi habilitado ou solicitado.

## Teste simples do responsável

1. Abra a prévia local indicada na entrega pelo Brave e confira **v0.37.1** no rodapé.
2. Nas Configurações de IA, mantenha o mesmo OpenRouter/Nemotron grátis do relato. Se quiser testar o serviço real, confira cada pedido e só autorize o envio de texto quando concordar com a cota/custo informado. Não é necessário comprar créditos.
3. Reabra o projeto de clipes, escolha 30–60 segundos e clique em **Reanalisar toda a transcrição**.
4. Autorize o pedido. Se houver recuperação, confira o segundo pedido (ou use a autorização de lote já disponível). Cancelar deve interromper sem novo envio.
5. Se o serviço responder, os clipes devem mostrar a revisão por IA. Confira o sentido dos trechos. Se continuar sem resposta ou rejeitar o raciocínio, deve aparecer **M4F-1018**, preservando os clipes locais. Texto realmente inválido ainda pode gerar M4F-1112.

Gate humano e confirmação com o serviço real continuam pendentes; a issue não foi encerrada nem o patch publicado por estes testes.
