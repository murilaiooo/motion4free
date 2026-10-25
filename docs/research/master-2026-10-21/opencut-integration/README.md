# OpenCut -> Motion4Free | Dossiê de engenharia executável

**Auditoria:** 21/10/2026. **Baseline Motion4Free:** main v0.22.1, `e9321ec`, verificado em `package.json` e no GitHub. **Upstreams:** `opencut-app/opencut` (rewrite, MIT, work in progress) e `opencut-app/opencut-classic` (MIT, arquivado). **Status:** DOCUMENTAÇÃO, não funcionalidade implementada. Nenhum teste, benchmark ou build foi rodado.

> **Para a IA executora:** comece por [08-execution-roadmap.md](08-execution-roadmap.md) e [09-agent-handoff.md](09-agent-handoff.md); leia `AGENTS.md` e os ADRs em `docs/decisions/`. Só execute **a primeira tarefa não concluída**. Não pule migrações, não substitua stack, não reabra testes já documentados como feitos e não apresente mocks como features.

## Documentos

1. [01-audit-and-feature-matrix.md](01-audit-and-feature-matrix.md) — inventário real, comparativo implementado/placeholder/planejado, requisitos e decisões; antiduplique.
2. [02-workbench-ux-spec.md](02-workbench-ux-spec.md) — reorganização visual da mesa de edição, wireframe, estado, responsividade, acessibilidade, comportamento de cada painel.
3. [03-workbench-build-playbook.md](03-workbench-build-playbook.md) — roteiro concreto de arquivos, contratos TypeScript, persistência, layout, interação e validação para implementação da interface.
4. [04-timeline-commands-time.md](04-timeline-commands-time.md) — pistas, zoom, snapping, seleção, marcadores, histórico, ações, inteiro/rational FPS, compatibilidade.
5. [05-motion-effects-inspector.md](05-motion-effects-inspector.md) — keyframes, curvas, máscara, transform, inspector contextual, efeitos, backgrounds, texto, stickers e guias.
6. [06-media-audio-export.md](06-media-audio-export.md) — mídia, velocidade, áudio, arquivos de legenda, export, render, performance e importação.
7. [07-new-opencut-architecture.md](07-new-opencut-architecture.md) — novo OpenCut: desktop/tema/resizable e ideias futuras de plugin/API/MCP/headless, com distinção explícita entre anunciado e entregue.
8. [08-execution-roadmap.md](08-execution-roadmap.md) — tarefas pequenas OCU-01…OCU-22, sequência, dependências, Definition of Done, vínculo aos MASTER-IDs.
9. [09-agent-handoff.md](09-agent-handoff.md) — runbook firme de trabalho, handoff pronto para outra IA, regras de PR e proibições de loop de testes.
10. [10-qa-matrix.md](10-qa-matrix.md) — testes únicos por risco, fixtures, visual/manual, export e cobertura de acessibilidade.
11. [11-source-map-and-licenses.md](11-source-map-and-licenses.md) — mapa de código upstream por capacidade, grau da evidência, compliance e verificações pendentes.

## Conclusão de arquitetura

- **Manter** React 19/Vite 8/TypeScript 7, Mediabunny/WebCodecs, Canvas2D, OPFS, Zod, StyleDNA e IA local/opcional existentes. Não converter para Next.js, Rust/GPUI, Prisma, monorepo, serviços pagos ou backend obrigatório.
- **Adotar padrões, não o projeto inteiro:** uma mesa editável inspirada na composição de painéis do Classic e no shell visual do novo; ações tipadas; inspector contextual; lanes de keyframe; ajustes visuais; registro de recursos.
- **Prioridade imediata da experiência do usuário:** mesa de edição mais organizada e redimensionável, com ajuste de painéis, inspeção contextual e agrupamento claro das ferramentas. É trabalho de UI sem alterar export, histórico ou `EditPlan`.
- **Base atual:** já há barra superior, rail esquerda com 8 abas, biblioteca à esquerda, preview no centro, inspector contextual, timeline de camadas 0–9, waveform real, snapping, copy/paste/split e safe zone de Reels. Reorganizar preservando esses recursos.
- **Classic:** README declara archived; `get_repo` confirmou `archived=true`. A aba `transitions` e a aba `adjustment` mostram `Coming soon`; **não** são implementações utilizáveis. Guias de Reels/Shorts existem como menus mas seus overlays retornam `null`. Evitar overclaim.
- **Rewrite:** editor web é `Coming soon`, timeline GPUI ainda mostra só `Timeline`; API de editor, plugins, MCP, scripting e headless são promessas de README, não comprovantes de implementação. Componentes de shell, tema e resizable, porém, têm código real.
- **Licença:** raízes MIT; licença de arquivos e dependências e atribuição precisam de verificação antes de portar qualquer trecho. Não copiamos source/assets aqui.

**Sem ações na main:** documentação proposta na branch/PR de pesquisa Master. Esta pesquisa aprofunda [08-opencut-deep-dive.md](../08-opencut-deep-dive.md), não o substitui.
