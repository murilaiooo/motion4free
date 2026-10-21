# QA técnico — Motion4Free v0.15.1

**Em 20/10/2026.** O objetivo é medir funcionamento, não anunciar perfeição.

## Checks implementados
- TypeScript, Vitest, build e Playwright Chromium (com FFmpeg/FFprobe em MP4 real).
- 100 testes determinísticos de reordenação/remoção, preservação dos IDs de fonte, tempos, schema e histórico.
- Quatro proporções 9:16, 4:5, 1:1, 16:9; fontes com orientações diferentes e áudio; vídeo sem áudio; remoção do primeiro clipe, salvamento/reabertura e exportação.
- Recuperação de lote com arquivo corrompido, inclusive quando ele é o primeiro; mensagem M4F-108 e persistência dos arquivos válidos.
- Limites de importação: vazio, 31 arquivos e apenas arquivos corrompidos.
- Três estilos no mesmo vídeo: evidência de diferença de pixels do quadro renderizado (não de sofisticação estética).
- Smoke em Chromium no endereço real da Cloudflare, conferindo renderização e commit publicado após o rollout.

## Evidências
- [App CI QA — rodada ampliada](https://github.com/murilaiooo/motion4free/actions/runs/39518278536): 1.490 testes unitários aprovados, 74 testes de navegador aprovados e 2 pulados por condição de execução.
- [Smoke inicial da produção](https://github.com/murilaiooo/motion4free/actions/runs/39517579425).
- [PR #52 com os checks do commit final](https://github.com/murilaiooo/motion4free/pull/52).
- O CI do **head definitivo** do PR é a fonte de verdade para conclusão da v0.15.1.

## Limites ainda sem prova suficiente
- Transcrição real Whisper WebGPU/WASM, diferentes vozes/idiomas/rede (E2E usa Fake ASR para reproduzibilidade).
- Desempenho em máquinas fracas, exportação contínua de 10 min/30 vídeos, Safari/Firefox/Android reais.
- FaceTrack existe como contrato, mas não há prova do detector de rostos conectado ao player/exportador. “Smart” não pode ser vendido como acompanhamento real de rosto sem esta integração.
- Existem regras de equalização de volume por clipe, mas falta evidência de que sejam chamadas na importação e na reabertura.
- Auditoria completa de licenças/segredos, testes de acessibilidade com usuários e de privacidade durante fluxos de IA real.
- Gate de qualidade artística (#26, #30 e #10): benchmark humano cego com vídeos autorizados, originalidade por contexto, legibilidade, narrativa e comparação com edições profissionais.

**Conclusão:** confiança técnica crescente, sem evidência de 100% de qualidade ou equivalência profissional. Nenhum check de CI substitui a validação humana desses requisitos.
