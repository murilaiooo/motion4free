# Runtime browser-first, cache e distribuição

## Objetivo
Carregar aplicação por URL em hosting estático, sem instalação tradicional; baixar módulos uma vez e reutilizar conforme cache/storage disponível. Sem mandar os arquivos de vídeo para servidor no caminho padrão.

## Estratégia de carregamento
**Critical shell:** interface, importação, diagnóstico, preview simples. **Lazy assets:** transcrição/embeddings, codec opcional, biblioteca motion, modelos locais, efeitos 3D. Tela de loading mede bytes/etapas reais, sem porcentagem falsa; primeira visita distinta da próxima.

## Armazenamento e integridade
- Cache API/Service Worker para app shell e arquivos versionados, cache invalidado corretamente.
- OPFS/IndexedDB para transcrição, embeddings, proxies, renders parciais e estado de projetos.
- File System Access API ou `<input type=file>` para mídia original; guardar permissões quando suportado sem presumir acesso persistente.
- Solicitar `navigator.storage.persist()` quando adequado e tratar negativa; oferecer export/backup do projeto.
- Hash por recurso, chunk manifest versionado e download deduplicado para arquivos grandes. Evitar baixar 1 GB de modelos sem necessidade.
- UI para limpar cache por tipo e mostrar uso aproximado.

## Inspiração dos ports de jogos
- [gta5-web](https://github.com/hammadshakeelai/gta5-web) `build_pages.py`, `hosting/chunk-fetch.js`: distribuição em chunks, range reads, limitação de cache em RAM. **Repositório público não equivale a validação independente de gameplay GTA V nativo em todos os ambientes**; usar técnica, não marketing.
- [gta-vice-city-wasm](https://github.com/joncodeofficial/gta-vice-city-wasm) `public/sw.js`, `src/main.js`: conteúdo OPFS, Service Worker, verificação de arquivos e respostas HTTP Range.
- [wasm-revc](https://github.com/origami-ltd/wasm-revc), [q3js](https://github.com/lklacar/q3js): estudo de Emscripten, workers e asset pipeline.

## Processamento
- Separar UI thread e workers; WebAssembly para funções sem API web apropriada.
- WebCodecs e [Mediabunny](https://github.com/Vanilagy/mediabunny) são candidatos à leitura/escrita/encode, com detecção de capacidade por navegador, formato e resolução.
- WebGPU quando compatível para inferência/efeitos; WebGL/Canvas como alternativas específicas, CPU para tarefas simples.
- Compartilhamento de memória pode exigir `crossOriginIsolated`, COOP e COEP; verificar CDN e recursos de terceiros.
- Diferenciar preview (baixa resolução) de export 1080×1920, protegendo sincronismo e memória.
- Não presumir que bibliotecas Python/FFmpeg nativas do Editonny funcionam sem port.

## Hosting e custo
Cloudflare Pages é hipótese inicial, verificar regras atuais: build, tamanho por arquivo, tráfego permitido e uso de origens externas para modelos grandes. GitHub Pages/Netlify como alternativas. Não conectar backend/GPU pagos. Modelos hospedados por terceiros podem ter termos de CDN e limites próprios.

## POC de compatibilidade
Chrome/Edge em Windows é alvo inicial. Testar vídeos H.264/AAC, outros codecs, 9:16, 16:9, 4K de origem, 5–15 min, arquivos volumosos, refresh, offline e storage eviction. Números de desempenho só depois dos testes.
