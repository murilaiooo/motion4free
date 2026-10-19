# Inventário de repositórios e técnicas

**Pesquisa de engenharia — 18/10/2026.** Links para código/documentação; atualidade, stars, licenças e APIs devem ser verificadas novamente antes de integrar. A presença na tabela **não** significa que foi instalado, benchmarkado ou aprovado.

## Base audiovisual e UI
| Projeto | Aproveitamento específico | Risco / observação |
|---|---|---|
| [Editonny](https://github.com/soumatheusgomes/editonny) | workflow de edição, regras, cenas, assets, checks, HyperFrames | Python local, não é editor web; recursos terceiros independentes |
| [OpenReel](https://github.com/Augani/openreel-video) | timeline, storage, export browser, WebCodecs | integração, maturidade, licenças, testes reais pendentes |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) | container/codecs/media browser | MPL-2.0 e compatibilidade codec/hardware |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | fallback para operações não cobertas | RAM/performance, limite por ambiente |
| [Auto-Editor](https://github.com/WyattBlue/auto-editor) | política de corte e silencios | CLI nativo, port não trivial |

## Aprendizado de jogos no navegador
| Projeto | Inspiração | Atenção |
|---|---|---|
| [GTA V web snapshot](https://github.com/hammadshakeelai/gta5-web) | distrib. estática em chunks, range fetch, manifest | snapshot/alegações de execução não substituem validação independente; engine não replicável só com script de hosting |
| [Vice City WASM](https://github.com/joncodeofficial/gta-vice-city-wasm) | OPFS, SW e leitura HTTP Range | dados/jogo sujeitos a direitos, **não copiar assets de jogos** |
| [reVC WASM](https://github.com/origami-ltd/wasm-revc) | Emscripten/worker bridge | complexidade/threads |
| [q3js](https://github.com/lklacar/q3js) | WASM, assets e inicialização | estudo, não componente obrigatório |
| [web-quaker](https://github.com/JWally/web-quaker) | Cache de motor/recursos | confirmar licença/estado |

## IA local, router, qualidade
| Projeto | Uso |
|---|---|
| [Transformers.js](https://github.com/huggingface/transformers.js) | transcrição/classificação/embeddings no navegador |
| [WebLLM](https://github.com/mlc-ai/web-llm) | modelos locais WebGPU e schema quando suportado |
| [Semantic Router](https://github.com/aurelio-labs/semantic-router) | encaminhamento por similaridade |
| [TypeChat](https://github.com/microsoft/TypeChat) | typed commands, validação/reparo |
| [Outlines](https://github.com/dottxt-ai/outlines) | constrained decoding |
| [DSPy](https://github.com/stanfordnlp/dspy) | otimização offline de prompts com exemplos e métricas |
| [Promptfoo](https://github.com/promptfoo/promptfoo) | avaliação, matriz de prompts, modelos e assertions |
| [LiteLLM](https://github.com/BerriAI/litellm) | referência de adapters, fallback e quotas; servidor opcional |
| [Ollama](https://github.com/ollama/ollama) | fallback nativo **opcional**, não requisito sem instalação |

## Como usar esta pesquisa
1. Fazer benchmark de **um** pipeline WebCodecs/Mediabunny, não integrar todos motores.
2. Avaliar OpenReel com protótipo isolado antes de decidir fork ou biblioteca.
3. Portar regras testáveis do Editonny; não criar dependência de Codex/Claude Code no produto web.
4. Indexar e validar scenes reais para motion semântico.
5. Testar 3 modelos gratuitos vs baseline de regras, sob os mesmos vídeos e métricas.
6. Só então decidir se devemos acrescentar mais um framework.

### Fontes de referência adicionais
- [Editonny architecture](https://github.com/soumatheusgomes/editonny/blob/main/docs/architecture.md)
- [Editonny workflow](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/WORKFLOW.md)
- [Editonny validation (escopo limitado)](https://github.com/soumatheusgomes/editonny/blob/main/docs/validation.md)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [MDN WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
