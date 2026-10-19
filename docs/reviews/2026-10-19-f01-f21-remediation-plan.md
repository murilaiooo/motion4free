# Plano verificável de fechamento — 21 achados da auditoria premium

**Data:** 2026-10-19. **Status:** plano de remediação proposto, **não implementado nem aprovado como plano Superpowers**.

**Fonte:** [Auditoria F01–F21](2026-10-18-premium-creative-audit.md). O repositório permanece em fase documental. **Zero achados estão comprovadamente corrigidos no aplicativo**, pois ainda não existe produto em execução. “Especificado” significa somente que há design escrito.

## O que significa “100%”
- **100% de cobertura auditável:** todos os achados F01–F21 têm responsáveis lógicos, critérios de aceite e evidências de testes.
- **100% dos bloqueadores resolvidos:** nenhum bloqueador técnico, de segurança, licença, custo ou direção artística sem prova antes do lançamento.
- **Não significa** prometer originalidade absoluta, qualidade humana superior em todos os vídeos, viralidade ou IA gratuita ilimitada.
- Um achado só fecha com **arquivo/PR/código e teste real**; documento, issue e biblioteca instalada são apenas preparação.
- Proposta arquitetural segue exigindo aprovação da spec e writing-plans pelo Superpowers antes de programar.

## Matriz de 21 correções, provas e estado

| ID | Prioridade | Ação concreta | Prova de fechamento | Estado |
|---|---|---|---|---|
| F01 | Bloqueador | Creative Director + SceneGraph e compositor procedural, além de templates | 3 direções realmente distintas da mesma gravação, não apenas cores/zoom | Design escrito; **não testado** |
| F02 | Bloqueador | Gate de **qualidade profissional** separado da prova de MP4 | Comparação cega com edições profissionais e baseline Editonny, limiares predefinidos | Rubrica escrita; **não executada** |
| F03 | Alta | UX prompt livre, preset editável e combinação dos dois | 10 casos de comandos contraditórios e overrides respeitados | UX escrita; **não implementada** |
| F04 | Alta | CreativeBrief → StyleDNA → Storyboard → SceneGraph → EditPlan | Contratos tipados, versões, serialize/reopen e render consistente | Contratos conceituais; **não implementados** |
| F05 | Alta | Passagem global de direção artística antes das microdecisões | Coerência tipográfica/ritmo/cor/câmera em cenas avaliadas cegamente | Design escrito; **não testado** |
| F06 | Alta | Gramática visual com tipografia, shapes, masks, charts, shaders, 2D/3D e animação temporal | Scene factory compõe 3 estruturas distintas com seek/export frame a frame | Design escrito; **não implementado** |
| F07 | Alta | Benchmark de originalidade, hierarquia, timing/easing, áudio e aderência | Rubrica por especialistas; medir também piores casos e concordância | Critérios escritos; **sem dataset** |
| F08 | Alta | Loop render sample → checagem de frames/áudio → reparo focal sob orçamento | Definir limite de iterações, gatilhos, evidência de correção e stop rule | Parcialmente descrito; **sem orçamento validado** |
| F09 | Alta | Spike comparativo de OpenReel, Mediabunny, Motion Canvas, PixiJS, Theatre Core, 3D/dotLottie | Mesmo exemplo rodando e exportando; licença e RAM verificadas | Inventário escrito; **sem integração** |
| F10 | Alta | IA ativa como diretora global + revisão contextual, com fallback explicável | Planos com StyleDNA/storyboard/razão e degradação honesta sem API | Design escrito; **não implementado** |
| F11 | Alta | Priorizar dois POCs paralelos em gates: MP4 browser + autoria visual premium | Ambos comprovados antes de declarar MVP viável | Roadmap atualizado; **não executado** |
| F12 | Alta | AssetResolver de mídia própria/licenciada com manifest, licença/hash/cache/fallback e busca contextual | Para todo asset na demo: proveniência, licença, disponibilidade e substituto | Ideia descrita; **sem pipeline** |
| F13 | Crítica | Custo 0 robusto: uso local, orçamento por edição, políticas de API e perfil de hardware | Simular quota=0, GPU=0, cache perdido e carga mensal plausível | Risco identificado; **não medido** |
| F14 | Média | Reedição por trecho, locks, diff e undo/redo | Alterar 12–18s sem tocar no resto; preservar sync e mídia original | UX escrita; **não implementada** |
| F15 | Média | Ferramenta interna de autoria/preview por frame, galeria de exemplos e curadoria de cena | Cena só entra no catálogo com aprovação de arte, licenciada e testada | Processo sugerido; **sem ferramenta** |
| F16 | Média | Registro de anti-repetição e riscos “AI slop” | Fingerprints intra-projeto e exame cego de repetições injustificadas | Riscos escritos; **sem validação** |
| F17 | Média | Triagem de issues históricas duplicadas, vínculos e motivo de fechamento | Backlog único, issues ativas ligadas ao F-ID, fechado ≠ entregue | Backlog existe; **triagem pendente** |
| F18 | Média | Rever GitHub Settings, definição de licença, labels, branch rules e security | Checklist verificável de configurações autorizadas | Documentação existe; **admin pendente** |
| F19 | Média | Storyboard contextual de B-roll/infográficos/prova, priorizando mídia do usuário | Cada imagem tem justificativa, evidência e direito de uso | Briefing cita B-roll; **sem motor** |
| F20 | Média | ReferenceBoard de exemplos visuais autorizados e aplicação por trecho | Prompt+referência altera composição, preserva restrições e evita cópia indevida | UX escrita; **não implementada** |
| F21 | Bloqueador de evidência | Implementar e testar aplicativo/compatibilidade/qualidade/custo | Export real, benchmarks e budget documentados por dispositivo | **Nenhum código do editor** |

