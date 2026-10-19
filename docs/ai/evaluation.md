# Laboratório de qualidade editorial

Não declarar “qualidade igual ou superior ao Editonny” sem comparações reproduzíveis. O Editonny oferece regras e testes documentados, mas não existe uma métrica pública universal de qualidade de edição.

## 1. Dataset e proveniência
- Reunir com autorização de uso um conjunto inicial alvo de 50–100 gravações diversificadas; começar com amostra menor no POC.
- Português e inglês; sotaques, pessoas, iluminação, formatos, cortes repetidos, valores, negações, enumerações e música.
- Dividir por origem/autor em conjuntos de desenvolvimento, validação e teste final **sem vazamento**.
- Anotar frases corretas e tempos de palavras; candidatas a gancho, blocos de história, decisões de motion, pontos de corte e escolhas humanas.
- Referências editadas por humanos; se possível gerar também baselines com Editonny e um editor simples determinístico.

## 2. Métricas objetivas
| Eixo | Avaliação |
|---|---|
| Estrutura | schema válido, scene IDs existentes, duração permitida |
| Fatos | números, nomes, negações e provas preservados |
| Corte | palavras completas, integridade de frase, sync e áudio sem estalos |
| Legenda | WER/CER, cobertura temporal, contraste, safe zones |
| Render | MP4 reproduzível, fps, codec, áudio, frames pretos acidentais |
| Custo | número de chamadas, tokens, RAM, banda, tempo, taxa offline |

**Não usar** a saída textual do próprio LLM como prova de qualidade.

## 3. Métricas criativas humanas
Avaliação cega (sem identificação da ferramenta), ordem aleatória, múltiplos avaliadores para gancho, clareza, cadência, relevância do motion design, legibilidade, escolha de transições e preferência geral. Registrar divergências. Não chamar vídeo de “viral” por nota alta.

## 4. Experimentos de IA
- Testar 3+ modelos gratuitos **disponíveis no momento**, mais baseline sem IA.
- Uma variável por vez: prompt, conjunto few-shot, shortlist, modelo, schema, validação.
- Construir experimentos `baseline -> shortlists -> few-shot -> structured output -> selective escalation`.
- DSPy pode otimizar prompts/exemplos **offline**, com budget de teste claramente limitado. Só promover nova versão após ganho em validação e sem regressão no teste separado.
- [Promptfoo](https://github.com/promptfoo/promptfoo) para matrizes de casos, provedores e assertions.
- Calibrar “risco/uncertainty” em exemplos anotados; autoavaliação do modelo não basta.

## 5. Alvos iniciais propostos (não são resultados)
- 100% dos IDs de cenas/operações passam validação de schema antes da execução.
- Zero fatos comprovadamente inventados nos casos de teste com evidência conhecida.
- Zero edição silenciosa de conteúdo fora do escopo solicitado.
- Zero transições ou cenas tecnicamente inválidas enviadas ao renderer.
- Taxa de sucesso de export nos dispositivos-alvo medida e publicada, não presumida.
- Preferência criativa estatisticamente comparável ao baseline Editonny definida a partir dos testes cegos.

## 6. Suite de regressão
Correção de números, negações, múltiplos falantes, fala cortada, short-form sem gancho, voz baixa, movimentos de rosto, vídeo sem áudio, cotas offline e mídia volumosa. Testes não podem eliminar proteção para “fazer passar”.

## 7. Gates de entrega
- POC: MP4 correto na máquina alvo.
- MVP: usuário obtém Reel editável sem intervenção técnica.
- Beta: benchmark humano publicado e regressões resolvidas.
- Público: privacy review, compatibilidade, licenças dos assets, budget e contenção de abuso validados.


## Rubrica premium adicional — qualidade de motion designer experiente
Executar teste cego com avaliadores de experiência documentada e múltiplas referências profissionais. Cada nota 0–5 precisa de exemplo de frame/trecho, não só opinião global.
1. Conceito, direção de arte e hierarquia tipográfica.
2. Timing/easing, física percebida e microanimação.
3. Sincronização semântica e musicalidade do motion com voz/SFX.
4. Variação de estrutura, layout e recursos sem perda de coesão.
5. Qualidade de assets, composição 2D/3D e legibilidade.
6. Narrativa, gancho não enganoso e impacto emocional.
7. Fidelidade ao briefing e aos controles de prompt/preset/referência.
8. Liberdade de clichês (“AI slop”), repetição e transições dispensáveis.
9. Revisabilidade, consistência em rerender, preview/export.
10. Preferência cega entre nossa edição, Editonny, baseline template-only e edição humana.

**Teste de diferenciação:** mesma fala com três briefs de estilo opostos deve gerar diferenças **semânticas e visuais significativas**. Mesma identidade de marca em vídeos diferentes deve manter coerência sem repetir cenas mecanicamente. Reportar piores falhas separadamente da média e grau de concordância entre avaliadores.

**Critério decisivo:** um produto que obtém MP4 válido e JSON perfeito, mas perde claramente em direção de arte e personalização, **não passa** a fase premium. [Auditoria](../reviews/2026-10-18-premium-creative-audit.md).
