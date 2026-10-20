# ADR-0013 — Legenda precisa: Whisper large-v3-turbo com escada de reserva, janelas com folga e limpeza (v0.8.0)

**Data:** 2026-10-20
**Status:** ACEITA. Substitui a linha "Whisper base" da seção Transcrição do [ADR-0005](0005-stack-v1.md) (a peça continua a mesma: `@huggingface/transformers` 4.3.1). Estende a lista do espelho do [ADR-0006](0006-espelho-do-modelo.md). Nenhuma dependência nova, nenhum serviço pago, o áudio continua sem sair do aparelho.

## Contexto
No teste real da v0.7.0 (vídeo de 145 s, fala em português, gravado no celular) o responsável contou ~80% das palavras certas. Num clipe curto e limpo, ~98%. O modelo era o `whisper-base` (74 M parâmetros), o menor multilíngue útil; em fala real e longa ele erra palavras raras, nomes e trechos com ruído. Além do modelo, havia três pontos fracos no caminho: (1) janela cortada no limite de 28 s quando não há silêncio, partindo a palavra da borda; (2) nenhuma defesa contra as alucinações típicas do Whisper (laço repetindo a frase; "Legendas pela comunidade Amara.org" em silêncio); (3) o alinhamento por atenção cruzada às vezes estica a última palavra antes de uma pausa até o fim da pausa (a legenda fica na tela sem voz) ou começa a primeira palavra cedo.

## Decisão
1. **Modelos em escada, com reserva automática** (`src/core/asr-models.ts`, `asrLadder`):
   - **Precisa** (padrão): `onnx-community/whisper-large-v3-turbo_timestamped` em **WebGPU** (encoder fp16, decodificador q4; ~1,4 GB na primeira vez) → `onnx-community/whisper-small_timestamped` em **WASM** q8 (~250 MB) → `whisper-base_timestamped` (WebGPU fp32, depois WASM q8: o caminho que já funcionava na v0.7).
   - **Rápida**: só o base (WebGPU se houver, depois WASM).
   - O turbo só entra na escada com **WebGPU de verdade** (adaptador que não é o de software), recurso **`shader-f16`** e **memória ≥ 8 GB** (ou não informada) — `src/asr/capability.ts`. Sem isso, Precisa começa no small.
   - O padrão é Precisa, menos em aparelho que informa menos de 4 GB (aí Rápida). A escolha fica lembrada no navegador.
   - **Sem beco sem saída**: se um degrau não baixa (M4F-301/305), não inicia (M4F-302) ou falha no meio de um trecho (M4F-303: falta de memória da placa, export sem atenção cruzada…), o Worker libera o modelo e **continua do mesmo trecho** com o próximo degrau. A legenda sai e aparece o aviso **M4F-307** dizendo qual falhou, por quê e qual fez a legenda; embaixo do resumo aparece "Legenda feita com …". Só se todos falharem a transcrição falha (código do último motivo), e o vídeo segue editável sem legenda, como antes.
