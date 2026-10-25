# Auditoria do Motion4Free (v0.21.1, delta v0.22.0)

**Fontes primárias:** `package.json`, `src/`, `tests/`, `e2e/`, `docs/CHANGELOG.md`, ADRs 0015–0023. Base inicialmente `ac09c5e`; atualização de `main` em `2a80e0f` (PR #66) observada em 21/10/2026. O README/PRODUCT e a antiga matriz upstream ainda citam v0.15.1 ou 'editor não implementado': documentação desatualizada, **não** descrição correta do runtime atual.

## Stack real

React 19.3.1, TypeScript 7, Vite 8, CSS próprio com variáveis semânticas, Lucide, Zod 4; Mediabunny 1.61.6 e WebCodecs para media/export; Transformers.js/Whisper e WebLLM local opcional. Projeto Vite na raiz; diretórios: `src/app` (UI e estado), `src/core` (tipos, validação, presets, projeto), `src/engine` (tempo/history/clipes), `src/editorial` (operações, prompts, regras), `src/render` (composição Canvas2D), `src/media` (leitura, áudio, player, MP4), `src/analysis`, `src/asr`, `src/ai`. Testes: Vitest em `tests/` e Playwright em `e2e/`. Deploy Cloudflare.

## Inventário de funcionalidades (evidência estática, não QA manual)

| Área | Já implementado ou representado no código | Evidência / cuidado |
|---|---|---|
| Importação | múltiplos arquivos, perfis 9:16/4:5/1:1/16:9 | `src/media/multi.ts`, `src/core/formats.ts`, `src/app/ClipList.tsx`; limites distintos por modo |
| Projetos | OPFS, salvar/reabrir, relink, histórico, versões, thumbnails | `project-library.ts`, `project.ts`, `Storage.tsx`; não perder compatibilidade |
| Timeline | segmentos, trim, split, move/reorder, copy/paste, delete, duplicar | `EditTimeline.tsx`, `src/editorial/manual.ts`, `sequence.ts` |
| Camadas | elementos adicionados em `track` 0–9, faixas de mídia/legenda, snapping | ADR-0021; isto NÃO é ainda uma trilha genérica de vídeo/áudio com efeitos independentes |
| Onda sonora | índices de picos e render da região visível | `src/analysis/waveform.ts` e `EditTimeline.tsx` |
| Prévia | vídeo, cenas, legendas, objetos selecionáveis/arrastáveis/redimensionáveis | `PreviewOverlay.tsx`, `src/render/hit.ts`, `frame.ts` |
| Direção criativa | StyleDNA, presets, pedidos textuais, IA interpretativa, por trecho e versões | `src/core/style.ts`, `templates.ts`, `editorial/interpret.ts`, `ai-brief.ts` |
| Legendas | transcrição por palavra, correção, estilo, destaque temporal | `Transcript.tsx`, `captions.ts`, `src/editorial/transcript.ts` |
| Áudio | silêncio, loudness, junção entre clipes, normalização simples | `src/analysis/*`, `src/media/splice.ts`; sem confirmar mixer multifaixa |
| Exportação | MP4 local, perfil de formato e fonte multi-clipe, caminhos worker/main | `src/media/export.ts`, `export-client.ts`; validar arquivo real |
| Experiência | landing remodelada, rail de abas, inspector, tema claro/escuro, atalhos | `Landing.tsx`, `landing.css`, `Editor.tsx`, `theme.css` |
| Clipes longos (v0.22) | detecção de momentos, transcrição reutilizada, seleção e render de cortes | `ClipMaker.tsx`, `editorial/highlights.ts`, `clip-pipeline.ts`; PR #66 declara NÃO testado |

## Pontos sensíveis verificados no código

1. `src/engine/timeline.ts` mantém segmentos como `srcStart/srcEnd` em segundos (`number`). `src/core/types.ts` usa tempos contínuos para palavra, cena e legenda; `OutputProfile` já tem `fps`. Repetir trims/splits pode acumular arredondamentos de frame. **Proposta:** camada de conversão, não migração precipitada.
2. `src/media/export.ts` usa `Math.floor(duration * fps)` e `f/fps` com `outputToSource` ou `outputToClip`. Uma duração parcial pode deixar frame final de fora. Hipótese para prova por contagem de frames e áudio, não afirmar bug reproduzido.
3. `src/app/Editor.tsx` tem ~1.244 linhas, `App.tsx` ~960, `EditTimeline.tsx` ~690, e `app.css` dezenas de KB. Alta responsabilidade da UI, exigindo extração cuidadosa de hooks/ações sem quebrar seletores E2E.
4. `src/engine/history.ts` já suporta undo/redo com limite 100. `PreviewOverlay.tsx` comita uma vez ao soltar, um padrão correto que deve ser estendido ao drag da timeline e keyframes.
5. `src/render/frame.ts` executa `drawFrame` como função compartilhada de render. Não criar compositor concorrente para keyframes ou filtros; acrescentar avaliação temporal determinística no pipeline atual.
6. `src/core/edits.ts` limita elementos, pistas e campos via Zod. Ao adicionar animação ou áudio, migrar schema antigo com defaults e limites, testar ida/volta.
7. `src/app/theme.css` já define tokens, contraste e modo claro. `docs/design-system.md` exige cores semânticas. Manter identidade amarela e acrescentar estados/tokens específicos, não instalar framework visual sem ADR.

## Matriz de lacunas (não confundir com 'não existe nenhum suporte')

- **Alto impacto, sem implementação completa confirmada:** keyframes manuais para transform/opacity com dope sheet/curves; controle real de faixas independentes de áudio/vídeo; biblioteca de efeitos/ajustes parametrizados; transições editáveis entre cortes; marcadores no timeline e BPM; workspaces redimensionáveis persistidos; backups portáteis; export de faixa e preflight detalhado; vídeo proxy e perfil de desempenho; UI de atalhos pesquisável/ajustável.
- **Funções parciais a elevar:** animação por regras (já existe) → keyframes editáveis; níveis de áudio (já existem) → mixer com ducking; enquadramento manual (já existe) → enquadramento assistido offline com consentimento e fallback; edição de legendas (já existe) → correspondência palavra/clip/marcações mais refinada; criação de vídeos longos (v0.22) → ranking comparável, review e performance.
- **Não priorizar agora:** multiusuário online, infraestrutura de GPU paga, Remotion como motor obrigatório, clonagem literal de UI, 3D pesado, colaboração em nuvem e troca de Vite/CSS por Next.js/Tailwind.

## Débitos de documentação e governança

Atualizar em PR próprio os trechos defasados do `README.md`, `PRODUCT.md` e `docs/research/upstream-implementation/05-integration-matrix.md` após consenso sobre o status de cada feature. Não reescrever documentos canônicos nesta pesquisa. `docs/CHANGELOG.md` chega a v0.22.0. Documentação de uma feature e PR mergeado não equivalem a funcionamento verificado em dispositivo real. `qa-production.yml` e Playwright não substituem medição de frames, memória, export, recuperação e qualidade criativa.
