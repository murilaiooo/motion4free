# ADR-0023 — Criador de clipes a partir de vídeos longos (v0.22)

**Status:** aceito (21/10/2026)

## Contexto
O responsável pediu um segundo modo no site: soltar um vídeo longo (ex.: 1 hora de podcast ou live do YouTube), o app achar os melhores momentos, cortar e entregar cada corte pronto, já editado, com legenda e no formato vertical. O site passa a ter dois caminhos: "Editar meus vídeos" (o fluxo de sempre) e "Clipes de vídeo longo" (o novo).

Limites que valem para o produto inteiro: custo zero, nada de API paga, nada de enviar o vídeo, tudo no navegador.

## Decisões

### 1. Entrada: arquivo local, não link
O navegador não consegue baixar vídeo do YouTube: o YouTube não libera o arquivo para outros sites (CORS e assinatura dos links), e os Termos de Serviço proíbem baixar fora do próprio YouTube. Um servidor que baixasse por nós custaria dinheiro, exigiria enviar o vídeo e seria arriscado legalmente.

Por isso a entrada é **o arquivo no computador**. Se a pessoa colar um link, o app reconhece e explica com o aviso **M4F-1105** como conseguir o arquivo: vídeo próprio sai pelo YouTube Studio (Conteúdo → ⋮ → Baixar); vídeo de outra pessoa só com autorização do dono. A tela lembra que cortes de terceiros precisam de permissão.

### 2. Áudio longo sem estourar a memória
O fluxo normal guarda o áudio inteiro em estéreo na taxa original (1 hora a 48 kHz ≈ 1,4 GB). Para vídeos longos o áudio é decodificado em pedaços e já reduzido para mono 16 kHz enquanto lê (`src/analysis/downmix.ts`, puro e testado, e `src/media/long-audio.ts`). Uma hora fica em ≈ 230 MB. Limite: **2 horas** (M4F-1101) e mínimo de 2 minutos (M4F-1103; vídeo curto vai pelo modo normal).

### 3. Escolha dos momentos: regras sempre, IA opcional
`src/editorial/highlights.ts` (puro, testado) monta janelas que começam e terminam em frase completa, no tamanho pedido (curtos 15–30 s, médios 30–60 s, longos 60–90 s), e dá nota a cada uma:
- abertura forte (pergunta, número, palavras fortes, exclamação), reaproveitando a detecção dos ganchos;
- conteúdo (palavras fortes por minuto), ritmo da fala e tamanho perto do ideal;
- energia do áudio em relação ao resto do vídeo (fala animada, risadas);
- fim de ideia completo; penalidade para silêncio morto e para começo com "e", "mas", "então".

Depois escolhe as melhores sem sobreposição. Cada momento traz os motivos em português ("começa com pergunta", "fala animada"…).

Se a pessoa ligar a IA (a mesma da aba IA: no navegador ou chave própria), as regras mandam o dobro de candidatos e a IA só **reordena e dá títulos** (`src/editorial/moments-ai.ts`). A resposta é validada: só números de candidatos que existem, título com limite de tamanho. Resposta inválida ou falha cai nas regras com o aviso **M4F-1106**. A IA nunca inventa trecho nem texto do vídeo; o título dela só nomeia o arquivo e o cartão.

### 4. Cada clipe vira um vídeo pequeno e um projeto normal
Para não copiar um arquivo de vários GB para cada clipe, o trecho escolhido é recortado num MP4 novo e pequeno (`src/media/cut.ts`, `Conversion` do Mediabunny com `trim`, sempre recodificando para os tempos ficarem exatos). As palavras e silêncios já transcritos são deslocados para o tempo do clipe (`src/editorial/clip-plan.ts`), então **não há segunda transcrição**. O plano sai do mesmo `autoEdit` do fluxo normal, com o modelo e o formato escolhidos.

Com isso cada clipe pode:
- **Baixar pronto:** recorta, monta e exporta pelo mesmo exportador do editor; o MP4 baixa sozinho;
- **Abrir no editor:** vira um projeto normal em Meus projetos, com tudo o que o editor faz.

"Gerar todos" faz os escolhidos um depois do outro. Falha num clipe não para os outros (M4F-1108). Falha no recorte tem código próprio (M4F-1104).

### 5. Análise guardada
Transcrever 1 hora leva tempo. A análise (palavras, silêncios, energia e dados do arquivo) é guardada no armazenamento do navegador (`clips/ultima-analise.json`, poucos MB). Se a pessoa voltar e escolher o mesmo arquivo (mesmo nome, tamanho e duração), o app pula a análise. O vídeo longo em si nunca é copiado.

## Consequências
- Nenhuma mudança no `EditPlan` nem no formato de projeto.
- A escolha por regras é previsível e explicável, mas não entende humor nem contexto; a IA opcional ajuda nisso. Qualidade real precisa de teste com vídeos de verdade.
- Transcrever 1 hora no navegador pode levar de 10 a 60 minutos, conforme o computador e a precisão escolhida. A tela avisa e mostra o progresso.
- O recorte recodifica o vídeo uma vez a mais antes da exportação final; a perda é pequena com qualidade "muito alta" no recorte.
