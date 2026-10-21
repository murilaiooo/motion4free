# Auditoria de referências GitHub: arquitetura, código e aproveitamento

**Inspeção:** 21/10/2026, acesso aos arquivos reais por GitHub (README, árvores, LICENSE, fontes citadas). Não foram rodadas builds de terceiros. As classificações de produto são do projeto upstream, não resultado de teste. Links detalhados em [07-source-map.md](07-source-map.md).

## Grupo A: referências prioritárias

### 1. [FreeCut, walterlow/freecut](https://github.com/walterlow/freecut), MIT

Estrutura examinada: `src/features/`, `src/runtime/`, `src/infrastructure/`, `src/shared/`, `DESIGN.md`, `src/config/editor-workspaces.ts`, `src/config/hotkeys.ts`, componentes de keyframe. Separação por features e contratos de runtime, edição multifaixa, keyframes, previews e workspace local. `editor-workspaces.ts` define três layouts edit/color/motion, mantém estado do documento separado do estado visual e migra layouts antigos; `hotkeys.ts` centraliza comandos, adapta modificadores entre plataformas e exporta/importa preferências. O design mantém fundo neutro e acento disciplinado, favorecendo leitura da mídia. O código de motion separa camada, propriedade e tempo.

**Aproveitar:** modelo de workspace sem alterar projeto (MASTER-10); registry de hotkeys (MASTER-11); editor de keyframes / dope sheet (MASTER-07); isolamento UI/runtime (MASTER-02). **Não fazer:** portar engine toda ou introduzir monorepo. A complexidade e a memória merecem spike de baixo risco. Referência com mais utilidade prática para a interface.

### 2. [Cutaway, S07K/cutaway](https://github.com/S07K/cutaway), MIT

Fontes: `docs/ARCHITECTURE.md`, `packages/timeline-engine/src/operations.ts`, `apps/web/src/features/timeline/geometry.ts`, `packages/export-engine/src/plan.ts`, `packages/ui/src/tokens.css`, testes por domínio. O projeto versiona JSON, normaliza entidades, representa tempo em frames inteiros e intervalos [início, fim) e separa operações puras da UI. `splitClip` ajusta `sourceInFrame`, evitando mostrar frames errados após split; `geometry.ts` isola viewport, hit-test e snapping; `plan.ts` valida contagem, dimensões, conteúdo e alertas **antes** de alocar encoder.

**Aproveitar:** contratos de operações temporais, preflight do export (MASTER-01/03/04) e testes matemáticos separados do React. `tokens.css` ensina disciplina de tokens, sem trocar a paleta atual. Cuidado com diferenças de modelo de projeto: adaptar, não substituir `EditPlan` de uma vez.

### 3. [OpenReel, afatabe/openreel](https://github.com/afatabe/openreel), MIT

Fontes: `apps/web/src/components/editor/inspector/KeyframesSection.tsx`, `BeatSyncSection.tsx`, `AudioDuckingSection.tsx`, `AutoReframeSection.tsx`, `apps/web/src/bridges/`, `packages/core/`. UI apresenta propriedades animáveis (posição, escala, rotação, opacidade, parâmetros de efeitos), curvas/easing, batidas, presets de ducking e opções de enquadramento. `BeatSyncSection` apresenta marcadores e corte rítmico; `AudioDuckingSection` possui thresholds, redução e ataque/release parametrizados. O motor usa bridges/stores e Mediabunny, parecido com o contexto browser atual.

**Aproveitar:** contracts e UX de keyframes (MASTER-07), mixer/ducking (MASTER-12), detecção de batidas (MASTER-13), reframe offline experimental (MASTER-17). **Risco:** funcionalidades de UI não provam eficiência, qualidade do tracking nem funcionamento integrado. Evitar portar muitos módulos ao mesmo tempo. `FairArena/fairarena-video` apresenta estrutura/aviso MIT semelhantes e copyright igual: investigar linhagem antes de contar como duas arquiteturas independentes.

### 4. [Panoptik, Panoptik-Studio/Panoptik](https://github.com/Panoptik-Studio/Panoptik), aplicação AGPL-3.0; **packages/engine MIT**

Fontes: `apps/web/src/webmcp/snapping.ts`, testes de grounding/validation/batch, `packages/engine/src/projectPackage.ts`, licença raiz e do engine. `snapping.ts` valida operações estruturadas, protege limites de palavras e tempos já cortados, recalcula timebase e registra rejeições; `projectPackage.ts` prepara arquivo de projeto com mídia e histórico. Excelente modelo de 'IA edita com as mesmas ações da UI' e de audit trail.

**Aproveitar:** *ideias/contratos* de batch com preview/diff/rejeições (MASTER-14), portable project (MASTER-05) e proteção por palavra (MASTER-15). **Não copiar UI AGPL** em produto MIT sem análise jurídica; apenas considerar arquivo de engine MIT com notices/compatibilidade verificados.

## Grupo B: UX e tarefas especializadas

### 5. [DesignCombo/VideoEditor, ViktorEj/VideoEditor](https://github.com/ViktorEj/VideoEditor), licença comercial/restrita

Árvore: `editor/src/components/editor/timeline/` separa canvas, tracks, clips, guidelines e handlers; `editor/src/components/editor/properties-panel/` separa propriedades por tipo, `shortcuts-modal.tsx` centraliza catálogo visual, `editor/src/stores/timeline-store.ts` normaliza `clips` em dicionário. `drag-handler.ts` aplica guias de snapping e feedback da faixa alvo; `thumbnail-cache.ts` ilustra cache básico (sem eviction). Código do editor tem licença específica personal/noncommercial; raiz DesignCombo License também é restrita. **Somente inspiração de layout/fluxo**, sem cópia de código/estilo/asset (MASTER-09/11).

