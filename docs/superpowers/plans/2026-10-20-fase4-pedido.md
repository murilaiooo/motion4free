# Fase 4 — pedido por texto + IA: plano de implementação

> Formato Superpowers `writing-plans`, versão curta. TDD nas camadas puras (teste primeiro, ver falhar, implementar, ver passar, commitar).

**Objetivo:** a pessoa escreve o que quer ("gancho forte, estilo calmo, sem emojis, destaque os números"), o site entende, mostra o que entendeu (e o que ignorou ou decidiu num conflito), sugere frases da própria fala para abrir o vídeo e monta a edição no estilo pedido. Funciona sem IA, sem internet depois de carregado e sem custo. IA é camada opcional por cima.

**Plano mestre:** [Fase 4](2026-10-20-plano-mestre.md) · **Decisão:** [ADR-0009](../../decisions/0009-pedido-e-ia.md) · **Stack:** [ADR-0005](../../decisions/0005-stack-v1.md) (dependência nova opcional: `@mlc-ai/web-llm` 0.2.85, Apache-2.0, carregada só sob demanda).

## Decisões
- **`CreativeBrief` v1** (`src/core/brief.ts`, zod): pedido original, origem (regras / IA local / chave), objetivo, público, tom, intensidade, ritmo, preset, proibições, destaques, "quer gancho", gancho escolhido (texto + ids das palavras), trechos travados (vazio; Fase 5) e notas (conflitos, palavras não usadas). Todos os campos são enums fechados ou texto curto limitado.
- **`EditPlan` v3** guarda o brief. `migratePlan` faz v1 → v2 → v3 (pedido vazio = vídeo igual). Projetos das Fases 2 e 3 abrem normalmente.
- **Intérprete em camadas** (`src/editorial/interpret.ts`, `ai-brief.ts`):
  1. **Regras** (sempre): léxico em português sem acentos, frases mais longas primeiro; "sem/nada de/não use/evite/tire X" com listas ("sem efeitos, emojis ou números"); "destaque/realce/foco em X"; negação ("nada animado" = pouco movimento); público ("para iniciantes"); objetivo; gancho. Conflitos: pedido explícito > tom; mesmo peso = o primeiro; **proibição sempre vence**. Tudo vira nota no resumo.
  2. **IA no navegador** (opcional, experimental): Qwen2.5 0.5B via WebLLM em Worker, só com WebGPU e por escolha da pessoa; arquivos pelo espelho do site.
  3. **Chave própria do Gemini** (opcional): guardada só no `localStorage`, aviso de que só vai texto.
  A IA devolve JSON; cada campo é filtrado pela lista de IDs permitidos; ela só **completa** o que as regras deixaram vazio e só **acrescenta** proibições; gancho só por índice dos candidatos. Qualquer falha cai para as regras com aviso (M4F-1005 a 1009).
- **Ganchos** (`src/editorial/hooks.ts`): frases completas da fala (pontuação ou pausa ≥ 0,7 s), 2–14 palavras e até 60 caracteres; pontuação por pergunta, número, palavras fortes, exclamação, posição e tamanho; até 5 candidatos. O escolhido vira o **título de abertura** (não reordena trechos nesta fase: mover a frase para o começo exige trechos fora de ordem no motor; fica para a Fase 5).
- **Como o brief vira vídeo** (`src/editorial/brief-apply.ts`): ajustes numéricos no StyleDNA do preset (dentro do esquema) e opções do seletor (tipos de cena proibidos, destaques com prioridade e sem contar no orçamento, título do gancho). O id do estilo continua o do preset, então o seletor de estilo segue marcado; trocar o estilo à mão mantém os ajustes do pedido.
- **Transcrição é dado**: as regras só leem o pedido; para a IA a fala vai escapada, delimitada e fora da mensagem de instruções.

## Tarefas
| # | Entrega | Arquivos | Testes |
|---|---|---|---|
| 1 | CreativeBrief + EditPlan v3 + migração v2→v3 + projeto | `src/core/{brief,types,schema}.ts` | `tests/schema.test.ts`, `project.test.ts` |
| 2 | Intérprete por regras + bateria de 20 pedidos | `src/editorial/interpret.ts` | `tests/interpret.test.ts` |
| 3 | Ajustes do StyleDNA e opções do seletor | `src/editorial/brief-apply.ts`, `selector.ts` | `tests/brief-apply.test.ts` |
| 4 | Ganchos | `src/editorial/hooks.ts` | `tests/hooks.test.ts` |
| 5 | `applyBrief`, `applyHook`, `applyStyle` com brief | `src/editorial/ops.ts` | `tests/brief-ops.test.ts` (proibições nunca violadas em 3 estilos × 8 pedidos, também depois de trocar estilo e cortar) |
| 6 | Camada de IA: mensagens, validação, junção, queda para regras, Gemini | `src/editorial/ai-brief.ts`, `src/ai/{local-ai,own-key,webllm.worker}.ts` | `tests/ai-brief.test.ts` |
| 7 | Espelho para o modelo Qwen e a biblioteca WebGPU | `src/core/mirror.ts`, `worker/index.ts`, `wrangler.jsonc` | `tests/mirror.test.ts` |
| 8 | Painel "O que você quer?" (resumo, ganchos, IA opcional) | `src/app/{BriefPanel,Editor}.tsx` | `e2e/pedido.spec.ts` |
| 9 | Códigos M4F-1001 a 1009, ADR-0009, licenças, versão 0.4.0 | `src/core/errors.ts`, `docs/` | todos |

## Fora desta fase / não testado ponta a ponta
- IA no navegador e chave do Gemini: interfaces, validação e queda para regras têm teste de unidade com respostas simuladas, mas **não foram executadas de verdade** (o ambiente de desenvolvimento não alcança Hugging Face nem Google). Precisam de teste manual num computador com WebGPU / uma chave gratuita.
- Reordenar a frase do gancho para o começo do vídeo e travar trechos: Fase 5.
