# Distribuição gratuita, cache, armazenamento, workflow e direitos

**Objetivo:** interface por URL sem instalação obrigatória, processamento local e recursos opcionais baixados progressivamente. Referências externas podem inspirar implementação sem que motor de jogo ou assets do jogo sejam copiados.

## 1. GTA5 Web — chunks, Range e deduplicação

**Upstream:** https://github.com/hammadshakeelai/gta5-web. Código específico inspecionado: [hosting/chunk-fetch.js](https://github.com/hammadshakeelai/gta5-web/blob/main/hosting/chunk-fetch.js) e `build_pages.py`.

### Mecanismo real observado
- Manifesto global `GAME_CHUNKS` mapeia arquivo lógico para peças estáticas.
- `chunk-fetch.js` intercepta fetch de arquivos aprovados no mesmo domínio, responde `GET/HEAD` e `Range: bytes=start-end` com `200/206`, `Accept-Ranges`, `Content-Range` e `416` para faixa inválida.
- Peças baixadas com cache HTTP `force-cache`, tamanho verificado, deduplicação por `pending` para requisições simultâneas, LRU RAM limitada a **32 MiB** no exemplo. Comentário indica no máximo 4 MiB por transferência.
- A origem é distribuída em peças imutáveis, evitando exigir suporte de Range do hosting para um único asset gigante.

### Como adaptar
1. Não sobrescrever `globalThis.fetch` para todo o site sem necessidade; preferir `AssetLoader` explícito/Service Worker com rotas limitadas e testes.
2. Gerar manifesto versionado de assets *nossos* (pesos de modelos, loops, WebM, bundles de cenas), com tamanho/sha256/mime/licença/URL e chunk table.
3. Lazy-download e cache HTTP/OPFS por hash, limitar RAM, deduplicar `Promise` de partes em andamento; evitar que cancelamento de um leitor mate outro download compartilhado.
4. Verificar resposta `206` com faixa exata, suffix-range, inválidas, chunk faltante, refresh, conteúdo truncado/corrompido; serviço pode substituir manifest sem misturar versões.
5. Preload só dos assets da cena, com progresso por bytes reais e fallback visual autorizado.

**Atenção:** repositório de um port/snapshot de jogo **não comprova** que jogos AAA ou nosso render rodam universalmente em navegador. Código, marcas, executáveis e assets de GTA têm direitos de terceiros; copiar apenas ideias de carregamento e escrever código próprio salvo licença explícita.

## 2. Vice City WebAssembly — OPFS, Service Worker e streaming local

