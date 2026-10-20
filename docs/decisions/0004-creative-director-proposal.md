# ADR-0004 — AI Creative Director + Creative Composer

**Data:** 2026-10-18
**Status:** ACEITA EM PARTE (20/10/2026). A [spec v1](../superpowers/specs/2026-10-20-motion4free-v1-design.md) adota a direção criativa como IA que escolhe e parametriza um sistema de motion design curado (Fases 3–4), não como autora livre de cenas.

## Contexto
A spec anterior define IA como seletora de ganchos, narrativas e templates. O responsável exige visual autoral, diferente em cada vídeo, sem aparência padronizada, com prompts e presets e IA atuando durante o processamento para aperfeiçoar direção artística.

## Decisão recomendada
Arquitetura mista: biblioteca de motion/assets licenciados + gramática composicional + diretor criativo assistido por IA + renderizador determinístico. IA define StyleDNA, storyboard e SceneGraph declarativo; motor compõe cenas variáveis. Regras e modelos locais continuam a poupar tokens em tarefas triviais.

## Alternativas
- Templates fixos e seleção semântica: barato e estável, **insuficiente** sozinho.
- Código de cena livre gerado por IA: flexível, mas unsafe, caro, inconsistente e difícil de exportar.
- Composição estruturada com diretor IA: maior complexidade, melhor alinhamento às exigências; **precisa de POC e benchmark**.

## Consequências
Aumenta escopo e esforço; requer UI de presets, fluxo de direção de arte, API de composição, previews avaliáveis e métricas de diversidade/qualidade; permanece browser-first e custo zero como meta, sujeito a provas.

## Gates
Aprovação humana deste ADR e do adendo à spec, seguida de provas de export MP4 **e** diferenciação artística semântica. Nenhuma implementação autorizada por este documento.

[Auditoria](../reviews/2026-10-18-premium-creative-audit.md) · [Creative Composer](../creative/composition-engine.md).
