# ADR-0001 — Browser-first, com processamento no dispositivo

- **Estado:** proposto, aguardando aprovação da especificação.
- **Contexto:** instalar helper nativo reduz alcance; servidor de render demanda GPU e custo. O uso do hardware do visitante permite edição local sem conta e sem cobrança por renderização hospedada.
- **Escolha proposta:** UI/site estático; análise, edição, preview, cache e export no navegador. Carregamento progressivo via SW, OPFS e manifestos de assets. Browser desktop inicialmente.
- **Alternativas:** backend render SaaS rejeitado como padrão pela incompatibilidade com orçamento zero; helper desktop só opção futura, não obrigatório.
- **Consequências:** maior esforço em codecs/WASM/memória; limitações por navegador e GPU; testes reais antes do marketing; mesma função pode ter fallback menos sofisticado.
- **Prova decisiva:** render com áudio real, legendas e motion, com reabertura de projeto após refresh.
- **Referências:** [motor](../engine/browser-runtime.md), [riscos](../risks.md).
