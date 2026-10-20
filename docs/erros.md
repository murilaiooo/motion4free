# Catálogo de erros

Cada problema mostra na tela um código `M4F-xxx`. O código-fonte do catálogo é `src/core/errors.ts`.
Faixas: 1xx arquivo/vídeo, 2xx áudio, 3xx transcrição, 4xx exportação, 5xx edição e trechos, 6xx projeto salvo e versões, 7xx player, 8xx estilo, animações e imagem de referência, 9xx desconhecido, 10xx pedido por texto (geral e por trecho) e IA.

| Código | Mensagem | O que costuma significar |
|---|---|---|
| M4F-101 | Formato de arquivo não reconhecido. | O arquivo não é um vídeo ou está corrompido. Tente outro arquivo. |
| M4F-102 | O arquivo não tem faixa de vídeo. | O arquivo só tem áudio ou imagem. |
| M4F-103 | Este navegador não consegue ler o vídeo deste arquivo. | Codec do vídeo não suportado pelo navegador. Teste no Chrome/Edge atualizados. |
| M4F-104 | Nesta versão de teste o vídeo pode ter no máximo 3 minutos. | Corte o vídeo para até 3 minutos. |
| M4F-105 | Não foi possível abrir o vídeo. | Falha inesperada ao ler o arquivo; ver detalhe. |
| M4F-106 | Dá para juntar no máximo 30 vídeos num projeto. Escolha menos vídeos. | Desde a v0.14 dá para enviar vários vídeos curtos de uma vez. Acima de 30 o app recusa antes de abrir qualquer um (o detalhe traz quantos foram escolhidos). O limite protege a memória do aparelho e o tempo de transcrição ([ADR-0019](decisions/0019-varios-videos-e-formatos.md)). |
| M4F-107 | Os vídeos juntos podem ter no máximo 10 minutos. Escolha menos vídeos ou vídeos mais curtos. | A soma das durações passa de 10 minutos. O vídeo final do Reels tem até 3 minutos, mas as gravações podem somar mais porque silêncios e tentativas repetidas saem. Acima de 10 min o áudio de todos os clipes não cabe com folga na memória de um celular. O detalhe traz a soma. |
| M4F-108 | Um dos vídeos não pôde ser lido e ficou de fora; os outros foram montados normalmente. | Com vários vídeos, um arquivo que não abre (formato desconhecido, sem imagem, codec que o navegador não lê, mais de 3 minutos) não impede os outros. O detalhe traz o nome do arquivo e o código do motivo (M4F-101 a M4F-105). |
| M4F-109 | O aparelho ficou sem memória para ler todos os vídeos. Tente com menos vídeos, vídeos mais curtos ou feche outras abas. | O navegador recusou memória ao decodificar o áudio ou os quadros dos clipes (comum em celular com muitos vídeos longos). Nada foi perdido; tente de novo com menos vídeos. |
| M4F-110 | Nenhum dos vídeos escolhidos pôde ser lido. | Todos os arquivos falharam ao abrir. O detalhe lista cada arquivo com o código do motivo. |
| M4F-201 | Não foi possível ler o áudio do vídeo. | O áudio do vídeo não pôde ser decodificado. |
| M4F-202 | O vídeo não tem som: ele fica sem legendas e sem cortes de pausas. Dá para escolher estilo e gerar o vídeo final. | O arquivo não tem faixa de áudio (gravação de tela sem microfone, vídeo exportado mudo). Sem som não há fala para transcrever nem pausas para cortar. Antes da v0.7 isso acontecia sem aviso. |
| M4F-301 | Não foi possível baixar o modelo de transcrição. | Falha de rede ao baixar o modelo ou o runtime. Desde a v0.1.3 o app tenta primeiro o espelho no próprio site (`[site]`) e depois os servidores originais (`[direto]`: huggingface.co, cdn.jsdelivr.net); o detalhe lista as duas tentativas. Causas comuns: firewall, antivírus, rede instável. |
| M4F-302 | O modelo de transcrição baixou, mas não conseguiu iniciar neste navegador. | Modelo baixado, mas WebGPU e WASM falharam ao iniciar. Ver detalhe. |
| M4F-303 | A transcrição da fala falhou. | Erro durante a transcrição em si. |
| M4F-304 | O processo de transcrição parou inesperadamente. | O Worker de transcrição travou (memória, script não carregou). |
| M4F-305 | O servidor do modelo de transcrição respondeu com erro. | O servidor respondeu 401, 403, 429 ou 5xx. O detalhe traz o status e o servidor; `HTTP 502` no espelho do site significa que a Cloudflare não alcançou o Hugging Face. |
| M4F-306 | Não encontrei fala neste vídeo: ele fica sem legendas e sem título. Dá para escolher estilo e gerar o vídeo final. | A transcrição terminou sem nenhuma palavra (só música, ruído, silêncio ou fala muito baixa). O detalhe traz quantos silêncios foram achados. Se tem fala, confira o volume do microfone. |
| M4F-307 | O modelo de legenda escolhido não funcionou neste aparelho; usei um modelo mais leve, e a legenda pode ter mais erros. | Desde a v0.8.0 o app tenta os modelos em escada (ADR-0013): no modo Precisa, Whisper large-v3-turbo na placa de vídeo → Whisper small no processador → Whisper base. Se um não baixa, não inicia (falta de memória da placa, navegador sem fp16) ou para no meio de um trecho, o próximo continua do mesmo trecho. O detalhe lista qual falhou, o código do motivo (M4F-301, 302, 303 ou 305) e qual fez a legenda. Não é falha: a legenda saiu, mas com um modelo menor. |
| M4F-401 | Este navegador não consegue gerar vídeo. Use Chrome ou Edge atualizados no computador. | Nenhum codificador de vídeo disponível. |
| M4F-402 | A geração do vídeo falhou. | Falha durante a geração do MP4; ver detalhe. |
| M4F-403 | Seu navegador não gera H.264: o vídeo funciona aqui, mas o Instagram pode recusar. Para o arquivo final, use Chrome ou Edge no computador. | O vídeo saiu em outro formato (VP9/AV1) porque o navegador não tem codificador H.264 (comum no Chromium sem codecs proprietários e em alguns Linux). Detalhe traz o formato usado. Antes da v0.7 este aviso aparecia sem código. |
| M4F-404 | A geração do vídeo não conseguiu ler um dos clipes. | Com vários vídeos, a exportação abre cada arquivo na sua vez. Um clipe que não abre nessa hora (cópia apagada pelo navegador, arquivo movido) interrompe a geração; o detalhe traz o clipe. Reabra o projeto escolhendo os vídeos de novo. |
| M4F-501 | A legenda não pode ficar vazia. | Ao editar, o texto da legenda ficou em branco. O texto anterior é mantido. |
| M4F-502 | A legenda pode ter no máximo 120 caracteres. | Texto longo demais para caber na tela. Divida em frases menores. |
| M4F-503 | Não dá para cortar o vídeo inteiro. | O ajuste de corte removeria todos os trechos. |
| M4F-504 | Este trecho está travado. Destrave para mudar. | Você pediu uma mudança (pedido do trecho, corte, restaurar corte ou corrigir legenda) dentro de um trecho travado. Nada muda. Use "Destravar" no painel do trecho. |
| M4F-505 | O trecho precisa ter pelo menos meio segundo dentro do vídeo editado. | O pedaço selecionado é curto demais ou está fora do vídeo editado. Arraste um pedaço maior ou corrija os campos de início e fim. |
| M4F-506 | Este pedaço encosta num trecho já ajustado. Clique no trecho existente ou escolha outro pedaço. | Trechos ajustados não podem se sobrepor. Clique no trecho que já existe (faixa "Trechos") para mudar o pedido dele. |
| M4F-507 | O vídeo precisa de pelo menos um clipe: não dá para tirar o último. | Na aba Clipes, "Tirar do vídeo" no único clipe que sobrou. Nada muda. |
| M4F-508 | O vídeo montado passa de 3 minutos, o máximo do Reels. Tire clipes ou corte mais para publicar como Reels. | Aviso (não bloqueia): o vídeo pode ser gerado, mas o Instagram não aceita Reels com mais de 3 minutos. Tire clipes, corte trechos ou use o corte "agressivo" no pedido. |
| M4F-601 | Não foi possível salvar o projeto neste navegador. As edições se perdem ao fechar a aba. | O navegador não oferece armazenamento local (OPFS), está em janela anônima ou sem espaço. A edição e a exportação continuam funcionando. |
| M4F-602 | O projeto salvo não pôde ser aberto e foi descartado. | O arquivo do projeto no navegador está incompleto ou é de uma versão incompatível. Escolha o vídeo de novo. |
| M4F-603 | Este não é o mesmo vídeo do projeto salvo. | Ao reabrir, o vídeo escolhido tem tamanho ou duração diferente do original do projeto. Escolha o arquivo certo ou comece outro vídeo. |
| M4F-604 | Para continuar o projeto salvo, escolha de novo o vídeo original. | O navegador apagou (ou não conseguiu guardar) a cópia local do vídeo. O projeto e as edições continuam salvos; basta escolher o mesmo arquivo. |
| M4F-605 | Limite de 20 versões guardadas. Apague uma para guardar outra. | Já existem 20 versões no projeto. Apague uma antiga na lista "Versões". |
| M4F-606 | Faltam vídeos do projeto salvo neste navegador. Escolha de novo os vídeos originais. | Projeto com vários vídeos: o navegador apagou a cópia de um ou mais clipes. As edições continuam salvas; escolha de novo os arquivos que faltam (o detalhe lista os nomes). Pode escolher todos de uma vez. |
| M4F-607 | Um dos vídeos escolhidos não é de nenhum clipe do projeto salvo; ele foi ignorado. | Ao reabrir um projeto com vários vídeos, um arquivo escolhido não bate em tamanho e duração com nenhum clipe que falta. O detalhe traz o nome. |
| M4F-701 | Não foi possível tocar a prévia. | Falha ao decodificar quadros ou iniciar o som da prévia; a exportação pode funcionar mesmo assim. Ver detalhe. |
| M4F-702 | A prévia não conseguiu ler um dos clipes; esse pedaço aparece preto na prévia. | Projeto com vários vídeos: um clipe não abriu na prévia (memória ou arquivo). O resto toca normalmente; a exportação tenta de novo e, se falhar, mostra M4F-404. |
| M4F-801 | As fontes do estilo não carregaram; o vídeo usa uma fonte reserva. | Os arquivos de fonte do app não baixaram (rede instável, bloqueio do navegador) na página ou durante a geração do vídeo. Tudo continua funcionando, mas as letras ficam com a fonte padrão do sistema. Recarregue a página; o detalhe lista quais fontes falharam. |
| M4F-802 | Este estilo não existe nesta versão do app. | Pedido de troca para um estilo que esta versão não tem. Nada é alterado. |
| M4F-803 | Não foi possível ler esta imagem. Use uma foto JPG, PNG ou WebP. | O navegador não conseguiu abrir o arquivo escolhido como imagem (formato não suportado, como HEIC, ou arquivo corrompido). Nada muda. |
| M4F-804 | A imagem é quase toda preta, branca ou cinza; as cores do estilo foram mantidas. | A imagem de referência não tem cores vivas para usar como destaque. Escolha uma imagem mais colorida. |
| M4F-805 | Os emojis não carregaram; o vídeo sai sem a fonte de emojis do app. | O arquivo de emojis do app (`m4f-emoji.woff2`, ~50 KB) não baixou (rede instável, bloqueio do navegador) na página ou durante a geração do vídeo. Os emojis podem sair com a fonte do sistema ou como quadradinhos. Recarregue a página e gere de novo. |
| M4F-1001 | Escreva o que você quer antes de aplicar. | O campo "O que você quer?" estava vazio ao apertar Aplicar. Nada muda. |
| M4F-1002 | O pedido pode ter no máximo 500 caracteres. | Pedido longo demais. Resuma em frases curtas. |
| M4F-1003 | Não entendi nenhum pedido neste texto; nada mudou. Veja os exemplos. | Nada do pedido corresponde a algo que o app sabe fazer (nem pelas regras nem pela IA, se ligada). O que foi reconhecido mas ainda não existe aparece em "Ainda não sei fazer". Use palavras como "legenda verde e amarela", "emojis a cada 3 segundos", "calmo", "sem zoom", "destaque os números". |
| M4F-1004 | A fala não tem frases completas e curtas para sugerir um gancho. | A transcrição não tem frase de 2 a 14 palavras e até 60 caracteres. O vídeo segue com o título automático. |
| M4F-1005 | A IA no navegador não funciona neste aparelho (precisa de WebGPU); usei as regras. | Navegador sem WebGPU. O pedido foi entendido só pelas regras. |
| M4F-1006 | A IA no navegador não carregou ou parou; usei as regras. | Falha ao baixar o modelo (leve ~300 MB, padrão ~0,9 GB, forte ~2,3 GB) ou sem resposta no tempo limite (60 s, 90 s ou 150 s, conforme o modelo). Ver detalhe. Falta de memória de vídeo tem código próprio (M4F-1013). |
| M4F-1007 | A IA respondeu fora do formato esperado; usei as regras. | O serviço da chave própria devolveu algo que não é a resposta esperada (corpo sem JSON ou sem texto). Respostas da IA com JSON quebrado ganham uma segunda tentativa; se ela falhar, o código é M4F-1012. |
| M4F-1008 | O serviço da sua chave não respondeu; usei as regras. | Falha de rede, tempo esgotado (30 s) ou erro do Google (5xx). A chave nunca aparece no detalhe. |
| M4F-1009 | O serviço recusou a sua chave (confira se ela está certa ou se o limite gratuito acabou); usei as regras. | Resposta 400 de chave inválida, 401, 403 ou 429 (limite gratuito). |
| M4F-1010 | Não entendi o pedido para este trecho; nada mudou. Veja os exemplos. | Nenhuma palavra do pedido do trecho é conhecida (o detalhe lista as palavras). Use "mais calmo aqui", "sem animação aqui", "troca essa animação", "destaque isso" ou "trava esse pedaço". |
| M4F-1011 | Não há outra animação possível neste trecho (falta fala ou as animações foram proibidas). | "Troca essa animação" num trecho sem palavras reconhecidas ou com as animações proibidas pelo pedido. Nada muda. |
| M4F-1012 | A IA respondeu fora do formato duas vezes (mesmo depois de pedir correção); usei as regras. | A resposta da IA não tinha um objeto JSON (ou nenhum campo válido) e a segunda tentativa, com o erro explicado, também falhou. O pedido foi entendido só pelas regras. Com o modelo leve isso é mais comum; tente o modelo padrão ou a chave própria. |
| M4F-1013 | Este aparelho não tem memória de vídeo suficiente para o modelo de IA escolhido; usei as regras. Tente o modelo leve. | A placa de vídeo não tem memória para o modelo (o padrão pede ~1,6 GB; o forte, ~3,4 GB) ou o navegador perdeu a GPU ao carregar. Escolha "leve" (~0,9 GB) ou use a chave própria. |
| M4F-999 | Erro inesperado. | Erro não previsto; ver detalhe. |

Erros 3xx são avisos: o vídeo continua sendo editado e exportado sem legendas e sem título.
Erros M4F-108 e M4F-508 são avisos: o vídeo continua sendo montado e exportado.
Erros 5xx não alteram nada: a edição é recusada e o plano fica como estava.
