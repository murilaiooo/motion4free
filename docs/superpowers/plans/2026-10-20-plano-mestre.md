# Motion4Free — plano mestre

**Data:** 2026-10-20. **Spec:** [v1 consolidada](../specs/2026-10-20-motion4free-v1-design.md). **Stack:** [ADR-0005](../../decisions/0005-stack-v1.md).

Este plano diz **o que** cada fase entrega, **como murilo testa** e **o que precisa passar** para seguir. Cada fase ganha o próprio plano detalhado (tarefas com código e testes, no formato `writing-plans`) só quando a anterior passar no gate, porque o resultado do teste muda o plano seguinte. O plano detalhado da Fase 1 já está pronto: [Fase 1 — primeiro MP4](2026-10-20-fase1-primeiro-mp4.md).

## Como cada fase funciona
1. O agente escreve o plano detalhado da fase.
2. Implementa tarefa por tarefa com TDD (teste falhando → código → teste passando → commit).
3. Abre um PR. A CI roda os testes de unidade, o build e o teste de ponta a ponta no navegador.
4. O PR ganha um **link de prévia** (Cloudflare). murilo abre o link e segue o **roteiro de teste** do PR.
5. murilo responde no projeto com o que achou. O agente corrige até o gate passar e faz o merge.

### Formato do feedback de teste
Basta responder no projeto, do jeito que for mais fácil. Ajuda muito dizer:
- qual vídeo usou (duração, celular ou câmera, horizontal ou vertical);
- o que esperava e o que aconteceu;
- se possível, o segundo exato onde algo ficou errado e um print.

---

## Fase 0 — Fundação ✅ (este PR)
- Spec v1 consolidada e aprovada, ADR-0005 com a stack, licença MIT, plano mestre e plano detalhado da Fase 1.
- Pipeline da Fase 1 validado num protótipo: 28 testes de unidade e um MP4 real gerado no Chromium.

## Fase 1 — Primeiro MP4
**Você vai conseguir:** abrir o site, escolher um vídeo seu falando e baixar um Reels 9:16 com silêncios cortados, legendas automáticas e um título animado na abertura.

**Entregas técnicas:** contratos e validação (zod), linha do tempo, detector de silêncio, cortes protegidos, legendas, compositor Canvas 2D com a cena "título cinético", transcrição Whisper em Worker, exportação MP4 (H.264/AAC com reserva VP9), UI mínima em português, testes de unidade e ponta a ponta, CI e deploy.

**Única ação sua fora do teste:** criar uma conta grátis na Cloudflare e conectar o repositório (passo a passo no fim do plano da Fase 1). Sem isso o site só existe nos testes automáticos.

**Roteiro de teste:**
1. Abrir o link no Chrome ou Edge do computador.
2. Escolher um vídeo de 30 a 90 s, você falando, com algumas pausas.
3. Esperar a análise. Na primeira vez o modelo de transcrição é baixado (dezenas de MB).
4. Clicar em "Ver prévia (10 s)" e assistir.
5. Clicar em "Gerar vídeo final", baixar e abrir no celular. Se quiser, subir como rascunho no Instagram.
6. Repetir com mais dois vídeos diferentes (por exemplo, um gravado na horizontal).

**Gate para seguir:**
- Os 3 vídeos exportam no seu Chrome/Edge em H.264, abrem no celular e o som está sincronizado.
- Nenhum corte come pedaço de palavra de forma perceptível.
- Legendas com pelo menos 9 de cada 10 palavras certas.
- Medido e anotado: quanto tempo levou a análise e a exportação no seu computador.

## Fase 2 — Editor básico
**Você vai conseguir:** assistir à edição com som antes de exportar, ver a linha do tempo, corrigir o texto de uma legenda, desfazer um corte que não gostou, desfazer/refazer, fechar o navegador e reabrir o projeto depois.

**Entregas técnicas:**
- Player em tempo real usando a mesma `drawFrame` da exportação, com áudio via Web Audio sincronizado pelo relógio do motor.
- Linha do tempo com trechos mantidos/cortados, waveform medida do áudio e legendas.
- Edição de legenda, restaurar trecho cortado, ajustar início/fim de corte.
- Histórico de operações (undo/redo) sobre o `EditPlan`; cada operação é pura e testada.
- Projeto salvo no OPFS (plano + análise + transcrição); o vídeo original é pedido de novo se o navegador apagar o cache, com aviso.
- Exportação movida para Worker (UI não trava).

**Roteiro de teste:** editar uma legenda errada, restaurar um corte, desfazer e refazer, fechar a aba, reabrir no dia seguinte e exportar.

**Gate:** as alterações sobrevivem ao reabrir; o player e o MP4 mostram exatamente a mesma coisa nos trechos que você conferir; nada trava durante a exportação.

**Plano detalhado:** [Fase 2 — editor básico](2026-10-20-fase2-editor.md) (implementada na v0.2.0; por pedido do responsável, as Fases 2–5 são construídas em sequência e testadas juntas no fim).

