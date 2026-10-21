# Histórico de versões

A versão aparece no rodapé da primeira tela e na barra de baixo do editor (`Motion4Free vX.Y.Z · commit`). Cada mudança publicada sobe a versão em `package.json`.

## v0.27.6 — 21/10/2026 — IMPLEMENTED — NOT TESTED

**#73 — Autorização para o conteúdo real e revogação imediata.** Cada envio externo, inclusive teste de conexão e reparo de JSON, mostra o corpo completo antes da autorização. O diálogo só guarda o texto enquanto o pedido aguarda a decisão; cancelar mantém o caminho de regras. Trocar/remover chave, trancar cofre ou revogar consentimento cancela operações em andamento e invalida a seleção anterior, inclusive fora do painel IA.

- Respostas de conexão atrasadas não podem confirmar outro modelo/credencial. O timeout e cancelamento cobrem também a leitura do corpo HTTP.
- Erros remotos não ecoam corpos, URLs ou cabeçalhos potencialmente privados; M4F-1218 identifica cancelamento.
- Paginação incompleta falha explicitamente sem apresentar um catálogo truncado como completo.
- Escritas e desbloqueios de cofre são descartados depois de lock/delete ou alteração em outra aba, preservando a revisão mais recente.
- Nada foi executado para verificar estas mudanças. Testes existentes preservados; QA independente obrigatória.

## v0.27.5 — 21/10/2026

