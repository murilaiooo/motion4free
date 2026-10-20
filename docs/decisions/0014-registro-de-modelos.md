# ADR-0014 — Registro de modelos e acabamento do quadro (v0.9.0)

**Data:** 2026-10-20
**Status:** ACEITA. Complementa o [ADR-0008](0008-styledna-e-cenas.md) (StyleDNA e cenas puras), o [ADR-0011](0011-ia-interprete-e-look.md) (look) e o [ADR-0012](0012-sistema-de-movimento.md) (movimento). Stack do [ADR-0005](0005-stack-v1.md) sem troca de peça; dependências novas: 13 fontes OFL `@fontsource/*` 5.3.0 ([licenças](../licencas.md)).

## Contexto
Pedido do responsável: "olhe nas nossas referências e já inclua mais templates". Havia 4 estilos (Pop, Neon, Editorial, Documental), escritos à mão em `presets.ts`, com a descrição de cada um repetida no seletor, o nome repetido no intérprete e no prompt da IA. Os editores de vídeo curto mais usados (pesquisa de ideias apenas, sem copiar nada nem usar nomes de marca) oferecem dezenas de modelos: blocos por palavra para vendas, legenda mínima em minúsculas, podcast com selo e nome de quem fala, passo a passo, cinema com faixas pretas, telejornal com faixa de manchetes, fita antiga, games com degradê, máquina de escrever, marca-texto, luxo preto e dourado. A outra frente (redesenho da tela) vai montar uma galeria de modelos e precisa de uma fonte de dados simples.

## Decisão
1. **Registro de modelos** em `src/core/templates.ts` — a única lista de modelos do app:
   ```ts
   TEMPLATE_IDS: readonly ['pop', 'neon', …, 'luxo']          // ordem da tela; literal (zod, prompt da IA)
   interface Template {
     id: TemplateId; name: string; description: string;           // nome e uma frase em português
     tags: TemplateTag[];                                         // TEMPLATE_TAGS + TAG_LABELS (rótulo em português)
     preview: { background, text, accent, panel, onPanel, titleFont, captionFont, highlight };  // miniatura sem compositor
     style: StyleDNA;                                             // o que o desenho lê
     match: { aliases, words, hints };                            // palavras do pedido (sem acento)
   }
   TEMPLATES: readonly Template[]; templateById(id); templatesByTag(tag); TEMPLATE_NAMES
   ```
   Os parâmetros de cada StyleDNA ficam em `src/core/template-styles.ts`; `presets.ts` virou fachada (`PRESETS = TEMPLATES.map(t => t.style)`, `presetById`, `DEFAULT_STYLE`). O seletor de estilo (`StylePicker`), a galeria (`?galeria`), o resumo "o que entendi" (`LABELS.preset`), o esquema do pedido (`PRESET_IDS = TEMPLATE_IDS`), o intérprete por regras e o prompt da IA leem do registro: **um modelo novo = um StyleDNA + uma linha no registro**. Nome de modelo nunca usa marca registrada nem nome de criador/empresa (teste).
