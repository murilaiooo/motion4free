# ADR-0039 — Parakeet v3 no degrau do meio da transcrição (v0.38.0)

Data: 02/11/2026 · Status: aceita, **não testada com o modelo real** (pedido do responsável: "procure modelos de IA melhores que o Whisper e que sejam mais eficientes, porém do mesmo tamanho de download")

## Contexto
A escada do modo Precisa (ADR-0013, ADR-0036) usa três tamanhos de Whisper: turbo (~1,4 GB, placa dedicada), small (250–560 MB, placa integrada ou processador) e base (80–290 MB, modo Rápida e reserva). O small erra bastante em português e, no processador, é lento porque escreve palavra por palavra.

## Pesquisa (nov/2026)
Erro por palavra em português (WER, FLEURS pt, quanto menor melhor; tabela pública de models.handy.computer, quantização q8, e artigo arXiv 2509.14128):

| Modelo | WER pt | Download no navegador | Licença | Roda no navegador hoje | Tempo por palavra |
|---|---|---|---|---|---|
| Whisper large-v3-turbo (atual, placa) | 4,2% | ~1,4 GB | MIT | sim (Transformers.js) | sim |
| **Parakeet TDT 0.6B v3** (NVIDIA) | 4,8–5,0% | **~670 MB** (int8, processador); ~1,27 GB (fp16, placa) | CC-BY-4.0 | sim (parakeet.js, MIT) | sim, nativo |
| Whisper medium | 5,1% | ~770 MB | MIT | sim | sim |
| Qwen3-ASR 0.6B | 6,6% | ~790 MB | Apache-2.0 | não (sem exportação ONNX para navegador) | só com alinhador separado |
| Whisper small (atual, meio) | 7,7% | 250–560 MB | MIT | sim | sim |
| Whisper base (atual, Rápida) | 13,9% | 80–290 MB | MIT | sim | sim |
| Parakeet "ultra" (pós-treino do v3) | 4,0–4,2% | ~670 MB | não está claro (cartões divergem) | só exportações de terceiros | sim |
| Voxtral Mini 3B/4B | 3,8–3,9% | 4,4–4,7 GB | Apache-2.0 | grande demais | — |
| Moonshine | — | — | — | **não tem português** | — |
| Distil-Whisper | — | — | — | oficial só em inglês; versão pt da comunidade com 8,2% no Common Voice | — |

Velocidade (artigo da NVIDIA, GPU de servidor): Parakeet v3 ≈ 23× mais rápido que o Whisper large-v3. O motivo é estrutural: o Parakeet ouve o trecho inteiro de uma vez (encoder FastConformer + decodificador TDT pequeno) em vez de gerar o texto token por token. Isso também elimina os "laços" do Whisper (repetir a mesma frase), que o app hoje precisa detectar e refazer.

## Decisão
1. **Topo (placa dedicada): continua o Whisper turbo.** O Parakeet v3 é bem mais rápido e do mesmo tamanho (1,27 GB em fp16), mas erra um pouco mais em português (≈ 4,8% contra 4,2%). Precisão da legenda vale mais que velocidade aqui.
2. **Meio: Parakeet v3 int8 no processador (~670 MB)**, logo depois do turbo e antes dos Whisper small. Tem o tamanho do Whisper medium, erra menos que ele e bem menos que o small (≈ 35% menos erros), não entra em laço e dá o tempo de cada palavra direto da saída do modelo. Só entra com 4 GB de memória ou mais (ou memória não informada).
3. **Rápida e reserva final: continua o Whisper base.** Não existe modelo com português abaixo de ~600 MB que seja melhor.
4. Integração: `parakeet.js` 1.4.4 (MIT) carregado só quando o degrau é usado; `npm overrides` + alias do Vite fazem ele usar o mesmo `onnxruntime-web` do Transformers.js (um runtime e um `.wasm` só). Arquivos do repositório `ysdede/parakeet-tdt-0.6b-v3-onnx` (exportação do `nvidia/parakeet-tdt-0.6b-v3`), baixados pelo espelho do site (`/hf/…`, ADR-0006) e depois direto, guardados no Cache Storage `motion4free-parakeet` (aparecem em Armazenamento como "Parakeet v3"). O encoder de 652 MB segue o mesmo redirecionamento ao CDN do Hugging Face que o encoder do turbo.
5. A saída (`words` com `start_time`/`end_time`) vira o mesmo formato do Whisper (`parakeetWordsToChunks`, puro e testado); janelas, junção, correções e cortes por palavra não mudam.

## Riscos e o que não foi verificado
- **Nada foi rodado com o modelo real**: o contêiner da nuvem não alcança huggingface.co nem o site publicado. Testes cobrem a escada, o espelho, o cache e a conversão de palavras; o caminho de verdade depende do teste do responsável no Brave.
- O Parakeet não recebe o idioma: ele detecta sozinho. Fala com muito espanhol/inglês misturado pode sair em outro idioma; o Whisper tem o idioma fixo em português.
- Sem `crossOriginIsolated` o ONNX no processador usa uma linha só; a estimativa de 40 s por minuto de fala é um palpite e pode ser maior em computador fraco.
- Se o Parakeet falhar (memória, download, runtime), a escada desce para o Whisper small com o aviso M4F-307, como já acontece com o turbo.
- Licença CC-BY-4.0 exige atribuição: NVIDIA (modelo) e ysdede/istupakov (exportação ONNX) estão em `docs/licencas.md` e em Configurações › Sobre.

## Próximos passos possíveis
- Testar o Parakeet v3 fp16 na placa dedicada como opção "rápida e quase tão precisa" (mesmo tamanho do turbo).
- Reavaliar o Parakeet "ultra" (≈ 4,0% em pt) quando a licença estiver clara e houver exportação ONNX estável.
