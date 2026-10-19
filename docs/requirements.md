# Requisitos e aceitação

## Prioridades
**P0 (primeira prova útil)**
- Importar arquivos locais sem upload obrigatório.
- Inspecionar resolução, duração, orientação, codec, áudio e compatibilidade antes de editar.
- Extrair áudio e obter transcrição com tempos de palavras, marcando incerteza.
- Identificar respirações/pausas candidatas sem mutilar palavras ou apagar pausas expressivas.
- Produzir EDL/timeline não destrutiva, com fonte original preservada.
- Cortar, inserir legendas, aplicar ao menos uma cena sincronizada e exportar um MP4 real localmente.
- Renderização de prévia representativa e verificação do resultado exportado.
- Salvar/reabrir projeto local com aviso de riscos de despejo de cache.

**P1 (MVP Reels)**
- Interpretar pedido por linguagem natural em operações estruturadas.
- Gancho candidato nos primeiros 3 s, com preservação semântica e plano alternativo quando não existir trecho adequado.
- Perfil 9:16, tipografia/legendas seguras, posicionamento baseado em rostos.
- Biblioteca de motion design versionada, categorizada semanticamente, com entradas e saídas previsíveis.
- Roteamento para IA local/serviço gratuito com limite por tarefa, fallback e cache de decisões.
- Editar apenas trecho afetado ao receber uma revisão.
- Arquivo final e arquivo de projeto editável.
- Progresso de download/instalação de assets no navegador (download opcional por módulo).

**P2 (amadurecimento)**
- Perfis por gênero (aula, anúncio, história, tutorial).
- Multicâmera, cortes avançados, proxies e render incremental.
- Modo móvel com funções limitadas conforme capacidade.
- Biblioteca pessoal e importação de recursos com direitos.
- Relatórios de qualidade e comparação com referências.

## Requisitos não funcionais
- Sem credenciais secretas embutidas no bundle da aplicação.
- Browser com Service Worker, OPFS/IndexedDB, worker threads e WebGPU/WebCodecs conforme suporte efetivo.
- Cabeçalhos COOP/COEP quando forem necessários para SharedArrayBuffer; testar compatibilidade com recursos cross-origin.
- API de edição declarativa: modelos geram dados validados, **nunca JavaScript/Python/shell executável arbitrário**.
- Isolamento e limite de memória para vídeos e modelos; cancelamento, reabertura e recuperação previsíveis.
- Acessibilidade mínima: operação por teclado, estado de tarefas legível, erros claros.
- Sem exigência de cadastro para edição local.

## Critérios de aceitação sugeridos (precisam de confirmação por benchmark)
- Exportar uma edição vertical real com fala, legendas, cortes e animação, totalmente no navegador-alvo.
- Sem envio do vídeo bruto a nenhum servidor por padrão.
- Cortes não removem sílabas nem alteram significado nos exemplos testados.
- Texto legível, dentro de zona segura validada; sem cobrir o rosto desnecessariamente.
- Qualquer frase/número exibido como fato tem origem verificável em mídia ou dados explicitamente fornecidos.
- Abertura 0–3 s exibe o trecho escolhido ou um fallback seguro; não inventar gancho.
- No modo offline ou sem API externa, usuário consegue editar e exportar com funcionalidades reduzidas.
- Resultados inspecionados por avaliadores humanos, com métricas e amostras reproduzíveis.

## Cenários negativos obrigatórios
- Negação, correção e hesitação (“não foi dez, foram dois”).
- Frase que depende de contexto anterior.
- Fala com sotaque, ruído, música e palavras baixas.
- Numeração que é relato de faturamento, não preço.
- Vídeo sem fala, com várias pessoas ou sem gancho convincente.
- Movimento de cabeça que cruza a área do overlay.
- Falta de GPU, codec indisponível, baixa RAM, quota de storage ou API esgotada.