## Prioridade e dependências
### Etapa G0 — Design e direitos
- Revisar [spec principal](../superpowers/specs/2026-10-18-motion4free-design.md), [adendo premium](../superpowers/specs/2026-10-18-premium-personalization-amendment.md) e este fechamento.
- Validar os contratos CreativeBrief/StyleDNA/Storyboard/SceneGraph/AssetManifest, a regra de prioridade do prompt e o padrão de dados. Aprovar especificação com Superpowers.
- Auditar licença de código e assets **antes de dependência definitiva**. Descoberta: [OpenVideo LICENSE](https://github.com/openvideodev/react-video-editor/blob/main/LICENSE) não é MIT: possui licença própria com elegibilidade/restrições. [Motion Canvas video rendering](https://motion-canvas.io/docs/rendering/video/) depende de exportador FFmpeg com servidor Node no fluxo padrão, portanto não provar browser-only pelo README.
- Definir o hardware de referência e critérios de teste cego. Só depois invocar writing-plans.

### Etapa G1 — Duas provas críticas
**POC A (editor/render):** importar, cortar, legendas, áudio, uma cena, seek, MP4 local exportado. Verificar WebCodecs/encoder, memória e licenças.
**POC B (qualidade criativa):** 1 gravação + 3 briefings/presets contrastantes → 3 storyboards e composições de motion substancialmente distintas, coerentes e avaliadas por designers.
Provar os dois antes de avançar.

### Etapa G2 — Editor criativo funcional
Editor não destrutivo, scene graph versionado, asset resolver, overlays/3D/B-roll, keyframes/easing, locks, presets e referências. Design system **flexível**, não clonagem de templates. A engine de render e a de preview compartilham relógio semântico.

### Etapa G3 — Inteligência e revisão
IA com direção global + decisões locais, modelos gratuitos benchmarkados por tarefa, heurísticas, shortlists, saída estruturada, cache, orçamento de revisão e loop de correção com provas. Quota=0 não bloqueia o editor, mas a qualidade criativa limitada deve ser apresentada honestamente.

### Etapa G4 — Beta e lançamento
Avaliar dataset autorizado com português/inglês, negações, números, B-roll e múltiplos estilos. Revisão cega contra Editonny e referências humanas, relatório de pior caso, licenças e segurança. Simular hardware fraco e custos de distribuição.

## Critérios de qualidade para predefinir com avaliadores
- Sem fatos inventados, negações trocadas, sílabas cortadas ou cenas tecnicamente inválidas nas suítes de referência.
- Fidelidade do projeto aos elementos explicitamente solicitados, incluindo “não use X” e segmentos travados.
- Paridade temporal de preview/export para amostras críticas, com tolerância de frames especificada no plano de testes.
- A qualidade média *e* os piores resultados devem ser avaliados por profissionais; não basta JSON válido ou visual “bonito”.
- Diversidade não pode surgir de ruído aleatório; avaliar diferença **intencional** entre briefings.
- Não alegar superioridade aos profissionais antes dos resultados cegos.

## Repositórios e licenças que exigem avaliação
- **Candidatos browser-first:** [OpenReel](https://github.com/Augani/openreel-video) (MIT), [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0), [PixiJS](https://github.com/pixijs/pixijs) (MIT), [Motion Canvas](https://github.com/motion-canvas/motion-canvas) (MIT), [Three.js](https://github.com/mrdoob/three.js) (MIT).
- **Referências de integração:** [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) (Apache-2.0), [Revideo](https://github.com/redotvideo/revideo) (consultar integração com servidor), [dotLottie Web](https://github.com/LottieFiles/dotlottie-web).
- **Alerta legal:** [OpenVideo](https://github.com/openvideodev/react-video-editor/blob/main/LICENSE) tem termos próprios com restrições à sublicença/derivados e certas empresas; **não adotar como dependência open-source irrestrita por default**.
- Licença de código de framework não resolve automaticamente a licença de assets, fontes, templates, modelos e samples.

## Como marcar progresso
A tabela acima não é um status de PR. Para cada F-ID registrar em issue: `NOT DESIGNED`, `SPECIFIED`, `APPROVED`, `IMPLEMENTED`, `TESTED`, `VERIFIED`. Somente `VERIFIED` fecha o achado. A matriz será atualizada quando houver evidências rastreáveis, sem arredondar porcentagens.