## Fase 3 — Sistema de motion design (o coração criativo)
**Você vai conseguir:** escolher entre 3 estilos bem diferentes para o mesmo vídeo e ver animações que acompanham o que é dito: números grandes quando você fala um número, listas quando enumera, destaque em palavras-chave, transições nos cortes, chamada final.

**Entregas técnicas:**
- `StyleDNA` versionado: paleta, par tipográfico (fontes livres, licença conferida), ritmo, intensidade, forma (cantos, traços, sombras), posição das legendas.
- Biblioteca de cenas parametrizáveis, todas funções puras do tempo: título cinético, palavra-destaque, número grande, lista, citação, lower third, zoom de ênfase, transição de corte, barra de progresso, chamada final.
- Seletor por regras: detecta números, enumerações, perguntas e palavras-chave na transcrição e propõe cenas, com limite de densidade para não poluir.
- 3 presets iniciais com personalidades opostas (por exemplo: minimalista editorial, energético pop, documental sóbrio).
- Teste de regressão visual: quadros de referência por cena e preset, comparados a cada mudança.
- Anti-repetição: a mesma cena com os mesmos parâmetros não aparece duas vezes seguidas.

**Roteiro de teste:** exportar o mesmo vídeo nos 3 estilos. Mostrar os 3 a duas pessoas sem dizer qual é qual.

**Gate criativo:** você e as duas pessoas percebem que são 3 estilos realmente diferentes (não só cor), nenhuma animação aparece sem motivo, e você usaria pelo menos um deles num post de verdade. Se não passar, a fase continua até passar; nada de IA entra antes disso.

## Fase 4 — Pedido por texto + IA
**Você vai conseguir:** escrever o que quer ("gancho forte, estilo calmo, sem emojis, destaque os números") e o site entende, sugere 3 opções de gancho para você escolher e monta a edição no estilo pedido.

**Entregas técnicas:**
- `CreativeBrief` versionado: objetivo, público, tom, intensidade, preset base, proibições ("sem efeitos", "sem emojis"), trechos travados.
- Intérprete do pedido em camadas: regras e palavras-chave (sempre) → modelo local via WebLLM quando a GPU permitir → opcional, a chave gratuita da própria pessoa (por exemplo Gemini), guardada só no navegador dela, com aviso do que é enviado (só texto, nunca o vídeo).
- Ganchos: regras encontram de 3 a 5 frases completas candidatas; a IA, quando disponível, ordena; a pessoa escolhe. Nunca inventa frase.
- A IA devolve JSON (brief, escolha de preset, parâmetros, cenas por trecho) validado por zod e filtrado por lista de IDs permitidos; erro de validação cai para regras.
- Proteção contra instruções escondidas na fala: a transcrição é tratada como dado, nunca como comando.
- Bateria de 20 pedidos de teste com respostas esperadas, rodada na CI com o caminho de regras e manualmente com o modelo.

**Roteiro de teste:** 5 pedidos diferentes para o mesmo vídeo, incluindo um contraditório ("bem animado mas sem efeitos") e um com o Wi-Fi desligado depois do carregamento.

**Gate:** os pedidos são respeitados, as proibições nunca são violadas, nenhuma frase inventada aparece e o site funciona sem IA.

## Fase 5 — Ajuste por trecho e por conversa
**Você vai conseguir:** selecionar um trecho e pedir "mais calmo aqui", "troca essa animação", "trava esse pedaço"; o resto do vídeo não muda.

**Entregas técnicas:** travas por trecho, revisão focal que recalcula só o trecho afetado, diff visual antes/depois, histórico por versão, referência visual (uma imagem sua) influenciando paleta e composição.

**Gate:** mudar um trecho de 12 s a 18 s não altera nada fora dele, inclusive sincronia de voz e legendas.

## Fase 6 — Beta público
**Entregas técnicas:** suporte a Safari/Firefox e celular com funções reduzidas onde preciso, vídeos de até 10 min com exportação em streaming, auditoria de licenças de cada fonte/asset/modelo, página pública honesta sobre limites, medição de custo real de hospedagem, avaliação cega com pessoas comparando com edição manual.

**Gate:** auditoria de licenças completa, nenhuma promessa sem medição, custo de hospedagem medido como zero no volume de teste.

---

## O que não vamos fazer cedo
Servidor próprio, login, render na nuvem, dezenas de APIs de IA, centenas de animações antes do gate criativo, suporte mobile antes do beta.

## Rastreabilidade com a auditoria F01–F21
| Achados | Onde fecham |
|---|---|
| F21 (nada implementado), F09 (spike de tecnologias), F11 (prova de MP4) | Fase 1 |
| F14 (edição por trecho, undo) parcial, F08 (loop de checagem) parcial | Fase 2 |
| F01, F04, F05, F06, F07, F12, F15, F16 (autoria visual, contratos, gramática, anti-repetição, assets) | Fase 3 |
| F02, F03, F10, F13 (gate de qualidade, prompt + preset, IA diretora, custo zero) | Fase 4 |
| F14, F19, F20 (trechos, B-roll contextual, referências) | Fase 5 |
| F17, F18 (backlog e configurações do GitHub) | contínuo, revisado a cada fase |
