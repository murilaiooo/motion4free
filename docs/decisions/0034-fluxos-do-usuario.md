# ADR-0034 — Fluxos do usuário: vídeos primeiro, perguntas durante o preparo (v0.32)

Data: 30/10/2026 · Status: aceito

## Contexto
O responsável achou a ordem dos fluxos errada e as opções mal distribuídas (30/10/2026). Mapa completo, com prints, em `/mnt/project-files/motion4free/fluxos/mapa-de-fluxos-v0.32.md` (pasta do projeto). Problemas principais: dois caminhos disputando a primeira tela; seis perguntas antes de escolher o vídeo e depois espera parada; "Apagar" vermelho ao lado do nome no editor; nove abas (a última sumia em 900 px de altura).

## Decisões
1. **Primeira tela = dois cartões grandes**, cada um com seu botão de arquivo e exemplo animado: "Editar meus vídeos" e "Cortar um vídeo longo em clipes". "Meus projetos" vem logo abaixo. As abas de modo viraram abas do "Como funciona". A linha técnica de transcrição só aparece no cartão de clipes (onde o tempo pesa); continua em Configurações › Transcrição.
2. **Vídeos primeiro.** Escolher os arquivos inicia a preparação (transcrição/análise) e abre as perguntas ao mesmo tempo. A análise não depende das respostas; `produceFirstDraft` é aplicado quando as duas coisas terminam. Uma faixa no topo mostra o progresso e depois "pronto"; o botão final diz "Ver meu vídeo".
3. **Perguntas na ordem de interesse:** Destino → Visual → Legendas → Cortes (edição + duração numa etapa) → Pronto. "Ou escolha outro formato" só aparece em "Outro destino".
4. **Quem já concluiu uma vez** (`m4f.creative-setup.done`) começa no resumo "Usar as mesmas escolhas da última vez?".
5. **Uma preparação por vez.** Cada escolha de vídeos ganha um número; sair das perguntas descarta o resultado da anterior e uma nova espera a anterior terminar (o transcritor é único).
6. **Editor:** 7 abas na ordem de uso (Estilo = modelos + cores; Legendas; Textos = textos + emojis/formas; Mídia; Música; Pedir; Versões). Topo só com nome, Meus projetos, salvamento, desfazer/refazer, Configurações e Exportar. "Apagar" fica no cartão do projeto (com confirmação). "Começar outro vídeo" foi para a aba Mídia. Rodapé com 4 atalhos e o botão "Todos os atalhos".

## Consequências
- O E2E usa `pickVideos()` (escolhe e pula as perguntas) onde antes soltava o vídeo direto.
- Se o usuário abandona as perguntas, a análise em andamento continua no fundo até terminar, mas o resultado é ignorado.
