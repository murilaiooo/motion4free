# Instruções para agentes — Motion4Free

## Fonte de verdade
Ler primeiro `README.md`, `docs/INDEX.md`, `docs/superpowers/specs/2026-10-18-motion4free-design.md`, `docs/requirements.md` e os ADRs. `docs/roadmap.md` estabelece gates; não tratar propostas como código existente.

## Regras essenciais
- Um repositório e uma pasta de projeto; não abrir ou modificar projetos não relacionados.
- **Sem custo obrigatório:** nenhuma API paga, serviços de GPU/servidor pagos, compras ou gastos não autorizados.
- **Sem instalação obrigatória:** browser-first, com alternativas transparentes para hardware limitado.
- **Sem expor segredos:** não incluir chaves em client, histórico git, logs, docs ou screenshots.
- **Sem upload silencioso:** mídia e derivados ficam no dispositivo por padrão.
- **Sem alteração destrutiva:** preservar mídia original, decisões anteriores e histórico de edição.
- **Sem dependência de resposta livre de LLM:** instruções estruturadas, validação e limites explícitos.
- **Sem prometer “viral”/profissional sem evidência:** benchmarks com vídeos reais antes de afirmação pública.
- Preferir produção determinística, cache, IA local e fallback. Não contornar limites de provedores usando múltiplas contas/chaves.
- Cada recurso copiado requer verificação de licença, provenance e notices.
- Não modificar configuração sensível de repo/segredos/visibilidade sem autorização expressa.

## Processos Superpowers
Este repositório está em **fase de especificação para revisão**. Não executar trabalho de produto antes de aprovar spec, plano e modo de execução. Seguir `@Superpowers`: brainstorming → design/spec → review → writing-plans → implementação/TDD → verificação.
Documentar decisões arquiteturais em ADR, atualizar docs com testes e exemplos reproduzíveis.

## Critérios para mudanças futuras
Uma mudança em motor de corte exige casos de fala, sync e áudio. Motion exige teste de frames/seek e licenças. IA exige validação semântica, custo e regressão. Export exige arquivo real e inspeção, não apenas sucesso da UI.

## Estrutura
Todo código futuro deverá ficar dentro deste repositório, com nomes humanos para papéis/agentes se houver painel de agentes, e identificações de executor separadas. Não assumir stack já definida.
