# Registro de riscos, premissas e validações

**Não ocultar limitações em marketing.** Estado inicial: nenhuma prova técnica executada no Motion4Free.

| ID | Risco | Severidade | Mitigação | Como verificar |
|---|---|---|---|---|
| R01 | APIs grátis esgotam em uso público | Crítica | local-first e sem dependência de API para editar/exportar | simular indisponibilidade completa |
| R02 | modelos locais não cabem em celular/PC fraco | Alta | detecção de capacidade, perfis e modo manual | matriz de hardware |
| R03 | codec MP4 H.264/AAC indisponível | Alta | probe e fallback explícito | export por browser/OS |
| R04 | cache/OPFS apagados | Alta | salvamento/backup e reimport de mídia | teste storage eviction |
| R05 | transcrição errada altera fato/negação | Crítica | validação por fonte, confidence, revisão | dataset adversarial |
| R06 | IA escolhe cena irrelevante | Alta | catálogo semântico, shortlist e opção `none` | teste cego |
| R07 | efeitos de IA/proxy enviam dados sem consentimento | Crítica | processamento local padrão e opt-in | auditoria de rede |
| R08 | chave secretamente embutida no frontend | Crítica | proxy protegido ou BYOK suportado; scanner | inspeção bundle/log |
| R09 | vídeo 4K/long-form estoura RAM | Alta | streaming, proxies, workers e limites | teste volume/stress |
| R10 | licenças de assets incompatíveis | Crítica | inventário e licença por arquivo, sem copiar indiscriminadamente | revisão legal pré-release |
| R11 | “viral” vendido como garantia | Alta | texto de produto preciso | revisão claims |
| R12 | preview diferente do MP4 final | Alta | motor temporal compartilhado + smoke | comparação de frames |
| R13 | QR/embedded captions encobrem rostos | Média | face-safe, safe zone, revisão | dataset rostos móveis |
| R14 | hospedagem/CDN cria cobrança | Crítica | budgets, limites e teste tráfego; não ativar billing | painéis e termos |
| R15 | repos externos abandonados ou incompatíveis | Média | POC de integração + abstrações | pin, health e tests |
| R16 | LLM obedece instruções maliciosas da transcrição | Crítica | dados não confiáveis, schemas, allowlist de ações | testes de prompt injection |
| R17 | gargalo de latency e primeira visita pesada | Alta | lazy load, cache, progresso real | testes por rede/browser |
| R18 | qualidade criativa abaixo da referência | Crítica | benchmark humano cego, exemplos, refinamento iterativo | gate editorial |

## Dependências de decisão
- Cloudflare Pages é uma **opção**, não conta/deploy configurados.
- OpenReel como base de timeline é **hipótese**, não dependência aprovada.
- GSAP/HyperFrames, MediaBunny/WebCodecs e compilação WASM precisam de ensaio.
- Modelo gratuito “melhor” depende do benchmark por tipo de tarefa, não de preferência subjetiva.
- Projeto público comercial exige auditoria de licença detalhada por mídia/modelo/código.

## Política de não prometer o que não foi medido
Nunca afirmar: “100% offline em qualquer browser”, “IA grátis ilimitada”, “igual ao Editonny”, “vídeo viral garantido”, “GTA V prova a performance de nosso vídeo”, “nenhum custo em qualquer escala”. Mensagens devem apresentar limitações conhecidas e verificadas.
