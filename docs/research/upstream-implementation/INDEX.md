# Manual de integração dos upstreams — índice e critérios

**Data da inspeção:** 2026-10-19. **Tipo:** pesquisa/documentação autorizada; **nenhuma biblioteca incorporada ao runtime, nenhum script executado**.
**Estado:** instruções de implementação **levantadas**, integrações ainda **não comprovadas**.

Este conjunto registra **onde estão as instruções originais**, como aplicá-las ao Motion4Free, contratos de integração, sequência de adaptação, riscos/licença e testes. Não é cópia integral da documentação dos autores: para detalhes completos, consultam-se os arquivos oficiais versionados durante a implementação.

## Navegação
1. [Editor, áudio e exportação](01-media-and-editor.md): Editonny, OpenReel, Mediabunny, ffmpeg.wasm, Auto-Editor e OpenTimelineIO.
2. [Motion design e composição autoral](02-motion-and-composition.md): PixiJS, Motion Canvas, Theatre Core, Three.js/R3F, Motion e dotLottie.
3. [IA gratuita, decisão e avaliação](03-ai-and-evaluation.md): Transformers.js, WebLLM, Semantic Router, TypeChat, Outlines, DSPy e Promptfoo.
4. [Cache, distribuição, qualidade e licenças](04-distribution-and-tooling.md): GTA5 Web, Vice City WASM, Vibe Coding Toolkit, estratégia de direitos e versões.
5. [Matriz de cobertura, decisões e tarefas](05-integration-matrix.md): o que foi lido, o que ainda exige prova e ordem de implementação.

## O que significa “usar todas as instruções”
- **Lidas/extraídas:** instruções relevantes de cada fonte necessárias às tarefas previstas. Não estamos afirmando que todos os milhares de arquivos, classes e testes de cada repo foram examinados.
- **Adaptadas:** contrato técnico para implementação no navegador, sem transcrever código proprietário nem presumir compatibilidade.
- **Confirmar no spike:** API/versão, resultados reais de render/worker/encode, licenças e assets.
- **Integrado:** só marcar quando código real adicionado, testes executados e aprovações Superpowers cumpridas.
- **Proibido confundir:** código visível no GitHub não concede automaticamente direito de copiar, modificar e redistribuir. Projetos sem licença permissiva validada ficam como referências técnicas e comportamento a implementar de forma independente, sem transplante de código restrito.

## Regra arquitetural
O Motion4Free é um **produto artístico premium**, não só um empacotamento de bibliotecas:
`CreativeBrief -> MediaUnderstanding -> StyleDNA -> Storyboard -> SceneGraph seguro -> EDL/Timeline -> Preview/Export -> Technical + Creative QA`.
Prompts e presets influenciam composição de verdade; modelos externos são opcionais, com quota/consentimento; o motor precisa funcionar de maneira útil sem APIs pagas. Reutilização só quando agrega qualidade.

## Arquitetura de módulos candidata (não scaffold criado)
```text
apps/web                  interface, prompt, presets, storyboard, preview
packages/editor           timeline, history, EDL e operações transacionais
packages/media            I/O, transcrição, waveform, face, export e codecs
packages/creative         StyleDNA, constraints, SceneGraph e primitives
packages/ai               roteamento, schema, proteção de prompt, decisões
packages/assets           manifestos, fetch/versionamento/licenças/cache
packages/qa               frame parity, áudio, assertions e benchmark
```
Organização proposta, sujeita à spec Superpowers aprovada; evitar importar código/instalar dependências até os gates.

## Regras de precisão
- Não presumir que Node/Python/FFmpeg nativos rodam no navegador.
- Não presumir que uma biblioteca de animação também renderiza MP4 com áudio.
- Não afirmar que modelos livres em GPU fraca terão o mesmo resultado.
- Distinguir licença do motor, licença de presets/assets, licença de pesos de modelos e termos de API.
- Avaliar **direitos autorais, atribuição e distribuição** antes de incorporar arquivo de terceiros.
- Cada repo pode evoluir: pin por commit/tag no projeto e revalidar API no momento da implementação.

[Auditoria F01–F21](../../reviews/2026-10-19-f01-f21-remediation-plan.md) · [Spec Superpowers](../../superpowers/specs/2026-10-18-motion4free-design.md) · [Adendo premium](../../superpowers/specs/2026-10-18-premium-personalization-amendment.md).

## Atualizações verificadas depois do levantamento inicial
- [Editonny 19/10/2026 — comparação de commit, código útil e plano de adaptação](../updates/2026-10-19-editonny-guide.md). A atualização mais recente examinada foi concentrada em **guia/React/Next.js e design system**, não no motor de render. Não importar animações de UI dependentes do relógio como se fossem animações de vídeo exportáveis.

\n## Complemento: SupoClip (21/10/2026)\n- [SupoClip: auditoria profunda do motor de clipes longos e integração clean-room](../2026-10-21-supoclip-deep-dive.md): seleção com contexto, janelas sobrepostas, grounding de timestamps, ranking, source-map, render, licenças e riscos. [Spec](../../superpowers/specs/2026-10-21-contextual-longform-clips.md) e [plano TDD](../../superpowers/plans/2026-10-21-contextual-longform-clips.md). **Referência documentada, não integrada ao runtime.**\n