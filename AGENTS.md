# Instruções para agentes — Motion4Free

## Fonte de verdade
Ler primeiro `docs/superpowers/specs/2026-10-20-motion4free-v1-design.md` (spec v1 aprovada), `docs/superpowers/plans/2026-10-20-plano-mestre.md` (fases e gates), o plano detalhado da fase em andamento em `docs/superpowers/plans/` e os ADRs, em especial `docs/decisions/0005-stack-v1.md`. Documentos de 18–19/10 são contexto e pesquisa; onde conflitarem com a spec v1, vale a spec v1.

## Quem decide
O responsável pelo produto (murilo) não é técnico e delegou as decisões técnicas ao agente (20/10/2026). O agente decide, registra em ADR quando relevante e segue. Não pedir ao responsável escolhas técnicas. Cada entrega termina com um roteiro de teste simples (sem terminal, sem instalação) e o feedback do teste orienta a próxima iteração.

## Regras essenciais
- Um repositório e uma pasta de projeto; não abrir ou modificar projetos não relacionados.
- **Sem custo obrigatório:** nenhuma API paga, serviços de GPU/servidor pagos, compras ou gastos não autorizados.
- **Sem instalação obrigatória:** browser-first, com alternativas transparentes para hardware limitado.
- **Sem expor segredos:** não incluir chaves em client, histórico git, logs, docs ou screenshots.
- **Sem upload silencioso:** mídia e derivados ficam no dispositivo por padrão.
- **Sem alteração destrutiva:** preservar mídia original, decisões anteriores e histórico de edição.
- **Sem dependência de resposta livre de LLM:** instruções estruturadas, validação e limites explícitos.
- **Sem prometer “viral”/profissional sem evidência:** benchmarks com vídeos reais antes de afirmação pública.
- Preferir produção determinística, cache, IA local e fallback. Não contornar limites de provedores usando múltiplas contas/chaves.
- Cada recurso copiado requer verificação de licença, provenance e notices.
- Não modificar configuração sensível de repo/segredos/visibilidade sem autorização expressa.

## Vibe Coding Toolkit integrado
- Toolkit upstream disponível como **submódulo Git versionado** em `tooling/vibe-coding-toolkit` (inicializar com `git submodule update --init --recursive`). Leia [docs/setup.md](docs/setup.md) para matriz de cobertura e limites.
- `CLAUDE.md` apenas importa `AGENTS.md`; não duplicar nem sobrescrever estas regras com o template genérico do upstream.
- Kit é fonte de **prompts, referências, qualidade e harness**; não é dependência do editor nem licença para instalar apps globais, migrar para Next.js/Drizzle ou ativar serviços pagos.
- Avaliar capabilities por necessidade. A stack está fixada no ADR-0005; trocar uma peça exige novo ADR. Qualidade real de vídeo exige benchmarks e revisão humana, além de checks técnicos.

## Processos Superpowers
Spec v1 aprovada; execução por fases conforme o plano mestre. Cada fase: plano detalhado (`writing-plans`) → implementação tarefa a tarefa com TDD → PR com CI verde → roteiro de teste para o responsável → gate. Não começar uma fase antes do gate da anterior passar.
Documentar decisões arquiteturais em ADR, atualizar docs com testes e exemplos reproduzíveis.

## Erros e versão (pedido do responsável, 20/10/2026)
- Todo problema que o usuário pode ver tem um código próprio `M4F-xxx` em `src/core/errors.ts`, documentado em `docs/erros.md`. Nunca mostrar mensagem genérica; erro novo ganha código novo.
- Toda mudança publicada sobe a versão em `package.json` e ganha entrada em `docs/CHANGELOG.md`. A versão e o commit aparecem no rodapé do app.

## Critérios para mudanças futuras
Uma mudança em motor de corte exige casos de fala, sync e áudio. Motion exige teste de frames/seek e licenças. IA exige validação semântica, custo e regressão. Export exige arquivo real e inspeção, não apenas sucesso da UI.

## Estrutura
App na raiz: `src/` (código), `tests/` (unidade, Vitest), `e2e/` (ponta a ponta, Playwright), `scripts/`. Camadas puras (`src/core`, `engine`, `analysis`, `editorial`, `render`) não usam APIs de navegador e sempre têm teste; `src/media`, `asr` e `app` tocam o navegador e são cobertas pelo teste de ponta a ponta. Comandos (a partir da Fase 1): `npm test`, `npm run typecheck`, `npm run build`, `npm run fixture && npm run e2e`.

## Manual de instruções dos repositórios upstream
Antes de escolher, integrar ou portar código de terceiros, consultar `docs/research/upstream-implementation/INDEX.md` e `05-integration-matrix.md`. Cada upstream tem instruções específicas, limites do navegador, licenças e provas de integração. Não tratar repositório público como licença universal, não copiar código/asset sem permissão correspondente e não afirmar testes que não rodaram.

