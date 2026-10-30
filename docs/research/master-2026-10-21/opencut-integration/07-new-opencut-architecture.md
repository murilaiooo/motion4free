# Novo OpenCut (rewrite): o que é utilizável, o que é apenas uma promessa

## Estado observado em 21/10/2026

- `README.md`: rewrite do zero; anuncia Editor API, first-class plugins, core Rust multiplaforma, MCP, headless e scripting como `What's coming`.
- `apps/web/src/routes/editor.tsx`: componente editor imprime literalmente “Editor” e “Coming soon.”. Não possui timeline/preview efetivos.
- `apps/desktop/src/shell.rs`: separa `Browser`, `Preview`, `Inspector`, `Timeline` em áreas; `panels/timeline.rs` é placeholder textual “Timeline”; `components/resizable.rs` tem orientação, fraction clamping, pointer drag, double-click reset; `theme.rs` define `SemanticColors` com temas claros/escuros via OKLCH -> HSL.
- `Cargo.toml`: membro de workspace `apps/desktop`, `crates/*` comentado; `apps/web/package.json`: React/Vite, Tailwind, Tanstack Router, shadcn primitives; os componentes UI são concretos, não editor completo.
- `crates/media/setup/setup.ts` e `ffmpeg.json`: setup de dependências de mídia, não evidência de render web pronto.
- Não há implementação comprovada de Editor API, plugins, MCP/headless ou motor vídeo Rust compartilhado nas árvores avaliadas. **Não criar dependência crítica em cima disso.**

## Aproveitar agora: experiência visual e padrões de shell

1. **Tema semântico:** identificar papéis background, foreground, card, muted, border, accent, destructive, focus ring em `src/app/theme.css`; completar light/dark usando tokens do M4F, nunca copiar CSS de Next/Tailwind necessário só para visual.
2. **Redimensionar com semântica:** versão web em React do algoritmo do `ResizablePanelGroup`: fração entre limites, reset em duplo clique; usar perf/focus tests. Classic tem persistência de tamanhos mais madura, preferi-la para o comportamento da UI web.
3. **Áreas estáveis:** `shell.rs` instancia cada painel uma vez para preservar estado durante re-render; em React manter identidade de componentes, keys estáveis e refs de canvas/player. Reorganização de JSX sem remontar decoder.
4. **Componentes claros:** botão, badge, context menu, separators existem no rewrite; no M4F criar apenas o necessário em React/CSS existente. Nada de importar dezenas de componentes ou `shadcn` wholesale.
5. **Seletor de contexto:** biblioteca e inspector como entidades de UI separadas; central editor state permanece `EditPlan`/session.

## Roteiro arquitetural *futuro*, inspirado no README (NÃO copiar funcionalidade inexistente)

### A. Editor API interna (OCU-24 se backlog expandir)

Interface proposta: `EditorService` com `getProjectSummary()`, `getSelection()`, `dispatch(EditorCommand)`, `canExecute(Action)`, `subscribeRevision()`, `requestExport()`. Expor operações **tipadas, validadas e determinísticas** sobre nosso core TS, nunca `window.editor = mutableStore` aberto ou acesso direto OPFS. Criar apenas depois do command registry, em ADR e PR de uma função. A UI atual chama mesma API que futuros scripts/IA. Não reimplementar motor.

### B. Sistema de plugins (estudo somente)

```ts
interface PluginManifestV1 {
  id: string; version: string; compatibility: string;
  permissions: Array<'read-selection'|'propose-edit'|'apply-edit'|'read-project-metadata'>;
  features: Array<'toolbar'|'inspector'|'effect'|'exporter'>;
}
```

Nível 0: **registro interno** em build para presets e painéis first-party. Nível 1: manifest externo assinado/verificado (muito mais complexo); usuário aprova permissões de forma explícita, sandbox para execução, sem eval/import remoto silencioso, sem modificar local disk. **Não** instalar plugins arbitrários de terceiros antes de ameaça/segurança e mecanismo de rollback. Preview/Export/render continuam determinísticos.

### C. IA e MCP (estudo somente)

Pipeline `userPrompt -> plan structured -> Zod -> dry-run diff -> approval -> atomic apply(command) -> history -> render`. Escopo: selecionar/trim/caption/estilo/cenas, pedir confirmação somente quando ação destrutiva/externa, preservar mídia. `MCP server` do novo OpenCut é **anunciado**. Para M4F, se solicitado no futuro: transportar comandos estritamente autorizados, escopos de arquivos, zero upload, rate limits, não aceitar prompt externo como instrução privilegiada. Não abrir porta HTTP local por padrão nem usar chaves pagas.

### D. Modo headless/batch render (estudo somente)

Separar `EditPlan`, dados de vídeo e `renderFrame` de estado de DOM para eventualmente testar render determinístico. Mas `Mediabunny/WebCodecs` exige ambiente apropriado; browser-only não se torna CLI headless só por ter API. Se houver demanda concreta, protótipo em worker/contexto suportado, sem fingir produção pronta.

### E. Scripting panel (estudo somente)

DSL declarativa validada (e.g. `[{op:'split',time:...}]`) seria mais segura que JavaScript arbitrário. Antes: command registry, schema, sandbox/undo/preview de diff. Scripting não bloqueia release do workbench.

## Decisão atual

**Nenhuma mudança de stack.** Incorporar só o modelo de design semântico e shell estável/resizable como referência. Todas as arquiteturas de automação acima são roadmap de médio/longo prazo, status PROPOSTO. Não marcar plugin/API/MCP/headless como implementados só porque README futuro anuncia.
