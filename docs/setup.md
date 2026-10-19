# Integração do Vibe Coding Toolkit — Motion4Free

**Escopo:** projeto (repositório GitHub), sem alterações globais no computador. **Estado:** submódulo Git incluído e documentação adaptada; integrações locais de CLIs/skills pendentes de ambiente e escolha da stack.

## Procedência e pin
- Projeto upstream: https://github.com/soumatheusgomes/vibe-coding-toolkit
- Licença do upstream: [MIT](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/LICENSE)
- Revisão fixada: `790a895304e0c08b70a5b215c9d334f1c86b816c` (2026-10-19 UTC)
- Destino: `tooling/vibe-coding-toolkit` via `.gitmodules`, **gitlink 160000**.
- Atualizar somente após examinar changelog/diff upstream e validar conflitos:
  ```bash
  git submodule update --init --recursive
  git -C tooling/vibe-coding-toolkit fetch origin
  # Revise e decida a revisão alvo antes de avançar o gitlink!
  ```
- O toolkit não é biblioteca do produto nem motor de vídeo; não executar scripts upstream sem inspecionar e autorizar.

## Mapeamento dos nove destinos de documentos
| Esperado pelo toolkit | Arquivo Motion4Free | Estado |
|---|---|---|
| README.md | [README](../README.md) | Preservado |
| PRODUCT.md | [PRODUCT](../PRODUCT.md) + [requisitos](requirements.md) | Adaptado |
| AGENTS.md | [AGENTS](../AGENTS.md) | Preservado; orientado a Motion4Free |
| CLAUDE.md | [Claude bridge](../CLAUDE.md) | Adicionado: `@AGENTS.md` |
| docs/architecture.md | [Arquitetura](architecture.md) | Preservada |
| docs/design.md | [Design](design.md) + [direção de arte](creative/art-direction.md) | Mapeado |
| docs/onboarding.md | [Onboarding](onboarding.md) | Adicionado |
| docs/quality.md | [Qualidade](quality.md) | Adicionado |
| docs/setup.md | Este documento | Adicionado |

## Matriz de cobertura do toolkit
| Componente upstream | Estado | Ação/prova |
|---|---|---|
| Superpowers | Disponível nesta conversa; **não instalado pelo submódulo no computador** | Aplicar gate spec->aprovação->writing-plans |
| Prompt 12, setup projeto existente | Referência integrada | Usar seletivamente, sem executar passos de máquina/global |
| CLAUDE / AGENTS / PRODUCT / docs | Integrado por arquivos | Links e documentação preservados |
| Context7 | Opcional, sem conexão local verificada | Quando for necessário validar API na futura stack |
| RTK, Ponytail, Caveman | Não instalado nem necessário na fase documental | Avaliar no ambiente de desenvolvimento autorizado |
| Graphify | Pendente | Só após existir código e com exclusions para arquivos privados |
| Vercel Skills / Next dev-loop | Não aplicável **agora** | Apenas se stack Next/React for escolhida; não impor Next.js |
| PostgreSQL/Drizzle | Não aplicável **agora** | A arquitetura browser-first não exige banco; decisão posterior |
| ESLint/Biome e rules locais | Pendente de stack | Definir após primeiro código de produto; adaptar e testar |
| shadcn/ui | Não selecionado | Avaliar somente na aprovação de UI |
| Chrome DevTools / agent-browser | Não instalado aqui | Aplicável quando existir app, sem tocar em sessões pessoais |
| CI repair | Documentado, GitHub CI existente | Usar se houver falha reproduzida; não instalar novo runtime |
| Security/differential review | Procedimento disponível em docs | Executar revisão read-only em diffs relevantes |
| Harness2-inspired approach | Adotado **como instrução**, não CLI | Registrar scope, contrato, evidência e testes isolados; nada pago |
| Sentry/monitoring MCP | Não conectado | Fora de escopo até decisão explícita sobre backend/privacy |
| Artifacts / extras | Sem necessidade atual | Adotar skills específicas com permissão e sem duplicatas |
| Hooks de cliente | Não configurados | Evitar ganchos não testados e bloqueios de push |
| Setup de máquina / Codex CLI / Claude CLI | **Fora do escopo** | Nenhuma mudança global na máquina ou autenticação do usuário |

## Restrições importantes
- O submódulo **não ativa** Superpowers/Context7/Claude Code no GitHub ou no computador.
- GitHub Actions já existente valida documentação; o checkout padrão não inicializa submódulos e **não executa código upstream**.
- Nada de copiar `templates/next/`, criar `package.json` nem configurar DB/ORM sem escolher stack e confirmar compatibilidade.
- Ferramentas de IA funcionam sob autenticação do usuário, sem API paga, rate limit contornado ou proxy oculto.
- Material de origem preservado no submódulo; nossas instruções em `AGENTS.md` têm prioridade de escopo.

## Comandos válidos no estágio atual
```bash
git submodule update --init --recursive
git submodule status
git status --short
```
Ainda **não existem** `npm install`, `npm test`, `npm run build` para Motion4Free. Ações de CLI e suas dependências têm de ser escolhidas depois da spec.

## Gate de continuidade
[Auditoria premium](reviews/2026-10-18-premium-creative-audit.md) e [adendo](superpowers/specs/2026-10-18-premium-personalization-amendment.md) aguardam aprovação, antes do planejamento de implementação.
