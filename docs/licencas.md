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

## Nada mais
Cenas, transições e estilos foram escritos do zero para o Motion4Free (sem código, preset ou asset copiado de outros projetos). As ideias de cenas do Editonny foram apenas referência de nomes de categorias (ver `docs/research/upstream-implementation/INDEX.md`).
