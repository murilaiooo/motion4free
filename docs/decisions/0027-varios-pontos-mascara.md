# ADR-0027 — Escolher vários, animação por pontos e máscara (v0.26)

**Status:** aceito (21/10/2026)

## Contexto
O responsável escolheu a "ordem recomendada" da comparação com o OpenCut: música e .srt (ADR-0026), depois escolher vários com o vídeo encostando ao apagar, animação por pontos (keyframes) e máscaras. Pediu tudo na mesma versão.

## Decisões

### 1. Escolher vários
- Estado só da tela (`multi: { segs, els }` no Editor), não do plano: escolher não entra no desfazer.
- Ctrl, Cmd ou Shift + clique põe ou tira um item. O botão **Vários** faz o mesmo com clique simples (regra do responsável: nada escondido, e no celular não há Ctrl).
- `deleteMany` (puro, em `editorial/manual.ts`) apaga elementos e pedaços numa entrada do desfazer. Apagar todos os pedaços é recusado (M4F-525).
- O vídeo editado já é a sequência dos pedaços, então apagar sempre "fecha o buraco". O trecho marcado na faixa Trechos agora também pode ser apagado com Delete (`deleteOutRange`).
- Copiar com vários pedaços copia todos, na ordem. Copiar ou duplicar com elementos entre os escolhidos é recusado (M4F-526), porque colar vários elementos de uma vez ainda não existe.

### 2. Animação por pontos
- `AddedElement.keys?: { at, x, y, scale, rotate, opacity, ease }[]` (até 24, em ordem; `at` conta desde que o elemento aparece). Sem pontos, nada muda.
- `render/keyframes.ts` (puro) calcula a pose: antes do primeiro ponto fica como o primeiro, depois do último como o último, e entre dois pontos interpola em linha reta ou com curva suave (`easeInOutCubic`). A entrada e a saída do elemento continuam valendo por cima.
- Com pontos, arrastar o elemento na prévia atualiza o ponto da agulha ou cria um ali. O mesmo cálculo serve para prévia, MP4 e clique na prévia.
- Só nos elementos adicionados. Legendas e cenas geradas já têm animação do modelo.

### 3. Máscara do vídeo
- `edits.mask?: { shape, x, y, size, aspect, radius, fill, border, borderColor } | null`, uma por vídeo.
- `render/mask.ts` monta o contorno com retas e arcos (círculo, retângulo arredondado, coração, estrela, losango), porque o contexto 2D do app não tem curvas de Bézier. `drawFrame` pinta a cor de fundo, recorta e desenha o vídeo, e depois a borda. Legendas, títulos e emojis vêm depois, sem recorte.

## Fora desta versão
- Pontos de animação em legendas e cenas, e curvas além de "suave" e "reta".
- Máscara por pedaço ou por clipe, máscara animada e máscara desenhada à mão.
- Colar vários elementos de uma vez.

## Não verificado
Nada disto foi testado nesta sessão (regra do responsável: ele roda os testes). Antes de afirmar que funciona, é preciso:
- rodar `tests/keyframes-mask.test.ts` e `e2e/edicao-v026.spec.ts`;
- exportar um MP4 real com máscara e com um texto animado por pontos, e assistir.
