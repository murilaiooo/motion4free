# Histórico de versões

A versão aparece no rodapé do app (`Motion4Free vX.Y.Z · commit`). Cada mudança publicada sobe a versão em `package.json`.

## v0.3.0 — 20/10/2026
Fase 3: estilos e animações.
- **3 estilos bem diferentes para o mesmo vídeo**, escolhidos com um clique logo abaixo da prévia:
  - **Pop**: energético. Letras grandes em maiúsculas, a palavra que está sendo falada aparece numa caixa amarela, flash nos cortes, muitas animações.
  - **Editorial**: elegante, como revista. Letra serifada nos títulos, legenda que "acende" palavra por palavra, movimento lento e poucas animações.
  - **Documental**: sóbrio. Painéis escuros à esquerda, letra técnica, quase sem movimento.
  Trocar de estilo muda letras, cores, animações e ritmo, e dá para desfazer. O vídeo final sai no estilo escolhido, e o estilo fica salvo com o projeto.
- **Legendas maiores e mais fortes**, com destaque na palavra falada e nas palavras-chave (ex.: "segredo", "nunca", "erro").
- **Animações que acompanham a fala**, escolhidas automaticamente pelo que é dito: número grande quando você fala um número ("noventa por cento" vira **90%**), lista quando enumera ("primeiro…, segundo…"), pergunta em destaque, seu nome na tela quando você se apresenta ("meu nome é…"), zoom em frases fortes, transição nos cortes, barra de progresso e chamada final ("Siga para mais"). Cada estilo tem um limite de animações por trecho para não poluir, e a mesma animação não se repete em seguida.
- A lista "Animações neste estilo" mostra o que foi colocado no vídeo.
- **Galeria de estilos**: o link "Ver os 3 estilos lado a lado" mostra as mesmas animações em cada estilo. Imagens de exemplo: [Pop](assets/fase3/pop.png), [Editorial](assets/fase3/editorial.png), [Documental](assets/fase3/documental.png).
- Fontes gratuitas de licença livre, guardadas no próprio site ([licenças](licencas.md)).
- Projetos salvos na versão anterior abrem normalmente (no estilo Pop); para ver as animações novas neles, escolha um estilo.
- Novos códigos: M4F-801 (fontes não carregaram) e M4F-802 (estilo inexistente). Ver [erros.md](erros.md).

## v0.2.0 — 20/10/2026
Fase 2: editor básico.
- **Assistir antes de gerar:** o vídeo editado toca na própria página, com som, legendas e título, desenhado pela mesma função que gera o arquivo final (a prévia usa meia resolução para ficar leve). Substitui a antiga "prévia de 10 s".
- **Linha do tempo:** mostra o vídeo inteiro, com os trechos mantidos (verde), os cortados (listras vermelhas), o desenho do som e as legendas. Clicar num trecho leva o vídeo até ali.
- **Corrigir legendas:** clique no texto da legenda, corrija e aperte Enter.
- **Desfazer cortes:** clique num trecho cortado para restaurá-lo ou para mudar onde o corte começa e termina (botões de ±0,1 s ou digitando o tempo).
- **Desfazer e refazer** qualquer alteração (botões ou Ctrl+Z / Ctrl+Shift+Z).
- **O projeto fica salvo neste navegador:** pode fechar a aba e voltar depois; as edições e o histórico continuam lá. Se o navegador tiver apagado a cópia do vídeo, o app pede para escolher o mesmo arquivo de novo. O vídeo original nunca é alterado e nada é enviado para a internet.
- **Gerar o vídeo não trava mais a página:** a geração roda em segundo plano.
- Novos códigos de aviso/erro: M4F-501 a 503 (edição), M4F-601 a 604 (projeto salvo) e M4F-701 (player). Ver [erros.md](erros.md).

## v0.1.4 — 20/10/2026
- Legendas não partem mais uma palavra em duas (no teste, "cada janela" aparecia como "cadeja" + "anela"). A transcrição agora é feita em trechos de até 28 s cortados nas pausas da fala, em vez de janelas fixas de 30 s que podiam cair no meio de uma palavra; pedaços de palavra que ainda vierem soltos são colados na palavra anterior.

## v0.1.3 — 20/10/2026
- O modelo de transcrição e o runtime agora são baixados pelo próprio endereço do Motion4Free (espelho na Cloudflare, [ADR-0006](decisions/0006-espelho-do-modelo.md)). Quem não alcança o Hugging Face ou o jsdelivr (firewall, antivírus, rede) passa a ter legendas. Se o espelho falhar, o app tenta os servidores originais.
- Novo código M4F-305 para resposta de erro do servidor do modelo; o detalhe do M4F-301 lista cada tentativa.

## v0.1.2 — 20/10/2026
- Detector de silêncio com limiar adaptativo ao ruído de fundo da gravação (antes era fixo em −40 dBFS e não achava pausas em vídeos com música ou ruído). No vídeo de teste de 146 s, os cortes passaram de 0,8 s para 1,8 s; o vídeo já vinha editado, com pausas curtas.

## v0.1.1 — 20/10/2026
- Cada problema mostra um código próprio (`M4F-xxx`), o que aconteceu e um botão "Copiar detalhes" com a versão e o navegador. Catálogo em [erros.md](erros.md).
- Se a transcrição falhar (por exemplo, sem acesso ao servidor do modelo), o vídeo continua sendo cortado e exportado, sem legendas e sem título, com um aviso.
- Falhas de rede informam qual servidor falhou (modelo no Hugging Face ou runtime no jsdelivr).
- Versão do app exibida no rodapé.

## v0.1.0 — 20/10/2026
- Fase 1: escolher vídeo, cortar silêncios, legendas automáticas, título animado, prévia de 10 s e exportação MP4 no navegador.
