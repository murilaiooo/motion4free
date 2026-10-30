# Issue #4 — Offline parcial, OPFS e backup portátil (QA de 24/10/2026)

## Implementação nova

- O build gera `dist/sw.js` com versão SHA-256 do HTML e manifesto de assets.
- O service worker faz cache de **somente arquivos estáticos do próprio domínio** (HTML, JS, CSS e fontes). A rede é preferida para navegação enquanto online, e o HTML do cache é usado quando offline. JS/CSS usam whitelist exata de URLs do build; nenhum pedido de API, modelo, vídeo do usuário, chaves ou caminho com query entra no cache.
- A instalação baixa ~11,4 MB de 61 assets no ambiente de teste de 24/10; modelos de ASR/WebLLM, mídia e serviços terceiros **não** são pré-carregados. Não há promessa de transcrição/IA online nem de todos os formatos offline.
- Instalação só no build de produção; build E2E com ASR falso exige o parâmetro `?offline-test=1` para não contaminar as demais suítes. Em dev Vite, sem service worker.
- A cada revisão do build, as URLs imutáveis geram novo nome de cache. Durante ativação remove somente caches que começam com `m4f-shell-`; preserva OPFS, dados dos usuários, modelos e caches de outras bibliotecas. A versão antiga pode continuar atendendo clientes até eles fecharem, sem forçar troca durante a edição.
- Projetos continuam no OPFS. Novo botão **Baixar backup completo** em cada projeto com mídia presente. O arquivo `.m4f` é um pacote binário original, com blobs de mídia, project.json, metadados, fontes de clipes, música e thumbnail, **sem chaves/contas de API**. Um botão **Restaurar backup** está disponível mesmo quando não há projetos.
- O importador lê e valida todo o manifesto, versões, plano e hashes SHA-256 por blocos de 2 MiB **antes de modificar OPFS**; rejeita arquivo truncado, corrompido, duplicatas e caminhos fora da pasta do projeto; cria ID novo e reescreve `meta.json`. Se faltar espaço ou falhar a gravação, remove somente o projeto novo incompleto, preservando os anteriores.
- Backup inclui a mídia original copiada no OPFS e pode ficar grande. Não existe backup automático fora do navegador: a pessoa precisa baixar e guardar o arquivo em local seguro. Para projetos sem cópia válida do vídeo, o download fica desabilitado até fornecer novamente a mídia original.

## Evidência E2E no Brave

Teste `e2e/issue4-offline.spec.ts` em perfil Playwright limpo, rede simulada offline via navegador (não muda Wi-Fi nem dados reais da máquina):
- Registro do service worker e pré-cache de 61 recursos, 11,4 MB aproximados. Nomes de cache `m4f-shell-<hash>`.
- Projeto com vídeo sintético foi salvo, reaberto com conexão e reaberto **sem conexão**; OPFS preservou o ID, Canvas/página renderizados e status de salvo permaneceu. Nenhum erro de fetch, recurso ou JavaScript no reload offline.
- Estimativa de armazenamento após a operação 13,1 MB inclui OPFS e cache; **estimativa do navegador**, não medição exata de bytes escritos nem pico de RAM.
- Primeira tentativa encontrou um bug real: JS/CSS tinham `net::ERR_FAILED` offline devido ao `Vary` de cabeçalhos nas entradas CacheStorage. Fix `cache.match(req,{ignoreVary:true})`, seguro aqui pois o escopo é a whitelist de arquivos versionados do próprio build. Teste repetido passou.

Teste `e2e/issue4-project-backup.spec.ts`:
- Exporta pacote no browser e importa na mesma origem sem perder original, recarrega, abre e confirma áudio/vídeo disponível.
- Importa o mesmo pacote em outro contexto de navegador **com OPFS inicialmente vazio**, comprovando portabilidade da mídia. Arquivo falso não cria projeto.

Regressões de falha já presentes em `e2e/project-recovery.spec.ts`: disco cheio `QuotaExceeded`, aba fechada na cópia e importação interrompida. Os avisos foram alinhados à UI com painel recolhível. A seleção novamente do original continua sendo recuperação possível quando a cópia do OPFS foi apagada.

## Medição de primeira carga, reabertura e modo offline

O teste isolado `e2e/issue4-load-metrics.spec.ts`, em perfil novo do Brave e servidor E2E local, mede as métricas publicadas pela Performance API; valores não representam pico de RAM nem custo total de rede:

| Mesmo perfil Brave | 1ª carga | Reabertura online | Reabertura offline |
| --- | ---: | ---: | ---: |
| `navigation.duration` | 104,0 ms | 61,8 ms | 77,1 ms |
| Requisições de recursos same-origin contabilizadas | 15 | 18 | 18 |
| `transferSize` agregado reportado | 578.086 bytes | 0 bytes | 0 bytes |
| `decodedBodySize` agregado reportado | 1.797.228 bytes | 1.852.872 bytes | 1.852.872 bytes |
| Cache ativo | instalação inicial | `m4f-shell-7350a3a0043f8112` | mesmo cache |

O navegador pode omitir bytes de rede transferidos e a contagem de recursos não captura todos os downloads. A instalação do service worker de 11,4 MB ocorre assíncrona após a primeira tela, de modo que `transferSize` de primeira navegação **não mede o tamanho total do pré-cache**. As três durações são **amostras únicas**, não afirmação de que qualquer usuário obterá a mesma velocidade. A reabertura offline preservou funcionamento sem rede.

## Como reproduzir

1. `npm ci`, instalar FFmpeg e `npm run fixture`.
2. `npm run typecheck && npm test && npm run build`.
3. Configurar `CHROMIUM_PATH` para Brave no Windows.
4. `npx playwright test e2e/issue4-offline.spec.ts e2e/issue4-load-metrics.spec.ts e2e/issue4-project-backup.spec.ts e2e/project-recovery.spec.ts`.
5. Conferir build: `dist/sw.js`, `dist/index.html` e `dist/assets/*`. O script `scripts/generate-offline-shell.mjs` é deterministicamente testado em `tests/offline-shell.test.ts`.
6. Usar teste de backup com conteúdo sintético e perfil isolado; não apagar dados de um navegador real.

## Limitações e política de release

Offline significa **reabrir o editor e projetos que já estejam salvos e cacheados**, não carregar modelos CDN inéditos, conectar provedores externos nem analisar novo áudio sem modelos previamente baixados. Se o navegador limpar OPFS e CacheStorage por falta de espaço, o app não pode recuperar os dados sozinho: use o backup baixado fora do navegador. A persistência via `navigator.storage.persist()` é pedido opcional sujeito à política do browser.

Backup não é arquivo ZIP interoperável nem tem criptografia própria: mídia e transcrição dentro do `.m4f` são dados privados. Guarde com cuidado. Suporte a grandes projetos (até 16 GiB de payload, dependendo da memória e espaço disponível), às plataformas móveis e casos de storage eviction real pelo sistema operacional ainda precisa de prova de campo.

Este incremento não publica nada na `main` e não conclui os gates externos de publicação, segurança/atribuição (#2), vídeo longo (#102) e avaliação de QA humano (#10). Testes no Chromium/Edge e o comportamento real no Cloudflare devem ser repetidos antes da publicação.
