# ADR-0036 — Transcrição detecta a placa de vídeo sozinha (v0.36.0)

Data: 02/11/2026 · Status: aceita (pedido do responsável: "se tiver placa de vídeo, usar a placa; se não tiver, usa processador ou a placa integrada do processador")

## Contexto
Até a v0.35 a escada do modo Precisa era turbo na placa → small no processador → base. O turbo só entrava com WebGPU + `shader-f16` + 8 GB; qualquer placa sem fp16 (comum em integradas e placas antigas) caía direto no processador, que é várias vezes mais lento. A detecção também não distinguia placa dedicada de integrada, então um notebook com Intel UHD tentava baixar 1,4 GB do turbo.

## Decisão
1. `src/asr/capability.ts` pede o adaptador WebGPU de alto desempenho (o mesmo que o Transformers.js usa, `powerPreference: 'high-performance'`) e o de baixo consumo, e lê `GPUAdapterInfo`. Quando o navegador esconde fabricante e modelo (o Brave faz isso), usa como reserva o `UNMASKED_RENDERER_WEBGL`.
2. `classifyGpu` (função pura, com teste) classifica em `dedicada`, `integrada`, `desconhecida` ou `nenhuma` (sem WebGPU ou adaptador de software como SwiftShader/Microsoft Basic Render). Duas placas com fabricantes diferentes nos dois adaptadores = a de alto desempenho é dedicada. Na dúvida, `desconhecida`, tratada como placa forte: a escada desce sozinha se não der.
3. Escada nova (modo Precisa): turbo na placa (só dedicada/desconhecida, fp16, ≥ 8 GB) → **small na placa** (fp16 + decodificador q4, ou encoder fp32 sem fp16) → base na placa → small no processador → base no processador. Modo Rápida: base na placa → base no processador.
4. O nome do modelo mostrado diz onde rodou e qual placa; Configurações › Transcrição mostra a placa detectada. Sem placa liberada, aviso M4F-313 (não é falha).

## Consequências
- Placa integrada passa a transcrever na placa (small), mais rápido que o processador e quase a mesma precisão do small no processador.
- Os arquivos `encoder_model_fp16`, `encoder_model` e `decoder_model_merged_q4` do `whisper-small_timestamped` passam a ser baixados quando a placa é usada. O espelho já libera o repositório inteiro. Não foi possível conferir na nuvem que esses arquivos existem no Hugging Face (huggingface.co bloqueado no contêiner); se algum faltar, o degrau falha no download e a escada desce para o próximo (M4F-307), sem parar a legenda.
- No Windows, o Chrome/Brave pode ignorar a preferência de alto desempenho em notebooks com duas placas; o app explica como escolher "Alto desempenho" para o navegador nas configurações de gráficos do Windows.
