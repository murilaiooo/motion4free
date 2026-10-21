# Backlog Master: melhorias propostas (sem implementação nesta pesquisa)

**Regra:** cada ID exige issue/PR próprio ou grupo de tarefas estritamente coeso. Confirmar `main` e PRs abertos antes de executar. Status abaixo: **PROPOSTO**, salvo quando cita capacidade existente. Pontuação qualitativa: P0 (fundação), P1 (autoria), P2 (otimização/futuro).

## P0: tornar a base confiável e extensível

| ID | Iniciativa e escopo | Evidência atual → ganho | Aceitação |
|---|---|---|---|
| MASTER-01 | Matemática temporal em frames inteiros e intervalos semiabertos | `engine/timeline.ts` usa segundos; Cutaway usa frames | testes de conversão 23.976/24/25/29.97/30/60, zoom/split/ripple sem gaps; legado abre idêntico |
| MASTER-02 | Comandos de edição tipados + *transaction* + selector de estado | ações distribuídas no Editor; Cutaway, Ektie, Panoptik | cada gesto vira um undo; invalid op não altera state; preview e save seguem mesma revisão |
| MASTER-03 | Preflight de exportação separado do encoder | `media/export.ts`; Cutaway `export/plan.ts` | check de dimensões/codec/track/memória/range antes do encode; erros M4F exclusivos |
| MASTER-04 | Prova frame-exata + consistência preview/export | Canvas/Mediabunny já existem | frame count, first/last, áudio e sync comprovados com fixtures; diferenças visuais definidas por tolerância |
| MASTER-05 | Backup/restauração portátil com manifest e integridade | OPFS + relink já existem; Panoptik engine | exportar projeto + mídia em arquivo local, checksum, versões, recuperação de upload interrompido e mídia ausente |
| MASTER-06 | Medição e fallback por capacidade do navegador | WebCodecs/Whisper e vídeo longo; novo modo v0.22 | perfis low/high, limite RAM, cancelamento/retomada e UI de degradação sem perda de projeto |

## P1: edição audiovisual profissional

| ID | Iniciativa | Dependência | Aceitação |
|---|---|---|---|
| MASTER-07 | Keyframes editáveis para posição/escala/opacidade/rotação; dope sheet inicial | 01–04 | criar/mover/excluir/suavizar; teste na pausa/seek/MP4 e salvar/reabrir |
| MASTER-08 | Transições reais entre clips, presets de entrada/saída e cross dissolve | 01/04 | sem perder frames ou áudio, endpoints coerentes, transição em preview/export |
| MASTER-09 | Timeline avançada: track headers, mute/lock, markers, in/out, ripple e trim mais precisos | 01/02 | todos comandos undoáveis, teclado e drag coerentes, tracks existentes não quebram |
| MASTER-10 | Workspaces Editar/Animar/Finalizar, docks redimensionáveis | 02 e design tokens | trocar workspace não edita vídeo; layout persistente e reset acessível |
| MASTER-11 | Registro de atalhos e command palette com busca | 02 | escopo correto, conflito de hotkey evitado, help pesquisável, teclado Windows/Mac |
| MASTER-12 | Áudio multifaixa, ganho por faixa, música/BGM e ducking de voz | 01/03/04 | nível sem clipping, fades, silence, transições e sync no arquivo final |
| MASTER-13 | Marcadores de batida (BPM, offset e energia), corte sugerido sem aplicar silenciosamente | 09/12 | marcadores auditáveis, 3 padrões musicais, preview da proposta, cancelamento |
| MASTER-14 | IA por comandos validados com dry-run, diff visual e aprovação por lote | 02/04 | agente só aplica operações permitidas; mostrar antes/depois; um undo reversível |
| MASTER-15 | Transcrição como superfície de edição: word-protect, multiword select, importar/exportar SRT/VTT | 01/02 e transcrição existente | selecionar palavras altera corte sem dividir palavra; legendas correspondem à mídia |
| MASTER-16 | Biblioteca de elementos e efeitos autorais: buscas/filtros, agrupamentos, favoritos e propriedades | 07/10 | presets editáveis e realmente distintos; assets licenciados; sem dependências pagas |
| MASTER-17 | Enquadramento assistido offline e safe zones para rosto/legenda, opt-in de modelos | 04/06 | comparação com enquadramento manual; respeitar limites de GPU/IA e fallback sem tracking |

## P1 adicional: descobertas OpenCut Classic (adendo 21/10)

