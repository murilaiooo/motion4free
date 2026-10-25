# ADR-0032 — OpenReel não será a base principal da timeline

**Data:** 24/10/2026
**Status:** ACEITA — decisão de pesquisa para a issue #5; complementa, não revoga, [ADR-0005](0005-stack-v1.md).
**Evidência:** [auditoria reproduzível, commit fixado e provas browser/core](../research/updates/2026-10-24-openreel-engine-evaluation.md).

## Contexto

A issue #5 exigia determinar se importar/forkar o OpenReel daria uma timeline mais profissional e economizaria esforço sem quebrar a edição, a privacidade ou a exportação existentes. A versão efetiva do repositório original foi clonada em pasta ignorada, com versão e commit fixados; 154 testes direcionados do núcleo passaram, mais prova real de importação, split, undo/redo e export H.264/AAC no Brave usando um arquivo sintético.

## Decisão

**Não migrar o motor e a persistência do Motion4Free para OpenReel.** O OpenReel é software funcional, MIT na raiz, mas seus contratos e subsistemas são um segundo editor inteiro. A troca do projeto em produção exige provar migração sem perdas entre os objetos OpenReel `Project/Timeline/Track/Clip` e o nosso `EditPlan` v6 (palavras da gravação, ranges/travas, cenas, edição conversacional, histórico, offsets e âncoras), além de codecs, compositor, preview, música e estado salvo. Não há resultado mensurável que justifique esse risco nem um benchmark de longa duração mostrando benefício.

Manter **TypeScript + React + Canvas2D `drawFrame` + Mediabunny/WebCodecs** como está. **Não copiar código, shaders, assets, componentes, modelos, fonts nem novos pacotes do OpenReel.** Manter o clone somente como referência externa e ignorada. Ideias de UX e algoritmos genéricos poderão inspirar implementações próprias, independentes e pequenas, caso uma issue com prova concreta as justifique; sem duplicar histórico, snapping ou exportadores que o app já possui.

## Consequências

1. A issue de **avaliação** #5 pode ser concluída com o veredito **descartar a substituição**. Isso não significa que OpenReel tenha problemas graves ou seja inferior, apenas que a migração não se paga no contrato e nos testes atuais.
2. Compatibilidade de projetos antigos do Motion4Free, fluxo local-first, assets e ausência de dependências novas são preservados.
3. Não existe ponte OpenReel→Motion4Free, nem haverá suporte anunciado a projetos do concorrente; licenças de recursos externos continuam exigindo revisão (#2).
4. A qualidade dos três motores/estratégias de composição (issue #26) e SceneGraph/WebGPU/Canvas (issue #28), benchmarks humanos (#10) e vídeo longo **não** são encerrados por esta decisão.
5. Se futuramente surgirem medições reproduzíveis demonstrando superioridade para nossos vídeos-alvo, a decisão pode ser reaberta mediante: (a) migrador reversível de projetos; (b) testes E2E no Brave de texto/áudio/legendas/cortes/undo/redo/MP4 real; (c) comparação CPU/RAM/seek/tempo de export; (d) matriz de licenças por dependência e recurso.

**Não é uma mudança de runtime:** esta ADR e o dossiê são apenas documentação e não alteram o editor instalado/publicado.
