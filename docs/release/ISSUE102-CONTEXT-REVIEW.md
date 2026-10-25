# Contexto de clipes #102 — revisão lexical responsável (24/10/2026)

## Mudança técnica independente

O módulo original de sinais lexicais `src/editorial/context-policy.ts` foi portado **do histórico do próprio Motion4Free**, branch preservada `review/integration-static-hardening`, como subentrega isolada da reconciliação #133. Nenhuma dependência ou asset do SupoClip foi copiado.

`groundedMoment()` agora inclui nos **motivos visíveis dos candidatos** alertas em PT-BR sobre palavras que podem mudar o sentido de um recorte:
- **Negação e ausência**: não, nunca, sem, not, never, e no em contextos possivelmente ingleses.
- **Hipótese/condição**: se, caso, depende, if, unless, could etc.
- **Comparações**: maior, menor, mais, menos, melhor/pior, better/worse, than etc.
- **Referência sem antecedente**: isso, aquilo, ele/ela, mas, this, that, but etc.

É **heurística de revisão**, não avaliação semântica, garantia de segurança, detecção confiável de idiomas ou transcrição. Não altera o texto, o score, os word IDs, a duração, o ranking ou os cortes, não inventa hook/título, não envia mídia/texto a nenhum serviço e não introduz cobrança. Isso evita punir uma negação verdadeira como se fosse defeito enquanto alerta a pessoa para conferir o contexto.

## Evidência reproduzível

- `tests/context-review-flags.test.ts`: 3 casos, PT/EN, negação, comparação, hipotéticos, referência e não confundir português *no vídeo* com uma negativa em inglês.
- `tests/clip-context-release.test.ts`: 6 casos de cobertura de transcript longo, limites de chamadas, IDs alucinados, distribuição de candidatos, ajustes manuais e mapa da origem.
- TypeScript aprovado; ambos os arquivos de teste passaram (9/9).
- Suíte completa validada no Windows: `npm test` **94 arquivos / 1.722 testes aprovados**, `npm run typecheck`, `npm run build` com pré-checagem de assets Cloudflare e `git diff --check` passaram. O motor MP4 não foi alterado; estes testes não substituem avaliação humana nem E2E com vídeos reais.

## O que NÃO está provado

Os sinais podem gerar falso positivo ou falso negativo, especialmente em fala espontânea, transcrição sem pontuação, ironia, idiomas mistos e expressões ambíguas. Exibir um aviso não garante que o trecho tenha início, argumento e conclusão suficientes. **#102 permanece aberta**, aguardando corpus autorizado e avaliação cega de pessoas, tracking de cortes/áudio/legendas/MP4 longos, stress e provas de generalização. Este incremento não altera o motor de exportação nem outros módulos de mídia.

A reconciliação #133 continua aberta para os outros módulos em falta; módulos faciais, render experimental e bibliotecas sem atribuição aprovada continuam fora do app ativo.
