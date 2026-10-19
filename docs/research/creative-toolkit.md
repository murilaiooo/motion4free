# Pesquisa adicional — ferramentas para criação de motion de verdade

**Data de auditoria:** 2026-10-18 · **Status:** candidatos de integração; nada adotado ou testado no Motion4Free.

A arquitetura anterior enfatizava seleção de templates. O requisito atualizado exige **composição customizada por vídeo**, combinando direção editorial, primitives e assets legais. A pesquisa separa motores de criação, playback e export para não confundir “open source” com “funciona browser-only”.

| Repositório | Licença indicada no upstream | Utilidade | Limitação e prova necessária |
|---|---|---|---|
| [Motion Canvas](https://github.com/motion-canvas/motion-canvas) | MIT | Animação 2D programática, timelines e composições TS | Exportador FFmpeg documentado não prova que export completo funciona browser-only; testar frame stepping e integração com nosso codec |
| [Theatre.js](https://github.com/theatre-js/theatre) | **Core Apache-2.0**, **Studio AGPL-3.0** (README upstream) | Direção fina de keyframes, easing, cenas 3D/HTML/SVG | Estudar uso do core e implicações caso studio seja incluído; repo sem push recente em 2026 |
| [PixiJS](https://github.com/pixijs/pixijs) | MIT | Cena 2D com WebGL/WebGPU, máscaras, blend, filtros, texto | Precisa compositor, timeline, audio sync e encoder próprios |
| [Pixi Filters](https://github.com/pixijs/filters) | MIT | Filters/bloom/blur/shaders | Cuidado com densidade estética e compatibilidade WebGPU |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) / [Three.js](https://github.com/mrdoob/three.js) | MIT nos projetos principais | 3D declarativo, camera, materiais, sombras e geometria procedural | Performance, memória, captura determinística, licenças de assets 3D |
| [Motion](https://github.com/motiondivision/motion) | MIT no core | Animação de UI/JS e motion primitives | Motion+ e ferramentas premium são ofertas separadas; não incluir materiais pagos |
| [dotLottie Web](https://github.com/LottieFiles/dotlottie-web) | MIT | Playback animado via WASM, state machines, temas | Player não é gerador de cenas únicas; licença da animação importada é separada |
| [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) | Apache-2.0 | Padrões de contratos de timeline/edição | Não é engine de render no navegador |
| [Glaxnimate](https://github.com/mbasaglia/glaxnimate) | GPL-3.0+ | Inspiração em autoria vetorial, motion e edição | Licença copyleft e software desktop; não assumir integração browser |
| [MLT](https://github.com/mltframework/mlt) | LGPL-2.1 core (componentes separados podem diferir) | Pipeline madura de NLE e composição | Framework nativo, dependências e build WASM complexos |
| [tldraw](https://github.com/tldraw/tldraw) | Licença proprietária/source-available própria | Inspiração de UX do canvas | **Produção exige licença**; rejeitar como dependência default do produto totalmente gratuito |
| [Editonny](https://github.com/soumatheusgomes/editonny) | Código first-party MIT, assets terceiros diversos | Direção semântica, cenas HTML/GSAP, waveforms e QA | Port não automático; catálogo é base de primitives, não suficiente para personalização |
| [OpenReel](https://github.com/Augani/openreel-video) | Verificar arquivo LICENSE e dependências na revisão de integração | Timeline, preview, export e storage | Pode não suportar engine de cenas procedurais sem adaptação |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) | MPL-2.0 | Media IO browser/WebCodecs | Não resolve motion e direção artística sozinho |
| [Blender](https://github.com/blender/blender) | GPL-2.0-or-later com termos por componentes | Inspiração em workflows 3D e autoria offline de assets | Não oferecer Blender completo em browser no MVP |

## Não misturar os papéis das bibliotecas
- **Authoring**: API/editor para desenhar e animar cenas.
- **Timing**: keyframes, easing, markers, seek arbitrário.
- **Scene composition**: layout/objeto/typography/camera/asset.
- **Encoding**: transformar frames+áudio em MP4.
- **NLE**: manipular planos de edição/EDL/projetos.
- **Creative AI**: planejar e criticar decisões; não substitui os demais.

## Recomendações de spikes
1. Motion Canvas vs PixiJS + custom keyframes: uma cena com forma, typographic kinetic, máscara, 3D opcional e efeitos, em tempos arbitrários e export browser.
2. Theatre Core para keyframe data, **sem incorporar Studio AGPL à distribuição sem decisão legal**.
3. OpenReel timeline vs custom timeline para compositing graph export.
4. dotLottie para incorporar assets animados, sem prometer que personaliza conteúdo arbitrário.
5. Shader/movimento com base em conteúdo real da fala, avaliando performance no dispositivo.

## Verificações não realizadas
Não há benchmark de render, confirmação de compatibilidade entre libs, teste de licenças de assets ou medição de produção. Licenças são informações de documentação upstream, sujeitas a auditoria específica por versão/componente.
