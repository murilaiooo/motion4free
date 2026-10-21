# ADR-0028 — Configurações e IA com chave própria, sem servidor (v0.27)

**Status:** aceito (21/10/2026). Implementa a primeira parte da issue #73.

## Contexto
O responsável pediu um painel de Configurações e uma mesa de edição só com ferramentas de edição, com cada configuração explicada para leigos. A issue #73 define: sem servidor do Motion4Free, sem receber chaves nem arquivos, tudo guardado no aparelho; com a autorização da pessoa, só o texto necessário vai direto ao serviço de IA escolhido.

## Decisões

### 1. Tela Configurações
- Janela grande por cima da tela atual (`src/app/settings/`), aberta pelo botão **Configurações** no topo do início, dos clipes, do assistente e do editor. Fechar volta exatamente para onde estava: o editor continua montado por baixo, sem nova transcrição nem perda de seleção.
- Seis seções, na ordem da issue: IA e provedores, Transcrição, Armazenamento, Editor e aparência, Privacidade e segurança, Sobre e diagnóstico. O estado "aberta / seção" fica num store pequeno (`settings/route.ts`) para qualquer tela abrir uma seção sem repassar funções.
- Saíram da mesa: o botão de tema, o botão Armazenamento, "Restaurar layout" e as opções técnicas de IA (chave, modelo, tamanho). A aba IA do editor e o criador de clipes mostram só **"IA: (o que está em uso) · Alterar"**. A área de envio mostra **"Precisão da legenda: X · Alterar"**.
- A tela Armazenamento virou `StoragePanel` (mesmo componente, sem a janela própria).
- Exemplos animados onde a opção dá para mostrar: pedido entendido por regras × IA, legenda Rápida × Precisa, miniaturas dos temas e o caminho dos dados (o que fica no computador e o que vai ao serviço).

### 2. Serviços de IA (`src/ai/providers/`)
- OpenRouter, Groq, Google Gemini, OpenAI (API) e Claude (API da Anthropic). `registry.ts` é puro (monta pedidos, lê respostas, classifica erros) e tem teste; `client.ts` faz a rede.
- Domínio fixo por serviço (lista permitida, só HTTPS). O app nunca aceita endereço digitado junto com uma chave. `fetch` com `redirect: 'error'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, tempo máximo (lista 20 s, resposta 45 s) e sem repetir pedido sozinho.
- A lista de modelos vem do próprio serviço com a chave da pessoa (não é uma lista fixa de 2026). Ficam só modelos de texto: pelo tipo informado (OpenRouter, Gemini) ou, quando o serviço não informa (Groq, OpenAI), pelas famílias de fala/imagem/vetores, que saem pelo nome. Limitação conhecida e testada.
- Preço só quando o serviço informa (OpenRouter). Senão: "grátis dentro do limite da conta" (Groq, Gemini) ou "pode gerar cobrança" (OpenAI, Claude), com link para a página oficial de preços. Escolher um modelo pago ou de preço desconhecido pede uma confirmação. O app nunca troca de modelo sozinho: se falhar, avisa com código e usa as regras naquele pedido.
- Antes do primeiro envio a pessoa marca a autorização por serviço, com um exemplo do texto enviado. Sem autorização, nada é enviado (M4F-1203). A autorização é revogável em Privacidade.
- "Testar resposta do modelo" é um clique explícito, com aviso de que gasta um mínimo da cota. Listar modelos não gera texto.
- Erros com código próprio: 401, 403, 429, sem crédito, modelo sumiu, bloqueio de rede/CORS, demora e erro do serviço (M4F-1204 a M4F-1212). A chave é apagada de qualquer detalhe de erro.

### 3. Onde a chave fica (`src/ai/credentials/`)
- Padrão: só na memória da aba. Recarregar ou fechar apaga.
- "Lembrar neste navegador": cofre cifrado com AES-GCM 256 e chave derivada da senha da pessoa (PBKDF2-SHA-256, 600 mil rodadas, sal aleatório, IV novo a cada gravação), em `localStorage` `m4f-cofre`. A senha não é guardada. Isso protege a chave guardada no disco; não protege contra extensão ou script malicioso rodando na página aberta, e a tela diz isso em linguagem simples (use chave com limite de gasto).
- A escolha de IA (`m4f-ia`) é guardada sem nenhuma chave. Projeto, histórico, versões e relatórios de erro nunca contêm chave.
- A chave antiga do Gemini (`m4f-gemini-key`, texto puro até a v0.26) só muda de lugar com o clique da pessoa ("Usar só nesta aba" ou cofre) e a cópia antiga é apagada em seguida. `src/ai/own-key.ts` saiu.
- "Apagar tudo" (Armazenamento) apaga o cofre e a escolha de IA, e esquece as chaves da memória da aba.

## Fora desta versão (próximos passos da #73)
- Modelos diferentes por tarefa (pedido, clipes, gancho), orçamento e contagem local de uso.
- Mistral, Hugging Face e servidores locais (Ollama/LM Studio).
- Prova real de CORS por serviço no site publicado: não houve chave nem rede para isso no ambiente de desenvolvimento. Se um serviço bloquear o navegador, o app mostra M4F-1208 e a pessoa pode usar outro; nunca haverá proxy.
- Política de segurança de conteúdo (CSP) do site.

## Incremento de 21/10/2026 — implementação sem testes

O PR de identidade de conta foi preservado. O consentimento de exemplo é complementado por confirmação do corpo completo de cada envio, inclusive reparo e teste de conexão, mantido só em memória. Revogação de chave/consentimento cancela requisições e a UI não reaproveita resultado de outro modelo/conta. O timeout cobre o corpo HTTP. Corpos de erro não são copiados para diagnóstico. Operações assíncronas do cofre usam revisão e snapshot de ciphertext para não ressuscitar chave depois de lock/delete.

Estado: IMPLEMENTED — NOT TESTED / AWAITING QA. Roteiro detalhado em [handoff #73](../reviews/2026-10-21-issue73-implementation-handoff.md). Nenhuma evidência anterior verifica este incremento. Modelos por tarefa, orçamento e roteamento ficam vinculados à #9; CSP e CORS reais permanecem gates de QA, sem afirmação de compatibilidade.
