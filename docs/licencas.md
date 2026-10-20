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

## IA opcional no navegador (desde a v0.4.0)
Só é baixada se a pessoa ligar "IA no navegador" no painel avançado; o resto do app não depende dela.

| Recurso | Versão / origem | Licença | Como chega ao navegador |
|---|---|---|---|
| WebLLM (`@mlc-ai/web-llm`) | 0.2.85, registro npm (github.com/mlc-ai/web-llm) | Apache-2.0 (arquivo `LICENSE` do pacote conferido em 20/10/2026) | empacotado no site em arquivos separados (~6 MB), carregados por `import()` só quando ligada |
| `loglevel` (dependência do WebLLM) | 1.9.x, registro npm | MIT | junto com o WebLLM |
| Modelo Qwen2.5-0.5B-Instruct, quantizado q4f16 pela MLC | `huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (pesos originais: Qwen/Qwen2.5-0.5B-Instruct, Alibaba Cloud) | Apache-2.0, declarada no cartão do modelo original. **Reconferir na página do modelo antes de divulgar**: o ambiente de desenvolvimento não alcança o Hugging Face | baixado sob demanda pelo espelho do site (`/hf/…`), arquivos sem modificação |
| Biblioteca WebGPU do modelo (`Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`) | `github.com/mlc-ai/binary-mlc-llm-libs`, pasta `web-llm-models/v0_2_84/base` (a mesma da lista do WebLLM 0.2.85) | Apache-2.0 (repositório da MLC) | baixada sob demanda pelo espelho do site (`/gh/…`) |

O texto da licença Apache-2.0 acompanha o pacote npm (`node_modules/@mlc-ai/web-llm/LICENSE`) e é público em apache.org/licenses/LICENSE-2.0. A chave do Google Gemini é da própria pessoa e segue os termos do Google; o app não distribui nada do Google.

## Nada mais
Cenas, transições e estilos foram escritos do zero para o Motion4Free (sem código, preset ou asset copiado de outros projetos). As ideias de cenas do Editonny foram apenas referência de nomes de categorias (ver `docs/research/upstream-implementation/INDEX.md`).
