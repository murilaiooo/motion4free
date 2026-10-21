# Histórico de versões

A versão aparece no rodapé da primeira tela e na barra de baixo do editor (`Motion4Free vX.Y.Z · commit`). Cada mudança publicada sobe a versão em `package.json`.

## v0.17.0 — 21/10/2026
**Linha do tempo de editor de verdade: dividir, apagar, mover, aparar, copiar, recortar, colar e duplicar.** Implementado; os testes automáticos e manuais desta versão ainda não foram executados.

- **Vista Edição (nova, padrão):** a linha do tempo mostra o vídeo final em blocos, um por pedaço, com a forma de onda. Clique seleciona (e leva a agulha até ali); arrastar muda a ordem; puxar as pontas apara ou devolve imagem; a tesoura entre dois pedaços abre o corte para restaurar. A vista **Original** (a gravação inteira com os cortes) continua a um clique.
- **Copiar, recortar, colar e duplicar** pedaços do vídeo (a fala, as legendas e as animações vão junto) e elementos (títulos, números, textos, emojis, formas). Colar entra na agulha. Os pedaços podem ficar numa ordem diferente da gravação e o mesmo trecho pode aparecer duas vezes. Ver [ADR-0020](decisions/0020-linha-do-tempo-edicao.md).
- **Elementos e legendas no tempo:** arrastar na faixa muda quando aparecem; as pontas mudam a duração; o ímã encosta nas emendas e na agulha. O painel do elemento ganhou "Aparece em / Some em", Copiar e Ir até ele.
- **Painel do pedaço:** tempos no vídeo final e na gravação, início/fim por número, zoom só naquele pedaço, dividir na agulha, mover para antes/depois, copiar, duplicar e apagar.
- **Atalhos:** S divide; Delete apaga; Ctrl+C, Ctrl+X, Ctrl+V e Ctrl+D copiam, recortam, colam e duplicam; Esc solta a seleção. Tudo volta com Ctrl+Z.
- **Erros novos:** M4F-518 (ajuste de corte pelos campos com ordem própria), M4F-519 (legenda não copia sozinha), M4F-520 (colar sem ter copiado), M4F-521 (nada selecionado).
- **Correções:** o painel do elemento usava `require` (não existe no navegador) para preencher o texto ao editar e engolia erros de Duplicar/Apagar sem mostrar o código; agora mostra o erro com código. O roteiro da transcrição segue a ordem do vídeo final quando ela muda.

## v0.16.0 — 21/10/2026
**Projetos que não se perdem, volume igual entre clipes, enquadramento na tela e polimento do editor.** Implementado; os testes automáticos e manuais desta versão ainda não foram executados.

