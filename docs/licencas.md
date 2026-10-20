# Licenças de recursos de terceiros incluídos no app

Cada recurso copiado para o app passa por verificação de licença e procedência (AGENTS.md). Esta página lista o que é distribuído junto com o site.

## Fontes (desde a v0.3.0)
Todas sob a **SIL Open Font License 1.1 (OFL)**, que permite usar, embutir e redistribuir as fontes, inclusive em vídeos e em uso comercial, desde que a licença acompanhe os arquivos e as fontes não sejam vendidas sozinhas. O texto completo da licença e os avisos de copyright vão no site publicado em [`/licencas-fontes.txt`](../public/licencas-fontes.txt).

| Fonte | Pacote npm (versão fixada) | Arquivos usados | Copyright / origem | Usada no estilo |
|---|---|---|---|---|
| Instrument Serif | `@fontsource/instrument-serif@5.3.0` | latin 400 normal e itálico | 2022 The Instrument Serif Project Authors (github.com/Instrument/instrument-serif) | Editorial (títulos, ênfase) |
| Inter | `@fontsource/inter@5.3.0` | latin 400 (só interface), 500, 600, 700, 800 | 2016 The Inter Project Authors (github.com/rsms/inter) | Editorial e Neon (legendas, rótulos); desde a v0.10 também a fonte da interface do app (família "M4F UI", 400–700) |
| Anton | `@fontsource/anton@5.3.0` | latin 400 | 2020 The Anton Project Authors (github.com/googlefonts/AntonFont) | Pop (títulos) |
| Montserrat | `@fontsource/montserrat@5.3.0` | latin 700, 800, 900 | 2011 The Montserrat Project Authors (github.com/JulietaUla/Montserrat) | Pop (legendas, rótulos) |
| IBM Plex Sans | `@fontsource/ibm-plex-sans@5.3.0` | latin 500, 600, 700 | 2019 IBM Corp. | Documental (legendas) |
| IBM Plex Sans Condensed | `@fontsource/ibm-plex-sans-condensed@5.3.0` | latin 600, 700 | 2019 IBM Corp. | Documental (títulos) |
| IBM Plex Mono | `@fontsource/ibm-plex-mono@5.3.0` | latin 500, 600 | 2017 IBM Corp. | Documental (rótulos) |
| Archivo Black | `@fontsource/archivo-black@5.3.0` | latin 400 | 2017 The Archivo Black Project Authors (github.com/Omnibus-Type/ArchivoBlack) | Impacto (títulos e legendas) (desde a v0.9.0) |
| DM Sans | `@fontsource/dm-sans@5.3.0` | latin 500, 700 | 2014 The DM Sans Project Authors (github.com/googlefonts/dm-fonts) | Minimal (desde a v0.9.0) |
| Space Grotesk | `@fontsource/space-grotesk@5.3.0` | latin 500, 700 | 2020 The Space Grotesk Project Authors (github.com/floriankarsten/space-grotesk) | Podcast (desde a v0.9.0) |
| Nunito | `@fontsource/nunito@5.3.0` | latin 800, 900 | 2014 The Nunito Project Authors (github.com/googlefonts/nunito) | Tutorial (desde a v0.9.0) |
| Cormorant Garamond | `@fontsource/cormorant-garamond@5.3.0` | latin 500, 600 e 500 itálico | 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) | Cinema (desde a v0.9.0) |
| Oswald | `@fontsource/oswald@5.3.0` | latin 500, 700 | 2016 The Oswald Project Authors (github.com/googlefonts/OswaldFont) | Jornal (desde a v0.9.0) |
| VT323 | `@fontsource/vt323@5.3.0` | latin 400 | 2011 The VT323 Project Authors (peter.hull@oikoi.com) | Retrô 90 (desde a v0.9.0) |
| Bungee | `@fontsource/bungee@5.3.0` | latin 400 | 2023 The Bungee Project Authors (github.com/djrrb/Bungee) | Turbo (títulos) (desde a v0.9.0) |
| Rubik | `@fontsource/rubik@5.3.0` | latin 800 e 900 itálico | 2015 The Rubik Project Authors (github.com/googlefonts/rubik) | Turbo (legendas, rótulos) (desde a v0.9.0) |
| Courier Prime | `@fontsource/courier-prime@5.3.0` | latin 400, 700 | 2015 The Courier Prime Project Authors (github.com/quoteunquoteapps/CourierPrime) | Datilografia (desde a v0.9.0) |
| Caveat | `@fontsource/caveat@5.3.0` | latin 700 | 2014 The Caveat Project Authors (github.com/googlefonts/caveat) | Marca-texto (títulos, ênfase) (desde a v0.9.0) |
| Kalam | `@fontsource/kalam@5.3.0` | latin 700 | 2014 Indian Type Foundry (info@indiantypefoundry.com) | Marca-texto (legendas, rótulos) (desde a v0.9.0) |
| Playfair Display | `@fontsource/playfair-display@5.3.0` | latin 400 normal e itálico | 2017 The Playfair Display Project Authors (github.com/clauseggers/Playfair-Display), com nome reservado "Playfair Display" | Luxo (títulos, ênfase) (desde a v0.9.0) |