**Upstream:** https://github.com/joncodeofficial/gta-vice-city-wasm.
- [public/sw.js](https://github.com/joncodeofficial/gta-vice-city-wasm/blob/main/public/sw.js): intercepta caminhos delimitados de assets, lê OPFS, gera `Content-Type`, `Content-Length`, `Accept-Ranges` e respostas parciais. Cache/revalidação da app shell em separado.
- [src/main.js](https://github.com/joncodeofficial/gta-vice-city-wasm/blob/main/src/main.js): verifica estado de mídia persistida, presença/versão/tamanho dos arquivos e oferece reset.

### Adaptação
- Guardar modelos, proxies, transcrições, cache de export e projetos em **OPFS/IndexedDB** onde apropriado. Não duplicar vídeo original inteiro quando File System Access API/seleção do usuário for suficiente.
- Service Worker deve ter escopo restrito, caminhos prefixados, versão de cache e sem interceptar URLs arbitrárias; servir conteúdo do próprio projeto quando API permitir.
- Verificar suporte a seek/Range e integridade; lidar com storage eviction, falta de quota, falta de permissão e offline.
- `Cache API` para app shell e assets reusáveis; `OPFS` para dados produzidos/grandes; projetos exportáveis/backups e relink dos arquivos originais.
- Headers de isolamento (`COOP`/`COEP`) somente quando necessários, testando compatibilidade e privacidade de embeds/CDNs.

**Teste:** entrar, carregar modelo/asset, recarregar offline, seek no WebM, forçar ausência de peça, limpar storage, recuperar projeto com mídia reimportada.

## 3. OpenReel + Mediabunny — evitar cache e export próprios sem necessidade
[OpenReel storage](https://github.com/Augani/openreel-video/tree/main/packages/core/src/storage) já contém motores de persistência e serializer; [Mediabunny I/O](https://github.com/Vanilagy/mediabunny/tree/main/docs/guide) já fornece streaming e mux. A combinação com OPFS tem custo de integração; antes de criar gerenciadores paralelos, estudar responsabilidades reais dos subsistemas no POC.

## 4. Vibe Coding Toolkit — já conectado ao GitHub

**Upstream:** https://github.com/soumatheusgomes/vibe-coding-toolkit; adotado como submódulo `tooling/vibe-coding-toolkit` em revisão fixa `790a895304e0c08b70a5b215c9d334f1c86b816c` (MIT).

### Instruções primárias relevantes
- [Existing project setup](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/12-existing-project-setup.md): inspecionar estado, preservar contratos, adotar só componentes compatíveis, não migrar stack só por defaults.
- [Superpowers](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/tools/01-superpowers.md): brainstorm/spec/revisão/aprovação/planos/execução e testes.
- [Multiagent review](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/03-multi-agent-code-review.md): revisões focadas com contexto e síntese sem ruído.
- [Security review](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/13-security-review.md): revisão read-only e escopo/relatório.
- [Harness2](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/tools/23-harness2.md): melhoria de agentes com experimentos medidos.

### Como usar de verdade no Motion4Free
- `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `docs/setup.md` e `docs/quality.md` já mapeiam projeto; preservar.
- Para obter checkout completo do submódulo em **máquina autorizada**: `git submodule update --init --recursive` (comando não executado aqui).
- Nenhuma necessidade atual de instalar globalmente Codex CLI, Claude Code, Docker, PostgreSQL/Drizzle, Next.js, Grafos, Sentry ou serviços de logging pagos.
- Quando stack existir, integrar ESLint/TS/testes, qualidade, revisão e CI das tecnologias **realmente escolhidas**, não o template inteiro.
- Não rodar automaticamente comandos remotos, mudanças de usuário/OS, hook global, migração DB ou billing.

## 5. Regras de licença e uso correto do código disponível

A frase “está no GitHub, então podemos saber como fazer” é válida para **estudar o funcionamento e reproduzir técnicas gerais**, mas **não é licença universal para copiar código/assets**.

### Checklist de incorporação
1. Fixar repositório + revisão/tag + arquivos efetivamente reutilizados.
2. Verificar **licença de cada pacote** (`LICENSE` e subpacotes), copyright e NOTICE.
3. Verificar **assets separadamente**: fontes (OFL etc.), áudio (CC0/CC-BY etc.), vídeos, 3D, imagens, modelo de IA/pesos, dataset de treino e amostras.
4. Cumprir notices e compartilhamento de alterações em bibliotecas copyleft quando necessário. Exemplos: **Mediabunny MPL-2.0**, possíveis subpacotes/Studio AGPL.
5. Biblioteca “source available” com restrições não deve ser vendorizada automaticamente. Exemplo concreto: [OpenVideo LICENSE](https://github.com/openvideodev/react-video-editor/blob/main/LICENSE) restringe derivativos e certos usos comerciais; **não é equivalente a MIT**. Podemos estudar a interface e recriar princípios com código próprio sem copiar expressão protegida.
6. Não incluir assets de jogos/filmes comerciais nem contornar proteção/assinatura.
7. Criar `third_party/licenses.json` ou equivalente antes de usar qualquer arquivo upstream na distribuição: fonte, URI, versão/hash, licença, avisos, permissões e obrigações.
8. Resolver conflitos/licenças com análise jurídica se necessário; não presumir autorização por classificação automática.

### Categorias
| Categoria | O que podemos fazer agora | Gate antes de distribuição |
|---|---|---|
| Técnica geral (chunking, timing, scene graph, EDL) | Estudar e projetar implementação própria | Teste técnico e evitar reprodução indevida de código restrito |
| Código MIT/Apache verificado | Usar com condições de licença e attribution | Capturar notices, versões, dependências |
| MPL-2.0 | Integrar se obrigações atendidas | Publicação de alterações cobertas e notices aplicáveis |
| AGPL/GPL | Avaliar cuidadosamente uso e distribuição | Revisão das obrigações específicas; não copiar sem decisão |
| Source-available restrito | Usar como referência de funcionamento | Licença específica/permissão se incorporar |
| Assets de terceiros | Catalogar e verificar direitos | Aprovação **por asset** |
| APIs gratuitas | Consultar termos e cotas atuais | Segurança, consentimento, no shared key in client |

## 6. Custo zero e publicação
A experiência web pode ser gratuita para o usuário com processamento no próprio dispositivo; mas largura de banda de modelos/assets, abuso, compatibilidade e limites de CDN não desaparecem. Cloudflare Pages ou equivalente é hipótese, não hosting conectado.

**Testar** primeira visita vs cache, transferência por 100/1000 edições, política de cache/CDN, resiliência a offline, limites gratuitos do provedor e custo de manutenção. Segredos de provedores pagos jamais embutidos na build pública.

## 7. Roteiro de verificação supply-chain
- Antes de dependência nova: revisar repo/commit, integridade, licença, histórico de releases e comportamento de install scripts.
- Pin de versões em lockfile, SBOM e NOTICE, testes numa cópia descartável.
- Sem bibliotecas que exigem cloud pago, scripts globais, chaves/telemetria opacas ou infraestrutura que contrarie privacidade.
- Revalidar permissões, CORS, CSP e headers ao hospedar WASM/Workers.
- Não tratar GitHub Actions de documentação como validação do motor de vídeo.

[Índice](INDEX.md) · [Mídia e editor](01-media-and-editor.md) · [Matriz](05-integration-matrix.md).
