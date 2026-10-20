# ADR-0005 — Stack v1 e forma de decidir

**Data:** 2026-10-20
**Status:** ACEITA. Substitui o "stack ainda não escolhida" dos documentos anteriores.

## Contexto
O projeto passou dois dias só em documentação, com várias propostas "pendentes de revisão" e nenhuma prova. Em 20/10/2026 o responsável (murilo) declarou que não é técnico e delegou ao agente todas as decisões técnicas, ficando com o papel de testar e dar feedback. Era preciso fechar a stack para começar a Fase 1.

As APIs abaixo foram conferidas nas versões instaladas em 20/10/2026, e o pipeline da Fase 1 foi montado e executado num protótipo descartável: 28 testes de unidade passaram e um teste de ponta a ponta no Chromium gerou um MP4 1080×1920 real com áudio AAC a partir de um vídeo com pausas.

## Decisões

### Forma de decidir
- O agente decide a parte técnica e registra decisões relevantes em ADR. O responsável não precisa aprovar escolhas técnicas.
- Cada fase termina com um **roteiro de teste** para o responsável, sem terminal e sem instalação.
- O que muda o produto visível (estilo, textos, comportamento) é mostrado ao responsável no teste e ajustado pelo feedback.

### Tecnologias
| Área | Escolha | Versão fixada | Licença | Por quê |
|---|---|---|---|---|
| Linguagem | TypeScript | 7.0.2 | Apache-2.0 | Tipos nos contratos do plano de edição |
| Build/dev | Vite | 8.3.4 | MIT | Site estático, Workers nativos, rápido |
| UI | React | 19.3.1 | MIT | Ecossistema maior; o OpenReel (referência) também usa |
| Mídia | Mediabunny | 1.61.6 | MPL-2.0 | Leitura/escrita MP4/WebM com WebCodecs, TS puro, sem FFmpeg |
| AAC de reserva | @mediabunny/aac-encoder | 1.61.6 | MPL-2.0 | Garante AAC mesmo em navegador sem encoder nativo; carregado sob demanda |
| Transcrição | @huggingface/transformers | 4.3.1 | Apache-2.0 | Whisper no navegador com WebGPU ou WASM |
| Validação | zod | 4.6.7 | MIT | Esquema único para plano salvo e saída de IA |
| Testes | Vitest 5.0.5, Playwright 1.64.1 | — | MIT / Apache-2.0 | Unidade em Node; ponta a ponta no navegador |

MPL-2.0 é copyleft por arquivo: usar a biblioteca sem modificá-la não impõe nada ao nosso código MIT. Se um dia modificarmos arquivos do Mediabunny, esses arquivos continuam MPL e o código-fonte deles precisa ficar disponível.

### Compositor próprio em Canvas 2D
Uma função pura `drawFrame(ctx, plano, t, quadroDeOrigem)` desenha cada quadro. A exportação chama essa função quadro a quadro e entrega o canvas ao `CanvasSource` do Mediabunny. A prévia da Fase 1 é uma exportação curta (10 s, metade da resolução), então prévia = exportação por construção. Na Fase 2, o player em tempo real usa a mesma função.

**Rejeitados por enquanto:** Motion Canvas e Theatre.js (feitos para tempo real/edição, seek determinístico e export no navegador não comprovados), GSAP (licença de plugins e relógio próprio), Remotion (licença comercial), PixiJS (só entra se a Fase 3 provar que Canvas 2D não basta, atrás da mesma interface).

### Codecs de saída
1. H.264 + AAC em MP4 (Chrome/Edge com codecs proprietários). É o que o Instagram aceita sem surpresa.
2. Sem H.264: VP9 (ou AV1) dentro do MP4, AAC via WASM, e aviso claro na tela.
Conferido: o Chromium de testes do Playwright não tem H.264; por isso o teste automático usa um vídeo VP9/Opus e valida o caminho de reserva, e o caminho H.264 é validado no teste manual no Chrome.

### Transcrição
Whisper base multilíngue com timestamps por palavra (`onnx-community/whisper-base_timestamped`), idioma fixo português, janelas de 30 s. Roda em Web Worker; tenta WebGPU e cai para WASM quantizado. O modelo vem do Hugging Face e o runtime ONNX do CDN jsdelivr, ambos grátis e cacheados pelo navegador; nenhum dado do usuário é enviado. O ID do modelo é uma constante, trocável se o teste real mostrar problema. **Atualizado na v0.8.0 ([ADR-0013](0013-legenda-precisa.md)):** escada large-v3-turbo (WebGPU) → small (WASM) → base, janelas de até 28 s com 1 s de folga.

### Cortes
Silêncio é medido pela energia do áudio (RMS em quadros de 20 ms, limiar −40 dBFS, mínimo 0,45 s). A transcrição só **protege**: nenhum corte pode cair dentro de uma palavra reconhecida, e há 120 ms de margem em cada emenda, com fade de 8 ms no áudio para não estalar.

### Hospedagem
Cloudflare com integração Git, publicado como Worker de arquivos estáticos (`wrangler.jsonc` apontando para `./dist`), porque o painel da Cloudflare passou a criar sites novos em Workers e esconde o fluxo antigo de Pages (ajustado em 20/10/2026 após o primeiro contato com o painel). Grátis, funciona com o repositório privado, gera uma URL de prévia por branch (cada PR vira um link para testar) e aceita cabeçalhos customizados se um dia precisarmos de COOP/COEP. GitHub Pages foi descartado porque não publica repositório privado no plano gratuito. Limite de 25 MiB por arquivo: o `.wasm` do ONNX (~27 MB) é removido do build porque o runtime já o carrega do CDN.

### Estrutura do repositório
App na raiz: `src/` (código), `tests/` (unidade), `e2e/` (ponta a ponta), `scripts/`, `public/`. Camadas puras (`core`, `engine`, `analysis`, `editorial`, `render`) não importam APIs do navegador; `media`, `asr` e `app` sim.

### Licença
MIT para o código do Motion4Free. Assets, modelos e fontes de terceiros mantêm as próprias licenças e passam por auditoria antes de entrar.

## Consequências
- `npm install`, `npm test`, `npm run build` e `npm run e2e` passam a existir a partir da Fase 1.
- O AGENTS.md deixa de dizer "stack não escolhida".
- Trocar qualquer peça acima exige um novo ADR com motivo medido.