2. **11 modelos novos** (15 no total), cada um com fontes, cores, legenda, entrada/saída, destaque, título e ritmo próprios: Impacto, Minimal, Podcast, Tutorial, Cinema, Jornal, Retrô 90, Turbo, Datilografia, Marca-texto, Luxo. Um teste garante par de fontes e "assinatura visual" (destaque, caixa, entrada, composição, moldura, acabamento) únicos para cada modelo.
3. **StyleDNA cresce sem mudar de versão** (continua v2; EditPlan continua v5): valores novos em enums que já existiam e um bloco novo com padrão.
   - `motion.enter`: + `slide` (desliza da esquerda), `drop` (cai e quica), `zoom` (assenta de um pouco maior), `type` (revela em degraus, como digitando). A legenda em "auto" segue: slide → desliza, drop → quica, zoom → aparece suave, type → palavra a palavra.
   - `captions.highlight`: + `marker` (traço de marca-texto com pontas irregulares, desenhado da esquerda para a direita; texto escuro por cima).
   - `captions.box`: + `word` (um bloco por palavra, texto escolhido por contraste); caixa por linha agora também troca a cor do texto por contraste (caixa clara = letra escura).
   - `decor` (com padrão "tudo desligado", então projetos antigos abrem iguais): `title` (`auto|frame|corners|band|marker`, moldura do título e da chamada final), `letterbox`, `vignette`, `scanlines`, `chroma` (separação vermelho/ciano), `jitter` (tremor de fita, proporcional à intensidade), `tint` (véu de cor #RRGGBBAA), `tag` (`none|label|live|rec`) + `tagText`, `ticker` (faixa de manchetes com as frases das cenas do próprio vídeo; nunca texto inventado; reserva espaço na área segura), `cursor` (cursor de digitação), `listMarker` (`number|circle`), `gradient` (palavra acesa em degradê, só com as cores do estilo).
   - Nome na tela vira tarja de telejornal quando `decor.title = 'band'`.
   Tudo continua função pura de (plano, t): mesmo instante = mesmo quadro, prévia = MP4. Só Canvas 2D (`createRadialGradient` entrou no subconjunto `Ctx2D`, sem uso atual).
4. **Look por cima de qualquer modelo**: cores, tamanho, posição, emojis, trechos e travas valem em todos (teste por modelo). Cor própria de destaque vence o degradê; cor de caixa pedida mantém blocos por palavra; "sem caixa" tira. Cor de referência (imagem) não exige mais contraste impossível quando o texto do painel é claro (o desenho troca a letra por contraste).
5. **Pedido escolhe modelo pelo registro**: antes do look, "estilo/template/modelo/tema… + nome ou apelido" e palavras inequívocas ("podcast", "cinematográfico", "telejornal", "retrô", "gamer", "luxuoso"…) escolhem com peso forte; dicas fracas ("tutorial", "minimalista", "notícias", "entrevista", "premium") só sugerem. Palavras de outros campos continuam como eram ("gancho de impacto" = tipo de gancho; "legenda como máquina de escrever" = animação; "nada de luxo" é negado). O prompt da IA lista os ids com a primeira parte da descrição de cada modelo.
6. **Fontes**: só OFL-1.1 via `@fontsource` 5.3.0 fixado, subconjunto latino, carregadas sob demanda pela FontFace API na página e no Worker. Teste confere peso no esquema, arquivo no pacote, entrada no carregador, licença `OFL-1.1` no pacote e linha em `docs/licencas.md`. Fontes novas também entram no look ("letra pixelada", "manuscrita", "de jornal"…).

## Custo medido (Chromium sem GPU do ambiente de desenvolvimento, quadro 1080×1920 da galeria, mediana de 3 × 120 quadros)
Pop 8–9 ms; Impacto 8 ms; Documental 11 ms; Podcast 13–14 ms; Jornal 14–16 ms; Editorial 15 ms; Marca-texto 15–20 ms; Tutorial 14–16 ms; Turbo 16–17 ms; Neon 15–17 ms; Datilografia 18–21 ms; Minimal 19–21 ms; Luxo 20–24 ms; Cinema 21–27 ms; Retrô 24–30 ms. O que mais pesa sem GPU são as camadas de tela inteira (degradê da legenda, vinheta, véu de cor): a vinheta virou quatro faixas lineares nas bordas em vez de um degradê radial. Tudo abaixo de 33 ms (30 quadros/s); com GPU fica bem menor. `window.m4fGallery.bench(id, n, decor)` mede com partes do acabamento desligadas.

## Alternativas descartadas
- **Uma função de desenho por modelo**: rápido de escrever, mas quebra a regra do ADR-0008 (nenhuma cena pergunta "qual preset") e impede a IA de compor um estilo novo.
- **StyleDNA v3 com migração**: desnecessário; enums só crescem e o bloco novo tem padrão.
- **Granulação de filme por ruído**: exige ler/escrever pixels (caro e fora do subconjunto `Ctx2D`); o Retrô usa linhas, cores separadas e tremor.
- **Faixa de manchetes com texto livre**: seria texto inventado; usa só frases das cenas (ou legendas) do próprio vídeo.

## Consequências
- Galeria e referências de tela: os 4 estilos antigos mantêm 7 quadros cada; cada modelo novo ganhou 2 (abertura e legenda) em `e2e/estilos.spec.ts-snapshots` (guarda grosseira, `maxDiffPixelRatio 0.12`); a regressão fina fica em `tests/templates.test.ts`.
- Script `scripts/render-templates.mjs` grava os 7 quadros de cada modelo em PNG (e mede, com `BENCH=1`), para revisão humana.
- O seletor atual lista os 15 cartões; a galeria de modelos com filtro por etiqueta fica com o redesenho da tela.
