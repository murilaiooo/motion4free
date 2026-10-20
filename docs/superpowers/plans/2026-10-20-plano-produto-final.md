# Plano do produto final — Motion4Free (passagem de bastão)

Escrito em 20/10/2026 às 18:50 (horário UTC), quando a cota da sessão anterior estava acabando. Este documento é o ponto de partida para quem continuar o trabalho, seja pessoa ou IA. Leia junto com `AGENTS.md` (regras obrigatórias), `docs/superpowers/plans/2026-10-20-plano-mestre.md` e os ADRs em `docs/decisions/`.

## 1. Onde estamos

- **No ar:** v0.10.0 em https://motion4free.murdokmurilo1.workers.dev. A Cloudflare publica sozinha a cada push na `main`. A prévia por branch da Cloudflare sempre falha; isso é conhecido e não bloqueia nada.
- **O que existe na main (v0.10.0):**
  - corta silêncios e transcreve no navegador. A legenda usa a escada Whisper large-v3-turbo (WebGPU) → small → base, com o aviso M4F-307 quando cai para um modelo menor (ADR-0013);
  - 15 modelos de estilo vindos de um registro (`src/core/templates.ts`, ADR-0014);
  - sistema de movimento (ADR-0012);
  - pedido por texto: regras, IA local (WebLLM) opcional ou chave própria do Gemini, sempre com JSON validado (ADR-0011);
  - ajustes, travas e versões por trecho (ADR-0010);
  - imagem de referência para cores;
  - visual novo de editor profissional: tela inicial, área de trabalho com abas, prévia grande, inspetor, linha do tempo e transcrição corrida (ADR-0015).
- **Ainda não validado com aparelho real:**
  - se os nomes e arquivos do repositório `onnx-community/whisper-large-v3-turbo_timestamped` estão certos (o Hugging Face é bloqueado no container de desenvolvimento);
  - a IA no navegador e o Gemini;
  - a qualidade do movimento em vídeo real.
- **Roteiro de teste e prompt para outra IA testar tudo:** `docs/roteiro-de-teste.md`. A cópia da sessão anterior está fora do repositório, na pasta compartilhada do projeto (`/mnt/project-files/motion4free/testes/lista-completa-de-testes-v0.10.md`).

## 2. O que o responsável pediu (20/10/2026, 18:23 e 18:25)

Palavras do responsável (murilo, não técnico, delegou todas as decisões técnicas ao agente), em resumo fiel:

1. O app deixa de ser teste e vira **produto final de verdade**.
2. **Um editor em que o usuário realmente edita o vídeo.** Ele quer colocar a legenda onde quiser, arrastando para uma região melhor (às vezes ela fica em cima do rosto), e personalizar tudo, porque o vídeo vai para o perfil dele no Instagram. O app faz o trabalho pesado e entrega o vídeo pronto, mas o usuário tem a opção de mexer em tudo.
3. **Remover o vídeo atual.** Hoje só existe "Trocar vídeo".
4. **Ver quantos GB o app ocupa no computador e conseguir apagar.**
5. Tudo **mais integrado e menos separado**.
6. Melhorar muito a personalização, os pedidos e as edições, pensando em **todos os tipos de usuário, nichos e fluxos**, não só nos exemplos que ele deu.
7. **Vários vídeos curtos (5, 20, 30) montados sozinhos num vídeo completo.**
8. **Escolher o formato de saída**: vertical, horizontal ou quadrado, com qualquer origem virando qualquer saída.

## 3. Frentes de trabalho e estado de cada uma

Eram quatro frentes em paralelo, cada uma numa branch. Todas foram **interrompidas no meio** quando a cota acabou. O trabalho parcial foi enviado para o GitHub, e os commits que começam com `wip(` **não foram verificados** (testes e typecheck podem falhar). Ordem de merge planejada: 1 → 2 → 3 → 4. Cada uma deve fazer merge da `main` antes do PR.

| # | Branch | Versão | Estado no GitHub |
|---|---|---|---|
| 1 | `feat/projetos-armazenamento` | 0.11.0 | Quase pronta: núcleo + tela + e2e commitados (3 commits). Falta rodar todos os checks, capturas e PR. |
| 2 | `feat/nichos-inteligencia` | 0.12.0 | Início: um commit `wip` com receitas, CTA, nichos, corpus de pedidos e regras extras. Não verificado. |
| 3 | `feat/editor-completo` | 0.13.0 | Meio: EditPlan v6 com edições manuais e migração v5→v6, operações manuais, códigos M4F-510 a 517 e 1014; `wip` com hit-testing/bounds/elementos no render. Falta a UI de manipulação direta e o inspetor. |
| 4 | `feat/multiplos-videos-formatos` | 0.14.0 | Início: núcleo de vários clipes (plano v6), formatos de saída, enquadramento, tentativas repetidas e volume; `wip` com fontes múltiplas no player e na exportação. |

