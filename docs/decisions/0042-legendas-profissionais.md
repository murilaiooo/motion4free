# ADR-0042 — Legendas de criador profissional e emojis no contexto

Data: 02/11/2026. Status: aceita. Contexto: o responsável achou os modelos de legenda "genéricos e fracos" e os emojis automáticos fora do contexto da fala. Revisão feita com as diretrizes do Impeccable (`critique`, `bolder`, `typeset`, `animate`), comparando as prévias desenhadas antes e depois.

## O que a crítica encontrou

1. **Causa principal: as perguntas iniciais apagavam a cara de todo modelo.** O assistente gravava Inter, amarelo `#FFD400`, entrada "fade", destaque por cor, movimento 35% e corte seco como se fossem escolhas da pessoa. Todo vídeo saía com a mesma legenda (Inter + palavra amarela), qualquer que fosse o modelo. O tom padrão "calmo" ainda trocava o pulo do Pop por subida.
2. **Sem hierarquia.** A palavra-chave só mudava de cor; legendas de criador hoje fazem a palavra-chave maior, às vezes numa linha só dela.
3. **Sem material.** Nenhum modelo tinha brilho (o Neon era só cor verde), relevo ou inclinação, recursos que definem os estilos atuais.
4. **Prévia enganosa.** A miniatura parava no título de abertura (a legenda nem aparecia) e mostrava frases inteiras mesmo em modelos de 2 ou 3 palavras por vez.
5. **Emojis errados.** A tabela tinha palavras de duplo sentido e de enchimento ("cara" virava 💸, "real" 💰, "precisa" 🎯, "agora"/"hoje" ⏰, "bom" 👍, "certo"/"verdade" ✅); começos de palavra pegavam outras ("compr*" em "compreender", "meta*" em "metade"); palavra negada contava ("não é caro" → 💸); e o modo "a cada N segundos" enchia os buracos com emojis aleatórios (✨🔥👉...).

## Decisão

1. **"Do modelo" é o padrão** de fonte, cor, movimento e transição nas perguntas iniciais (`'auto'` em `creativeSetupSchema`). Só o que a pessoa escolhe de fato vira ajuste. Uma vez só, quem tinha exatamente os padrões antigos salvos passa para "do modelo" (`migrateSetupDefaults`); a revisão de direção no editor faz o mesmo com projetos antigos. O tom só muda o tempo das entradas, não a entrada.
2. **Acabamento da legenda** (`captions.fx`, opcional; ausente = desenho de antes, projetos antigos não mudam): `keywordScale` (palavra-chave maior), `keywordLine` (linha só dela), `glow` (halo na cor de destaque), `depth` (relevo em degraus na cor do contorno; com "revelação" só aparece na palavra já falada), `tilt`/`tiltMode` (inclinação da palavra falada e da palavra-chave, ou de todas alternando), `leading` (altura da linha). Tudo no canvas, mesma imagem na prévia e na exportação.
3. **Os 15 modelos foram retocados** com esse acabamento, cada um no seu mundo (Neon ganhou brilho de verdade, Editorial e Luxo a palavra-chave em itálico numa linha própria, Pop e Tutorial relevo, Turbo e Marca-texto inclinação). **Três modelos novos** com a linguagem dos criadores de hoje: **Gigante** (maiúsculas grossas, palavra-chave gigante verde-limão numa linha só dela; padrão para quem começa), **Foco** (uma palavra por vez, enorme e em relevo) e **Adesivo** (letras de adesivo em relevo, tortas, caindo e quicando). Sem fonte nova: só famílias OFL que o app já tinha.
4. **Prévias honestas**: a galeria corta a frase de exemplo como o app corta no vídeo (`chunkCaption`) e as miniaturas param no momento da palavra-chave (21,2 s).
5. **Emojis só pelo contexto**: tabela sem palavras ambíguas; frase de 2–3 palavras > palavra exata > começo de palavra; palavra negada não conta (menos ❌ e ⚠️). No modo "a cada N segundos", sem palavra que combine, procura numa janela maior; depois usa os emojis pedidos (receita, IA ou pedido) ou o **tema do vídeo** (`topicEmojis`: o que mais aparece na fala inteira); sem nada disso, aquele intervalo fica sem emoji.

## Consequências

- Vídeos novos ficam com a cara do modelo escolhido. Quem quiser a fonte/cor antiga escolhe nos ajustes opcionais.
- Menos emojis em vídeos cuja fala não sugere nenhum: é o comportamento certo, não um defeito.
- Limites: emojis continuam por palavra em português; o sentido da frase inteira (ironia, contexto longo) não é entendido sem IA. A lista de emojis desenháveis é a fonte embutida (sem emoji novo).
- Não testado nesta entrega (o responsável testa); prévias conferidas visualmente nas 18 miniaturas.
