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
