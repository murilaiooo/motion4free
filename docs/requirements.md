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


## P0 criativo adicional — bloqueador de produto (proposto)
- Entrada equivalente via **prompt livre e presets de estilo editáveis**, com prioridade às opções escolhidas pelo usuário.
- `CreativeBrief` unificado, com público, objetivo, linguagem, formato, ritmo, intensidade, avoid-list e referências.
- `StyleDNA` consistente por projeto e opção de preservar identidade do canal em futuras edições.
- **AI Creative Director** produz plano visual/storyboard e decisões semânticas; não só ranking de templates.
- **Creative Composer/SceneGraph** permite composições distintas a partir de primitives/ativos aprovados (tipografia, vetor, imagens autorizadas, 2D/3D, máscaras, gráficos, materiais e keyframes).
- Presets e IA podem variar layout e organização narrativa, não só cor/fonte/zoom.
- Referências do usuário podem inspirar a estética respeitando direitos; voz/imagem e arquivos originais permanecem protegidos.
- Ajuste por trecho via prompt e controles manuais; locks e `avoid_styles`; undo/redo não destrutivo.
- **Prova criativa obrigatória:** mesmo conteúdo, 3 briefings distintos, composições distintas e coerentes, avaliadas cegamente por especialistas. Um MP4 válido não basta para dizer que MVP premium está pronto.
- Medir repetição entre vídeos, estética genérica, uso irrelevante de efeitos, diversidade visual, aderência ao brief, qualidade dos movimentos/easing e harmonização de áudio/visual.
- IA “no background” significa processamento interno na sessão/aplicação, **não garantia de continuar executando depois que aba/navegador fechar**.
- Sem cota/hardware adequado, informar degradação criativa; não rotular fallback determinístico como “equivalente a motion designer experiente”.

Os P0 técnicos acima continuam como pré-requisitos. Ver [auditoria](reviews/2026-10-18-premium-creative-audit.md) e [UX](creative/presets-and-prompts.md).

## Propostas de aceitação derivadas do Editonny (revisão de 19/10/2026)

**Requisitos complementares em revisão**, sem alterar os gates P0/P1 existentes nem declarar funções entregues. Fontes, riscos e limites no [estudo fixado do upstream](research/updates/2026-10-19-editonny-guide.md).

- **Builder**: prompt, preset e controle por trecho produzem um único briefing validado, editável, versionado e com diff/undo; instruções explícitas, inclusive “sem efeitos”, não podem ser sobrescritas implicitamente.
- **Idioma**: rótulos traduzidos não mudam chaves estruturais, conteúdo da gravação, referências ou proibições do usuário.
- **Estado**: quando storage falhar, mostrar claramente que as alterações estão apenas na sessão; projetos/mídia permanecem locais por padrão. Links de presets públicos não carregam dados privados.
- **Timeline**: waveform medida da gravação e captions com timestamps reais, sem transformar animações demonstrativas por intervalos em engine de vídeo.
- **Design da UI**: identidade original e contratos de tokens, variantes e showcase após definição da stack; teste de teclado, contraste, foco e reduced-motion.
- **Qualidade**: QA de interface e QA audiovisual separados; teste do MP4 real, paridade de frames, fala e legibilidade final, além de avaliação cega criativa.
- **Compatibilidade/custo/licença**: não exigir Next.js, backend, CLI ou API paga por causa do upstream. Componentes, assets, fontes, modelos e codecs passam por avaliação individual de licença, funcionalidade e desempenho.

Critérios de teste detalhados em [quality.md](quality.md) e prioridade de prova em [roadmap.md](roadmap.md).
