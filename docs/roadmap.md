# Roadmap de execução orientado a provas

**Estado:** proposta, sujeita à revisão da especificação. A ordem protege custo zero e evita desenvolver UI completa antes de comprovar vídeo real.

## Fase 0 — Fundamentos e desenho
- [x] Consolidar decisões, alternativas e hipóteses da conversa em documentos.
- [ ] Revisar/aprovar [spec Superpowers](superpowers/specs/2026-10-18-motion4free-design.md).
- [ ] Auditar licenças de fontes, modelos, mídias e código.
- [ ] Definir hardware-alvo, codecs prioritários e escopo do MVP.
- [ ] Produzir plano de implementação com Superpowers **após aprovação da spec**.

## Fase 1 — Spike obrigatório de navegador
**Entrega:** vídeo de entrada real -> cortes -> legendas -> motion simples -> MP4, sem servidor.
- [ ] Avaliar WebCodecs + Mediabunny e alternativa mínima.
- [ ] Provar exportação MP4 com áudio no Chrome/Edge Windows.
- [ ] Validar consumo memória/codec e preview/export coerentes.
- [ ] Provar OPFS/cache/reload e download progressivo.
**Gate:** vídeo real reproduzível e medido; sem isso não avançar para produto.

## Fase 2 — Editor mínimo
- [ ] Avaliar OpenReel via protótipo de integração, não assumir compatibilidade.
- [ ] Import, tracks, trim, undo, caption, sample, export, autosave.
- [ ] Manter mídia original intacta.
**Gate:** edição manual local estável.

## Fase 3 — Inteligência editorial offline
- [ ] Portar regras úteis do Editonny para TS com testes.
- [ ] Speech-to-text local e alinhamento confiável.
- [ ] Candidate hooks, EDL, cortes de respiração protegidos.
- [ ] Criar catálogo semântico com cenas limitadas, testadas.
**Gate:** Reel mínimo sem IA externa.

## Fase 4 — Roteador híbrido de IA e qualidade
- [ ] JSON restrito, busca semântica, cache, fallback e budget.
- [ ] Avaliar 3 modelos gratuitos comparativamente.
- [ ] DSPy/Promptfoo para otimização **de desenvolvimento**, não em cada edição.
- [ ] Testes cegos humanos e robustez de negação/fatos.
**Gate:** ganho sobre baseline determinístico, sem regressões técnicas.

## Fase 5 — Biblioteca premium e beta
- [ ] Aumentar templates após revisão de design e licenças.
- [ ] QA de vídeo final, versões, acessibilidade e benchmark publicável.
- [ ] Segurança e contenção de abuso; plano de hospedagem sustentável.
**Gate:** aprovação de QA e auditoria de privacidade/licenças.

## Ordem de entrega sugerida
POC -> MVP desktop Reels -> beta mais amplo -> compatibilidade mobile -> recursos avançados.

## Tamanho/complexidade
Arquitetura completa: alta complexidade, estimativa qualitativa 7–8/10; a integração pode reduzir retrabalho, mas não elimina problemas de encoders, runtime e estética. Estimativas antigas de 3–6 semanas para prova, 3–5 meses para MVP e 8–15+ meses para maturidade são **ordens de grandeza exploratórias para trabalho experiente e contínuo**, não compromissos. Refazer previsão após o spike.

## Não fazer no início
Não construir dez adapters antes do editor funcionar; não criar backend pago; não baixar todos modelos/efeitos no loading; não implementar múltiplos formatos de export, cloud rendering e multicâmera no mesmo MVP.
