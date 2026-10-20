# ADR-0006 — Espelho do modelo de transcrição no próprio site

**Data:** 2026-10-20
**Status:** ACEITA. Complementa a seção "Transcrição" e "Hospedagem" do [ADR-0005](0005-stack-v1.md).

## Contexto
No teste real (v0.1.1 e v0.1.2), o navegador do responsável abriu o site, mas não conseguiu baixar o modelo Whisper: aviso M4F-301, falha de rede antes de qualquer resposta. O site em si carrega, então o problema é alcançar `huggingface.co` (e possivelmente `cdn.jsdelivr.net`) a partir daquela rede. Firewall, antivírus e bloqueadores fazem isso com frequência, e não é algo que o usuário leigo saiba resolver.

## Decisão
- O Worker da Cloudflare que já publica o site passa a ter um script (`worker/index.ts`) que atende só `/hf/*` e `/cdn/*` (`run_worker_first`). Ele busca o arquivo no Hugging Face ou no jsdelivr e devolve pelo mesmo endereço do app, com cache na borda da Cloudflare (30 dias).
- Só o modelo usado pelo app (`onnx-community/whisper-base_timestamped`; desde a v0.8.0 também `whisper-large-v3-turbo_timestamped` e `whisper-small_timestamped`, ver [ADR-0013](0013-legenda-precisa.md)) e o pacote `onnxruntime-web` são permitidos (`src/core/mirror.ts`, com teste); qualquer outro caminho vai para os arquivos do site. Não é um proxy aberto.
- O Worker de transcrição tenta primeiro o espelho (`[site]`) e, se houver falha de rede ou resposta 401/403/429/5xx, os servidores originais (`[direto]`). No `npm run dev` vai direto.
- Nenhum dado do usuário passa pelo espelho: só downloads de arquivos públicos do modelo e do runtime.

## Custo e limites
Plano gratuito do Workers: 100 mil requisições por dia. Cada primeira transcrição faz cerca de 10 requisições; depois o navegador usa o próprio cache. O repasse é streaming, sem guardar o arquivo na memória do Worker. Licenças: Whisper (OpenAI) é Apache-2.0 no Hugging Face; onnxruntime-web é MIT. Os arquivos não são modificados.

## Alternativas descartadas
- Hospedar os arquivos do modelo no build: arquivos acima de 25 MiB exigiriam fatiar e remontar, e o container de desenvolvimento não alcança o Hugging Face para validar.
- Espelhos de terceiros (hf-mirror etc.): proveniência e disponibilidade incertas.

## Consequências
- O deploy deixa de ser só arquivos estáticos: `wrangler.jsonc` ganha `main`. O build continua o mesmo.
- Se a Cloudflare não alcançar o Hugging Face, o detalhe do erro mostra `[site] … HTTP 502` seguido da tentativa direta.
