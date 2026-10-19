# Motion design profissional: catálogo, sincronização e proveniência

## Conclusão da pesquisa
No Editonny, **Claude/Codex não gera cada asset do zero**. O repositório já oferece 145 cenas HTML, 79 clipes originais no pacote, 44 objetos transparentes animados em WebM, 115 ícones/objetos 3D de catálogo externo, 12 fundos animados, 7 overlays, 102 efeitos sonoros e 23 faixas musicais (dados declarados em [visuals/README.md](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/README.md)). Há sobreposição entre categorias: não somar como assets únicos.

## Funcionamento real
Exemplos de cena: [three-steps.html](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/scenes/three-steps.html), [revenue-counter.html](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/scenes/revenue-counter.html), [text-impact.html](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/scenes/text-impact.html).
- Composição HTML/CSS: tipografia, gradientes, blur, sombras, cards, layout.
- Timeline GSAP: entrada/saída, escala, posição, opacity, time-based seek.
- Recursos: MP4 de fundo, WebM com transparência, imagens, fontes e efeitos sonoros.
- Runtime HyperFrames compõe e renderiza o vídeo; agente escolhe cena, parâmetros e temporização.

## Estratégia Motion4Free
**Não gerar vídeo do zero por solicitação.** Construir renderizador declarativo de composições, catálogo de templates testados, pré-visualizações e recurso `none` quando nenhuma cena adicionar valor. Motor sincroniza com timestamps da fala; IA decide significado e intenção.

### Categorias prioritárias
1. Kinetic typography e legendas (palavra-impacto, destaque, karaoke, transcrição).
2. Números/contadores/progresso, com proteção contra preço/receita confundidos.
3. Checklists e etapas, comparações, antes/depois.
4. Callouts, arrows, highlights e diagramas simples.
5. Transições modernas discretas: fade, zoom, wipe, glow, film burn, glitch quando justificado.
6. Objetos 3D transparentes, fundos e partículas quando não sobrecarregam o rosto.
7. SFX ancorado no instante da mudança; voz sempre prioritária.

### Catálogo semântico por cena
```json
{
  "scene_id": "three-steps",
  "intent": ["ordered_steps", "explanation"],
  "do_not_use_when": ["speaker_describes_one_step_only"],
  "requires": ["three_verified_step_labels"],
  "min_duration_s": 3.0,
  "max_duration_s": 8.0,
  "face_safe": true,
  "weight": "medium",
  "license_record": "link-to-source-notice"
}
```
Valores acima são **exemplo de schema**, não metadados copiados ou medidos do Editonny. A ficha precisa seguir a capacidade real do template escolhido. Checar parâmetros, animação, início/meio/fim e seek arbitrário.

## Como obter qualidade de graça
- **Primeiro:** reutilizar animações originais/código MIT com atribuições e confirmar licenças dos recursos distribuídos.
- **Segundo:** construir cenas paramétricas originais em HTML/SVG/CSS/GSAP/WebGL com consistência visual.
- **Terceiro:** usar fontes e ícones livres corretamente licenciados (ex.: 3dicons CC0; verificar fonte e distribuição). Música/SFX CC0 conforme registros individualizados, não assumir que todo arquivo “free” permite redistribuição.
- **Quarto:** aceitar mídia do usuário com direitos. Geração externa é **opcional**, não requisito do produto gratuito.
- **Quinto:** pipeline de revisão visual para validar legibilidade, ritmo, estética, acessibilidade e ausência de marcas/informações fictícias.

## Origem de recursos já encontrados
- [Editonny biblioteca e proveniência](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/README.md).
- [Licenças de terceiros](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/THIRD_PARTY_NOTICES.md).
- [Freesound créditos](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/visuals/library/effects/CREDITS.md).
- [Assets 3dicons](https://github.com/realvjy/3dicons) (licença precisa ser validada por arquivo/uso).
- [GSAP](https://github.com/greensock/GSAP), [Three.js](https://github.com/mrdoob/three.js), [Mediabunny](https://github.com/Vanilagy/mediabunny).

**Licença:** Motion4Free ainda não adotou licença própria. Não redistribuir em massa o pacote de terceiros do Editonny antes de auditoria dos recursos e termos.


## Revisão essencial: biblioteca é matéria-prima, não limite de composição
A hipótese de “selecionar entre 145 cenas” sozinha contraria a exigência premium. Nossa arquitetura candidata usa biblioteca com cenas aprovadas **mais composição procedural** guiada por `StyleDNA`, `Storyboard` e `SceneGraph`, para criar identidade por projeto e variação real em direção visual, estrutura, tipografia, materiais, B-roll e movimentos.

Cada cena deve ter elementos parametrizáveis combináveis (layout, keyframes/easing, vetores, shapes, gráficos, mídia licenciada, texto e máscaras), não apenas slots de texto/cor. A IA diretora pode reorganizar primitives e sugerir movimentos contextualizados, mas não executar código arbitrário.

Avaliar como bases: [Motion Canvas](https://github.com/motion-canvas/motion-canvas), [PixiJS](https://github.com/pixijs/pixijs), [Theatre.js](https://github.com/theatre-js/theatre), [Motion](https://github.com/motiondivision/motion), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [dotLottie](https://github.com/LottieFiles/dotlottie-web). Nem toda ferramenta inclui export vídeo nativo de navegador: testar paridade por frame, seek, GPU, licença e custo.

Ver [Creative Composer](../creative/composition-engine.md) e [auditoria](../reviews/2026-10-18-premium-creative-audit.md). A curadoria de assets por licença continua mandatória.
