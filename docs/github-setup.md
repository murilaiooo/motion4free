# Configuração do GitHub e limites da integração

## Configurado via arquivos
- README com navegação para documentação.
- Superpowers design spec, ADRs, roadmap, requisitos, pesquisa e riscos.
- Templates de issues (feature e bug) e pull requests.
- CODEOWNERS do usuário conhecido na URL do repositório.
- .gitignore para mídia privada, modelos, renders, credenciais e caches.
- Contributing e política de segurança inicial.
- Workflow simples de validação de documentação; execução CI ainda deve ser verificada no GitHub.
- Issues rastreáveis a serem criadas para provas e arquitetura.

## Configurações de UI que precisam de gestão administrativa
A conexão GitHub atual **não expõe ações de atualização de configurações do repositório**, topics, homepage, branch protection, habilitar Discussions/Projects/Wiki, vulnerability-reporting ou criação de labels customizadas. Nenhuma delas deve ser descrita como configurada.

### Valores recomendados para revisar em Settings
- Manter **Private** durante pesquisa/licenças; tornar público quando o responsável decidir.
- Descrição sugerida: "Editor de vídeo inteligente, browser-first, local-first e sem custo obrigatório, com motion design semântico."
- Topics sugeridos: video-editor, browser, webassembly, webgpu, webcodecs, motion-design, local-first, open-source (apenas se licença decidida).
- Default branch: main.
- Pull requests: preferir squash merge e branches curtas após iniciar código.
- Proteção de main: exigir aprovação/review e docs-check **só após validar que o workflow executa corretamente e há colaboradores disponíveis**.
- Habilitar segurança de dependências e reporte privado de vulnerabilidade conforme disponível.
- Configurar labels de roadmap se houver utilidade (p0, p1, spike, ai, browser, motion, qa).
- Não configurar GitHub Pages ou site público antes de existir um app e termos claros.
- Licença MIT adotada em 20/10/2026 por decisão delegada pelo mantenedor ([ADR-0005](decisions/0005-stack-v1.md)).

## Custo e CI
GitHub Actions em repositório privado pode consumir cotas conforme o plano; workflow é pequeno, mas acompanhar uso. Não ligar infraestrutura paga.

## Issues canônicas
Use as issues **#13–#24** (marcos M0–M5) como backlog oficial. A série anterior #1–#12 cobre os mesmos temas e deve permanecer encerrada como duplicada. Não desenvolver duas versões da mesma issue. Os títulos e os documentos permanecem rastreáveis no histórico.