**Atenção a um conflito previsto:** as frentes 3 e 4 criaram cada uma um "EditPlan v6" diferente. Quem juntar precisa unificar numa só versão (v6 do editor e v7 dos clipes, ou o contrário), com migrações encadeadas e testadas.

### Frente 1: Projetos e armazenamento (v0.11.0)
- **"Meus projetos" na tela inicial:** cartões com miniatura, nome, duração, modelo, última edição e tamanho em disco. Ações: abrir, renomear, duplicar e apagar. Vídeo novo cria um projeto novo. Migrar o projeto único da v0.10 sem perda.
- **Menu do projeto no editor:**
  - **Fechar projeto:** volta ao início e mantém salvo.
  - **Apagar projeto:** confirmação dizendo o que apaga e quanto espaço libera. O arquivo original no disco do usuário nunca é tocado.
  - **Trocar vídeo:** continua existindo.
- **Tela Armazenamento:**
  - total via `navigator.storage.estimate()`, com detalhe por projeto, por modelo de legenda (Whisper, no Cache Storage do transformers.js), por modelo de IA (WebLLM, no Cache Storage/IndexedDB) e fontes;
  - cota, botão de armazenamento persistente (`navigator.storage.persist()`), apagar por item e "Apagar tudo do Motion4Free" com confirmação forte.
  - Verificar nos fontes em `node_modules` onde transformers.js 4.3.1 e @mlc-ai/web-llm 0.2.85 guardam os arquivos (ADR-0016).
- **Aviso de pouco espaço** antes de importar ou baixar, com código M4F próprio.
- e2e cobrindo tudo isso.

### Frente 2: Nichos, pedidos e inteligência (v0.12.0)
- **`docs/produto/personas-e-fluxos.md`:** pelo menos 15 nichos brasileiros de Reels/TikTok, por exemplo coach, infoprodutor, loja, restaurante, beleza, fitness, saúde, advogado/contador, corretor, educação, religioso, podcast/cortes, humor, notícia, tech, viagem, maternidade, B2B, artista. Para cada nicho:
  - objetivos;
  - formatos (lista de dicas, história, antes/depois, tutorial, depoimento, oferta/CTA, polêmica, react);
  - 20 ou mais pedidos reais em PT-BR informal, com erro de digitação;
  - o que é "pronto para postar" para esse nicho;
  - lacunas do app.
- **Corpus de 300 ou mais pedidos** com parâmetros esperados. Ampliar as regras e o prompt da IA. O que não dá para fazer vai para "Ainda não sei fazer", nunca é ignorado em silêncio.
- **Novas capacidades:**
  - cartão final de CTA ("siga", "link na bio", "comente X");
  - sobreposição de lista numerada para vídeos de "3 dicas";
  - cores de marca em hex;
  - tom (sério, divertido, inspirador);
  - ritmo por nicho;
  - logo/marca d'água, se for barato.
- **Receitas por nicho** (modelo + look + ritmo + gancho + CTA) e uma pergunta opcional depois do upload: "Qual o seu tipo de conteúdo?".
- **Legenda que evita o rosto:**
  - detecção de rosto no navegador e grátis (MediaPipe Tasks Vision, Apache-2.0, servido pelo espelho em `src/core/mirror.ts`, ou a Shape Detection API);
  - a lógica pura de posicionamento fica em `src/analysis` com testes;
  - posição manual sempre vence;
  - se a detecção falhar, novo código M4F.
- Sugestões de pedido conforme o nicho e a transcrição. ADR-0017.

### Frente 3: Editor completo (v0.13.0)
- **Manipulação direta na prévia:**
  - clicar para selecionar legenda, título, emoji, lista, CTA ou texto adicionado;
  - caixa com alças;
  - arrastar com guias de encaixe (centro, área segura, outros elementos), Shift para travar o eixo, setas do teclado;
  - redimensionar;
  - duplo clique para editar o texto.
- Mover uma legenda oferece "todas" (padrão) ou "só esta". As posições são normalizadas no plano e desenhadas iguais na exportação. O hit-testing é uma função pura testada.
- **Inspetor contextual:**
  - texto, fonte, tamanho, peso, cores (texto, destaque, contorno, caixa, sombra), caixa alta ou baixa, alinhamento, palavras por linha, caixa de fundo, animação de entrada e saída com intensidade, início e fim;
  - escopo do elemento ou global;
  - "voltar ao modelo".