| ID | Iniciativa | Dependência | Aceitação |
|---|---|---|---|
| MASTER-22 | Guias visuais de plataforma (TikTok / Reels / Shorts), grid e safe zones opcionais | layout/framing atual, 04/10 | guias de interface não entram no MP4; presets por plataforma realmente desenhados e testes nos quatro formatos; não presumir overlays de Reels/Shorts prontos no upstream |
| MASTER-23 | Máscaras editáveis por objeto (rectangle, ellipse e feather inicial, editor de handle) | 04/07, render determinístico | preview idêntico a MP4 em frames de borda e de keyframe; shape preservado no projeto; máscara não afeta objetos não selecionados |
| MASTER-24 | Registro de efeitos tipados + pipeline de passes, com protótipo GPU opcional | 03/04/06/07, validar compatibilidade WebGPU | pelo menos blur/color deterministic preview/export; fallback Canvas2D, métricas de RAM/tempo e zero dependência de GPU/servidor obrigatório |

**Referência técnica:** [OpenCut Classic](08-opencut-deep-dive.md), projeto MIT mas arquivado. Não é convite para reescrever o motor em Rust/WGPU.

## P2: ampliar confiança, acabamento e interoperabilidade

| ID | Iniciativa | Dependência | Aceitação |
|---|---|---|---|
| MASTER-18 | QA artístico lado a lado e avaliação cega por nicho | 04/16 | métricas + pareceres humanos, sem alegar qualidade master por testes de unidade |
| MASTER-19 | Exportações auxiliares: SRT/VTT, project manifest e faixa selecionada | 03/05/15 | arquivos importáveis, legendas por frame/tempo e nenhum upload |
| MASTER-20 | Clipes longos (v0.22): melhorar score, revisão de trechos, tempo e bateria térmica | 04/06 | preservar o que PR #66 criou, medir acurácia de cortes, ASR, memória e export dos escolhidos |
| MASTER-21 | Higiene de documentação, versão/CI e guias por modo | contínuo | README/PRODUCT refletem main, check de docs e roteiro leigo, nunca 'testado' se não rodou |

## Marcos recomendados

**M1, Fundamento (MASTER-01 a 06, 21):** contrato temporal, erro/preflight, QA de mídia e projeto. PRs pequenos: A tempo; B preflight; C portabilidade; D capability. Não refazer a UI na mesma mudança.

**M2, Ferramentas (07, 09, 10, 11):** primeiro keyframes puramente na engine e fixture; depois inspector, timeline visual, workspaces. Separar cada passo em PR e avaliação.

**M3, Produção audiovisual (08, 12, 13, 15, 19, 22):** transições, áudio/beat, legendas e formatos. Evitar fazer todos em uma PR.

**M4, Direção criativa inteligente (14, 16, 17, 20, 23, 24):** IA como proponente reversível, mais qualidade artística, refinamento de clipes longos; M4 pode iniciar spikes paralelos que não mudem runtime.

**M5, Aprovação de produto (18):** comparação cega com material real e validação por usuários em diferentes máquinas.

## Ordem mínima para próxima execução

1. `MASTER-01`: definir timebase sem quebrar `EditPlan`, adicionar testes puros de frame e migração, **sem** troca de player.
2. `MASTER-03`: preflight puro reutilizando `export.ts`, flags de capacidade, export fixture de duração ímpar.
3. `MASTER-07`: protótipo de keyframe em objeto `added` de `core/edits.ts`, fora do render final até prova WYSIWYG.
4. `MASTER-10`: só após ações separadas, interface workspace/resizable sobre CSS existente.

## Anti-backlog: o que não pedir novamente

- Recriar importação multi-clipe, quatro proporções, OPFS, história/versões, seleção de cenas ou correção de legendas. Já existem.
- 'Fazer clipes de vídeo longo' sem especificar regressão ou melhoria. Implementado no PR #66, não testado na pesquisa.
- Instalar outro renderizador completo, framework UI ou migrar tudo para monorepo sem necessidade demonstrada.
- Copiar uma biblioteca de templates/assets sem provenance, fontes e pesos conferidos.

## Regras de aceite transversais

Cada PR inclui: paths alterados; uma mudança por domínio; testes unitários de invariantes; teste E2E novo e **não repetido sem propósito**; arquivo MP4 real inspecionado para mudanças de mídia; validação acessível no Chrome/Edge; compatibilidade de projetos; checklist de license/notices; relato de tradeoffs; manual simples de validação do produto. Respeitar `AGENTS.md` e limites de cota do CI. Se não houver ambiente para rodar teste, declarar 'não executado'.
