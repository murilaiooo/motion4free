# Experiência Master: interface e design system

## Direção

**Ferramenta profissional sem interface intimidante.** O vídeo fica no centro. O usuário alterna entre modos de trabalho, sem perder a timeline ou criar versões distintas do projeto. Identidade mantida: Inter, amarelo da marca, superfícies neutras e tokens existentes em `src/app/theme.css`. Não clonar cores do FreeCut/Magnetic nem instalar Tailwind/shadcn. Status, seleção e focos precisam ter significados consistentes.

## Layout proposto para desktop (referência visual funcional)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Motion4Free · Nome do projeto  [Salvo]    Editar | Animar | Finalizar   Exportar │
├───────────┬─────────────────┬───────────────────────────┬───────────────────────┤
│ Trilho    │ Painel de mídia │ PREVIEW                    │ INSPECTOR contextual  │
│ Mídia     │ Arquivos        │                           │ Posição   Tamanho      │
│ Legenda   │ Pastas/Modelo   │    Canvas 9:16 etc.       │ Texto     Animação     │
│ Texto     │ Busca/Tags      │    Guias/área segura      │ Propriedades por item │
│ Efeitos   │ Arraste/solte   │                           │ Keyframe diamante     │
│ IA        │                 │ Play · timecode · zoom    │                       │
├───────────┴─────────────────┴───────────────────────────┴───────────────────────┤
│ Timeline: ferramentas · ripple/snap · zoom · ruler · marcadores                  │
│ V1 vídeo    [shot][shot][shot]  thumbs                          ◇ keyframes     │
│ A1 voz      ▒▒ waveform ▒▒▒▒▒▒                                              │
│ A2 música   ▒▒ waveform ▒▒▒▒▒                                                │
│ T1 legendas [texto         ][texto         ]                                    │
│ G1 objetos  [título][sticker]                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ QA/projeto: autosave | codec | recursos de dispositivo | alertas                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Workspaces**, sem mudar estado criativo:
- **Editar:** timeline maior, browser de mídia e transcript. Ferramentas de corte, áudio e legendas.
- **Animar:** preview maior, inspector de propriedades, keyframes/dopesheet e curvas; timeline mantém a mesma fonte de verdade.
- **Finalizar:** preview 1:1 vs export, escolha de formato/áudio/legendas, preflight, tamanho estimado e alertas, validação de MP4.

## Componentes propostos (incrementais)

| Componente | Contrato | Nota |
|---|---|---|
| `WorkspaceSwitcher` | `edit/motion/finish`; apenas estado da UI | lembrar preferências por workspace; botão reset |
| `ResizableDock` | painéis com min/max, teclado e drag | não perder foco/canvas durante resize |
| `MediaBin` | thumbnails geradas/cached, duração, estado de link | a UI atual já tem `ClipList`; evoluir sem duplicar |
| `ContextInspector` | escolhido: vídeo, texto, caption, áudio, cena | lista declarativa de propriedades com ranges |
| `KeyframeLane` | propriedade → frames → easing → preview | controle de posição, escala, rotação e opacidade |
| `TimelineRuler` | frame/timecode, zoom, marker, snap, fit | cálculos puros e seleção independente |
| `ShortcutPalette` | pesquisar comando, atalhos e escopo | validação de conflitos do navegador |
| `PreflightExport` | resolução, FPS, áudio, uso de RAM estimado, avisos | nunca afirmar sucesso antes de ler o MP4 |
| `ComparisonView` | alternar original/final ou before/after | somente modo análise, não segundo renderer |

## Regras visuais

1. O amarelo `--brand` permanece para CTA, seleção e foco, mas não domina cada controle. Os estados temporais e semânticos usam `--blue/--violet/--green/--red/--amber` atuais.
2. Evitar reconstrução de landing na mesma entrega. A v0.21 já mexeu nela; primeiro tornar o editor produtivo.
3. Tipografia numérica tabular para frames, tempo, volume e coordenadas. Alvo de clique de handles ≥ 16 px no ponteiro; área do toque maior nos breakpoints móveis.
4. Empty state útil: 'Arraste vídeos', 'Selecione um objeto para editar', 'Clique no diamante para adicionar animação', com ação direta. Evitar botões sem comportamento.
5. Inspector mostra só propriedades aplicáveis; ajustes avançados podem recolher. Undo grava gesto inteiro, nunca cada movimento.
6. Timeline: contraste de trilhas por tipo, clip thumbs e waveforms sem pixelar com zoom; header de pista com mute/solo/lock *apenas quando o motor suporta*. Não simular funcionalidade inexistente.
7. Preview: guias de centro, áreas seguras para cada formato, snapping visual, transformar objeto diretamente, zoom e fit; WYSIWYG na exportação.
8. 1280+ usa 4 zonas; 900–1279 colapsa inspector em aba acessível; < 900 fluxo focado/step-by-step (editor completo em mobile pode requerer limites explícitos). Persistência de layout independe do projeto e é validada antes de restaurar.
9. Carregamento assíncrono de módulos pesados. Carregar editor e modelo de IA sob demanda, preservar preferências ao mudar de workspace.
10. A11y: controles por teclado, focus-visible, nomes acessíveis, modais com foco, prefers-reduced-motion, teste de contraste em ambos os temas.

## Design tokens: ampliar, não refazer

`src/app/theme.css` permanece fonte única para paleta, raio, espaçamento e hierarquia. Sugeridos tokens novos, **somente ao implementar**: `--track-video`, `--track-audio`, `--track-text`, `--handle-hit`, `--marker`, `--keyframe`, `--dock-min`, `--ruler-h`, `--waveform`, `--scrub-bg`. Fazer mapeamento para tokens semânticos existentes e testar contraste; não adicionar 30 matizes sem necessidade.

## Referências verificadas

- FreeCut: [workspaces](https://github.com/walterlow/freecut/blob/main/src/config/editor-workspaces.ts), [hotkeys](https://github.com/walterlow/freecut/blob/main/src/config/hotkeys.ts), [DESIGN](https://github.com/walterlow/freecut/blob/main/DESIGN.md).
- Cutaway: [tokens](https://github.com/S07K/cutaway/blob/main/packages/ui/src/tokens.css), [geometry](https://github.com/S07K/cutaway/blob/main/apps/web/src/features/timeline/geometry.ts).
- OpenReel: [keyframe inspector](https://github.com/afatabe/openreel/blob/main/apps/web/src/components/editor/inspector/KeyframesSection.tsx).
- DesignCombo: [shortcuts modal](https://github.com/ViktorEj/VideoEditor/blob/main/editor/src/components/editor/shortcuts-modal.tsx) (ideia apenas, licença).
- Magnetic: [DESIGN](https://github.com/ucsandman/Magnetic/blob/main/DESIGN.md) (desktop, inspiração).
