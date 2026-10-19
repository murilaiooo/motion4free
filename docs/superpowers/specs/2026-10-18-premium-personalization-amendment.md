# Adendo de especificação: qualidade premium, criação customizada e presets

**Data:** 2026-10-18 · **Status:** PROPOSTA EM REVISÃO, sem implementação autorizada.
**Motivo:** [auditoria](../../reviews/2026-10-18-premium-creative-audit.md) detectou que o plano original depende demais de templates fixos e não atende o requisito explícito de vídeos altamente personalizados.

## Condições atualizadas do produto
1. Resultados almejados: qualidade de direção de arte/motion equivalente à edição profissional experiente, validada por benchmarks cegos; **sem garantia prévia de equivalência universal**.
2. Não parecer genérico nem “feito por IA”; evitar reutilizar mesma animação por padrão e repetir formulações visuais em vídeos diferentes sem motivo.
3. **Personalização por vídeo**: conteúdo, mood, intenção, público, presença de marca, idioma, estilo, timing, movimento, câmera, tipografia, fonte e referência devem influenciar escolha de cenas; não apenas cor e texto.
4. **Entrada dupla:** prompt livre e presets editáveis; usuário pode combinar ambos e refinar partes sem recortar todas as decisões anteriores.
5. **IA atuante durante o processo:** interpreta briefing, planeja narrativa/StyleDNA/storyboard/cenas, avalia resultados e propõe revisões sob orçamento; nunca escreve/executa código arbitrário diretamente.
6. **Zero custo obrigatório / sem instalação:** inferência, render e armazenamento principalmente locais; modelos/API grátis apenas onde autorizados e disponíveis. Degradação honesta de qualidade no hardware fraco.
7. **Explorar open source existente sem prender ao caminho mais fácil**: selecionar tecnologia por evidência de qualidade, potencial artístico e compatibilidade; não por menor número de linhas para demo.

## Mudança arquitetural
ANTES: `phrase -> shortlist(scene_id) -> IA escolhe -> template parametrizado`

DEPOIS (proposto):
```text
Prompt + Preset + User Choices + Brand + References
    -> CreativeBrief e restrições
    -> Speech/Frame/Audio Understanding
    -> Art Director (StyleDNA e direção global)
    -> Storyboard / beats e asset plan
    -> Scene Composer (composição procedural + templates + recursos licenciados)
    -> Timeline / Renderer / Local Export
    -> QA multimodal/heurístico + edição interativa
    -> revisão localizada / saída final
```

## As três alternativas
**A — Catálogo fixo e IA como seletora:** rejeitada como sistema exclusivo porque dá repetição.
**B — IA gera qualquer JS/shader e executa livremente:** rejeitada como padrão por segurança/qualidade/custo.
**C — Gramática de cena declarativa + IA de direção + conteúdo contextual:** recomendação pendente de POC e aprovação.

## Interfaces que deverão constar da spec principal
- `CreativeBrief` e `PresetSpec` com precedência explícita de escolhas.
- `StyleDNA` por projeto e constraints por cena.
- `Storyboard` com beats, motivo editorial e timing.
- `SceneGraph` com primitives e parâmetros validados; keyframes, masks, tipografia, assets, shapes, gráfica e 3D.
- `AssetManifest` com origem/licença/hash/direitos.
- `CreativeReview` e artefatos de benchmark.

Definições em [UX criativa](../../product/creative-experience.md), [diretor IA](../../ai/creative-director.md) e [motor procedural](../../motion/procedural-composition.md).

## Medidas de qualidade para declarar prontidão
- Render/export de um MP4 real no navegador (gate técnico).
- Mesma gravação renderizada sob **três direções artísticas materialmente distintas**, todas apropriadas, sem ser apenas troca de cores (gate artístico).
- Prompt e preset combinados respeitam preferências e proibições explícitas.
- IA capaz de dizer `none` e criar composição contextual a partir de primitives; não requer assets externos pagos.
- Edição de gancho/motion em um trecho sem destruir outros.
- Avaliação cega contra trabalhos de referência com profissionais: tipografia, hierarquia, motion easing, narrativa, consistência, originalidade relativa, áudio e aderência à intenção.
- Fallback sem IA externa capaz de gerar **resultado honesto**, ainda que não equivalente ao modo de alta qualidade.

## Consequências e fases
O plano deve conter **duas provas de viabilidade**, não uma só:
- Spike A: browser render/export + storage;
- Spike B: customização criativa e qualidade de motion com AI director e cenas procedurais.

Enquanto não houver evidências de ambas, o “MVP premium” não está comprovado. Revisar [roadmap](../../roadmap.md) e lacunas [auditoria](../../reviews/2026-10-18-premium-creative-audit.md).

## Bloqueios antes do plano Superpowers
1. Revisar/aceitar escopo artístico atualizado e este adendo.
2. Escolher critérios de sucesso do piloto com avaliadores e hardware.
3. Só então atualizar a spec canônica, aprovar e invocar writing-plans para primeiro spike. Não iniciar implementação agora.
