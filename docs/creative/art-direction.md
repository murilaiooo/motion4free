# Direção de arte assistida por IA — proposta de revisão

**Estado:** PROPOSTA, exige aprovação do responsável e provas com vídeos reais. Documento criado após a auditoria de qualidade premium.

## Requisito de produto
Motion4Free não é um aplicador de templates. Deve oferecer **personalização de ponta a ponta**: prompt aberto, presets editáveis, referências visuais, ajustes por segmento e identidade própria por vídeo. O padrão almejado é comparação favorável com trabalhos de um motion designer experiente, sem declarar equivalência até avaliação cega. Não aceitar visual genérico de IA, sobrecarga de efeitos ou repetição sistemática.

## Separar direção artística de execução de render
**AI Creative Director** (IA local ou API gratuita opcional no processamento da edição):
1. Interpreta briefing textual, presets, material real e eventuais referências de estilo.
2. Propõe conceito único, tom, narrativa visual, ritmo, tipografia, estrutura de cores, sistema de movimentos e linguagem de transições.
3. Produz um **StyleDNA** para manter coerência do vídeo (não mero seed aleatório).
4. Escreve um storyboard por beats: propósito visual, posição do usuário, quando revelar, como entrar/sair e relação com palavras.
5. Pede ao **Creative Composer** cenas declarativas construídas combinando primitives validadas, assets licenciados e parâmetros de animação.
6. Inspeciona amostras de quadros e dados do render (com ferramentas locais de visão quando disponível) e propõe ajustes específicos.
7. Encaminha decisões genuinamente subjetivas/incertas à revisão do usuário; registra justificativas e versões.

**Creative Composer** (determinístico): traduz StyleDNA + SceneGraph em layouts, textos, máscaras, vetores, gráficos, timing/easing, 2D/3D, iluminação/efeitos e áudio. **Nenhuma execução arbitrária de código gerado por LLM** em mídia privada.

**Render e Quality Gate**: preview/export com a mesma semântica temporal e uma amostra crítica antes da exportação.

## Variação significativa vs cosmética
- **Não suficiente:** mesma cena com cor alterada, fonte trocada, zoom diferente ou ordem aleatória de presets.
- **Esperado:** composição espacial distinta, narrativa de imagens distinta, padrão de movimento, ritmo e hierarquia visual específicos ao vídeo.
- **Coerência:** preservar identidade do canal/usuário entre vídeos quando solicitada; diversidade não pode virar caos.
- **Controle:** preset define ponto de partida; texto livre e opções explícitas do usuário têm precedência; locks por cena e `avoid_styles` evitam escolhas repetidas.

## Gramática visual orientada por dados
Nós candidatos: text, vector, shape, chart, mask, image, footage, 3d-object, group, filter, particle, caption, sfx, camera, transition, light, shader. Parâmetros: bounding box, parent, z-index, colors, font, opacity, position, rotation, scale, easing, duration, word anchor, constraints e anim curves. Biblioteca aprovada determina sintaxe e limites para impedir cenas quebradas.

## Recursos que diferenciam produto
- B-roll de material do usuário e biblioteca legalmente liberada, **não stock genérico inserido ao acaso**.
- Infográficos criados com valores comprovados, ritmados por fala.
- Motion typography autoral com hierarquia e movimento sensível ao conteúdo.
- Alternância de composição; transições com função editorial.
- Gramáticas por gênero (tutorial, depoimento, anúncio, ciência, educação) com variações reais.
- Biblioteca pequena e fortemente curada pode ser ponto de partida, mas não teto do sistema.

## Qualidade e custo
Gerar automaticamente 1 brief global e decisões locais; cachear resultados, produzir previews em baixa resolução e reservar modelo mais capaz para ambiguidade / revisão. Só usar IA vision caso compatível e permitido. Sem GPU/quotas: exibir capacidade e modo limitado **sem fingir criação premium automática idêntica**.

## Provas obrigatórias
A) **Export real:** MP4 com fala + corte + caption + uma composição customizada no navegador.
B) **Direção artística:** mesma gravação e três briefings diferentes => três edições substantivamente diferentes. Revisão cega por motion designers, com comparações à edição humana e Editonny.
C) **Adesão:** alterar preset por prompt => modificar somente cenas atingidas, sem destruir intenções travadas e preservando identidade.
D) **Robustez:** originalidade limitada pelo material/biblioteca declarada, direitos claros por asset, sem inventar fatos.

## Referências a testar
[Motion Canvas](https://github.com/motion-canvas/motion-canvas), [PixiJS](https://github.com/pixijs/pixijs), [Theatre.js](https://github.com/theatre-js/theatre), [Motion](https://github.com/motiondivision/motion), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [dotLottie Web](https://github.com/LottieFiles/dotlottie-web). Licença por componente e suporte a export por frame/seek são gates, não suposições.

[Auditoria](../reviews/2026-10-18-premium-creative-audit.md) · [Presets e prompts](presets-and-prompts.md) · [Compositor](composition-engine.md).
