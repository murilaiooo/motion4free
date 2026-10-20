# Histórico de versões

A versão aparece no rodapé do app (`Motion4Free vX.Y.Z · commit`). Cada mudança publicada sobe a versão em `package.json`.

## v0.1.2 — 20/10/2026
- Detector de silêncio com limiar adaptativo ao ruído de fundo da gravação (antes era fixo em −40 dBFS e não achava pausas em vídeos com música ou ruído). No vídeo de teste de 146 s, os cortes passaram de 0,8 s para 1,8 s; o vídeo já vinha editado, com pausas curtas.

## v0.1.1 — 20/10/2026
- Cada problema mostra um código próprio (`M4F-xxx`), o que aconteceu e um botão "Copiar detalhes" com a versão e o navegador. Catálogo em [erros.md](erros.md).
- Se a transcrição falhar (por exemplo, sem acesso ao servidor do modelo), o vídeo continua sendo cortado e exportado, sem legendas e sem título, com um aviso.
- Falhas de rede informam qual servidor falhou (modelo no Hugging Face ou runtime no jsdelivr).
- Versão do app exibida no rodapé.

## v0.1.0 — 20/10/2026
- Fase 1: escolher vídeo, cortar silêncios, legendas automáticas, título animado, prévia de 10 s e exportação MP4 no navegador.