- **Adicionar e remover:** texto, título, emoji, forma opcional; apagar qualquer elemento (inclusive os automáticos), duplicar, ordem das camadas.
- **Edição de vídeo:**
  - apagar palavras na transcrição corta o vídeo;
  - dividir no cursor, apagar segmento, aparar bordas;
  - arrastar bordas para reajustar o tempo das legendas e dos elementos;
  - zoom por segmento;
  - enquadramento do vídeo (escala e posição; encaixar ou preencher).
- **Integração:** barra fixa "Peça qualquer coisa…" junto da prévia. Ela vale para a seleção (trecho ou elemento) ou para o vídeo inteiro. Prévia, inspetor e linha do tempo ficam sincronizados.
- Desfazer e refazer tudo. Travas respeitadas (M4F-504). Arrastar a 60 fps.
- e2e:
  - arrastar a legenda para cima e conferir os pixels do quadro exportado;
  - apagar uma palavra e ver a duração diminuir;
  - dividir e apagar um segmento;
  - adicionar um texto e exportar.
- ADR-0018.

### Frente 4: Vários vídeos e formatos de saída (v0.14.0)
- **Até cerca de 30 clipes:**
  - escolher vários de uma vez;
  - caixa de clipes com miniatura, duração e ordem (por data ou nome, arrastar para reordenar);
  - transcrição por clipe, com o modelo carregado uma vez só;
  - o plano vira uma sequência de segmentos que apontam para ids de clipe, com migração.
- **O que continua funcionando com vários clipes:**
  - cortes, legendas, gancho, modelos, trechos e travas passam a valer para a linha do tempo montada;
  - transições entre clipes;
  - crossfade curto e volume igualado entre clipes.
- **Montagem automática:**
  - remover silêncios e tentativas repetidas (frase recomeçada: fica a última completa; lógica pura testada);
  - ordenar, escolher o gancho, aplicar a receita;
  - a IA pode sugerir a ordem, com validação e as regras como reserva.
- **Formato de saída:**
  - 9:16 (1080×1920), 1:1 (1080×1080), 4:5 (1080×1350) e 16:9 (1920×1080);
  - escolhido na importação e mudável depois;
  - encaixar com fundo desfocado, preencher (cortar) ou **corte inteligente que segue o rosto**, com caminho suavizado e sem tremor;
  - enquadramento por clipe;
  - render, área segura, modelos e legendas com layout certo em todos os formatos.
- Códigos M4F novos: muitos clipes, total longo demais, um clipe ilegível (o resto continua), memória.
- e2e: 3 clipes (um deitado), montagem, reordenar, exportar em 9:16 e 16:9 e inspecionar os MP4. ADR-0019.

## 4. Como continuar (para a próxima IA)

1. Leia `AGENTS.md`, este plano e os ADRs 0005 a 0015.
2. Para cada frente, na ordem 1 → 2 → 3 → 4:
   - faça `git checkout` da branch e `git merge origin/main`;
   - rode `npx tsc --noEmit`, `npx vitest run`, `npm run build` e `npm run fixture && npx playwright test`;
   - termine o que falta (lista acima), suba a versão, escreva a entrada do CHANGELOG, o ADR e atualize o roteiro;
   - abra o PR e espere o CI verde (o job `test`; a "Workers Builds" da prévia sempre falha);
   - faça o merge e confirme que a publicação da `main` deu certo.
3. Depois das quatro, faça um teste de ponta a ponta com vídeo real, se possível, e mande ao responsável um roteiro único de teste (sem terminal, sem instalação, em português simples).

**Pegadinhas do ambiente de nuvem (container):**
- só o registro npm é acessível (huggingface.co, o site publicado e os logs de blob são bloqueados);
- use `mcp__github__get_job_logs` para ler os logs do CI;
- Playwright com `CHROMIUM_PATH=/opt/pw-browsers/chromium`;
- nunca use `pkill -f` ou `pgrep -f` com padrões que casem com o próprio comando;
- as capturas de tela do CI são uma guarda grosseira (`maxDiffPixelRatio 0.12`, `threshold 0.35`), porque o Chromium do CI (1248) é diferente do local (1194).

## 5. Como o responsável quer trabalhar (não negociável)
- O agente decide tudo o que é técnico e não pergunta escolhas técnicas. Registra a decisão em ADR e segue.
- Autorização permanente para corrigir, testar, fazer merge e publicar sem pedir. Só pede ao responsável testes manuais grandes.
- Ele quer rapidez: frentes seguidas, sem parar entre fases. Ele testa no fim.
- Todo problema visível ao usuário tem código M4F próprio, com o botão "Copiar detalhes".
- A versão aparece no rodapé. Cada publicação sobe a versão e ganha entrada no CHANGELOG.
- Sem custo obrigatório, sem instalação, sem enviar o vídeo, sem segredos no cliente ou no git, licença conferida para todo recurso copiado.
- Respostas em português, sem jargão, curtas, começando pelo que ele precisa fazer.
