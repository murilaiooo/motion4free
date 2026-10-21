# Arquitetura Master e plano de validação técnica

## Evoluir sem reescrever

```
UI/Workspaces -> EditorCommand -> validate -> reducer/project revision
                                              |
                                              v
                              normalized EditPlan + migrations
                                  |                 |
                                preview         export preflight
                                  |                 |
                                  +-- same resolved scene --+
                                             |
                              existing Canvas2D drawFrame
                                             |
                                Mediabunny/WebCodecs
```

**Conservar:** React/Vite, Zod, `drawFrame`, MediaBunny, OPFS, ASR local, `EditPlan`, slots atuais. **Introduzir gradualmente:** camada temporal em frames, operações tipadas, planejamento de export, selectors e adapters para novas faixas. Mudanças em schema precisam defaults de migração e fixtures de projetos antigos.

## RFC-A: timebase e cortes

- Internamente usar `FrameIndex` inteiro (ou discriminated type), FPS racional `numerator/denominator` para 29.97/23.976; converter tempo de mídia para frames num único módulo. Não usar `Math.round(t * 29.97)` disperso.
- Guardar intervalos [startFrame, endFrame); media source/timeline separados por tipo para impedir usar tempo errado. Testar no mínimo: split, trim, ripple, undo, reverse, clip duplicado e cortes de palavras nos limites.
- **Compatibilidade:** inicialmente manter serialização antiga por segundos e criar adapter. Só trocar schema persistido após testes de ida/volta com 10+ fixtures v0.15–v0.22 e ADR. Timebase de legendas/transcrições preserva precisão de palavras; arredondar apenas nas fronteiras de vídeo.
- Fonte: [Cutaway architecture](https://github.com/S07K/cutaway/blob/main/docs/ARCHITECTURE.md), [operations](https://github.com/S07K/cutaway/blob/main/packages/timeline-engine/src/operations.ts).

## RFC-B: command transaction

Interface proposta (conceitual, não commit de implementação):

```ts
type EditorCommand =
  | { type: 'clip.split'; clipId: string; atFrame: number }
  | { type: 'layer.move'; id: string; trackId: string; startFrame: number }
  | { type: 'keyframe.set'; id: string; property: string; frame: number; value: number }
  | { type: 'ai.proposal.apply'; proposalId: string; expectedRevision: number };
```

`applyCommand(document, command)` valida e devolve `{next, diff, inverse?, warnings}` ou erro tipado, sem side effect. Drags exibem estado provisório e comitam **uma** transaction ao soltar. A IA usa a **mesma** função pública de operações que os botões, passa `expectedRevision` e pede revisão quando altera conteúdo ou mídia. `preview`, `save` e `export` recebem um snapshot consistente do `EditPlan`.

Referências: [Ektie reducer](https://github.com/Ektie/react-video-timeline-editor/blob/main/packages/editor/src/useTimelineEngine.js), [Panoptik snapping](https://github.com/Panoptik-Studio/Panoptik/blob/main/apps/web/src/webmcp/snapping.ts) (ideias, sem copiar código AGPL), `src/engine/history.ts` atual.

## RFC-C: export plan e WYSIWYG

- `planExport(plan, prefs, caps)`: validar data, time range, clip inputs, fonte de áudio, dimensões pares, fps, codecs disponíveis, texto/fontes/assets e estimativa de memória. Devolver avisos e código de erro M4F específico. Não iniciar worker caro se impossível.
- Um `SceneResolver` determinístico avalia estados visuais no `frame`. Reusar `drawFrame` como compositor; a preview deve chamar mesma função com tempo de saída normalizado. Nunca gerar keyframes apenas com CSS do editor e não exportá-los.
- Planejar export por contagem de frames; validar primeiro/último frame e timestamp. O runtime atual usa `Math.floor(duration * fps)`, hipótese de clipping do último frame em determinados comprimentos. Medir antes de corrigir.
- Capacidade e memória: worker disponível? WebCodecs supported? encoder H.264/AAC? fallback sem áudio? frame cache? oferecer downgrade explícito com resultado verificável.

Fonte: [Cutaway export plan](https://github.com/S07K/cutaway/blob/main/packages/export-engine/src/plan.ts), `src/media/export.ts`, `src/media/player.ts`.

## Matriz de testes inéditos/expandidos

| Experimento | Entrada sintética | Resultado exigido |
|---|---|---|
| Boundary de frames | 23.976, 24, 29.97, 30, 60 fps; 2 cortes adjacentes | sem repetir/pular quadro; no drift; contagem combinada correta |
| Undo transacional | drag com 200 eventos; falha no meio | uma entrada no histórico; redo idêntico, sem autosave parcial |
| Recovery de mídia | fechar aba durante gravação de 2/30 arquivos | projeto recuperável, mídia faltante sinalizada; nenhum arquivo 0 byte silencioso |
| Audio sync | 2 clipes com frequências diferentes; fade e normalização | sync medido por pulsos e sem clipping |
| Frame parity | 5 keyframes com easing e mudança de aspect ratio | screenshot preview vs frame MP4 comparado com tolerância de codec |
| Determinismo | exportar mesmo fixture duas vezes | duração/estrutura/frames-visuais consistentes (bytes podem diferir por metadados) |
| Low-memory | 1/4/8 GB simulado quando possível e arquivos grandes | sem congelar UI; cancelamento e aviso de limitações |
| Fonts/assets | texto emoji, 3 fontes, fonte ausente, SVG sem licença | fallback explícito, asset attribution |
| Prompt inválido | pedir edição fora do vídeo, operação com NaN, frame negativo | rejected op, arquivo não alterado, erro M4F |
| QA artístico | 3 estilos no mesmo vídeo, nichos diferentes | avaliação cega humana, coerência de narrativa/legenda, sem score 'viral' fictício |
| Long-video v0.22 | 2 min/30 min/2 h, voz baixa/pausas, multimídia | tempo, memória, score e cortes por palavra, todos os MP4 válidos |

## Medições e evidências

Guardar artefatos **locais ou em anexos de CI permitidos**, nunca mídia privada do usuário: comando/revisão; versão do browser/SO/GPU; duração e FPS; largura/altura; codec; peak RAM e tempo; tamanho; hash de fixture; ffprobe streams/duration/fps/frames, espectrograma/frames selecionados; diffs visuais; resultados de benchmark artístico humano. Não publicar vídeos do usuário. Adicionar fixtures pequenas e livres de direitos, com origem e licença.

**CI:** separar testes puros (rápidos) de E2E real (demorado). Rodar só suites impactadas no desenvolvimento; executar matriz completa em gates explícitos. Quando a cota do GitHub Actions acabar, registrar checks `not-run` e oferecer roteiro de teste manual; nunca fazer loops repetitivos de CI.

## Gates de aprovação

G0 documentação/licença/schema; G1 testes de operações puros; G2 browser local com fixture; G3 MP4 analisado; G4 projects antigos; G5 UX/acessibilidade; G6 avaliação artística real. Os status devem distinguir `implemented`, `tested synthetic`, `tested real`, `approved`.
