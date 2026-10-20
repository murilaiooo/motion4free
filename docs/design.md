# Direção visual e experiência do Motion4Free

Este arquivo cumpre o destino `docs/design.md` previsto no Vibe Coding Toolkit, **sem duplicar** a documentação criativa já existente.

## Design do produto
- [Direção de arte](creative/art-direction.md): princípios estéticos, StyleDNA, gramática visual e qualidade-alvo.
- [Prompt e presets](creative/presets-and-prompts.md): duas formas de entrada, referências e personalização por trecho.
- [Compositor](creative/composition-engine.md): SceneGraph e keyframes, preview/export por frame.
- [Jornada completa](product/creative-experience.md): experiência de usuário e fallback de IA.
- [Auditoria crítica](reviews/2026-10-18-premium-creative-audit.md): problemas detectados na primeira especificação.

## Sistema visual em vigor (v0.10)
A interface tem um sistema próprio de tokens e componentes: [design-system.md](design-system.md), decidido no [ADR-0015](decisions/0015-novo-visual.md). As seções abaixo são o contexto de 18–19/10.

## Gate antes de implementar a UI
A experiência concreta e a identidade visual **ainda não têm protótipos aprovados**. Presets precisam ter amostras reais; o app não pode entregar os mesmos layouts com paletas diferentes. Validar acessibilidade, compatibilidade e projetos editáveis.

O Vibe Coding Toolkit não autoriza instalar Next.js, Tailwind, shadcn ou um sistema de design específico antes de escolher a stack com base nos testes do motor de vídeo.

## Design system do aplicativo: proposta de adoção seletiva

A atualização [Editonny `05d3ded`](https://github.com/soumatheusgomes/editonny/commit/05d3dedcddcf6717001b0a3ef91411ec08f614d4) acrescentou `DESIGN.md`, tokens, 38 componentes React, showcase e testes de aderência. **Aproveitar o método de construção, não a marca, as cores ou o pacote inteiro.** A stack do Motion4Free ainda não foi definida.

- **Contrato visual único para UI**: tokens semânticos para superfícies, texto, bordas, tipografia, espaçamento, raio, foco, densidade e animação; temas escuro/claro e estados hover/focus/disabled/error/loading. Evitar valores dispersos em componentes.
- **Biblioteca de componentes da interface**: controles de upload, briefing, presets, timeline, transporte, revisão, diálogo, estado/progresso, feedback e navegação acessível. Construir apenas quando a tela e a stack exigirem; usar componentes compartilhados e casos de uso reais.
- **Showcase com verificações automáticas**: cada componente e variante visível; testes de contrato token ↔ estilos ↔ componentes ↔ showcase; lint com regras adequadas à stack efetivamente aprovada. Não declarar cobertura por número de componentes importados.
- **Direção de arte do vídeo é outro sistema**: StyleDNA muda tipografia, composições, formas, materiais, ritmo e efeitos da mídia independentemente do tema da UI; presets são guias de decisão, não sequências visuais fixas.
- **Temporalidade**: `prefers-reduced-motion` afeta movimentos decorativos da interface; não remove do MP4 a animação solicitada. Preview/export de mídia devem se basear em frames/timestamps e relógio compartilhado.
- **Experiência real**: contraste, teclado, foco, leitor de tela, telas de laptop e viewport estreito, recuperação de erro e tempos de processamento. Demonstrações de timeline/waveform são explicitamente ilustrativas até usarem vídeo e áudio reais.

Pontos de referência: [componentes](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/design-system/README.md), [tokens](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/DESIGN.md), [testes de contrato](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/tests/design-system.test.mjs). Evidências e prioridades específicas na [auditoria do Editonny](research/updates/2026-10-19-editonny-guide.md).
