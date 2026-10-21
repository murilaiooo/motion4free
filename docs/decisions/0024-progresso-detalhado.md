# ADR-0024 — Progresso detalhado em todas as etapas (v0.23)

**Status:** aceito (21/10/2026)

## Contexto
O responsável pediu que toda espera mostre o que está acontecendo: porcentagem, tempo que já passou, tempo que falta e, em downloads, velocidade e tamanho. Antes cada tela tinha uma barra própria (às vezes só um "girando"), a porcentagem geral da tela de processamento voltava para trás ao passar do download do modelo para a transcrição, e nenhuma etapa dizia quanto faltava.

## Decisões

### 1. Um formato só de progresso
`src/core/progress.ts` (puro, testado em `tests/progress.test.ts`) define `Progress`: texto da etapa, fração (0–1 ou `null` quando não dá para saber o total), etapa (`phase`), detalhe curto, bytes (baixados/total) e uma previsão opcional de duração. Todas as etapas demoradas passam a chamar o mesmo `OnProgress`, no lugar do antigo `(texto, fração)`.

### 2. Tempo restante honesto
`ProgressClock` mede a fração nos últimos 30 s e calcula quanto falta pela velocidade real, suavizada para o número não pular. Sem medida ainda, mostra "calculando…" ou, na transcrição, a previsão do modelo marcada como "(previsão)"; passou da previsão, volta para "calculando…" em vez de um "quase pronto" que não acaba. Etapa sem total (abrir vídeo, procurar silêncios, montar o modelo na placa de vídeo) mostra barra andando e só o tempo passado. Depois de 45 s sem notícia, a tela avisa que a etapa está demorando.

### 3. Velocidade de download real
- Modelo de legenda: o Transformers.js 4.3.1 manda `progress_total` com bytes somados de todos os arquivos (tamanhos lidos antes de baixar). Se o modelo já está no cache do navegador, o texto diz "carregando, já guardado" em vez de "baixando".
- IA no navegador: o WebLLM só manda frases ("120MB fetched"); `localAiProgress` lê os MB e usa o tamanho conhecido do modelo como total.
- Cópia do vídeo para o navegador: a gravação no OPFS vai em pedaços de 16 MB para mostrar o andamento (o arquivo continua trocando só no `close()`, então nada muda na segurança da gravação).

### 4. Um componente só na tela
`src/app/ProgressPanel.tsx` desenha título, porcentagem, barra (ou barra andando), "Passou · Falta · 120 MB de 1,4 GB · 3,4 MB/s" e o aviso de demora. Usado em: tela de processamento (vídeo novo, vários vídeos, projeto salvo, vídeo longo), exportação no editor, adicionar clipes no editor, cópia do vídeo, criador de clipes (cada clipe e o lote inteiro, com tempo restante do lote), pedidos à IA, armazenamento e página de avaliação.

### 5. Tela de processamento
O número grande agora é a porcentagem da etapa atual, com "Etapa X de 4" ao lado. A soma antiga de etapas dava porcentagens que voltavam para trás.

## O que não muda
Nenhum código de erro novo: progresso não é erro. Nenhum envio de dados: tudo é medido no aparelho.

## Não verificado
Implementado sem rodar testes, typecheck ou build (regra do responsável: ele testa). A velocidade do modelo de legenda depende do `progress_total` do Transformers.js 4.3.1 (conferido no código-fonte do pacote); os textos do WebLLM foram conferidos pela documentação, não num download real.
