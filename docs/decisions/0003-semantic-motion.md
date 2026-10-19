# ADR-0003 — Motion design por biblioteca semântica, não geração irrestrita

- **Estado:** proposto, aguardando aprovação da especificação.
- **Contexto:** Editonny combina cenas HTML/GSAP, vídeo transparente, recursos 3D, fundos, SFX e composição, não depende de gerar todos os assets por vídeo.
- **Escolha proposta:** catálogo com condições de uso, restrições, parâmetros, segurança de rosto e fontes. Reconhecer eventos na fala, filtrar templates e solicitar IA apenas para escolha entre IDs compatíveis + `none`.
- **Alternativa rejeitada como padrão:** fazer modelo gerar código de animação personalizado para cada trecho; impraticável para modelos limitados, difícil de auditar e arriscado.
- **Consequências:** exige investimento inicial em direção de arte e templates; maior consistência e custo por vídeo quase nulo.
- **Prova decisiva:** 10+ gravações com cenas sincronizadas, comparação cega de relevância e estética, preview igual ao export.
- **Referências:** [motion](../motion/catalog-and-assets.md).
