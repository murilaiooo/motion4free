# Catálogo de erros

Cada problema mostra na tela um código `M4F-xxx`. O código-fonte do catálogo é `src/core/errors.ts`.
Faixas: 1xx arquivo/vídeo, 2xx áudio, 3xx transcrição, 4xx exportação, 9xx desconhecido.

| Código | Mensagem | O que costuma significar |
|---|---|---|
| M4F-101 | Formato de arquivo não reconhecido. | O arquivo não é um vídeo ou está corrompido. Tente outro arquivo. |
| M4F-102 | O arquivo não tem faixa de vídeo. | O arquivo só tem áudio ou imagem. |
| M4F-103 | Este navegador não consegue ler o vídeo deste arquivo. | Codec do vídeo não suportado pelo navegador. Teste no Chrome/Edge atualizados. |
| M4F-104 | Nesta versão de teste o vídeo pode ter no máximo 3 minutos. | Corte o vídeo para até 3 minutos. |
| M4F-105 | Não foi possível abrir o vídeo. | Falha inesperada ao ler o arquivo; ver detalhe. |
| M4F-201 | Não foi possível ler o áudio do vídeo. | O áudio do vídeo não pôde ser decodificado. |
| M4F-301 | Não foi possível baixar o modelo de transcrição. | Download do modelo ou do runtime falhou. O detalhe diz o servidor (huggingface.co, cdn.jsdelivr.net, cas-bridge…). Causas comuns: bloqueador de anúncios, firewall, rede instável. |
| M4F-302 | O modelo de transcrição baixou, mas não conseguiu iniciar neste navegador. | Modelo baixado, mas WebGPU e WASM falharam ao iniciar. Ver detalhe. |
| M4F-303 | A transcrição da fala falhou. | Erro durante a transcrição em si. |
| M4F-304 | O processo de transcrição parou inesperadamente. | O Worker de transcrição travou (memória, script não carregou). |
| M4F-401 | Este navegador não consegue gerar vídeo. Use Chrome ou Edge atualizados no computador. | Nenhum codificador de vídeo disponível. |
| M4F-402 | A geração do vídeo falhou. | Falha durante a geração do MP4; ver detalhe. |
| M4F-999 | Erro inesperado. | Erro não previsto; ver detalhe. |

Erros 3xx são avisos: o vídeo continua sendo editado e exportado sem legendas e sem título.
