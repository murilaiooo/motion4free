# Plano — Criador de clipes de vídeos longos (v0.22.0)

Pedido do responsável (21/10/2026): o site vira dois modos, "Editar meus vídeos" e "Clipes de vídeo longo". No segundo, a pessoa solta um vídeo longo e recebe vários cortes prontos, cada um já editado, com legenda e no formato escolhido. Decisões em [ADR-0023](../../decisions/0023-criador-de-clipes.md).

## Tarefas
1. **Áudio longo** — `src/analysis/downmix.ts` (mono 16 kHz em pedaços, puro), `src/analysis/energy.ts` (energia por meio segundo, puro) e `src/media/long-audio.ts`. Testes: `tests/downmix.test.ts`, `tests/energy.test.ts`.
2. **Momentos** — `src/editorial/highlights.ts`: janelas em frase completa, nota, seleção sem sobreposição, motivos e título. Teste: `tests/highlights.test.ts`.
3. **IA opcional** — `src/editorial/moments-ai.ts`: mensagem, leitura validada da resposta, reserva nas regras (M4F-1106). Teste: `tests/moments-ai.test.ts`.
4. **Clipe → plano** — `src/editorial/clip-plan.ts`: recorta palavras e silêncios para o tempo do clipe e chama `autoEdit`. Teste: `tests/clip-plan.test.ts`.
5. **Recorte** — `src/media/cut.ts` (Mediabunny `Conversion` com `trim`); `openMedia` aceita limite de duração.
6. **Análise do vídeo longo** — `src/app/clip-pipeline.ts`: abrir (até 2 h), áudio, silêncios, energia, transcrição, guardar a análise (`src/core/clip-job.ts`, puro e testado em `tests/clip-job.test.ts`).
7. **Tela** — `src/app/ClipMaker.tsx`: opções (tamanho, quantidade, modelo, formato, IA), cartões com prévia do trecho, "Baixar pronto", "Abrir no editor", "Gerar todos". Primeira tela com a escolha de modo e o aviso de link (M4F-1105).
8. **Erros e versão** — M4F-1101 a 1108 em `src/core/errors.ts` e `docs/erros.md`; versão 0.22.0; CHANGELOG; roteiro de teste.

## Fora desta versão
- Baixar direto de link (ver ADR-0023).
- Seguir o rosto de quem fala em vídeo com duas pessoas (vale o enquadramento automático atual).
- Legenda em outro idioma.
