# Licenças de recursos de terceiros incluídos no app

Cada recurso copiado para o app passa por verificação de licença e procedência (AGENTS.md). Esta página lista o que é distribuído junto com o site.

## Fontes (desde a v0.3.0)
Todas sob a **SIL Open Font License 1.1 (OFL)**, que permite usar, embutir e redistribuir as fontes, inclusive em vídeos e em uso comercial, desde que a licença acompanhe os arquivos e as fontes não sejam vendidas sozinhas. O texto completo da licença e os avisos de copyright vão no site publicado em [`/licencas-fontes.txt`](../public/licencas-fontes.txt).

| Fonte | Pacote npm (versão fixada) | Arquivos usados | Copyright / origem | Usada no estilo |
|---|---|---|---|---|
| Instrument Serif | `@fontsource/instrument-serif@5.3.0` | latin 400 normal e itálico | 2022 The Instrument Serif Project Authors (github.com/Instrument/instrument-serif) | Editorial (títulos, ênfase) |
| Inter | `@fontsource/inter@5.3.0` | latin 500, 600, 700, 800 | 2016 The Inter Project Authors (github.com/rsms/inter) | Editorial (legendas, rótulos) |
| Anton | `@fontsource/anton@5.3.0` | latin 400 | 2020 The Anton Project Authors (github.com/googlefonts/AntonFont) | Pop (títulos) |
| Montserrat | `@fontsource/montserrat@5.3.0` | latin 700, 800, 900 | 2011 The Montserrat Project Authors (github.com/JulietaUla/Montserrat) | Pop (legendas, rótulos) |
| IBM Plex Sans | `@fontsource/ibm-plex-sans@5.3.0` | latin 500, 600, 700 | 2019 IBM Corp. | Documental (legendas) |
| IBM Plex Sans Condensed | `@fontsource/ibm-plex-sans-condensed@5.3.0` | latin 600, 700 | 2019 IBM Corp. | Documental (títulos) |
| IBM Plex Mono | `@fontsource/ibm-plex-mono@5.3.0` | latin 500, 600 | 2017 IBM Corp. | Documental (rótulos) |

- **Procedência:** pacotes oficiais do projeto Fontsource no registro npm (os mesmos arquivos do Google Fonts, sem acesso ao Google Fonts em tempo de execução). A licença `OFL-1.1` está declarada no `package.json` de cada pacote e o arquivo `LICENSE` de cada um foi conferido em 20/10/2026.
- **Subconjunto latino** (`latin`): cobre todos os acentos do português. Cada arquivo tem de 18 a 40 KB (limite da Cloudflare: 25 MiB por arquivo).
- **Carregamento:** `src/media/fonts.ts`, pela FontFace API, na página e dentro do Worker de exportação. Nenhuma fonte é baixada de servidor externo.
- **Nomes reservados:** a OFL proíbe distribuir versões *modificadas* com o mesmo nome; o app usa os arquivos sem modificação.

## Emojis (desde a v0.6.0)
| Recurso | Origem (versão fixada) | Licença | O que vai no site |
|---|---|---|---|
| Noto Color Emoji (subconjunto) | pacote npm `@fontsource/noto-color-emoji@5.3.2`, arquivo `files/noto-color-emoji-emoji-400-normal.woff2` (fonte original: github.com/googlefonts/noto-emoji) | **SIL OFL 1.1**, Copyright 2021 Google Inc. (arquivo `LICENSE` do pacote conferido em 20/10/2026; sem "Reserved Font Name") | `src/assets/emoji/m4f-emoji.woff2` (~50 KB) com **só os 72 emojis** da lista `EMOJI_SET` (`src/core/emoji.ts`), formato COLRv1 (colorido e vetorial); licença ao lado em `src/assets/emoji/OFL.txt` e no site em `/licencas-fontes.txt` |

- **Por que uma fonte própria:** o emoji do sistema muda de aparelho para aparelho e pode não existir dentro do Worker de exportação. Com a mesma fonte carregada na prévia e no Worker, o emoji sai **igual nos dois** (conferido no Chromium: mesmos pixels coloridos no canvas da página e no OffscreenCanvas do Worker).
- **Modificação:** é um subconjunto (só os glifos usados, sem a tabela SVG), permitido pela OFL porque a licença acompanha o arquivo e a fonte não é vendida sozinha; como a licença não declara nome reservado, o arquivo pode manter o nome interno. No app ela é registrada como família `"M4F Emoji"`.
- **Como regenerar:** `scripts/make-emoji-font.sh` (npm pack do pacote fixado + `pyftsubset` do fonttools, MIT). Não roda no build nem na CI.
- **Rejeitado:** imagens PNG do pacote `emoji-datasource` (64 px no máximo, ficariam borradas no tamanho do vídeo).

