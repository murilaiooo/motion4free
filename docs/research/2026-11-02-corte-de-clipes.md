# Pesquisa: como deixar o corte automático de clipes profissional (02/11/2026)

Explicação para quem não é técnico. Decisão técnica completa no [ADR-0037](../decisions/0037-corte-de-clipes-profissional.md).

## O que os melhores apps de corte fazem
Apps pagos como OpusClip e os projetos gratuitos de código aberto seguem a mesma receita:
1. **Transcrever com o tempo de cada palavra** (o Motion4Free já faz, no seu computador).
2. **Dar nota a cada trecho** olhando: o começo prende nos 3 primeiros segundos? tem emoção ou opinião forte? conta uma história e chega a uma conclusão? a voz está animada? fala de um assunto só? dá para entender sem ter visto o resto?
3. **Cortar só em frases inteiras**, sem começar com "então, como eu estava falando…".
4. **Reenquadrar**: em vídeo deitado virando vertical, o recorte segue o rosto de quem fala.
5. **Título** a partir da frase mais chamativa.

## Repositórios que estudamos
| Projeto | Para que serve | Licença | Como usamos |
|---|---|---|---|
| [ClipsAI](https://pypi.org/project/clipsai) | Acha clipes pela transcrição e reenquadra no falante | MIT | Usamos a ideia de "assunto único" (TextTiling). O código é Python e exige servidor, então não roda no navegador. |
| [AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator) | Corta vídeos do YouTube em shorts com IA | MIT | Usamos a lista de critérios de "viralidade" (gancho, emoção, opinião, revelação, frase citável, valor prático). |
| [SupoClip](https://github.com/FujiwaraChoki/supoclip) | Alternativa aberta ao OpusClip | AGPL-3.0 | Só lido: a licença não combina com o Motion4Free (MIT). |
| [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) (Google) | Detecta rosto e boca no navegador | Apache-2.0 | Já usado no editor; agora também nos clipes. |
| [MediaPipe Audio Classifier](https://ai.google.dev/edge/mediapipe/solutions/audio/audio_classifier/web_js?hl=pt) (YAMNet) | Reconhece risada, aplauso, música | Apache-2.0 | Próximo passo. |

Lista de mais projetos: [tópico viral-clips no GitHub](https://github.com/topics/viral-clips). A maioria é Python com servidor ou cobra por API, o que não serve para o Motion4Free (grátis, sem instalar, vídeo não sai do computador). Por isso aproveitamos as **ideias**, escritas do zero em TypeScript.

## O que entrou na v0.37
- Nota de 0 a 100 com 8 critérios visíveis em cada clipe (barrinhas em "Revisar trecho").
- Clipe começa sem "hum", "bom," ou "então,".
- Título vindo da frase mais forte do clipe, sem cortar "não", "se" ou "mas".
- Recorte vertical seguindo o rosto, ligado por padrão.
- IA gratuita (Nemotron e outros) respondendo sem o aviso M4F-1112.

## Próximos passos sugeridos
1. **Falante ativo** em podcast com duas pessoas: medir quem mexe a boca (MediaPipe Face Landmarker) e cortar de uma pessoa para a outra.
2. **Risadas e aplausos** como sinal de momento forte (YAMNet no navegador).
3. **Assunto por significado** (não só por palavras repetidas) com um modelo pequeno de embeddings no navegador; custa um download de ~100 MB, então seria opcional.
