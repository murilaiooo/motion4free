# Motion4Free — design spec (Superpowers)

**Data:** 2026-10-18. **Status:** DRAFT PARA REVISÃO. Este documento registra uma proposta arquitetural; não representa implementação ou aprovação de início do código.

## Entendimento do produto
Criar um editor de vídeo acessível por URL, sem instalação ou cobrança obrigatória, com foco em Reels de pessoas falando. Usuário envia mídia e descreve: “gancho nos primeiros 3 segundos, motion design alinhado à fala, transições modernas, cortes de respiração”. App analisa, edita, produz preview, permite revisão por conversa e exporta MP4 local. Qualidade comparável/superior ao Editonny é **meta testável**, não conquista comprovada.

## Alternativas examinadas
- **A: browser-first, preferida para POC.** Site estático, WebCodecs/WASM/WebGPU, assets lazy e render local. Limites: codec, storage, RAM, GPU, browsers.
- **B: backend cloud para render.** Compatibilidade maior, mas GPU/banda/upload tornam custo zero em escala improvável.
- **C: helper nativo opcional.** Robustez FFmpeg/Python, porém viola a proposta de zero instalação no fluxo principal. Só considerar após POC.

## Arquitetura de módulos
1. **Browser UI:** import, chat, timeline, preview, export, estados/erros acessíveis.
2. **Asset loader e storage:** manifestos/chunks (padrões GTA V web), Service Worker/OPFS/IndexedDB (Vice City WASM), carregamento progressivo, integridade, backup do projeto.
3. **Media workers:** checar codecs, extrair voz/quadros, transcrever local, waveform, faces e proxies. Processamento isolado da thread UI.
4. **Regras editoriais:** frases completas, cortes que protegem palavras/negações, candidatos a ganchos, reconhecimento de números/listas/CTAs.
5. **Catálogo semântico:** templates HTML/SVG/CSS/GSAP/WebGL, duração/parametrização, restrição de rosto, assets, licenças e opção nenhuma cena.
6. **Decision router:** regras -> embeddings/classificadores locais -> modelo WebLLM se suportado -> API grátis opcional autorizada; chamada somente para microdecisões.
7. **Validador de planos:** IA produz apenas dados estruturados com IDs existentes; nunca comandos shell/JS/Python. Verificar fatos, tempos, cenas, parâmetros e escopo.
8. **Composer/export:** mesma lógica temporal no preview e export, WebCodecs/Mediabunny candidato, WASM para faltas específicas. MP4 final e projeto não destrutivo.
9. **Quality gate:** sample 8–15s, arquivo exportado, checks de sync, cortes, áudio, textos e revisão criativa humana.

## Contratos candidatos
MediaRef: ID/fingerprint, codec, tracks, dimensões, duration e handle local.
Word/Phrase: stable IDs, source, início/fim, texto na língua original e incertezas.
SceneDescriptor: ID, quando usar/não usar, bounds de tempo, params, constraints, estilo, fontes e licença.
EditPlan v1: profile, segmentos de origem, hookPhraseId, scene placements, captions, transições, audio e warnings. Só enum e IDs; tempos resolvidos pelo motor.
DecisionEvidence: frase real, alternativas, motivo, modelo e versão do prompt.
ValidationResult: erros, degradations e trechos que precisam da revisão do usuário.
CapabilityReport: codecs/GPU/storage/browser suportados. Versões e fingerprints condicionam invalidação de cache.

## Fluxo Reels de referência
1. Import local, preflight e transcrição com timestamps.
2. Regras buscam 3–5 frases candidatas a hook com sentido preservado; modelo pode ranquear. Nada de inventar preço ou fala.
3. EDL seleciona frases integrais, remove pausas não expressivas e protege consoantes fracas. Sem inverter negações, tirar ressalvas ou reconstruir mentira.
4. Motion: regras e busca semântica geram shortlist pequena, IA escolhe entre opções aprovadas incluindo nenhuma, motor ajusta times/posições.
5. Legendas e transições alinhadas com fala, voz prioritária sobre música/SFX.
6. Prévia de 8–15 s, QA técnico/semântico, render MP4 local.
7. Revisões de gancho/zoom/motion reprocessam somente trechos dependentes; projeto é preservado.

## Segurança e custos
Arquivos brutos permanecem no dispositivo. IA externa exige transparência e opt-in; não incluir keys privadas no bundle. Não usar contas múltiplas para contornar cotas. Com APIs esgotadas, permitir edição por regras e interface manual, sem prometer qualidade criativa idêntica. CDN e downloads de modelos podem ter custos/limites; medir antes de publicizar gratuidade ilimitada.

## Qualidade e benchmark
Testes unitários de schema, EDL, timestamps e templates; integração de MP4 com voz, captions e transições; adversarial para negações, números corrigidos, música, faces móveis, vídeo sem fala, prompt injection na transcrição, codec indisponível, storage eviction e quota zero. Criar referências humanas e comparar Motion4Free, Editonny e baseline simples cegamente. Avaliar gancho, ritmo, motion e preferências separadamente dos testes técnicos.

## Ordem por subprojetos
- POC: vídeo real -> corte -> legenda -> motion -> MP4, cache e reload no browser desktop.
- Editor: timeline, undo/redo, projeto, análise persistente e export estável.
- Inteligência: regras adaptadas do Editonny, embeddings e cenas testadas.
- Modelo/roteador: schema, fallback e benchmarks DSPy/Promptfoo offline.
- Beta: direção de arte, privacidade, licenças, hardware e custo de distribuição.

## Questões explicitamente pendentes
Licença própria do Motion4Free; limites de hardware; reutilização direta do OpenReel; auditoria dos assets upstream; política de envio opcional a IA externa; alternativas caso hosting gratuito atinja cotas; suporte a helper opcional.

## Gate Superpowers
Revisar/aprovar esta spec antes de executar o workflow writing-plans para o **POC inicial**. A solicitação atual cobre documentação e organização, não implementação do editor.

[Índice](../../INDEX.md) · [Arquitetura](../../architecture.md) · [Requisitos](../../requirements.md) · [Roadmap](../../roadmap.md) · [Riscos](../../risks.md)