2. **Opção "Precisão da legenda"** na área de envio (`AsrPrecisionOption`), alimentada pelo hook `useAsrPrecision` (sem layout próprio, para sobreviver ao redesenho da interface). Cada opção diz o modelo, se usa placa de vídeo ou processador e o download da primeira vez. Durante a transcrição o progresso mostra o modelo, o trecho ("trecho 3 de 6") e a estimativa de minutos.
3. **Melhorias independentes do modelo**:
   - Idioma `portuguese` e tarefa `transcribe` **sempre fixos** (`whisperOptions`, com teste). Sem detecção automática, nenhum trecho vira espanhol ou tradução.
   - Janelas continuam cortadas no meio de silêncios (≤ 28 s), agora com **1 s de folga de cada lado** (o Whisper ouve ≤ 30 s). Cada janela só responde pelas palavras cujo meio cai no seu pedaço; a palavra da junção entra uma vez, e se a mesma palavra aparecer dos dois lados da junção no mesmo instante, a repetida sai (`mergeWindows`).
   - Janela com ≥ 95% de silêncio **não vai ao Whisper** (é ali que ele inventa frases).
   - **Alucinações**: frases de legendagem ("Legendas pela comunidade Amara.org", "Legenda Adriana Zanotto", "Subtitles by…") sempre saem; frases que podem ser fala ("Obrigado por assistir", "Inscreva-se no canal", "tchau") só saem quando ≥ 60% caem num silêncio medido; marcações de som (♪, [Música], (risos)) saem. **Laços**: palavra repetida 4+ vezes seguidas ou grupo de 2–8 palavras repetido 3+ vezes fica uma vez ("não, não, não" fica). Janela com cara de laço (> 6 palavras/s ou laço > 25% do texto) é **transcrita de novo com `no_repeat_ngram_size: 6`** e fica a melhor das duas.
   - **Tempo das palavras** (`snapToSpeech`): palavra que entra num silêncio medido é recortada para fora dele com margem de 80 ms (consoantes finais são baixas); palavra que atravessa uma pausa fica do lado maior; palavra toda dentro de "silêncio" (fala baixa) não muda; palavras ficam em ordem e sem sobreposição. Testes garantem que palavras boas não mudam de tempo.
   - A colagem de pedaços de palavra (sem espaço → mesma palavra) foi mantida (`groupPieces`).
4. **Medida**: `src/analysis/wer.ts` (WER por alinhamento de Levenshtein, com trocas/faltas/sobras, opção de ignorar acentos e lista dos erros mais comuns), com testes. Página **`?avaliar`** para medir num vídeo real no navegador ([docs/ai/avaliar-legenda.md](../ai/avaliar-legenda.md)).

## O que foi conferido e o que é suposição
O ambiente de desenvolvimento **não alcança o Hugging Face** e não tem placa de vídeo: nenhum dos modelos novos foi baixado nem rodado aqui. A qualidade real só se mede com `?avaliar` no computador do responsável.

**Conferido no código do Transformers.js 4.3.1 instalado (`node_modules/@huggingface/transformers/src`):**
- `return_timestamps: 'word'` liga `return_token_timestamps` e exige `alignment_heads` no `generation_config.json` e **atenção cruzada nas saídas do decodificador**; sem isso lança "Model outputs must contain cross attentions…" na primeira janela (`models/whisper/modeling_whisper.js`). Por isso todos os modelos são exportações `_timestamped` e uma falha nessa hora desce a escada.
- Idioma e tarefa viram tokens fixos do prompt (`_retrieve_init_tokens`); sem idioma, o 4.3.1 assume **inglês** (não detecta), então fixar `portuguese` é obrigatório.
- dtype por arquivo (`{ encoder_model, decoder_model_merged }`) e os sufixos de arquivo: fp32 = sem sufixo, fp16 = `_fp16`, q8 = `_quantized`, q4 = `_q4` (`utils/dtypes.js`). Whisper usa `encoder_model` + `decoder_model_merged` (`models/session_config.js`).
- `no_repeat_ngram_size` e `repetition_penalty` são aplicados (`models/modeling_utils.js`). **Beam search não funciona de verdade** (o laço de geração só segue o primeiro feixe: "we don't support spawning new beams") e **não existe a troca de temperatura por taxa de compressão** do Whisper original; por isso a decodificação é gulosa e a segunda tentativa com `no_repeat_ngram_size` faz o papel da reserva de temperatura.
- `suppress_tokens` do `generation_config.json` é aplicado (o Whisper já suprime a maioria dos símbolos de som).
- Com `return_timestamps`, o 4.3.1 usa o laço de "seek" do Whisper dentro da janela; não passamos `max_new_tokens` (desligaria o laço).

