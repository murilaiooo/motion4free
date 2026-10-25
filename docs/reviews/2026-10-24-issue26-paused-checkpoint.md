# Checkpoint da issue #26 — PAUSADO (24/10/2026)

Branch: `research/26-verified-compositions-20261024`. Trabalho isolado, NÃO publicado. A `main` continua na v0.30.2.

O protótipo em `research/frame-compositor/` gera três composições distintas (minimalista Canvas2D, técnica Three.js/WebGL, documental Canvas2D) com a mesma fonte sintética local, 12 segundos. O harness `scripts/qa-issue26.mjs` gerou três MP4 H.264 + AAC, 540x960, e decodificou os frames. Three.js rodou sob SwiftShader do Brave de teste, não comprovando performance em GPU física. O SHA-256 da mídia de entrada se manteve intacto. As três miniaturas PNG em `docs/reviews/evidence/issue26/` são evidência visual de pesquisa. Os MP4 grandes e frames intermediários permanecem na pasta local ignorada `test-results/`, sem distribuição no Git.

O teste `tests/issue26-compositions.test.ts` exige estrutura distinta, tempos/dados ancorados e rejeição de payloads inválidos. A qualidade estética é de protótipo, não de render profissional. Ainda é necessário avaliar ritmo/tipografia/legibilidade e obter revisão humana cega, além da paridade de preview/export dentro do Motion4Free. **Não fechar a issue #26**, não integrar código experimental ao produto e não copiar assets de terceiros sem licença. Nenhum GitHub Actions.

O usuário pediu PAUSA para jogar CS. Retomar apenas após solicitação expressa, preservando arquivos existentes e sem testes em background.