- **Procedência:** pacotes oficiais do projeto Fontsource no registro npm (os mesmos arquivos do Google Fonts, sem acesso ao Google Fonts em tempo de execução). A licença `OFL-1.1` está declarada no `package.json` de cada pacote e o arquivo `LICENSE` de cada um foi conferido em 20/10/2026.
- **Subconjunto latino** (`latin`): cobre todos os acentos do português. Cada arquivo tem de 18 a 40 KB (limite da Cloudflare: 25 MiB por arquivo).
- **Carregamento:** `src/media/fonts.ts`, pela FontFace API, na página e dentro do Worker de exportação. Nenhuma fonte é baixada de servidor externo.
- **Nomes reservados:** a OFL proíbe distribuir versões *modificadas* com o mesmo nome (só a Playfair Display declara um nome reservado); o app usa os arquivos sem modificação.
- **Modelos da v0.9.0:** as 13 famílias novas foram conferidas em 20/10/2026 (`license: OFL-1.1` no `package.json` e arquivo `LICENSE` de cada pacote, versão 5.3.0 fixada). Só os pesos usados pelos modelos são carregados, e só quando um estilo que os usa está na tela.

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

## Ícones da interface (desde a v0.10.0)
| Recurso | Origem (versão fixada) | Licença | O que vai no site |
|---|---|---|---|
| Lucide | pacote npm `lucide-react@1.49.0` (lucide.dev, github.com/lucide-icons/lucide) | **ISC** (declarada no `package.json` e no `LICENSE` do pacote, conferidos em 20/10/2026); os ícones derivados do Feather (ex.: `check`, `download`, `upload`, `x`, `zoom-in`) seguem a **MIT** de Cole Bemis, no mesmo arquivo | só os ícones importados em `src/app` (tree-shaking, ~40 ícones dentro do JS); texto da licença no site em [`/licencas-icones.txt`](../public/licencas-icones.txt) |

- **Por que Lucide:** traço consistente, cobre todos os ícones de editor de vídeo que o app usa, componentes React sem dependências, licença permissiva que exige só manter o aviso (feito no arquivo acima). Nenhum ícone ou logo de outro produto (CapCut, Descript etc.) foi copiado; o logo "M" do Motion4Free é um SVG desenhado no próprio código (`src/app/TopBar.tsx`).

## Nada mais
Cenas, transições, estilos e a interface (layout, CSS, componentes) foram escritos do zero para o Motion4Free (sem código, preset ou asset copiado de outros projetos). As ideias de cenas do Editonny foram apenas referência de nomes de categorias (ver `docs/research/upstream-implementation/INDEX.md`).