### 6. [Ektie react-video-timeline-editor](https://github.com/Ektie/react-video-timeline-editor), AGPL-3.0

`packages/editor/src/useTimelineEngine.js` usa reducer puro: `live` muda visual durante drag, `endDrag` grava uma única etapa, `revision` dispara salvamento fora do reducer, evitando efeito duplo em React StrictMode. Boa referência para seleção múltipla e operações de timeline. **Reproduzir o comportamento de forma independente**, não incorporar sem avaliar obrigações AGPL.

### 7. [Magnetic, ucsandman/Magnetic](https://github.com/ucsandman/Magnetic), MIT, Electron desktop

`README.md`, `DESIGN.md`, estrutura `src/shared/timeline` e `src/renderer`. Timeline magnética, ferramentas de slip/roll, monitores source/sequence, marcadores, biblioteca de mídia, atalhos, undo e layout redimensionável. **Usar como referência de gramática NLE e densidade do editor** (MASTER-09/11/16), não trazer dependência Electron/FFmpeg nativo ao navegador. Conteúdo readme é declaração upstream até testes.

### 8. [Rescript, wassgha/rescript](https://github.com/wassgha/rescript), PolyForm Noncommercial 1.0.0

README e árvore `app/`, `components/`, `lib/`, `workers/`: edição textual baseada em palavras e exportação de legendas/projetos em diversos formatos. Alinha-se à UI existente de `Transcript`. **Só conceito UX e interoperabilidade**, sem código, pois licença não comercial é restritiva (MASTER-15/19).

### 9. [OpenChatCut, 0xsline/OpenChatCut](https://github.com/0xsline/OpenChatCut), AGPL-3.0

README, `src/editor/`, `shared/`, `remotion/` (estrutura) apontam editor com comandos imutáveis, IA aplicando propostas e export. **Referência para arquitetura de comandos e consentimento em edição assistida** (MASTER-14), não migrar para Electron/Remotion e não copiar app AGPL.

### 10. [editorvideo-ai, metiutek/editorvideo-ai](https://github.com/metiutek/editorvideo-ai), MIT

`backend/vedit/keyframes.py` define chaves, easing, validação e compilação determinística para expressões ffmpeg. README descreve ferramentas de agente, visualização de frame/grid e operações idênticas na UI. **Inspirar a revisão visual da IA e semântica de keyframes** (MASTER-07/14), sem serviço Python/FFmpeg obrigatório.

## Grupo C: já inventariado ou de menor compatibilidade

- [Editonny](https://github.com/soumatheusgomes/editonny): já auditado extensamente em `docs/research/updates/2026-10-19-editonny-guide.md` e `docs/research/upstream-implementation/`. Não duplicar plano: consumir o guia existente, usar storyboard, StyleDNA e QA.
- [Mediabunny](https://github.com/Vanilagy/mediabunny): **já integrado** ao Motion4Free. Evoluir pipeline de export existente, não instalar encoder paralelo (licença MPL-2.0 da lib).
- [Transformers.js](https://github.com/huggingface/transformers.js) e [WebLLM](https://github.com/mlc-ai/web-llm): **já dependências**, validar hardware, fallback, tempo e licença dos pesos antes de crescer catálogo.
- [FairArena/fairarena-video](https://github.com/FairArena/fairarena-video): árvore e LICENSE revisados, aparenta compartilhar família de código com OpenReel; não contabilizar como fonte independente sem comparação de commits.
- [ReactVideoEditor/free-react-video-editor](https://github.com/reactvideoeditor/free-react-video-editor): README menciona licença própria e Remotion, potencial licença paga. Pouco ganho frente ao engine atual. **Não integrar**.
- [OpenVideo, openvideodev/react-video-editor](https://github.com/openvideodev/react-video-editor): fonte de ideia Pixi/UI, **licença por faixa de organização** e serviços/API opcionais; não integrar como dependência sem revisão específica.
- [Remotion](https://github.com/remotion-dev/remotion): arquitetura React para vídeo, mas regras de licenciamento em certos usos e render frequentemente separado; manter como inspiração, não core.
- [autobroll, andriidrok1/autobroll](https://github.com/andriidrok1/autobroll): pipeline de takes/legendas/B-roll com servidor e Remotion. Ideias para conteúdo e separação de pipeline, não substituto browser-first.

## Seleção prática

| Tema | Fonte mais adequada | Método seguro |
|---|---|---|
| Tempo/frame/export | Cutaway | Adaptar algoritmos/contratos puros; validar MP4 |
| Workspace e teclado | FreeCut | Usar UX/API como guia, preservar CSS atual |
| Keyframes/motion | FreeCut + OpenReel | Spike isolado e dados próprios |
| Áudio/música | OpenReel | Novo domínio multifaixa e análise |
| IA estruturada | Panoptik + editorvideo-ai | Operações com schema e simulação/diff |
| Timeline & inspector | FreeCut + Magnetic + DesignCombo | Analisar comportamento, não copiar UI restrita |
| Pacote de projeto | Panoptik engine MIT + Cutaway | Versão, integridade, portabilidade |
| Narrativa e templates | Editonny já estudado | Revisar qualidade real, não quantidade |

**Observação:** 'MIT' no topo de um repositório não licencia automaticamente fontes, modelos, bibliotecas transversais ou assets. Ler [06-licenses-and-provenance.md](06-licenses-and-provenance.md).
