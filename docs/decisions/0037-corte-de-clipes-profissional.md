# ADR-0037 — Corte automático de clipes profissional (v0.37.0)

Data: 02/11/2026 · Status: aceita (pedido do responsável: "foco total no corte de clipes automático; encontre repositórios que ajudem a deixá-lo profissional e assertivo")

## Contexto
O criador de clipes (v0.22, ADR-0023) acha candidatos por frases inteiras (`findContextualMoments`), mas a nota desses candidatos era quase plana: `65 + números + pergunta − alertas`. Na prática a ordem dependia mais da posição no vídeo do que da qualidade do trecho. Os títulos caíam muito em "Trecho em 12:05". O recorte vertical saía sempre no centro do quadro, mesmo com o detector de rosto já existindo no editor. E modelos grátis do OpenRouter (ex.: NVIDIA Nemotron 3 Ultra) davam M4F-1112: modelos que "pensam" gastavam o limite de 800 tokens raciocinando e a resposta vinha cortada, vazia ou com campos a mais que o esquema `.strict()` recusava.

## Pesquisa (referência de ideias; nenhum código copiado)
Resumo para leigo em `docs/research/2026-11-02-corte-de-clipes.md`.

| Projeto | Licença | O que aproveitamos | Por que não usamos o código |
|---|---|---|---|
| ClipsAI (`clipsai`) | MIT | Ideia de limites por mudança de assunto (TextTiling) e de reenquadrar no falante | Python + WhisperX + Pyannote (precisa servidor/GPU e token do Hugging Face) |
| AI-Youtube-Shorts-Generator | MIT | Grade de "viralidade": gancho, pico emocional, opinião, revelação, frase citável, valor prático; corte de sobreposição > 50 % | Python, depende de LLM pago ou servidor |
| SupoClip | AGPL-3.0 | Notas separadas (gancho, engajamento, valor) | AGPL é incompatível com distribuir sob MIT; só lido |
| MediaPipe Tasks Vision | Apache-2.0 | Detector de rosto no navegador (já usado no editor desde a v0.31) | — (usado de verdade) |
| MediaPipe Face Landmarker / Audio Classifier (YAMNet) | Apache-2.0 | Próximos passos: falante ativo pela boca e risadas/aplausos | Ficam para depois: mais downloads e precisam de teste em navegador real |

## Decisão
1. **Nota profissional** (`src/editorial/clip-score.ts`, pura e testada): 8 critérios de 0 a 1 com pesos — gancho nos 3,5 s iniciais (26), emoção/opinião/história pessoal (12), conclusão/virada na segunda metade (10), energia da voz acima da mediana do vídeo (14), ritmo de fala (8), fecha a ideia (12), funciona sem contexto anterior (10), assunto único por coesão lexical entre as metades (8). Descontos: silêncio morto, chamada para ação/patrocínio, tamanho longe do ideal. Os motivos aparecem em português no cartão e a tela de revisão mostra as 8 barras. Continua sendo estimativa estrutural, não previsão de visualizações.
2. **Começo sem enrolação**: até 4 palavras de preenchimento ("hum", "bom,", "então,") saem do começo do clipe; palavras ambíguas ("É", "Um", "Bom") só saem com vírgula/reticências.
3. **Título**: a frase falada com gancho mais forte dentro do clipe (nunca inventada). Frase longa só vira começo + "…" se o pedaço cortado não tiver palavra que muda o sentido ("não", "se", "mas", "até"…). Sem opção segura, "Trecho em mm:ss". Em vídeos longos o título só é calculado para os escolhidos (desempenho igual ao da v0.36).
4. **Seguir o rosto** ao gerar o MP4 e ao abrir no editor: quando a proporção muda, o trecho recortado passa pelo mesmo detector do editor (`analyzeFaces`) e o caminho suave vai para a exportação. Sem rosto: M4F-1115; detector não carregou: M4F-1116. Nos dois casos o clipe sai, centralizado. Pode ser desligado ("Seguir o rosto").
5. **Resposta da IA tolerante** (`src/editorial/ai-json.ts`): ignora raciocínio (`<think>` aberto ou fechado), cercas, rascunhos (vale o último JSON), vírgula sobrando, comentários, aspas tipográficas; aproveita trechos inteiros de resposta cortada; aceita nomes de campo alternativos e IDs numéricos. O pedido à IA ficou menor (4 trechos, sem listas de evidência). No OpenRouter: `reasoning.effort = low` e folga de 2048 tokens para modelos que pensam; texto que vier só no campo de raciocínio também é lido. Nada da resposta é executado e todo trecho continua conferido contra os IDs reais da transcrição.

## Consequências
- A ordem das sugestões passa a refletir qualidade do trecho; o tempo da busca local em 2 h de fala ficou igual ao da v0.36 (~2,7 s no contêiner de testes).
- Gerar um clipe vertical a partir de vídeo deitado leva alguns segundos a mais (rostos amostrados a cada 0,5 s no trecho).
- Não foi possível testar o OpenRouter nem o download do MediaPipe na nuvem (hosts bloqueados no contêiner); os formatos de resposta foram cobertos por testes com respostas simuladas.
