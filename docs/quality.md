# Verificação de qualidade — Motion4Free

> Integração do Vibe Coding Toolkit **adaptada ao estado do repositório**: não há aplicação para executar lint, typecheck, tests ou build de produto.

## Evidência atual
- GitHub Actions `Documentation check`: valida arquivos obrigatórios e links Markdown relativos. Ver [Actions](https://github.com/murilaiooo/motion4free/actions).
- Submódulo `vibe-coding-toolkit`: confirma presença e pin do upstream no Git; **não comprova instalação/ativação de CLIs e skills**.
- Arquivos `PRODUCT.md`, `AGENTS.md`, `CLAUDE.md`, documentos de arquitetura e revisão: estrutura de contexto.
- Nenhum editor/benchmark de Motion4Free executado.

## Verificação de conteúdo sem app
1. Verificar árvore e revisão do submódulo: `git submodule status`.
2. Verificar que as referências na documentação são arquivos existentes ou URLs externos.
3. Conferir se modificações de requisitos atualizam `PRODUCT.md`, spec, ADR e critérios de aceitação.
4. Exigir avaliação de licenças e provenance antes de versionar assets ou modelos.

## Testes a implantar **depois** que stack e spec forem aprovadas
- `lint`, `typecheck`, `test`, `build` com comandos da stack realmente escolhida.
- QA de media: MP4 real reproduzível, A/V sync, legendas, waveform, EDL, safe area, tempos, CPU/GPU e memória.
- QA de scene graph: render determinístico por timestamp, export/preview paritários, sources licensed, segurança contra conteúdo não confiável.
- QA criativa: comparação cega humana com trabalhos de motion designers; mesma gravação sob briefs distintos; penalização de resultados genéricos.
- Harness engineering: testes de autorização, recuperação de contexto, escopo e ambiente isolado sem executar ações fora do projeto.
- Security: inspeção de segredos, dados privados, prompt injection na transcrição, APIs externas opt-in.

## Ferramentas do upstream (sob demanda)
- [Prompt de revisão de código](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/03-multi-agent-code-review.md)
- [Prompt de revisão de segurança](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/13-security-review.md)
- [Avaliação de harness](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/14-harness-evaluation.md)
- [Guia de quality gates](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/tools/06-eslint-biome-quality-gates.md)

A configuração ESLint/Next não está aplicada porque ainda não existe stack definida. Não instalar regras genéricas sobre um código que ainda não existe.
