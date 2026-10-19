# Onboarding do projeto Motion4Free

## Estado atual
Somente documentação e instruções para agentes. **Não há servidor de desenvolvimento, dependências, build ou comandos npm para o produto.** Não afirmar que "o aplicativo roda" após clonar.

## Clonar com toolkit completo
```bash
git clone --recurse-submodules https://github.com/murilaiooo/motion4free.git
cd motion4free
git submodule status
```
Se o repositório já estiver clonado:
```bash
git submodule update --init --recursive
git submodule status
```
O toolkit está em `tooling/vibe-coding-toolkit/`, fixado no commit `790a895304e0c08b70a5b215c9d334f1c86b816c`. O download depende de conexão à origem GitHub. **Isto é instalação do material no checkout Git, não instalação automática de plugins globais, CLIs, modelos nem APIs.**

## Antes de qualquer modificação
1. Ler `PRODUCT.md`, `AGENTS.md`, [índice](INDEX.md) e [spec Superpowers](superpowers/specs/2026-10-18-motion4free-design.md).
2. Conferir as prioridades e [lacunas criativas](reviews/2026-10-18-premium-creative-audit.md).
3. Consultar [mapa da integração do toolkit](setup.md), não executar `prompts/12-existing-project-setup.md` sem seguir gates do projeto.
4. Trabalhar **somente dentro deste repositório** e não tocar em projetos não relacionados.
5. Após aprovação da spec, seguir Superpowers `writing-plans` para os dois spikes (export browser e personalização artística).

## Operação e validação disponíveis
- Repositório GitHub Actions: [Documentation check](https://github.com/murilaiooo/motion4free/actions).
- Testa presença dos documentos e links relativos; NÃO testa IA, codec, render MP4 ou estética.
- Toolkit oferece testes próprios para sua base; rodá-los só se Node e permissões estiverem disponíveis, e nunca confundir com testes do Motion4Free.

## Credenciais, privacidade e custos
Não copiar chaves, tokens, configurações globais ou dados pessoais para o repo. Sem serviços pagos ou instalações globais automatizadas. Modelos e assets externos precisam de licença e proveniência.
