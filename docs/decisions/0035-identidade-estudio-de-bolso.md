# ADR-0035 — Identidade visual "estúdio de bolso" (v0.33.0)

Data: 31/10/2026 · Status: aceita (pedido do responsável: "home genérica, sem identidade, sem personalidade, sem ser aconchegante")

## Contexto
A primeira tela e os cartões seguiam o padrão de app escuro de IA: cinza frio, grade de ícones em caixas, cartões chapados, seleção com fundo amarelado opaco. Referências do mercado:
- **Submagic / Captions / Opus Clip:** preto + roxo/gradiente neon, muita prova social e números. Vende "IA viral", é o que o responsável chama de genérico.
- **CapCut:** vitrine de modelos densa, ótima para mostrar resultado, mas poluída.
- **Descript:** o mais humano: tipografia editorial, tons quentes, tom de voz de gente.

## Decisão
"Estúdio de bolso": o lugar caseiro onde o criador grava sozinho, com acabamento de estúdio.
1. **Papel quente** nas telas de entrada (`.land`, `.gallery-page`, `.production-page`): tokens de superfície e texto reescritos em tons de marrom/creme, com grão SVG leve. O editor fica neutro (julgamento de cor do vídeo).
2. **Marca-texto amarelo** como gesto da marca: a mesma ideia da palavra destacada na legenda. Usado no título, na chamada final e no destaque de itens ao passar o mouse. Amplia a regra "amarelo só para ação principal" apenas na primeira tela e na faixa de privacidade.
3. **Anotações à mão** (Caveat) em frases curtas, como um criador rabiscando no caderno; **serifa itálica** (Instrument Serif) para a parte suave do título e os números dos passos. Inter continua sendo a letra da interface.
4. **Produto real em vez de ilustração:** celular com modelo tocando ao vivo, modelos dentro de celulares, exemplos animados próprios por caminho.
5. **Uma família de cartões** (`src/app/cards.css`): superfície em degradê sutil, filete de luz no alto, sombra macia, levanta 2 px no mouse; escolhido = borda amarela + brilho quente.
6. Sem blobs, sem inclinações de cartão e sem gradientes neon (removidos antes na v0.21.1 por parecerem de IA). Só as anotações à mão têm leve rotação, porque é escrita.

## Consequências
- Fontes Instrument Serif e Caveat passam a carregar na primeira tela (~40 KB, só latin). Já estavam licenciadas para o motor de vídeo.
- `prefers-reduced-motion` desliga marca-texto animado, ponto de gravação e exemplos.
- Alterar a paleta quente exige ajustar os dois blocos em `src/app/landing.css` (escuro e claro).