## Modelos de transcrição (Whisper)
Não são empacotados no site: o navegador baixa sob demanda, pelo espelho (`/hf/…`, ADR-0006) ou direto do Hugging Face, e guarda no próprio cache. Arquivos sem modificação.

| Modelo | Origem | Licença | Usado em |
|---|---|---|---|
| Whisper large-v3-turbo, ONNX com tempo por palavra (desde a v0.8.0) | `huggingface.co/onnx-community/whisper-large-v3-turbo_timestamped` (original: openai/whisper-large-v3-turbo, OpenAI) | **MIT** (cartão do modelo original; código e pesos do Whisper são MIT em github.com/openai/whisper) | Precisa, com placa de vídeo |
| Whisper small, ONNX com tempo por palavra (desde a v0.8.0) | `huggingface.co/onnx-community/whisper-small_timestamped` (original: openai/whisper-small) | **Apache-2.0** no cartão do Hugging Face (pesos também publicados pela OpenAI sob MIT) | Precisa, sem placa de vídeo |
| Whisper base, ONNX com tempo por palavra (desde a v0.1.0) | `huggingface.co/onnx-community/whisper-base_timestamped` (original: openai/whisper-base) | **Apache-2.0** no cartão do Hugging Face (MIT na OpenAI) | Rápida e reserva final |
| Runtime ONNX (`onnxruntime-web`) | cdn.jsdelivr.net, versão fixada pelo `@huggingface/transformers` 4.3.1 | MIT | todos |

As duas licenças permitem uso comercial e redistribuição. **Reconferir nas páginas dos modelos antes de divulgar**: o ambiente de desenvolvimento não alcança o Hugging Face (ver [ADR-0013](decisions/0013-legenda-precisa.md)).

## IA opcional no navegador (desde a v0.4.0)
Só é baixada se a pessoa ligar "IA no navegador" no painel avançado; o resto do app não depende dela.

| Recurso | Versão / origem | Licença | Como chega ao navegador |
|---|---|---|---|
| WebLLM (`@mlc-ai/web-llm`) | 0.2.85, registro npm (github.com/mlc-ai/web-llm) | Apache-2.0 (arquivo `LICENSE` do pacote conferido em 20/10/2026) | empacotado no site em arquivos separados (~6 MB), carregados por `import()` só quando ligada |
| `loglevel` (dependência do WebLLM) | 1.9.x, registro npm | MIT | junto com o WebLLM |
| Modelo "Leve": Qwen2.5-0.5B-Instruct, q4f16 pela MLC | `huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (original: Qwen/Qwen2.5-0.5B-Instruct, Alibaba Cloud) | Apache-2.0 (cartão do modelo original) | sob demanda pelo espelho (`/hf/…`), sem modificação |
| Modelo "Padrão" (desde a v0.6.0): Qwen2.5-1.5B-Instruct, q4f16 pela MLC | `huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (original: Qwen/Qwen2.5-1.5B-Instruct) | Apache-2.0 (cartão do modelo original) | idem |
| Modelo "Forte" (desde a v0.6.0): Qwen3-4B, q4f16 pela MLC | `huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC` (original: Qwen/Qwen3-4B) | Apache-2.0 (cartão do modelo original) | idem |
| Bibliotecas WebGPU dos três modelos (`Qwen2-0.5B-…`, `Qwen2-1.5B-…`, `Qwen3-4B-q4f16_1_cs1k-webgpu.wasm`) | `github.com/mlc-ai/binary-mlc-llm-libs`, pasta `web-llm-models/v0_2_84/base` (a mesma da lista do WebLLM 0.2.85, conferida por teste) | Apache-2.0 (repositório da MLC) | sob demanda pelo espelho (`/gh/…`) |

**Reconferir as licenças nas páginas dos modelos antes de divulgar**: o ambiente de desenvolvimento não alcança o Hugging Face. O **Qwen2.5-3B foi descartado de propósito**: ele usa a "Qwen Research License", que não permite uso comercial; o Qwen3-4B (Apache-2.0) ocupa o lugar de modelo "forte".

O texto da licença Apache-2.0 acompanha o pacote npm (`node_modules/@mlc-ai/web-llm/LICENSE`) e é público em apache.org/licenses/LICENSE-2.0. A chave do Google Gemini é da própria pessoa e segue os termos do Google; o app não distribui nada do Google.

## Nada mais
Cenas, transições e estilos foram escritos do zero para o Motion4Free (sem código, preset ou asset copiado de outros projetos). As ideias de cenas do Editonny foram apenas referência de nomes de categorias (ver `docs/research/upstream-implementation/INDEX.md`).
