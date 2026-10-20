# ADR-0009 — CreativeBrief, intérprete do pedido em camadas e IA opcional (Fase 4)

**Data:** 2026-10-20
**Status:** ACEITA. Complementa o [ADR-0005](0005-stack-v1.md), o [ADR-0006](0006-espelho-do-modelo.md) (espelho) e o [ADR-0008](0008-styledna-e-cenas.md) (StyleDNA). Dependência nova opcional: `@mlc-ai/web-llm` 0.2.85 (Apache-2.0), carregada só sob demanda ([licenças](../licencas.md)).

## Contexto
A Fase 4 ([plano](../superpowers/plans/2026-10-20-fase4-pedido.md)) deixa a pessoa pedir a edição com as próprias palavras. Regras do projeto: custo zero, sem instalação, vídeo nunca sai do aparelho, nada depende de resposta livre de LLM e o site funciona sem IA. A rede do responsável não alcança `huggingface.co` direto (ADR-0006).

## Decisão
1. **`CreativeBrief` v1** (zod, enums fechados) é a única saída de qualquer intérprete. Fica no `EditPlan` v3, então entra no desfazer e no projeto salvo; v1/v2 migram com pedido vazio.
2. **Regras primeiro e sempre.** Léxico em português (sem acentos, frase mais longa primeiro), proibições com listas, destaques, negação, público, objetivo e gancho. Conflitos resolvidos de forma determinística: pedido explícito ("estilo pop", "muito movimento") > o que vem do tom ("animado" sugere Pop); mesmo peso = o primeiro citado; **proibição sempre vence** (ex.: "bem animado mas sem efeitos" = muito movimento nas cenas, mas sem zoom, sem transições, entrada sem "pop" e intensidade ≤ 0,15). Cada decisão vira nota no resumo, e palavras não usadas são listadas. A bateria de 20 pedidos roda na CI.
3. **O brief só dosa o que já existe**: ajustes numéricos no StyleDNA do preset (intensidade, durações, ritmo, zoom, transição, barra, chamada final por objetivo — frases fixas do app) e opções do seletor (tipos de cena proibidos, destaques com prioridade, intervalo curto e fora do orçamento). Nenhuma cena, código ou texto novo vem do pedido. "Sem emojis" é registrado (o app não desenha emojis); "sem legenda" não é atendido nesta versão e o resumo diz isso.
4. **Ganchos por regras**: 2–14 palavras, ≤ 60 caracteres, frase completa (pontuação ou pausa ≥ 0,7 s), pontuação por pergunta/número/palavra forte/exclamação/posição; o texto é exatamente o falado. O escolhido vira o título de abertura. Reordenar trechos fica para a Fase 5 (o motor supõe trechos em ordem).
5. **IA opcional por cima das regras**, com o mesmo contrato:
   - **No navegador**: Qwen2.5-0.5B-Instruct q4f16 (MLC) via WebLLM, num Worker, só com WebGPU e se a pessoa escolher. ~300 MB de pesos, ~945 MB de memória de vídeo. Biblioteca JS (~6 MB) por `import()` dinâmico; o pacote principal cresceu ~35 KB (as camadas novas). Pesos e biblioteca WebGPU pelo espelho: o allowlist passa a ter exatamente o repositório `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` e o arquivo `.wasm` desse modelo em `raw.githubusercontent.com` (`/gh/…`), com teste que confere que é a mesma biblioteca da lista do WebLLM instalado. Desligável no build com `VITE_IA_LOCAL=0`.
   - **Chave própria do Google Gemini** (`gemini-flash-latest`, camada gratuita da pessoa): chave só no `localStorage`, no cabeçalho (nunca na URL), aviso claro de que vai só texto (pedido + até 1.500 caracteres da fala).
   - A resposta precisa ser um objeto JSON; cada campo é filtrado pela lista de IDs permitidos e o resto é descartado. A IA só **preenche** campos que as regras deixaram vazios e só **acrescenta** proibições; gancho só por índice da lista de candidatos. Falha de rede, tempo (60 s local, 30 s chave), formato ou chave → resultado das regras + aviso (M4F-1005 a 1009).
6. **Transcrição é dado, nunca instrução**: as regras não leem a fala; para a IA, instruções vão só na mensagem de sistema e pedido/fala na do usuário, dentro de etiquetas, com `<`/`>` escapados para a fala não fechar a etiqueta. Testado com fala "ignore as instruções…" e com uma IA simulada que obedece à fala: as proibições das regras continuam.

## Alternativas descartadas
- **IA como intérprete principal**: resposta variável, depende de GPU/rede e não passa na bateria de forma determinística.
- **IA gerando StyleDNA inteiro ou cenas**: possível pelo esquema (ADR-0008), mas sem dataset para avaliar estética; a IA só escolhe entre IDs nesta fase.
- **Modelos maiores (Llama 3.2 1B, Qwen 1.5B)**: entendem melhor, mas exigem 1–2 GB de VRAM e downloads maiores; o 0.5B basta para completar campos fechados.
- **Transformers.js para o LLM**: já usado para o Whisper, mas o WebLLM tem modelos de chat prontos, Worker e `response_format` JSON.
- **Gancho reordenando trechos**: exigiria trechos fora de ordem em `timeline`, player e exportação; adiado.

## Consequências
- A IA no navegador e a chave do Gemini **não foram executadas ponta a ponta** neste ambiente (sem acesso ao Hugging Face e ao Google); só a interface, a validação e a queda para regras têm teste. Precisam de teste manual antes de qualquer afirmação pública.
- O espelho passa a repassar também `/gh/*` (só o arquivo permitido); primeiro uso da IA local faz ~20 requisições ao espelho.
- Se o WebLLM mudar a versão da biblioteca do modelo, o teste do espelho falha e o allowlist precisa acompanhar.
