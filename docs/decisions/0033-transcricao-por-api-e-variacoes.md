# ADR-0033 — Transcrição por API, variações A/B e trocas parciais (v0.31)

Data: 30/10/2026 · Status: aceito

## Contexto
Issues #127, #118 e #11. O responsável pediu a versão final com tudo fácil para leigos.

## Decisões
1. **Transcrição por API é opcional e separada da IA de texto.** Só entram serviços que, na documentação oficial, aceitam áudio direto do navegador e devolvem tempo por palavra (`verbose_json` + `timestamp_granularities[]=word`): Groq (whisper-large-v3/-turbo, com plano gratuito) e OpenAI (whisper-1). OpenRouter, Gemini e Claude ficam de fora: não dão tempo por palavra; o app não inventa tempos (M4F-311).
2. **Autorização de áudio própria** (`m4f-asr.audioConsent`), nunca derivada da autorização de texto. Sem ela nada é enviado.
3. **Reserva local ligada por padrão, visível:** API não pronta ou com falha → Whisper local + aviso (M4F-308/310). Desligando, o app para sem enviar (M4F-309). Nunca troca de provedor pago sozinho.
4. **Áudio em WAV 16 kHz mono em pedaços ≤ ~12 min cortados nas pausas** (`planAsrChunks`), abaixo do limite de 25 MB dos dois serviços. Sem codificador extra.
5. **Variações = versões.** Três direções fixas (energética, elegante, direta) aplicadas sobre o plano atual com `applyStyle` + `applyHook` (gancho sempre da própria fala). Guardadas como versões para reaproveitar Comparar/Restaurar e o limite de 20 versões; nenhum estado novo no projeto salvo.
6. **Trocas parciais** ("outro gancho", "tira o gancho", "outro estilo") são reconhecidas antes do intérprete completo e viram uma única operação (`applyHook`/`applyStyle`), para não reiniciar o resto do pedido.

## Consequências
- Quem não mexe em nada continua 100% local.
- Transcrição guardada de clipes só é reaproveitada se veio do mesmo tipo de transcritor.
- Falta medir WER/tempo/custo comparando Whisper local × APIs com gravações autorizadas (#10).