**Suposições (de memória, a confirmar no primeiro teste real):**
- Os repositórios `onnx-community/whisper-large-v3-turbo_timestamped` e `onnx-community/whisper-small_timestamped` existem e têm `onnx/encoder_model_fp16.onnx`, `onnx/decoder_model_merged_q4.onnx` (turbo) e os arquivos `_quantized` (small), como o `whisper-base_timestamped` que já funciona. Se o turbo não existir ou faltar um arquivo, o download dá 404, vira M4F-302 e a escada desce para o small (o aviso M4F-307 mostra isso). O turbo **sem** `_timestamped` (`onnx-community/whisper-large-v3-turbo`) não serve: não exporta atenção cruzada.
- A combinação encoder fp16 + decodificador q4 em WebGPU é a da demonstração oficial do Transformers.js para o large-v3-turbo.
- Tamanhos (1,4 GB / 250 MB / 290 MB / 80 MB) são estimativas pelos parâmetros (turbo: encoder ~635 M em fp16 + decodificador de 4 camadas em q4; small: 244 M em q8).
- Tempos esperados para 145 s de fala (estimativa, não medido): turbo em WebGPU numa placa de vídeo comum ~30–60 s depois do download; small em WASM 2–4 min (o site não tem isolamento entre origens, então o WASM roda em uma linha de execução); base 30 s–1 min. O alinhamento do turbo (4 camadas no decodificador) costuma ser um pouco menos exato que o do large-v3 completo; `snapToSpeech` compensa os casos mais visíveis.
- O plano grátis da Cloudflare não guarda em cache arquivos acima de 512 MB; o encoder fp16 do turbo (~1,3 GB) passa pelo espelho em streaming sem cache na borda (cada primeira transcrição busca no Hugging Face). Se o espelho falhar, o app tenta o servidor original.

## Licenças
Whisper (OpenAI): código e pesos publicados sob **MIT** (github.com/openai/whisper). Cartões no Hugging Face: `openai/whisper-large-v3-turbo` declara MIT; `openai/whisper-small` e `openai/whisper-base` declaram Apache-2.0 — as duas permitem uso comercial e redistribuição sem modificação. As conversões ONNX da onnx-community herdam a licença do original. Nada é empacotado no site: o navegador baixa sob demanda (espelho `/hf/…` ou huggingface.co). Ver [licencas.md](../licencas.md). **Reconferir nas páginas dos modelos antes de divulgar** (o ambiente não alcança o Hugging Face).

## Alternativas descartadas
- **whisper-large-v3 completo** (1,5 B parâmetros, 32 camadas no decodificador): ~2× o download do turbo e muito mais lento por palavra, para ganho pequeno em português.
- **whisper-medium**: mais lento que o turbo e menos preciso.
- **Distil-Whisper**: as versões oficiais são só inglês.
- **Moonshine / Cohere ASR / Parakeet** no Transformers.js 4.3.1: sem tempo por palavra no pipeline ou sem português.
- **`chunk_length_s` do pipeline**: corta no tempo fixo (parte palavras) e junta por texto; nossas janelas cortam em silêncio e juntam por tempo.
- **Prompt com o texto anterior** (`prompt_ids`): ajuda na consistência, mas aumenta os laços de repetição; fica para depois do benchmark.
- **API de transcrição na nuvem**: paga e envia o áudio (AGENTS.md proíbe).

## Consequências
- `Transcriber.transcribe` devolve `{ words, model, notices }`; a limpeza (`cleanTranscript`) roda no pipeline, que conhece os silêncios.
- Espelho: três repositórios Whisper permitidos (teste confere cada arquivo que a escada pede).
- Novo código **M4F-307**. Projetos salvos continuam abrindo (as palavras salvas não mudam).
- Próximo passo depois do teste real: se o WER com o turbo ainda passar de ~8% no vídeo de 145 s, olhar a lista de erros mais comuns do `?avaliar` antes de mexer em mais coisas.
