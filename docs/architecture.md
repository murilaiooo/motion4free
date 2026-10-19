# Arquitetura proposta — Motion4Free

**Estado: PROPOSTA, não implementada.** Especificação central em [Superpowers](superpowers/specs/2026-10-18-motion4free-design.md).

## Mapa de execução
```text
Site estático (Cloudflare Pages é candidato; sem deploy configurado)
  ├─ UI: importação, chat, timeline, preview, jobs e exportação
  ├─ Asset Loader: manifestos/chunks/cache + Service Worker
  ├─ Storage: OPFS/IndexedDB + arquivos escolhidos pelo usuário
  ├─ Media Workers: metadados, proxy, waveform, transcrição local,
  │                 detecção de rosto, edição e codificação
  ├─ Editorial Engine: regras + EDL + constraints + catálogo semântico
  ├─ Decision Router:
  │     local/rules -> WebLLM se capaz -> free API opcional e autorizada
  ├─ Motion Renderer: composições declarativas, captions, 2D/3D, áudio
  └─ Quality Gate: verificação da timeline, amostra e MP4 final
```

## Separação obrigatória
1. **Plano declarativo:** descrição versionada do projeto; conteúdo fornecido por IA tratado como entrada não confiável.
2. **Motor determinístico:** aplica operações idempotentes, valida ids/tempos/licenças, mantém undo/redo.
3. **Renderizador:** preview por frame e export devem usar mesmas regras de tempo e composição, evitando divergência visual.
4. **Orquestrador de IA:** perguntas pequenas, métricas por tarefa, cache, budget e fallback; nunca acesso irrestrito ao filesystem/código.

## Opções arquiteturais examinadas
- **Browser-only:** sem instalação e inferência/render locais; limitação de memória, codec e hardware. Candidato principal.
- **Servidor remoto:** amplo suporte, mas custo de computação/banda inviável como padrão de zero custo em escala.
- **Híbrido com aplicativo auxiliar:** aumenta compatibilidade, mas contraria requisito de instalação zero. Alternativa futura, não MVP.

## Tecnologias a testar, não dependências aprovadas
- WebCodecs + Mediabunny para codificação/leitura compatíveis.
- WASM/FFmpeg.wasm apenas onde API nativa não resolver.
- WebGPU/Transformers.js/WebLLM para análise e inferência local.
- Canvas/WebGL/CSS/SVG/GSAP e eventualmente Three.js para composições.
- Service Worker, OPFS, IndexedDB, cache em chunks, API de acesso a arquivos.
- OpenReel como possível base de timeline, **sujeito a avaliação de compatibilidade, manutenção e licença**.
- Catálogo/Editonny como referência de regras/cenas; o código Python não migra automaticamente ao navegador.

## Fluxos de dados e privacidade
Arquivos de vídeo são lidos localmente. Dados derivados (transcrições, embeddings, keyframes) ficam no armazenamento da origem. Sem envio externo por padrão; uso de API externa deve mostrar dados transmitidos, provedor, finalidade e efeito da revogação. Chaves pessoais não podem ser persistidas sem mecanismo seguro; chaves do mantenedor nunca ficam no cliente público.

## Failure modes
Sem WebGPU -> regras e/ou CPU com desempenho reduzido. Sem codec -> outro formato/resolução suportado ou mensagem honesta. Quota externa esgotada -> modo local e nenhuma chamada paga. Cache removido -> baixar módulos novamente, solicitar reimportação dos originais. Export com falha -> preservar projeto e diagnóstico.

## Comunicação entre módulos
IDs de origem imutáveis; trechos por tempo e frame; esquema versionado. Eventos de progresso/cancelamento; snapshots de timeline; operações determinísticas (`select_segment`, `cut_pause`, `add_caption`, `place_motion_scene`, `mix_audio`, `export`). Nunca montar comandos de shell a partir de saída da IA.

## Qualidade e rastreabilidade
Toda escolha semântica registra origem da frase, alternativas, modelo/versão do prompt, evidência e razão. Métricas reproduzíveis alimentam [benchmarks](ai/evaluation.md), evitando otimizações baseadas em impressão.


## Revisão premium: direção artística além de templates (proposta)
O pipeline original `regras -> escolha do scene_id` é útil para casos simples, mas **insuficiente como arquitetura criativa completa**. Novo pipeline:
```text
Prompt livre + preset editável + referências do usuário
  -> CreativeBrief validado
  -> AI Creative Director (conceito, StyleDNA, storyboard)
  -> Creative Planner (shot list, evidências, assets e ritmo)
  -> Creative Composer (SceneGraph seguro, primitives/recursos curados)
  -> Render local (mesmo relógio temporal em preview e MP4)
  -> Technical QA + Creative Review visual
  -> revisão focal por prompt/controles de cena
```
IA continua sem executar JS/shell arbitrário. O catálogo anterior é um conjunto de **primitives + cenas de referência**, não um mecanismo de saída única. Renderizador aceita combinações/contextualização, com limites de segurança e verificações de performance/licença.

Tecnologias de autoria a testar: Motion Canvas, PixiJS, Theatre.js, Motion/GSAP, Three.js/R3F, dotLottie Web, OpenTimelineIO (modelo de timeline). Nenhuma escolhida sem POC de render determinístico, seek, export e licenciamento.

Ver [Creative Composer](creative/composition-engine.md), [auditoria](reviews/2026-10-18-premium-creative-audit.md) e [ADR-0004](decisions/0004-creative-director-proposal.md). A especificação final permanece aguardando aprovação.
