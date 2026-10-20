# Catálogo de erros

Cada problema mostra na tela um código `M4F-xxx`. O código-fonte do catálogo é `src/core/errors.ts`.
Faixas: 1xx arquivo/vídeo, 2xx áudio, 3xx transcrição, 4xx exportação, 5xx edição, 6xx projeto salvo, 7xx player, 8xx estilo e animações, 9xx desconhecido, 10xx pedido por texto e IA.

| Código | Mensagem | O que costuma significar |
|---|---|---|
| M4F-101 | Formato de arquivo não reconhecido. | O arquivo não é um vídeo ou está corrompido. Tente outro arquivo. |
| M4F-102 | O arquivo não tem faixa de vídeo. | O arquivo só tem áudio ou imagem. |
| M4F-103 | Este navegador não consegue ler o vídeo deste arquivo. | Codec do vídeo não suportado pelo navegador. Teste no Chrome/Edge atualizados. |
| M4F-104 | Nesta versão de teste o vídeo pode ter no máximo 3 minutos. | Corte o vídeo para até 3 minutos. |
| M4F-105 | Não foi possível abrir o vídeo. | Falha inesperada ao ler o arquivo; ver detalhe. |
| M4F-201 | Não foi possível ler o áudio do vídeo. | O áudio do vídeo não pôde ser decodificado. |
| M4F-301 | Não foi possível baixar o modelo de transcrição. | Falha de rede ao baixar o modelo ou o runtime. Desde a v0.1.3 o app tenta primeiro o espelho no próprio site (`[site]`) e depois os servidores originais (`[direto]`: huggingface.co, cdn.jsdelivr.net); o detalhe lista as duas tentativas. Causas comuns: firewall, antivírus, rede instável. |
| M4F-302 | O modelo de transcrição baixou, mas não conseguiu iniciar neste navegador. | Modelo baixado, mas WebGPU e WASM falharam ao iniciar. Ver detalhe. |
| M4F-303 | A transcrição da fala falhou. | Erro durante a transcrição em si. |
| M4F-304 | O processo de transcrição parou inesperadamente. | O Worker de transcrição travou (memória, script não carregou). |
| M4F-305 | O servidor do modelo de transcrição respondeu com erro. | O servidor respondeu 401, 403, 429 ou 5xx. O detalhe traz o status e o servidor; `HTTP 502` no espelho do site significa que a Cloudflare não alcançou o Hugging Face. |
| M4F-401 | Este navegador não consegue gerar vídeo. Use Chrome ou Edge atualizados no computador. | Nenhum codificador de vídeo disponível. |
| M4F-402 | A geração do vídeo falhou. | Falha durante a geração do MP4; ver detalhe. |
| M4F-501 | A legenda não pode ficar vazia. | Ao editar, o texto da legenda ficou em branco. O texto anterior é mantido. |
| M4F-502 | A legenda pode ter no máximo 120 caracteres. | Texto longo demais para caber na tela. Divida em frases menores. |
| M4F-503 | Não dá para cortar o vídeo inteiro. | O ajuste de corte removeria todos os trechos. |
| M4F-601 | Não foi possível salvar o projeto neste navegador. As edições se perdem ao fechar a aba. | O navegador não oferece armazenamento local (OPFS), está em janela anônima ou sem espaço. A edição e a exportação continuam funcionando. |
| M4F-602 | O projeto salvo não pôde ser aberto e foi descartado. | O arquivo do projeto no navegador está incompleto ou é de uma versão incompatível. Escolha o vídeo de novo. |
| M4F-603 | Este não é o mesmo vídeo do projeto salvo. | Ao reabrir, o vídeo escolhido tem tamanho ou duração diferente do original do projeto. Escolha o arquivo certo ou comece outro vídeo. |
| M4F-604 | Para continuar o projeto salvo, escolha de novo o vídeo original. | O navegador apagou (ou não conseguiu guardar) a cópia local do vídeo. O projeto e as edições continuam salvos; basta escolher o mesmo arquivo. |
| M4F-701 | Não foi possível tocar a prévia. | Falha ao decodificar quadros ou iniciar o som da prévia; a exportação pode funcionar mesmo assim. Ver detalhe. |
| M4F-801 | As fontes do estilo não carregaram; o vídeo usa uma fonte reserva. | Os arquivos de fonte do app não baixaram (rede instável, bloqueio do navegador) na página ou durante a geração do vídeo. Tudo continua funcionando, mas as letras ficam com a fonte padrão do sistema. Recarregue a página; o detalhe lista quais fontes falharam. |
| M4F-802 | Este estilo não existe nesta versão do app. | Pedido de troca para um estilo que esta versão não tem. Nada é alterado. |
| M4F-1001 | Escreva o que você quer antes de aplicar. | O campo "O que você quer?" estava vazio ao apertar Aplicar. Nada muda. |
| M4F-1002 | O pedido pode ter no máximo 500 caracteres. | Pedido longo demais. Resuma em frases curtas. |
| M4F-1003 | Não entendi nenhum pedido neste texto; nada mudou. Veja os exemplos. | Nenhuma palavra do pedido é conhecida pelas regras (o detalhe lista as palavras). Use palavras como "calmo", "animado", "elegante", "sem zoom", "destaque os números". |
| M4F-1004 | A fala não tem frases completas e curtas para sugerir um gancho. | A transcrição não tem frase de 2 a 14 palavras e até 60 caracteres. O vídeo segue com o título automático. |
| M4F-1005 | A IA no navegador não funciona neste aparelho (precisa de WebGPU); usei as regras. | Navegador sem WebGPU. O pedido foi entendido só pelas regras. |
| M4F-1006 | A IA no navegador não carregou ou parou; usei as regras. | Falha ao baixar o modelo (~300 MB), memória de vídeo insuficiente ou sem resposta em 60 s. Ver detalhe. |
| M4F-1007 | A IA respondeu fora do formato esperado; usei as regras. | A resposta da IA não era um objeto JSON. Nada do que ela disse foi usado. |
| M4F-1008 | O serviço da sua chave não respondeu; usei as regras. | Falha de rede, tempo esgotado (30 s) ou erro do Google (5xx). A chave nunca aparece no detalhe. |
| M4F-1009 | O serviço recusou a sua chave (confira se ela está certa ou se o limite gratuito acabou); usei as regras. | Resposta 400 de chave inválida, 401, 403 ou 429 (limite gratuito). |
| M4F-999 | Erro inesperado. | Erro não previsto; ver detalhe. |

Erros 3xx são avisos: o vídeo continua sendo editado e exportado sem legendas e sem título.
Erros 5xx não alteram nada: a edição é recusada e o plano fica como estava.
