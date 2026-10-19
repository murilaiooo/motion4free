# Creative Composer e SceneGraph — avaliação tecnológica

**Estado:** proposta, não implementação ou escolha final de stack.

## Por que o catálogo de cenas não basta
Uma biblioteca de 145 cenas pode elevar o mínimo de qualidade, mas fica reconhecível quando vídeos diferentes compartilham composições/efeitos. Uma fábrica de cenas parametrizada deve permitir novas combinações coerentes sem pedir ao modelo que gere código que roda livremente.

## SceneGraph declarativo v1 (ilustrativo)
```json
{
  "version": 1,
  "sceneId": "benefits_02",
  "evidence": [{"phraseId": "p_22", "startWord": 3}],
  "nodes": [
    {"id": "headline", "type": "text", "textSource": "p_22", "layout": "top-safe"},
    {"id": "indicator", "type": "vector-chart", "dataRef": "fact_08", "styleRef": "s01"},
    {"id": "camera", "type": "camera", "preset": "slow-track"},
    {"id": "caption", "type": "caption", "source": "p_22"}
  ],
  "motion": [{"target": "headline", "keyframes": "word-anchored-rise"}]
}
```
Não autorizar URLs arbitrárias, HTML executável, CSS externo ou funções do modelo. Asset e nó devem existir na allowlist.

## Problemas técnicos a resolver
- **Seek arbitrário:** render deve reproduzir exatamente o mesmo frame independentemente de ordem de reprodução ou relógio real. Time-driven e pure evaluation.
- **Preview/export parity:** o frame exportado deve manter câmera, fontes, filtros e easing vistos na prévia.
- **Composição:** texto, fontes, vetor, partículas, shaders e vídeo têm pipelines de desenho diferentes; precisamos de coordenadas, cor e blend coerentes.
- **Performance:** GPU não elimina gargalos de encode nem memória; usar projeções/proxies e processamento segmentado.
- **Animação temporal:** anchors para palavras, easing legível e curvas de movimento adaptadas à intenção.
- **Layouts contextuais:** safe zones variam por Reels/TikTok/Shorts, rostos/legendas/mãos móveis. Templates se rearranjam, não apenas diminuem escala.
- **3D:** objetos WebM transparentes e cenas Three.js podem coexistir, mas avaliar depth/compositing/alpha/efeitos e licenças.
- **Render incremental:** mudanças pequenas invalidam somente segmentos e dependências.

## Matriz de alternativas (sem decisão prematura)
| Base | Ponto forte | Principal dúvida |
|---|---|---|
| Motion Canvas | Timeline programática e motion por código | Integração sem servidor, seek, licenças e export browser-only |
| PixiJS | Renderer 2D acelerado, filtros e objetos | Render/composição temporal determinística precisa ser criada |
| Theatre.js | Authoring de keyframes/timeline | Licença separada do Studio, manutenção e encaixe com export |
| Motion / GSAP | Movimento, easing e timelines JS | Uniformidade entre browser, preview e export |
| Three.js / R3F | Composição 3D | Desempenho/GPU, sincronismo, export transparente |
| dotLottie Web | Reprodução eficiente de animações vetoriais existentes | Não substitui scene factory nem garante arte original |
| OpenTimelineIO | Esquema de timeline editorial/intercâmbio | Não é encoder, nem executor browser |

## Testes comparativos
A mesma cena complexa em ao menos duas tecnologias; medir frame parity, tempo de export, peak RAM, CPU/GPU e qualidade; considerar tamanho da distribuição, manutenção e licença. **Não escolher porque repositório tem mais estrelas.**

## Asset pipeline
Resolver assets por hash e licença, cache progressivo, transcodificação e substitutos autorizados. Fonts/áudio e imagens com licenças divergentes nunca herdam MIT do nosso código.

[Direção criativa](art-direction.md) · [Auditoria](../reviews/2026-10-18-premium-creative-audit.md).
