# Operação de release (sem deploy automático nesta revisão)

Produto e stack: [spec aprovada](../superpowers/specs/2026-10-20-motion4free-v1-design.md), [ADR-0005](../decisions/0005-stack-v1.md). Estado de liberação: [STATUS](STATUS.md).

## Política

`main` está conectada ao processo de publicação Cloudflare Workers, conforme configuração e documentação do projeto. **Mesclar na main pode iniciar um deploy automaticamente.** Não mescle nenhuma branch somente por ter build local verde. Nunca force push. Não publicar produção como parte de revisão documental ou de QA preliminar.

## Gates antes de aprovar a release

1. Reconciliar PRs e worktrees com a `main`, sem descartar dados; tratar implementações experimentais isoladamente.
2. Resolver ou aceitar explicitamente em um registro de risco todos os P0 reais, com atenção para licenças (#2), exportação real (#3), recuperação (#4) e decisões da timeline (#5).
3. Executar na **branch candidata limpa**, com Node compatível com o CI (Node 22), npm e FFmpeg instalados:
   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   npm run fixture
   npm run e2e
   ```
   O build também executa `scripts/check-dist.mjs`, barrando arquivos maiores que 25 MiB e arquivos diagnósticos/sensíveis conhecidos.
4. Testar em Brave no Windows. Para rodar Playwright nesse browser, definir `CHROMIUM_PATH` para o executável do Brave, sem alterar o navegador padrão do usuário.
5. Inspecionar um MP4 real de vídeo curto com FFprobe (codec, dimensões, duração, áudio), abrir o vídeo resultante e confirmar sincronismo. Testar reabrir um projeto e exportar após mudanças.
6. Confirmar política de privacidade, arquivos de licença/atribuição e compatibilidade das dependências. Testar consentimento real antes de qualquer chamada externa e comparar custo anunciado com a informação do provedor.
7. Registrar SHA, versão, resultados e limitações no [STATUS](STATUS.md); incluir teste de aceitação humano. A CI do GitHub pode não iniciar por quota, e isso não deve ser descrito como aprovação.
8. Fazer merge **somente depois** da aprovação explícita da release; observar no Cloudflare qual commit entrou em produção e executar smoke no domínio real.

## Controle de publicação e reversão

- Antes do merge: guardar SHA da versão de produção conhecida como saudável, SHA do candidato e identificação do deployment Cloudflare atual.
- Se produção falhar: usar o mecanismo de rollback do Cloudflare Workers para voltar ao deployment saudável, quando disponível na conta; verificar efetivamente a versão e os fluxos principais. Em paralelo, criar e revisar um commit de `git revert` da mudança defeituosa para restaurar o código da `main` sem reescrever histórico.
- A simples reversão no GitHub não prova que o Worker em produção já voltou à versão anterior. Confirmar no domínio público, versão e status do deploy antes de encerrar o incidente.
- Nunca apagar projetos locais, mídia original ou chaves de usuário como medida de rollback.
- Não depender de UI exata do painel Cloudflare sem conferi-la na conta conectada.

## Aceitação manual para o responsável, só em Brave

1. Abra a versão de prévia validada, e confira a versão no rodapé.
2. Importe um vídeo seu de 15–30 segundos, escolha um preset, reproduza e mova uma legenda.
3. Faça um corte pequeno, desfaça, refaça, salve e reabra o projeto.
4. Exporte um MP4 curto, abra o arquivo, escute o áudio e confira se a legenda está sincronizada.
5. No Criador de Clipes, use um vídeo com começo, desenvolvimento e conclusão e verifique se o trecho sugerido preserva o sentido.
6. Nas Configurações de IA, confira clareza de preço, teste de modelo e consentimento. Não precisa comprar créditos nem fornecer chave para o teste básico.
7. Se algo falhar, anote a tela, a ação e o código M4F mostrado. Não compartilhe chaves, mídia privada ou transcrições em issue pública.

Aceitação manual satisfatória não elimina benchmarks de conteúdo, licença e regressões técnicas.
