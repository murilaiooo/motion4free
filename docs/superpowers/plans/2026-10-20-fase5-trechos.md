# Fase 5 — ajuste por trecho e por conversa: plano de implementação

> Formato Superpowers `writing-plans`, versão curta. TDD nas camadas puras (teste primeiro, ver falhar, implementar, ver passar, commitar).

**Objetivo:** a pessoa seleciona um pedaço do vídeo e pede "mais calmo aqui", "sem animação aqui", "troca essa animação", "destaque isso" ou "trava esse pedaço"; só aquele pedaço muda. Ela vê o que mudou (lista + antes/depois), guarda versões com nome e pode usar uma imagem sua para tirar as cores do vídeo.

**Plano mestre:** [Fase 5](2026-10-20-plano-mestre.md) · **Decisão:** [ADR-0010](../../decisions/0010-trechos-travas-versoes.md) · **Stack:** [ADR-0005](../../decisions/0005-stack-v1.md) (nenhuma dependência nova).

**Gate:** mudar um trecho de 12 s a 18 s não altera nada fora dele, inclusive sincronia de voz e legendas.

## Decisões
- **`EditPlan` v4**: ganha `ranges` (trechos ajustados) e `reference` (cores de uma imagem). Migração v3 → v4 sem mudança visível; v1–v3 continuam abrindo.
- **Trecho = intervalo do vídeo original** (`srcStart`/`srcEnd`), escolhido no tempo do vídeo editado e convertido na hora. Assim um corte feito antes do trecho só o desloca; o trecho continua sendo "as mesmas falas". `out` (tempo no vídeo editado) é derivado e recalculado a cada mudança.
- **Pedido do trecho**: o mesmo intérprete em português (tom, intensidade, ritmo, proibições, destaques) + frases próprias de trecho: travar/destravar, "sem animação aqui", "troca essa animação" (contador `variant`, ciclo determinístico de animações), "destaque isso" (palavra-chave + zoom), "volta ao normal". Estilo, objetivo, público e gancho continuam valendo só para o vídeo inteiro (nota no resumo).
- **Revisão focal**: só as cenas que começam e terminam dentro do trecho são recalculadas (com o estilo do trecho e as palavras do trecho). Legendas e trechos mantidos nunca mudam num pedido de trecho; cenas que cruzam a borda ficam como estão. Teste de propriedade: para 40 trechos aleatórios × 5 pedidos, tudo fora do trecho é idêntico (`toEqual`) e cada legenda continua no tempo da sua palavra.
- **Estilo por trecho**: o trecho guarda o seu StyleDNA (o do vídeo ajustado pelo pedido do trecho). O desenho do quadro usa o estilo do trecho que contém o instante `t`; fora dele, o do vídeo. Prévia e exportação usam a mesma função.
- **Trava**: guarda uma cópia das cenas e legendas que tocam o trecho, mais o estilo. Depois de qualquer mudança geral (estilo, pedido geral, gancho, cores, cortes fora do trecho) a cópia volta exatamente igual, só deslocada se um corte antes do trecho mudou a posição. Cortar, restaurar corte ou corrigir legenda dentro de um trecho travado é recusado (M4F-504).
- **Antes/depois**: `diffPlans` (puro) lista cenas que entraram/saíram, legendas alteradas, estilo, cores, cortes e trechos. A prévia alterna entre o plano anterior e o atual no instante escolhido.
- **Versões**: lista com nome, data e plano completo, salva no projeto (formato 2 do projeto, máximo 20). Restaurar entra no desfazer.
- **Imagem de referência**: lida localmente (canvas 64×64), paleta por median-cut (puro), aplicada em `accent`/`accent2`/`panel` com contraste mínimo 4,5:1 contra o texto que fica por cima e contra o preto. Texto da legenda, sombra e degradê não mudam. Só as cores ficam no projeto; a imagem não é guardada nem enviada.
- **Gancho reordenado**: não entra. O motor supõe trechos em ordem crescente (cortes, linha do tempo, conversões de tempo, legendas por palavra); repetir ou mover uma frase quebraria essas garantias. O gancho continua como título de abertura (ver ADR-0010).

## Tarefas
| # | Entrega | Arquivos | Testes |
|---|---|---|---|
| 1 | EditPlan v4, migração v3→v4, conversões de trecho | `src/core/{types,schema}.ts`, `src/engine/timeline.ts` | `tests/schema.test.ts`, `timeline.test.ts` |
| 2 | Intérprete de trecho | `src/editorial/range-interpret.ts` | `tests/range-interpret.test.ts` |
| 3 | Revisão focal, travas, reaplicação depois de mudanças gerais | `src/editorial/ranges.ts`, `ops.ts` | `tests/ranges.test.ts` (gate 12–18 s, propriedade, travas) |
| 4 | Estilo por trecho no desenho e fontes | `src/render/frame.ts`, `src/media/{export,fonts}.ts` | `tests/frame.test.ts` |
| 5 | Diferenças antes/depois | `src/editorial/diff.ts` | `tests/diff.test.ts` |
| 6 | Versões + projeto formato 2 | `src/core/{versions,project}.ts` | `tests/versions.test.ts`, `project.test.ts` |
| 7 | Paleta de imagem com contraste | `src/core/color.ts`, `src/editorial/reference.ts` | `tests/color.test.ts`, `reference.test.ts` |
| 8 | Interface: faixa de trechos, painel do trecho, o que mudou, versões, imagem | `src/app/*` | `e2e/trechos.spec.ts` |
| 9 | Códigos novos, ADR-0010, versão 0.5.0, roteiro de teste consolidado | `src/core/errors.ts`, `docs/` | todos |

## Fora desta fase
- Reordenar a frase do gancho para o começo (motivo acima).
- Referência visual influenciando composição/layout (só cores nesta fase).
- Trechos sobrepostos (recusado com M4F-506; ajuste o trecho existente).
