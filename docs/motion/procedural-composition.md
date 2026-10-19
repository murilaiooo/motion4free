# Motor de composição autoral — além dos templates

**Status:** projeto técnico para revisão, não dependência implementada.

## Problema a resolver
`scene_id + color + text` gera variantes previsíveis de designs repetidos. Para personalizar cena a cena, necessitamos de uma **gramática criativa controlável**, formada por primitives artísticas e contextuais, e uma engine que suporte prévia, seek e export consistentes.

## Estratégia
**Composições declarativas e generativas sob regras**, não código escrito por IA e executado no browser. O modelo descreve **o que** compor: significado, objetos, ordem, layout, ritmo, 2D/3D, materiais, câmera e hierarquia. Renderer e validadores definem **como**, com primitives aprovados.

### Biblioteca de primitives
- Tipografia cinética, variação de tracking, máscaras, grids, títulos editoriais, números, legendas, anotações, destaque de palavras.
- Composição 2D vetorial, cartões, mapas esquemáticos, gráficos baseados em fatos, setas, linhas, gradientes, partículas, luzes, camadas.
- Objetos 3D (assets autorizados), materiais/shaders, câmeras, profundidade, parallax, sombras e highlight.
- Footage original, B-roll do usuário, biblioteca licenciada, image sequence, texturas, overlays e mattes.
- Timing: keyframes, easing, motion paths, physics controlada, word anchors, beat sync, transições com propósito.
- Som: cenas com SFX ancorado e headroom sob a voz.

### Modelagem de cenas (conceitual)
```json
{
  "sceneId": "generated-018",
  "styleRef": "style-reel-42",
  "purpose": "contrast_three_options",
  "sourcePhraseIds": ["p04", "p05"],
  "duration": {"anchorStart": "p04", "anchorEnd": "p05"},
  "nodes": [
    {"type": "title", "contentRef": "p04", "layoutSlot": "topTitle"},
    {"type": "vector-group", "layout": "branching-three"},
    {"type": "word-highlight", "sourcePhraseId": "p05"}
  ],
  "motion": {"language": "editorial", "intensity": 0.55},
  "constraints": {"faceSafe": true, "captionSafe": true}
}
```
É proposta conceitual; não habilitar interpretação arbitrária de filtros, shaders ou JS de prompts não confiáveis.

## Princípios de composição profissional
- **Objetivo editorial primeiro**: cada efeito deve demonstrar uma relação, tempo, emoção, contraste ou objeto concretamente pertinente.
- **Identidade global**: fonte/paleta/grid/materiais/easing guardam consistência; momentos de ruptura planejada são intencionais.
- **Hierarquia tipográfica**: tamanho, contraste, densidade, duração de leitura, fluxo de olhos.
- **Ritmo inteligente**: movimentos reforçam beats, não sincronizam qualquer palavra como metrônomo.
- **Economia de movimento**: não fazer efeitos pelo simples fato de serem possíveis.
- **Variação material**: modificar estrutura, perspectiva, tipografia, layout, assets, ritmo e narrativa; não só cores e semente aleatória.
- **Dados verificáveis**: nunca produzir prova, estatística ou cena realista enganosa sem fonte.

## Antirrepetição
Histórico local de fingerprints:
- assinatura de família visual, primitive dominante, layout, curva temporal, paleta, posição, transições e assets;
- penalidade de cenas repetidas sem função temática;
- estilização coesa é permitida (não confundir consistência com repetição);
- não armazenar contexto de outros usuários em nuvem sem consentimento.
A diversidade será avaliada por humanos, pois scores métricos isolados podem premiar cenas arbitrárias ou feias.

## Três arquiteturas para testar
**1. HTML/CSS/SVG com timing próprio:** excelente para typography/overlay, mas problemas possíveis em frame stepping/export.
**2. Motion Canvas:** animação procedural e timelines TS sob licença MIT; exportador padrão FFmpeg **não é browser-only por definição**, portanto usar como inspiração ou motor apenas após spike.
**3. PixiJS/WebGL/WebGPU + Three.js (condicional):** composição 2D/3D poderosa e shaders, mas requer integração de timing, fontes, áudio e captura por frame. Theater Core e GSAP podem ajudar na autoria temporal quando licenças verificadas.

Escolha somente após comparativo real: mesma cena autoral, reprodução em timestamp arbitrário, preview/export fiel, consumo de RAM, H.264/AAC, licenças e carga inicial.

## Escopo de assets
Lottie/dotLottie: eficientes para animações que já existem, **não criam novas por si**. Banco de modelos WebM: suporte como camada, não solução geral para personalização. Referências de pessoas/brands: direitos por arquivo e consentimento do usuário.

## Gate de design
Testar uma mesma frase usando:
- Direção A: editorial austera com tipografia e máscaras.
- Direção B: explicação visual com objetos 3D/diagramas e timing rápido.
- Direção C: narrativa humana/doc com B-roll local e anotações.
Aprovado somente se as três cenas parecerem **conceitos artísticos distintos e coerentes**, não meras skins de um template, e se render/export permanecer sincronizado.
