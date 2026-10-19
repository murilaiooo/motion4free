# UX criativa: prompt livre + presets + direção de arte personalizada

**Estado:** PROPOSTA para revisão Superpowers. Esta experiência é requisito declarado pelo responsável; decisões exatas de UI e forma de implantação aguardam projeto/teste.

## Duas entradas, um mesmo briefing
O usuário pode:
- Descrever livremente o trabalho: objetivo, estilo, plataforma, exemplos, tons, elementos proibidos, ritmo, público e cortes.
- Escolher um **preset de direção**, como editorial tipográfico, documental elegante, cinematográfico, minimalista premium, explainer com diagramas ou motion 3D. Nome e categoria descrevem uma **intenção**, não uma sequência fixa de cenas.
- Combinar ambos: texto livre **refina/sobrepõe** escolhas do preset; escolhas explícitas na UI prevalecem sobre inferências da IA.
- Enviar referência visual de uso legítimo: vídeo de referência, screenshots, frames de marca, logo, cores, fonte, trilha própria e B-roll autorizado.
- Marcar um trecho específico e alterar **somente** o que foi pedido; manter o resto estável.

A UI deve sempre tornar transparentes limitações técnicas ou falta de fonte/autorização, sem adicionar cenas inventadas como se fossem materiais reais.

## CreativeBrief v1 — esquema conceitual
```json
{
  "userPrompt": "Quero um Reel elegante com movimento editorial...",
  "presetId": "editorial-kinetic",
  "format": "9:16",
  "platform": "instagram-reels",
  "durationPreference": "content-led",
  "audience": "leigos interessados no assunto",
  "purpose": "explicar e gerar curiosidade",
  "creative": {
    "mood": "confident",
    "movement": "refined",
    "density": "moderate",
    "visualOriginality": "high",
    "typography": "editorial",
    "dimensionality": "mixed-2d-3d"
  },
  "brand": {
    "palette": [],
    "logoAssetId": null,
    "fontAssetIds": []
  },
  "references": [],
  "avoid": ["generic flashy zooms", "random glitch", "fake stock proofs"],
  "hardConstraints": ["preserve all factual qualifiers"]
}
```
Apenas **contrato ilustrativo**, não JSON schema validado. Nenhum default prescrito deve ser imposto quando o usuário selecionar opções explícitas.

## Sequência de experiência desejada
1. Upload e verificação técnica local.
2. Prompt e/ou preset; opções de alto impacto (formato, intenção, ritmo, densidade de motion, estilo, presença de música e referências).
3. IA cria **Creative Brief legível** e plano narrativo provisório; usa características da própria gravação, não interpreta só texto.
4. Direção visual global: “StyleDNA” e moodboard com 2–3 propostas **materialmente distintas** (sob orçamento de compute). Usuário pode escolher sem saber termos técnicos.
5. IA compõe cenas e transições no Storyboard; assets são licenciados e têm motivo editorial.
6. Mostra **storyboard e trecho renderizado representativo** antes de processar vídeo completo. Pode autoescolher quando não há preferência explícita, preservando reversão.
7. Agente local de QA inspeciona quadros e áudio; propõe ajustes quando detecta problema, sob orçamento limitado.
8. Timeline editável, cards de justificativa e pedidos conversacionais (“menos zoom”, “trocar cor só do trecho”, “criar animação específica”, “ficar mais editorial”).
9. Export e projeto. Reabrir sem repetir inferência pesada sempre que possível.

## Exemplo de mesmo vídeo, dois perfis
**Briefing A:** “Elegante, quase revista premium, sóbrio, sem ícones 3D chamativos.” → composições tipográficas de alta hierarquia, grids editoriais, máscaras sutis, pausas expressivas, transições discretas.

**Briefing B:** “Tech com animações tridimensionais, gráficos precisos, ritmo ágil.” → objetos 3D contextuais licenciados, diagramas com profundidade, tipografia técnica, câmera e transições alinhadas aos temas.

Não basta mudar paleta: os **elementos, enquadramentos, estruturas e timings** devem ser distintos. A mesma pessoa pode preservar uma identidade de marca em vídeos diferentes sem repetir layouts mecanicamente.

## Presets são direções, não templates de sequência
Cada preset define distribuição de escolhas e limites:
- Layouts permitidos/proibidos, densidade, tipografia, energia, grade, paleta padrão e ritmo.
- Variantes de grafismos e regras de pontuação narrativa.
- Exemplos de referência e contraexemplos de mau uso.
- Restrições da marca e personalização por usuário.
- Qualidades não negociáveis: clareza, legibilidade, integridade factual, áudio.

O sistema precisa funcionar com **zero preset** e com um **preset + prompt conflitante**, resolvendo de maneira legível:
`segurança/verdade/licença > instrução explícita do usuário > restrições de marca > prompt contextual > preset > defaults`.

## Controles úteis para leigos
“Quero mais ousado / mais elegante / menos elementos / mais informativo / mais 3D / mais próximo da referência.” Controles contínuos como densidade de motion, velocidade de cortes e volume de efeitos não substituem texto livre; ambos geram revisões do mesmo projeto.

## Proteção contra o visual genérico
- Bloquear padrões “glitch + contador + pop” em sequência sem motivo.
- Anti-repetição entre cenas consecutivas; repetição permitida apenas se constituir tema/identidade.
- Preferir animações que expliquem a fala, não icons decorativos desconexos.
- Registrar fingerprints visuais por projeto para evitar repetir composição, ângulo e ritmo sem intenção.
- Não fazer escolha aleatória só para parecer novo; variação precisa ter fundamento narrativo.

## Gates
A) Dois briefs materialmente diferentes sobre a mesma gravação: três avaliadores devem reconhecer diferença intencional de direção, não mera cor.
B) Prompt + preset + marca: nenhuma restrição explícita omitida silenciosamente.
C) Revisão de 1 cena não invalida seções não relacionadas; sem regressão de sync.
D) Recursos grátis insuficientes: opção de revisão manual e modo menos sofisticado, sem prometer mesma qualidade.