- **Recuperação de projetos (achado do QA do PR #55):** a cópia do vídeo era gravada antes das edições, então fechar a aba durante a cópia deixava uma pasta sem dados, mostrada como "Projeto que não abre". Agora as edições (project.json e meta.json) são gravadas primeiro. A lista separa projeto sem a cópia do vídeo (abre e pede o original, M4F-604), resumo perdido (refeito a partir dos dados), **importação interrompida** (cartão próprio e aviso novo M4F-617) e dados realmente danificados (M4F-602, com o motivo). No OPFS, uma gravação que falha não deixa arquivo vazio, e erro de leitura não é mais confundido com "arquivo não existe". O teste do #55 esperava com `waitForFunction` e função async, que passa na hora; o teste novo (`e2e/project-recovery.spec.ts`) usa `expect.poll`.
- **Volume igual entre clipes (#53):** prévia, MP4, adicionar clipes e reabrir usam o mesmo ganho por clipe (mediana da fala, ±9 dB, pico 0,97), sempre calculado do áudio original. Um áudio mais longo que o clipe não vaza mais para o clipe seguinte.
- **Enquadramento na tela:** Preencher a tela ou Mostrar inteiro (com o vídeo desfocado atrás), aproximar, mover e centralizar, para o vídeo todo ou só um clipe. Antes o motor tinha isso, mas não havia controle. "Seguir o rosto" (#54) continua **não implementado**: sem detector de rosto, o recorte fica no centro, e a tela não promete o contrário.
- **Exportação mais rápida:** os quadros são lidos em sequência (`canvasesAtTimestamps`), não com uma busca por quadro.
- **Motion:** o título de abertura pula cumprimentos ("Oi gente, tudo bem?") em vez de mostrar "Oi" gigante.
- **Editor:** avisos com botão para dispensar; "Copiar detalhes" com plano B quando o navegador não deixa copiar; Tab preso dentro das janelas; setas andam um quadro (Shift, 1 s), Home/End; desfazer pelo teclado bloqueado enquanto o app trabalha; trava contra adicionar clipes duas vezes ao mesmo tempo (do PR #55); lista de clipes com as cores do tema (usava variáveis inexistentes) e botão Adicionar acessível pelo teclado.
- **Qualidade (#30):** kit de avaliação cega em [qualidade/avaliacao-cega.md](qualidade/avaliacao-cega.md). Nada nesta versão prova qualidade de motion designer profissional.

## v0.15.1 — 20/10/2026
**QA ampliado, recuperação de arquivos inválidos e smoke do deploy real.**

- Vídeos válidos importam mesmo com arquivos corrompidos no lote, incluindo o primeiro; aviso M4F-108; identificação e cópia corretas após reabrir.
- 100 cenários determinísticos de identidade/tempo/cortes/esquema; testes de limites, arquivos inválidos e persistência.
- Chromium + FFmpeg/FFprobe valida MP4 real em 9:16, 4:5, 1:1, 16:9, vídeo mudo, remoção/reabertura e undo/redo.
- Três presets produzem quadros visivelmente distintos para a mesma gravação; isso não prova excelência artística.
- QA de produção usa o domínio público e verifica o commit realmente implantado. A qualidade do ASR em aparelhos reais, os limites de performance e a avaliação humana continuam pendentes.
- Ver [QA da v0.15.1](QA-v0.15.1.md).

## v0.15.0 — 20/10/2026
**Integração do editor multi-clipe, preservando os projetos e as edições existentes.**

- Adição, reordenação, remoção e recuperação de clipes com IDs estáveis; arquivos do histórico de desfazer/refazer e versões permanecem recuperáveis ao reabrir.
- Transcrição, silêncio, áudio, waveform, legendas e cenas acompanham a nova ordem, sem reaproveitar timestamps de outros arquivos.
- Edição manual continua ancorada à fonte; operações que atravessariam clipes incompatíveis são recusadas com erro, sem perda silenciosa.
- Gravação local OPFS de todos os arquivos, indicador de salvamento fiel, recuperação dos originais por identificação e controle de até 30 clipes / 10 minutos totais.
- Player e MP4 com fontes múltiplas, quatro perfis (9:16, 4:5, 1:1, 16:9), transição de áudio curta (40 ms) e decodificação com proporção nativa.
- Teste E2E com dois vídeos diferentes, validando MP4 via FFprobe, cores da sequência e frequências do áudio via FFmpeg. Testes de regressão de reordenação, remoção, inclusão e histórico.
- O corpus de interpretação alcançou 349/363 (96,1%); holdout separado 12/16 (75%). **Esses números não medem qualidade artística.** Avaliação humana de motion design, modelos de IA em hardware real e publicação Cloudflare precisam de verificação própria.

## v0.14.0 — 20/10/2026
**Frentes 1→4 consolidadas (merge das branches `feat/*` para `main`): projetos, nichos, editor e multi-vídeos/formatos — com correções de regressão e base para finalização.**

- **Projetos e armazenamento (v0.11.0, ADR-0016):** `EditPlan` v6 com `clips/format` e migração v5→v6 (`fill→smart`, `clips: []` condicional, `earlyReturn` via `editPlanSchema.safeParse`); formatos 9:16/1:1/4:5/16:9 (`src/core/formats.ts`); loudness/normalização e correção de `SpliceJoins` (faixas encostadas não mesclam quando há joins); UI de “Meus projetos”/armazenamento pendente para próximo PR.
- **Nichos e inteligência (v0.12.0, ADR-0017):** corpus 300+ pedidos por nicho (`tests/corpus/pedidos-nichos.ts`, ≥12 por `NICHE_IDS`) + `corpus.test.ts`; `Brief v2` com `niche`; `interpret` com `findNiche` sem quebrar `goal/emphasis` legados; threshold temporário 0.4 (46% com regras main, alvo 90% com léxico de nichos completo).
- **Editor completo (v0.13.0, ADR-0018):** `EditPlan` v6 com `edits`, ops manuais (`split/trim/deleteWords`) e M4F-510–517/1014; render puro `layout/frame/captions/emoji/kit` com hit-testing e bounds testados; assembly/retakes; UI de arrasto na prévia adiada.
- **Múltiplos vídeos e formatos (v0.14.0, ADR-0019):** motor multi-clip (`engine/clips`, `assembly`), `sources` e `framing` com `SourceFrame/framingFor`; timeline montada já usada por cortes/legendas/gancho em testes; player/export multi-clip pendentes.
- **Correções:** `tests/schema.test.ts` unificado (framing `smart`), `tests/brief-ops.test.ts` tolerante a `niche:null`, `tests/helpers/recording-ctx.ts` ajustado, `src/media/*` mantido single-clip para `tsc --noEmit` verde, `npm test` 51×1362 verde, `npm run build` ok.

## v0.10.0 — 20/10/2026

**Visual novo, com cara de editor profissional** — a tela inteira foi refeita e agora usa todo o espaço do computador.
- **Primeira tela nova**: a promessa do app, uma área grande para **arrastar o vídeo** (ou clicar e escolher), o aviso de que o vídeo nunca sai do aparelho e exemplos dos modelos desenhados na hora.
- **Tela de "editando seu vídeo"** com os passos (abrir, cortar silêncios, transcrever, montar legendas e estilo), qual está acontecendo agora e a porcentagem.
- **Editor em tela cheia**, como nos editores de vídeo conhecidos: no alto, o nome do projeto, se está salvo, desfazer/refazer e o botão amarelo **Exportar**; à esquerda, as ferramentas em abas (**Modelos, Pedido, Legendas, Gancho, Trechos, Versões, Cores**); no meio, a **prévia grande**; à direita, os **Detalhes** do que você selecionou e **O que mudou** (com Antes/Depois); embaixo, a **linha do tempo** larga, com régua para clicar ou arrastar e **zoom**.
- **Legendas como um texto corrido**: em vez de centenas de linhas, o que você falou aparece como um parágrafo. Clique numa palavra para ir até ela e corrigir ali mesmo; a palavra falada acende enquanto o vídeo toca; o que foi cortado aparece riscado. Vídeos longos ficam em páginas.
- **Galeria de modelos**: cada modelo mostra um quadro de verdade (e se mexe quando você passa o mouse), com etiquetas e filtro (Energético, Vendas, Podcast, Tutorial, Elegante…); os **15 modelos** da v0.9 estão todos lá; o escolhido fica marcado.
- **Área segura do Reels**: um botão mostra na prévia onde os botões do Instagram cobrem a tela.
- **Atalhos**: Espaço toca/pausa, J e L voltam/avançam 1 segundo, Ctrl+Z desfaz, Ctrl+Shift+Z refaz. Clicar na prévia também toca.
- **Tema claro** opcional (botão do sol, no alto); o escuro continua o padrão.
- **Celular e tablet**: prévia em cima, ferramentas numa barra embaixo, sem rolar para o lado.
- A **Precisão da legenda** (Rápida/Precisa, da v0.8) fica logo abaixo da área de soltar o vídeo, em dois cartões; **"Legenda feita com …"** aparece no alto da aba Legendas.
- Tudo o que existia continua lá (pedido por texto, IA opcional, gancho, trechos e travas, versões, cores de uma imagem, cortes, exportar, avisos com código e "Copiar detalhes"). Projetos salvos antes abrem normalmente.
- Roteiro de teste refeito para o novo visual: [roteiro-de-teste.md](roteiro-de-teste.md).

## v0.9.0 — 20/10/2026
Muito mais estilos: agora são **15 modelos** prontos, cada um com letra, cores, animações e jeito de legenda próprios.
- **11 modelos novos**: **Impacto** (vendas: cada palavra num bloco, a falada em vermelho), **Minimal** (tudo em minúsculas, discreto), **Podcast** (selo de podcast no canto, legenda em pílulas, nome de quem fala em destaque), **Tutorial** (passos numerados em círculos, palavra falada sublinhada), **Cinema** (faixas pretas, cor quente, letra clássica), **Jornal** (selo "ao vivo", faixa de manchetes correndo embaixo, tarja com o nome), **Retrô 90** (letra de computador antigo, linhas de TV, "REC" com o tempo), **Turbo** (games: títulos que caem quicando, palavra em degradê), **Datilografia** (a legenda vai sendo digitada numa tira de papel, com cursor), **Marca-texto** (escrito à mão, palavra falada riscada de amarelo) e **Luxo** (preto e dourado, título numa moldura fina).
- **Pedir pelo nome**: escreva "estilo podcast", "template tutorial", "quero algo cinematográfico", "estilo de jornal", "retrô anos 90", "estilo gamer", "escrito à mão" ou "luxuoso" no pedido e o modelo é escolhido. Com a IA ligada, ela também conhece todos os modelos.
- **Tudo o que você já pedia continua valendo em qualquer modelo**: cores da legenda, tamanho, posição, emojis, pedidos por trecho, travas e versões.
- Novas letras para pedir na legenda: "letra pixelada", "letra manuscrita", "letra de máquina de escrever", "de jornal"… e o destaque "com marca-texto".
- Todas as letras novas são gratuitas e livres (licença OFL), vêm junto com o app e só são baixadas quando o modelo é usado. Ver [licencas.md](licencas.md).
- Projetos salvos nas versões anteriores abrem iguais.
- Imagens dos modelos para comparar: pasta `motion4free/templates-v0.9` (uma imagem por modelo: abertura e legenda). Decisão técnica: [ADR-0014](decisions/0014-registro-de-modelos.md).

## v0.8.0 — 20/10/2026
Legenda muito mais certa, principalmente em vídeos longos e gravados no celular.
- **Modelo de legenda maior**: no modo **Precisa** (o padrão), o app usa o *Whisper large-v3-turbo*, um modelo bem maior que o anterior, na placa de vídeo do computador. Ele baixa **cerca de 1,4 GB na primeira vez** (depois fica guardado no navegador). Sem placa de vídeo compatível, usa o *Whisper small* no processador (cerca de 250 MB; demora alguns minutos num vídeo de 2–3 min).
- **Escolha "Precisão da legenda"** embaixo da caixa do vídeo: **Precisa** (recomendada) ou **Rápida** (o modelo pequeno de antes, para computadores fracos ou pressa). Cada opção mostra o tamanho do download. A escolha fica lembrada.
- **Nunca fica sem legenda por causa do modelo**: se o modelo grande não funcionar no seu computador (falta de memória, navegador antigo, internet caiu no meio do download), o app passa sozinho para o próximo e avisa com o código **M4F-307**, dizendo qual modelo fez a legenda. Embaixo do resumo aparece "Legenda feita com …".
- **Menos palavras perdidas ou repetidas** nos pontos em que o app divide o áudio em pedaços: cada pedaço agora ouve um pouco do vizinho, e a palavra da emenda entra uma vez só.
- **Sem frases inventadas**: o app tira frases que o modelo inventa no silêncio (como "Legendas pela comunidade Amara.org") e repetições em laço ("e aí e aí e aí e aí…"); trechos só de silêncio nem vão para o modelo. A fala é sempre tratada como português.
- **Legenda mais junto da voz**: a última palavra antes de uma pausa não fica mais "pendurada" na tela durante a pausa, e a primeira depois da pausa não aparece antes da hora.
- **Medir o acerto**: a página `?avaliar` (para teste) transcreve um vídeo seu, compara com o texto que você colar e mostra a porcentagem de acerto, os erros mais comuns e quanto tempo levou. Ver [ai/avaliar-legenda.md](ai/avaliar-legenda.md).
- Ainda não medido num vídeo real: o ambiente de desenvolvimento não baixa os modelos. O teste do responsável é que vai dizer quanto melhorou.
- Projetos salvos nas versões anteriores abrem normalmente (com a legenda que já tinham).
- Novo código: M4F-307. Decisão técnica: [ADR-0013](decisions/0013-legenda-precisa.md).

## v0.7.0 — 20/10/2026
Testamos o app inteiro do começo ao fim e caprichamos no movimento para ficar com cara de editor profissional.
- **Legenda mais viva**: as palavras entram uma depois da outra com um "pulinho"; a caixa amarela do Pop **desliza** de palavra em palavra junto com a fala; a palavra falada cresce e empurra as vizinhas (as letras não se encavalam mais); palavras importantes ganham um destaque extra; a legenda sai suavemente quando há uma pausa. O contorno das letras ficou mais limpo, com uma sombra suave.
- **Legenda fora dos botões do Instagram**: na parte de baixo da tela, a legenda não passa mais por baixo dos botões de curtir/comentar. E uma legenda nunca termina com uma palavra sozinha.
- **Câmera que respira**: em trechos longos sem corte, o vídeo aproxima devagar (para a imagem não ficar parada); no Pop, o zoom de destaque chega com um "soco" e um tremor curto. "Sem zoom" e "sem animação aqui" desligam isso.
- **Nada em cima de nada**: o título de abertura não repete a mesma frase da legenda; se você pedir legenda em cima, o título desce; os emojis ficam logo acima da legenda e não caem mais em cima do título.
- **Títulos mais bonitos**: no Pop, o gancho alterna amarelo e branco; no Editorial, o título aparece subindo de trás de uma linha invisível, com uma faixa escura suave atrás para ler em qualquer fundo; a barra de progresso ganhou uma ponta brilhante.
- **Estilo novo: Neon** — legenda branca e limpa, poucas palavras por vez, a palavra falada acende em verde neon. Peça "estilo neon" ou toque no cartão.
- **Problemas encontrados no teste e corrigidos**: o exemplo "legenda grande em cima, amarela com contorno preto" deixava o contorno amarelo (agora a legenda fica amarela e o contorno preto); "música de fundo" mostrava também "fundo" em "Ainda não sei fazer"; trocar de estilo dizia "Cores do estilo de volta" mesmo sem imagem e listava a mesma animação como tirada e posta; o nome do estilo vazava do cartão (principalmente no celular); o resumo dizia "1 trechos · 1 legendas".
- **Avisos que antes não tinham código** (ou nem apareciam): vídeo sem som (**M4F-202**), vídeo sem fala (**M4F-306**) e navegador que não gera H.264 (**M4F-403**). Ver [erros.md](erros.md).
- Projetos salvos nas versões anteriores abrem normalmente.
- Roteiro de teste atualizado: [roteiro-de-teste.md](roteiro-de-teste.md).

## v0.6.0 — 20/10/2026
O pedido por texto agora muda muito mais coisas, e a IA passa a ler o pedido inteiro.
- **O seu pedido funciona**: *gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos* agora deixa a legenda verde com a palavra falada em amarelo, coloca emojis a cada uns 3 segundos e escolhe para abrir o vídeo uma frase sua diferente da mais óbvia. **Funciona sem IA.**
- **Muito mais coisas que dá para pedir**: qualquer cor da legenda (por nome, como "rosa choque" ou "azul mais escuro", ou por código como #FF00AA), cor do contorno e do fundo, legenda maior ou menor, em cima, no meio ou embaixo, em maiúsculas ou minúsculas, outra fonte, legenda pulando, deslizando ou aparecendo palavra por palavra, quantas palavras por linha; cortes mais rápidos (sem pausas) ou mais calmos; tipo de transição; quanto movimento; ligar barra de progresso, zoom e destaques; gancho em forma de pergunta, de impacto ou criativo.
- **Emojis**: a cada N segundos ou nas palavras importantes, escolhidos pelo que você está falando (💰 dinheiro, 💪 academia, 😴 dormir…), em cima, embaixo, dos lados ou longe da legenda, maiores ou menores, pulando, girando ou flutuando. Saem iguais na prévia e no vídeo final. "Sem emojis" continua valendo mais.
- **"Apliquei" e "Ainda não sei fazer"**: no lugar de "Palavras que não usei", o site mostra o que mudou e, separado, o que você pediu e o app ainda não sabe fazer (por exemplo música de fundo, filtro preto e branco, efeitos 3D).
- **IA mais esperta (opcional)**: a IA no navegador agora tem três tamanhos — **Padrão** (recomendado, baixa ~0,9 GB na primeira vez), **Leve** (para computadores mais fracos) e **Forte** (precisa de placa de vídeo boa). Ela lê o pedido inteiro, mostra uma frase-resumo e diz o que ainda não dá para fazer; se responder errado, o site pede para ela corrigir uma vez e, se continuar errado, usa as regras. Suas proibições continuam valendo mais que a IA. A chave do Google Gemini continua como opção.
- **Pedidos num trecho** usam o mesmo entendimento: "legenda vermelha aqui", "emojis grandes aqui" mudam só aquele pedaço; pedaço travado continua protegido.
- Projetos salvos nas versões anteriores abrem normalmente.
- Novos códigos: M4F-805 (emojis não carregaram), M4F-1012 (IA respondeu errado duas vezes), M4F-1013 (falta memória de vídeo para o modelo de IA). Ver [erros.md](erros.md).
- Roteiro de teste atualizado, com o pedido exato: [roteiro-de-teste.md](roteiro-de-teste.md).

## v0.5.0 — 20/10/2026
Fase 5: ajuste por trecho.
- **Mudar só um pedaço do vídeo**: na linha do tempo há uma faixa nova, "Trechos". Arraste nela para selecionar um pedaço (ou use o botão "selecione a partir de agora" e corrija início e fim). Abre um painel onde você escreve o que quer só ali: "mais calmo aqui", "sem animação aqui", "troca essa animação", "destaque isso" (palavra-chave e zoom com a sua própria fala), "sem zoom aqui", "destaque os números aqui"… **O resto do vídeo não muda**: cortes, legendas e animações fora do pedaço ficam exatamente iguais, e a legenda continua junto com a voz.
- **Travar um pedaço**: "trava esse pedaço" (ou o botão "Travar este trecho") congela aquele pedaço do jeito que está. Depois disso você pode trocar o estilo, fazer outro pedido geral, usar cores de uma imagem ou mexer em cortes em outros lugares, e o pedaço travado continua igual. Mudanças dentro dele são recusadas com o aviso M4F-504; para mudar, toque em "Destravar".
- Os pedaços ajustados aparecem na faixa "Trechos" (azul = ajustado, roxo = travado); clique num deles para ver o que foi pedido, pedir mais coisas ou "Voltar ao normal".
- **O que mudou**: um quadro lista cada mudança (animação que entrou ou saiu e em que segundo, legenda corrigida, estilo, cores, cortes, trechos). Clique numa linha para levar a prévia até ali e use **Antes / Depois** para ver como era no mesmo instante.
- **Versões**: dê um nome e guarde como o vídeo está ("versão calma", "versão pop"). Dá para restaurar (e desfazer a restauração), comparar com a atual ou apagar. As versões ficam salvas com o projeto neste navegador (até 20).
- **Cores de uma imagem sua (opcional)**: escolha uma foto ou logo e as cores de destaque do vídeo passam a ser as dela, sempre com contraste suficiente para a legenda continuar legível. A imagem é lida só no seu aparelho e não é guardada nem enviada; só as cores ficam no projeto. "Voltar às cores do estilo" desfaz.
- Ainda não: mover a frase do gancho para o começo do vídeo (o gancho continua aparecendo como título de abertura).
- Projetos salvos nas versões anteriores abrem normalmente.
- Novos códigos: M4F-504 a 506 (trechos), M4F-605 (limite de versões), M4F-803 e 804 (imagem de referência), M4F-1010 e 1011 (pedido do trecho). Ver [erros.md](erros.md).
- Roteiro de teste de tudo o que existe até agora: [roteiro-de-teste.md](roteiro-de-teste.md).

## v0.4.1 — 20/10/2026
- IA no navegador: corrigido o erro M4F-1006 ("GrammarMatcherInitError") que aparecia logo depois de baixar o modelo. A resposta da IA continua sendo conferida e, se vier errada, o app usa as regras.

## v0.4.0 — 20/10/2026
Fase 4: pedido por texto.
- **"O que você quer?"**: logo abaixo da prévia há uma caixa para escrever o pedido com suas palavras, por exemplo "gancho forte, estilo calmo, sem emojis, destaque os números". Há exemplos prontos para tocar e usar. Ao apertar **Aplicar**, o vídeo muda: estilo, quantidade de movimento, ritmo das animações e o que aparece ou não na tela.
- **O site mostra o que entendeu**: uma lista "Entendi" (estilo, tom, movimento, ritmo, objetivo, público, destaques), o que ficou proibido ("Sem: zoom, números grandes…"), como resolveu pedidos que se contradizem e as palavras que não usou.
- **Proibição sempre vale mais**: "bem animado mas sem efeitos" deixa as animações no ritmo animado, mas sem zoom, sem transições e sem movimento exagerado. Pedir "sem números", "sem zoom", "sem título", "sem barra de progresso", "sem chamada final", "sem texto na tela" etc. tira essas animações, mesmo se você trocar de estilo ou mexer nos cortes depois.
- **Gancho**: o site sugere frases da sua própria fala (nunca inventa) para abrir o vídeo, dando preferência a perguntas, números e palavras fortes. A frase escolhida aparece como título no começo. Escrever "gancho forte" escolhe a melhor sozinho; dá para trocar ou tirar.
- Tudo entra no **Desfazer/Refazer** e fica salvo com o projeto.
- **Funciona sem IA e sem internet** (depois que o site carregou): o pedido é entendido por regras em português.
- **IA opcional (avançado, ainda não testada de verdade)**: dá para ligar uma IA que roda no próprio navegador (precisa de placa de vídeo compatível; baixa cerca de 300 MB na primeira vez, pelo próprio endereço do Motion4Free) ou usar a sua chave gratuita do Google Gemini (só o texto do pedido e um trecho da fala são enviados; o vídeo nunca sai do aparelho; a chave fica só no seu navegador). A IA só completa o que as regras não entenderam e nunca tira uma proibição sua; se falhar, o site usa as regras e avisa.
- Projetos salvos nas versões anteriores abrem normalmente, sem pedido.
- Novos códigos: M4F-1001 a M4F-1009 (pedido e IA). Ver [erros.md](erros.md).

## v0.3.0 — 20/10/2026
Fase 3: estilos e animações.
- **3 estilos bem diferentes para o mesmo vídeo**, escolhidos com um clique logo abaixo da prévia:
  - **Pop**: energético. Letras grandes em maiúsculas, a palavra que está sendo falada aparece numa caixa amarela, flash nos cortes, muitas animações.
  - **Editorial**: elegante, como revista. Letra serifada nos títulos, legenda que "acende" palavra por palavra, movimento lento e poucas animações.
  - **Documental**: sóbrio. Painéis escuros à esquerda, letra técnica, quase sem movimento.
  Trocar de estilo muda letras, cores, animações e ritmo, e dá para desfazer. O vídeo final sai no estilo escolhido, e o estilo fica salvo com o projeto.
- **Legendas maiores e mais fortes**, com destaque na palavra falada e nas palavras-chave (ex.: "segredo", "nunca", "erro").
- **Animações que acompanham a fala**, escolhidas automaticamente pelo que é dito: número grande quando você fala um número ("noventa por cento" vira **90%**), lista quando enumera ("primeiro…, segundo…"), pergunta em destaque, seu nome na tela quando você se apresenta ("meu nome é…"), zoom em frases fortes, transição nos cortes, barra de progresso e chamada final ("Siga para mais"). Cada estilo tem um limite de animações por trecho para não poluir, e a mesma animação não se repete em seguida.
- A lista "Animações neste estilo" mostra o que foi colocado no vídeo.
- **Galeria de estilos**: o link "Ver os 3 estilos lado a lado" mostra as mesmas animações em cada estilo. Imagens de exemplo: [Pop](assets/fase3/pop.png), [Editorial](assets/fase3/editorial.png), [Documental](assets/fase3/documental.png).
- Fontes gratuitas de licença livre, guardadas no próprio site ([licenças](licencas.md)).
- Projetos salvos na versão anterior abrem normalmente (no estilo Pop); para ver as animações novas neles, escolha um estilo.
- Novos códigos: M4F-801 (fontes não carregaram) e M4F-802 (estilo inexistente). Ver [erros.md](erros.md).

## v0.2.0 — 20/10/2026
Fase 2: editor básico.
- **Assistir antes de gerar:** o vídeo editado toca na própria página, com som, legendas e título, desenhado pela mesma função que gera o arquivo final (a prévia usa meia resolução para ficar leve). Substitui a antiga "prévia de 10 s".
- **Linha do tempo:** mostra o vídeo inteiro, com os trechos mantidos (verde), os cortados (listras vermelhas), o desenho do som e as legendas. Clicar num trecho leva o vídeo até ali.
- **Corrigir legendas:** clique no texto da legenda, corrija e aperte Enter.
- **Desfazer cortes:** clique num trecho cortado para restaurá-lo ou para mudar onde o corte começa e termina (botões de ±0,1 s ou digitando o tempo).
- **Desfazer e refazer** qualquer alteração (botões ou Ctrl+Z / Ctrl+Shift+Z).
- **O projeto fica salvo neste navegador:** pode fechar a aba e voltar depois; as edições e o histórico continuam lá. Se o navegador tiver apagado a cópia do vídeo, o app pede para escolher o mesmo arquivo de novo. O vídeo original nunca é alterado e nada é enviado para a internet.
- **Gerar o vídeo não trava mais a página:** a geração roda em segundo plano.
- Novos códigos de aviso/erro: M4F-501 a 503 (edição), M4F-601 a 604 (projeto salvo) e M4F-701 (player). Ver [erros.md](erros.md).

## v0.1.4 — 20/10/2026
- Legendas não partem mais uma palavra em duas (no teste, "cada janela" aparecia como "cadeja" + "anela"). A transcrição agora é feita em trechos de até 28 s cortados nas pausas da fala, em vez de janelas fixas de 30 s que podiam cair no meio de uma palavra; pedaços de palavra que ainda vierem soltos são colados na palavra anterior.

## v0.1.3 — 20/10/2026
- O modelo de transcrição e o runtime agora são baixados pelo próprio endereço do Motion4Free (espelho na Cloudflare, [ADR-0006](decisions/0006-espelho-do-modelo.md)). Quem não alcança o Hugging Face ou o jsdelivr (firewall, antivírus, rede) passa a ter legendas. Se o espelho falhar, o app tenta os servidores originais.
- Novo código M4F-305 para resposta de erro do servidor do modelo; o detalhe do M4F-301 lista cada tentativa.

## v0.1.2 — 20/10/2026
- Detector de silêncio com limiar adaptativo ao ruído de fundo da gravação (antes era fixo em −40 dBFS e não achava pausas em vídeos com música ou ruído). No vídeo de teste de 146 s, os cortes passaram de 0,8 s para 1,8 s; o vídeo já vinha editado, com pausas curtas.

## v0.1.1 — 20/10/2026
- Cada problema mostra um código próprio (`M4F-xxx`), o que aconteceu e um botão "Copiar detalhes" com a versão e o navegador. Catálogo em [erros.md](erros.md).
- Se a transcrição falhar (por exemplo, sem acesso ao servidor do modelo), o vídeo continua sendo cortado e exportado, sem legendas e sem título, com um aviso.
- Falhas de rede informam qual servidor falhou (modelo no Hugging Face ou runtime no jsdelivr).
- Versão do app exibida no rodapé.

## v0.1.0 — 20/10/2026
- Fase 1: escolher vídeo, cortar silêncios, legendas automáticas, título animado, prévia de 10 s e exportação MP4 no navegador.