**Conexão de provedores sem catálogo de outra conta nem sucesso de fachada (#73, entrega parcial).** Conectar/substituir/remover uma chave invalida o catálogo daquela conta e a escolha antiga de modelo, sem guardar identificador derivado da chave em armazenamento. Uma resposta atrasada de outra chave é descartada; requisições pendentes são canceladas ao trocar de provedor. Os catálogos ficam por até 30 minutos na memória desta aba, separados por revisão opaca da credencial.

- Um HTTP 200 só valida a execução se o modelo realmente devolver texto. Resposta vazia mostra M4F-1217 e a interface distingue “modelo selecionado” de “resposta confirmada”.
- Modelos removidos da listagem desmarcam a preferência anterior, com aviso M4F-1209. Caso o serviço não marque nenhum modelo como recomendado, o seletor mostra todos em vez de uma lista vazia.
- “Preço zero informado” só inclui modelos cuja API devolve preço zero; cotas variáveis agora avisam sobre possível cobrança e exigem confirmação explícita.
- Novo E2E no Brave com duas contas sintéticas, lista alterada, teste de inferência vazio, troca de chave, cache, revogação e verificação de que nenhuma chave aparece em localStorage. Testes unitários da revisão de credenciais e do teste de modelo.

**Ainda pendente na #73:** modelos por tarefa, orçamento/uso e limite local, roteamento avançado da #9, auditoria CSP/CORS com credenciais reais e consentimento preciso para cada pedido.

## v0.27.4 — 21/10/2026

**Download de modelos Whisper sem HTTP 403 por URL temporária (#80, complemento do PR #90).** A correção do cache de borda do PR #90 era necessária, mas o arquivo grande do Whisper ainda respondia HTTP 403 no site público após o deploy. Verificação: endpoint do modelo (1.274.403.767 bytes) retornava "Auth failed: credentials expired"; Hugging Face direto e CDN Xet respondiam 200, e o CDN permitia CORS.

- O Worker solicita ao Hugging Face um novo redirecionamento assinado para os pesos ONNX turbo, devolve um HTTP 302 sem cache e deixa o navegador buscar os bytes diretamente do CDN oficial. A origem é validada e só aceita HTTPS do Hugging Face.
- GET/HEAD e Range não exigem baixar o modelo inteiro pelo Worker. Configuração, modelos menores e bibliotecas estáticas continuam na rota normal.
- Testes do Worker para redirecionamento fresco, origem permitida, cache, Range, HEAD e erros sem exposição de endereços sensíveis.
- Teste real pós-publicação apenas por HEAD e pequeno Range, sem baixar o modelo completo.

## v0.27.3 — 21/10/2026

**Cores de referência no Creative Setup (#84).** Corrigida a ordem de aplicação das cores na composição e nos trechos com estilo próprio. A imagem escolhida depois do briefing agora determina as cores de destaque e a palavra realçada da legenda quando sua cor acompanha a marca; cores de legenda diferentes escolhidas manualmente são preservadas. Ao remover a imagem, retornam as cores do modelo e do pedido, inclusive a cor de marca explícita. A interface explica a prioridade. As regras de contraste da paleta continuam as mesmas.

- Testes unitários: paleta real versus briefing com cor definida, todos os presets, contraste mínimo, trechos com look próprio, remoção e desfazer/refazer.
- Regressão visual dirigida no Brave com imagem BMP pequena; sem exportação.

## v0.27.2 — 21/10/2026

**Versões e histórico da composição (#83).** Verificado no Brave: restaurar uma versão anterior remove o título acrescentado depois, desfazer/refazer recuperam o estado anterior e reabrir o projeto mantém o estado restaurado. A correção amplia o painel "O que mudou" para reconhecer elementos manuais, camadas e ajustes de composição (antes podia mostrar "Nada mudou" mesmo com título novo). As versões guardadas agora têm cópia independente do plano, protegida contra futuras mutações acidentais.

- Regressão E2E curta no Brave: guardar A, adicionar título B, comparar, restaurar A, desfazer/refazer e recarregar, sem exportação.
- Testes unitários de comparação, isolamento de snapshots e persistência.

## v0.27.1 — 21/10/2026
**Corrigida a tela preta ao navegar em Configurações (#78).** O efeito de rolagem da seção não devolve mais o resultado de `scrollTo` ao React como se fosse função de limpeza. Ao trocar abas, o diálogo e o editor permanecem montados. Teste E2E de regressão monitora exceções JavaScript e percorre as seis seções, incluindo fechar e reabrir a janela; validação feita em cópia isolada, sem alterar o trabalho local em andamento.

## v0.27.0 — 21/10/2026
**Configurações e IA com a sua própria chave.** Pedido do responsável: um painel de Configurações e uma mesa de edição só com ferramentas de edição, tudo explicado para quem não é técnico (issue #73, [ADR-0028](decisions/0028-configuracoes-e-ia-com-chave-propria.md)). Implementado; não testado nesta sessão.

- Novo botão **Configurações** no topo de todas as telas. Abre por cima da tela atual e, ao fechar, tudo continua como estava (projeto, linha do tempo, clipes).
- Seis seções: **IA e provedores**, **Transcrição**, **Armazenamento**, **Editor e aparência**, **Privacidade e segurança** e **Sobre e diagnóstico**, cada uma explicando o que cada opção faz, com exemplos animados.
- A mesa de edição ficou só com edição: saíram o botão de tema, o botão Armazenamento, "Restaurar layout" e as opções técnicas de IA. A aba IA mostra "IA: (em uso) · Alterar"; a área de envio mostra "Precisão da legenda: (escolhida) · Alterar".
- **IA com a sua chave:** OpenRouter, Groq, Google Gemini, OpenAI (API) e Claude (API). Passo a passo para criar a chave, link oficial, aviso de custo (assinatura ChatGPT ou Claude Pro não inclui API), lista de modelos buscada do próprio serviço com filtro "sugeridos / sem cobrança / todos", confirmação para modelo pago, autorização de envio por serviço com exemplo do texto enviado e "Testar resposta do modelo".
- O navegador fala direto com o serviço escolhido; o Motion4Free não tem servidor e não recebe chave nem texto. Só o texto do pedido e trechos da fala vão para o serviço; vídeo e áudio nunca.
- A chave fica só na memória da aba. Opcional: "Lembrar neste navegador" guarda a chave cifrada com uma senha sua (cofre). A chave antiga do Gemini, que ficava sem proteção, só muda de lugar com o seu clique e a cópia antiga é apagada.
- A escolha de IA agora fica lembrada e vale para o editor, o pedido de trecho e o criador de clipes.
- Privacidade: desenho do que sai do computador, lista de chaves abertas e guardadas, trancar e apagar o cofre, tirar autorizações e baixar as configurações sem chaves.
- Sobre: versão, recursos do navegador (placa de vídeo, codificador de vídeo, armazenamento, criptografia) e "Copiar diagnóstico" sem dados pessoais.
- "Apagar tudo" agora também apaga a precisão da legenda, que ficava para trás.
- Rodapé do editor diz para qual serviço vão os pedidos quando a IA com chave está ligada.
- Códigos novos: M4F-1201 a M4F-1216 (IA com chave e cofre).

## v0.26.0 — 21/10/2026
**Música de fundo, legenda .srt, escolher vários, animação por pontos e máscara.** Melhorias da comparação com o OpenCut, todas numa versão, a pedido do responsável ([ADR-0026](decisions/0026-musica-e-legenda-srt.md), [ADR-0027](decisions/0027-varios-pontos-mascara.md)). Implementado; não testado nesta sessão.

- Nova aba **Áudio** no editor: escolha uma música do aparelho (MP3, M4A, WAV ou OGG, até 60 MB). Ela toca por baixo da fala na prévia e no MP4, entra e sai suave e não se repete.
- Volume da música e "abaixar a música quando alguém fala" (ligado por padrão). Trocar e tirar a música também entram no desfazer e nas versões.
- A música fica guardada no projeto: ao reabrir, ela volta junto. Se o arquivo sumir, aparece o aviso M4F-205.
- Vídeo sem som com música agora sai com áudio.
- Aba **Legendas** ganha "Baixar legenda (.srt)": as legendas do vídeo editado, já corrigidas e nos tempos dos cortes, para o YouTube ou outro editor.
- **Escolher vários** na linha do tempo: Ctrl ou Shift + clique, ou o botão **Vários**, escolhe vários pedaços e elementos; Delete apaga todos de uma vez (uma entrada no desfazer) e o resto do vídeo encosta. Copiar com vários pedaços copia todos, na ordem.
- Trecho marcado na faixa Trechos também pode ser apagado com Delete: só aquela parte sai e o resto encosta.
- **Animação por pontos** (keyframes) em textos, títulos, emojis e formas: marque um ponto, vá para outro instante e arraste o elemento no vídeo; ele anda, cresce, gira e muda de opacidade sozinho entre os pontos. Cada ponto tem opacidade e curva (suave ou reta), e os pontos aparecem como losangos na linha do tempo.
- **Máscara do vídeo** (aba Mídia): o vídeo aparece só dentro de um círculo, retângulo, coração, estrela ou losango, com tamanho, posição, cantos, borda e cor de fundo. Legendas e textos ficam por cima.
- Códigos novos: M4F-203, M4F-204, M4F-205, M4F-206 (música), M4F-523 (sem legenda para baixar), M4F-524 (limite de pontos), M4F-525 (apagar todos os pedaços) e M4F-526 (vários itens com elemento ao copiar ou duplicar).

## v0.25.1 — 21/10/2026
**Configuração com exemplos animados.** Pedido do responsável: as prévias do passo "Visual" estavam minúsculas e iguais, e "Palavra em destaque" e "Discreta" pareciam a mesma coisa. Implementado; não testado nesta sessão.

- Cada escolha agora tem um exemplo que se mexe em loop, como um GIF leve (sem arquivo pesado): telinha no formato de cada destino, gravação de exemplo mostrando as pausas que somem em cada modo de edição, barra com a parte que entra em cada duração, legenda falada palavra por palavra, movimento, transições e título de abertura.
- Visual: prévias grandes ao lado do nome, sobre um fundo que parece vídeo, todas animadas (com "menos movimento" ligado no sistema, só a escolhida e a do mouse animam).
- Legendas: "Palavra em destaque" mostra as palavras entrando uma a uma e a falada pulando; "Discreta" mostra a frase inteira parada, só trocando a cor. Textos dos cartões reescritos.
- Rodapé: "Usar estas escolhas" virou "Pular e escolher vídeos" e "Continuar" virou "Próximo: (nome da etapa)".

## v0.25.0 — 21/10/2026
**Publica o trabalho local da v0.24 (configuração por escolhas, mesa ajustável, biblioteca, guias, checagem antes de exportar), revisado, e melhora a linha do tempo.** As v0.24.0 e v0.24.1 foram feitas e testadas só no computador do responsável e não chegaram a ser publicadas; esta versão as inclui. Implementado; não testado nesta sessão.

- Mesa: recolher ferramentas, recolher propriedades e restaurar layout viram botões sempre visíveis no topo (antes ficavam num menu fechado).
- Primeira tela: a área para soltar vídeos fica sempre à vista, com as últimas escolhas salvas (antes escondida embaixo de um texto clicável). Na configuração, os outros formatos aparecem direto e as observações do rascunho ficam abertas.
- Linha do tempo: altura das faixas de vídeo e áudio em P, M ou G (fica guardada), botão "ver tudo", atalhos + − 0 para zoom e rolagem automática até o item escolhido na prévia.
- Esc tira qualquer seleção (pedaço, elemento, corte ou trecho).
- Códigos de erro próprios: edição recusada pela checagem vira M4F-522 e plano inválido na exportação vira M4F-406 (antes os dois apareciam como M4F-1016).
- O histórico guarda o próprio plano depois de validá-lo (antes guardava uma cópia que podia perder campos).
- Biblioteca de mídia gera uma miniatura por vez, para 30 clipes não esgotarem a memória.
- IA no navegador no Brave (issue #72): o app deixa de bloquear o download do modelo pelo número de espaço que o navegador informa (no Brave ele aparece como 2 GB, menor que o real, por privacidade). Tenta baixar e só mostra M4F-1014 se o navegador recusar guardar de verdade; esse erro, antes confundido com falta de placa de vídeo (M4F-1013), agora é reconhecido. A lista de modelos mostra o espaço informado, quais já estão baixados e quais podem não caber. No Criador de Clipes, o aviso mostra a causa real (ex.: M4F-1014) em vez do genérico M4F-1106. Duplicar projeto também não se bloqueia mais pelo número.

## v0.24.1 — 21/10/2026
**Configuração por escolhas, sem formulário obrigatório.** Revisão local após feedback do responsável; publicação pendente.

- Uma decisão por tela: destino, edição, duração, visual e legendas, seguida de revisão com atalhos para alterar cada escolha.
- Cartões grandes, textos destacados e explicações concretas: o que corta, o que preserva e como afeta o vídeo. Sem linguagem metafórica na configuração, no upload e na abertura do rascunho.
- Modos Sem cortes, Natural, Direto e Dinâmico configuram a política de pausas, ritmo e movimento reais. Nenhum campo escrito, select ou slider é obrigatório.
- Fonte, cor, abertura, CTA, movimento e pedidos escritos ficam em seções opcionais. Exemplos dos visuais usam o renderizador existente sobre fundo neutro, sem personagem ilustrado.
- Preferências anteriores são mantidas. Navegar ou clicar novamente no destino não apaga formato personalizado; ajustes fora dos modos prontos continuam identificados como personalizados.
- Revisão dentro do editor não pergunta novamente por cortes ou duração: preserva a montagem e o histórico existentes.
- Decisões e roteiro em `docs/quality/setup-ux-2026-10-21.md` e `docs/quality/acceptance-v0.24.md`.

## v0.24.0 — 21/10/2026
**Direção criativa antes da mídia e primeiro rascunho revisável.** Implementação local; validação editorial com vídeos reais e publicação ainda pendentes.

- Jornada principal Começar → intenção → identidade → ritmo → pedido → vídeos → edição → prévia, com Exportar e Personalizar igualmente acessíveis.
- Briefing versionado e validado controla formato, modelo, tom, ritmo, política de pausas, legenda, tipografia, cor, movimento, transição e CTA. Duração desejada termina em frase completa quando há um limite adequado. Sem fala confiável, preserva a sequência e explica as limitações.
- Preferências locais recuperáveis; briefing guardado no projeto sem remover dados antigos. Revisão de direção preserva cortes, legendas corrigidas, elementos manuais, cenas editadas/apagadas e travas; entra no desfazer. Pedidos por texto mantêm o contexto de produção.
- Mesa com três divisórias redimensionáveis, teclado, Escape, reset, recolhimento, persistência validada e propriedades em drawer em telas médias. O canvas/player mantém sua identidade durante resize.
- Biblioteca com miniaturas locais, metadados, grade/lista, busca e ordenação independente da montagem. Importação e reordenação continuam usando o pipeline existente.
- Guias sugeridas Reels/TikTok/Shorts e margens personalizadas: só na interface, persistidas; não alteram os pixels do canvas nem o MP4.
- Transações de edição validadas antes do histórico; preflight compartilhado recusa fontes ausentes/trechos inválidos antes de exportar. Novos códigos M4F-405, 618, 619, 1016 e 1017 documentados.
- Build de testes compatível com Windows. Nenhuma nova dependência; referências OpenCut usadas conceitualmente, sem copiar código/assets.
- Evidências e pendências em `docs/quality/transformation-progress.md`; roteiro para o responsável em `docs/quality/acceptance-v0.24.md`. ASR sintético nos E2E não comprova qualidade do Whisper real.

## v0.23.1 — 21/10/2026
**Correção da publicação da v0.23.0.** A build da Cloudflare parou por um nome repetido no criador de clipes (TS2451); renomeado. Mesmo conteúdo da v0.23.0. Não testado.

## v0.23.0 — 21/10/2026
**Progresso detalhado em todas as esperas.** Implementado; não testado.

- Toda etapa demorada mostra a porcentagem, quanto tempo já passou e quanto falta, com o nome do que está fazendo em palavras simples.
- Downloads (modelo de legenda, inclusive o de ~1,4 GB do modo Precisa, e a IA no navegador) mostram velocidade (MB/s) e "baixado de total". Se o modelo já estava guardado, aparece "carregando, já guardado neste aparelho".
- Transcrição: trecho atual, minutos de fala já ouvidos e tempo restante (primeiro uma previsão, depois a medida real).
- Etapas sem total conhecido (abrir vídeo, procurar silêncios, preparar o modelo na placa de vídeo) mostram barra andando e o tempo passado; depois de 45 s sem notícia, um aviso de que está demorando.
- Tela de processamento: a porcentagem não volta mais para trás; mostra "Etapa X de 4".
- Exportar: porcentagem, tempo restante e "Fechando o arquivo MP4" no fim. Fechar e abrir o painel não zera o relógio.
- Criador de clipes: progresso por clipe e do lote inteiro, com tempo restante do lote.
- Cópia do vídeo para o navegador, adicionar clipes, pedidos à IA e Armazenamento ganharam o mesmo painel.
- Decisões em `docs/decisions/0024-progresso-detalhado.md`.

## v0.22.1 — 21/10/2026
**Sem campo de link no modo Clipes.** Implementado; não testado.

- O campo "Cole o link" saiu: como o app não baixa de links, ele só confundia. No lugar ficam, sempre à vista, as três formas de conseguir o arquivo (YouTube Studio, pedir ao dono, gravação da live).

## v0.22.0 — 21/10/2026
**Novo modo: Clipes de vídeo longo.** Implementado; não testado. (Publicação reenviada porque a Cloudflare não pegou o primeiro envio.)

- A primeira tela agora tem dois modos: **Editar meus vídeos** (como antes) e **Clipes de vídeo longo**.
- Solte um vídeo de 2 minutos a 2 horas (podcast, aula, live, entrevista). O app transcreve, mede a energia da voz e mostra os melhores momentos, cada um com título, horário, nota e motivos.
- Escolha tamanho (15–30 s, 30–60 s, 60–90 s), quantidade, formato e modelo. Veja cada trecho na prévia e ajuste começo e fim de 3 em 3 segundos, sempre encaixando numa palavra.
- **Baixar pronto** recorta, edita (cortes de silêncio, legenda, título e animações do modelo) e baixa o MP4. **Gerar e baixar os escolhidos** faz vários seguidos. **Abrir no editor** vira um projeto normal, sem transcrever de novo.
- IA opcional reordena os momentos e dá títulos; se falhar, ficam as regras (M4F-1106).
- Link do YouTube: o app explica como conseguir o arquivo (M4F-1105). Não baixa de links.
- A análise do último vídeo longo fica guardada: escolher o mesmo arquivo de novo pula a espera. Aparece em Armazenamento.
- Novos códigos M4F-1101 a M4F-1109. Decisões em `docs/decisions/0023-criador-de-clipes.md`.

## v0.21.1 — 21/10/2026
**Revisão da primeira tela.** Implementado; não testado.

- As faixas da linha do tempo de exemplo passavam da borda da janela; agora ficam dentro, com a agulha no lugar.
- Fundo liso, sem manchas coloridas; janela do editor reta (sem inclinação); botão de escolher vídeos sem brilho exagerado e com cursor de clique.
- Título legível no tema claro.

## v0.21.0 — 21/10/2026
**Primeira tela nova, do zero.** Implementado; não testado. (Publicação reenviada.)

- Abertura com título forte, botão grande "Escolher vídeos" (ou arrastar) e uma prévia de como o editor se parece: modelo animado ao vivo, trilho de abas e linha do tempo com faixas.
- Seções numeradas explicam tudo o que o app faz: como funciona (3 passos), os 8 recursos principais, modelos desenhados ao vivo, privacidade, perguntas frequentes e chamada final.
- Seus projetos salvos aparecem logo abaixo da abertura.

## v0.20.0 — 21/10/2026
**Nada escondido: ações do projeto à vista no topo.** Implementado; não testado. (Publicação reenviada porque a Cloudflare não pegou o primeiro envio.)

- O menu que abria ao clicar no nome do projeto saiu. Agora a barra do topo mostra direto: o nome com um lápis (clique para renomear), **Meus projetos**, **Armazenamento** e **Apagar**, ao lado de Trocar vídeo, Desfazer/Refazer e Exportar.
- Na aba IA, as seções Gancho e "Mudar só um pedaço" já vêm abertas.
- O lápis de corrigir legenda no texto falado aparece sempre (antes só ao passar o mouse).
- Continua recolhida só a "IA opcional (avançado)", marcada como avançada.

## v0.19.1 — 21/10/2026
**Prévia no formato escolhido.** Implementado; não testado.

- Trocar o formato de saída (4:5, 1:1, 16:9) não mudava a forma da prévia: a moldura ficava sempre 9:16 e o vídeo e as letras apareciam esticados. A moldura agora segue a proporção do formato. O vídeo exportado já saía no tamanho certo; era só a prévia.

## v0.19.0 — 21/10/2026
**Menu da esquerda reorganizado, no padrão de CapCut e Canva.** Implementado; os testes automáticos e manuais desta versão ainda não foram executados.

- **Ícones do trilho:** Modelos, Texto, Elementos, Legendas, Mídia, IA, Cores e Versões. Cada aba faz uma coisa só.
- **Texto (novo):** Título, Texto, Chamada e Pergunta prontos; um clique coloca na agulha e já deixa escolhido para arrastar. Antes não havia como adicionar texto pela tela.
- **Elementos (novo):** formas (seta, círculo, retângulo) e emojis em grade, um clique para adicionar.
- **Legendas:** posição (em cima, no meio, embaixo), tamanho, cores de texto, destaque e contorno para todas as legendas, e o texto falado logo abaixo.
- **Mídia:** clipes, formato (vertical/horizontal) e enquadramento juntos, fora do painel da direita.
- **IA:** pedido em texto; gancho e "mudar só um pedaço" em seções recolhíveis na mesma aba (eram as abas Pedido, Gancho e Trechos). Ver [ADR-0022](decisions/0022-menu-lateral.md).

## v0.18.0 — 21/10/2026
**Camadas, onda de áudio real e mover itens na prévia de forma fluida.** Implementado; os testes automáticos e manuais desta versão ainda não foram executados.

- **Mover na prévia (corrigido):** a legenda, o emoji e o título não se moviam. O código pegava a posição inicial com `require`, que não existe no navegador, e emojis e títulos gerados recebiam a posição no formato errado. Agora: clique escolhe, arrastar move, os cantos mudam o tamanho, Shift trava o eixo e o ímã encosta no centro e na área segura. Arrastar uma legenda leva todas as legendas juntas (para tirar do rosto de uma vez). Durante o arraste só a prévia muda; ao soltar, vira uma entrada do desfazer (antes, cada movimento do mouse criava uma).
- **Camadas:** cada texto, emoji ou forma adicionado fica numa camada (faixa) da linha do tempo; a de cima é desenhada por cima. Arraste o item para outra faixa (sempre há uma vazia por cima) ou use "Para cima / Para baixo" no painel. As animações geradas, o vídeo e o áudio têm faixas próprias. Ver [ADR-0021](decisions/0021-camadas-e-edicao-direta.md).
- **Onda de áudio real:** lida das amostras do áudio e desenhada só na parte visível, na resolução da tela. Fica nítida em qualquer zoom, que agora vai até 64×.
- **Arraste mais leve:** a linha do tempo redesenha no máximo uma vez por quadro; as pontas para aparar ficaram com área de pegada maior (para fora do bloco) e uma alça visível; a borda amarela da seleção ficou mais fina.

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
