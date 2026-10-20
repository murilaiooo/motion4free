# Motion4Free — spec v1 consolidada (Superpowers)

**Data:** 2026-10-20. **Status:** **APROVADA** para execução por fases.
**Aprovação:** o responsável pelo produto (murilo) delegou ao agente todas as decisões técnicas em 20/10/2026 e fica com o papel de testar cada entrega e dar feedback. Esta spec substitui, como fonte de decisão, a [spec de 18/10](2026-10-18-motion4free-design.md) e o [adendo premium](2026-10-18-premium-personalization-amendment.md). Esses documentos continuam como contexto e pesquisa.

Plano de execução: [plano mestre](../plans/2026-10-20-plano-mestre.md) · primeiro plano detalhado: [Fase 1 — primeiro MP4](../plans/2026-10-20-fase1-primeiro-mp4.md) · decisões de stack: [ADR-0005](../../decisions/0005-stack-v1.md).

## 1. O produto em uma frase
Um site onde a pessoa escolhe um vídeo seu falando e recebe, sem instalar nada e sem pagar, um Reels editado (cortes, legendas, motion design com identidade própria) que pode ajustar e baixar em MP4. Tudo roda no navegador da pessoa.

## 2. Como funciona para quem usa (versão final)
1. Abre o site no Chrome ou Edge do computador.
2. Escolhe um vídeo (até 3 minutos nas primeiras versões). O vídeo **não sai do computador**.
3. Escreve o que quer ("Reels animado, gancho forte, estilo minimalista") e/ou escolhe um estilo pronto (preset).
4. O site transcreve a fala, corta silêncios e hesitações sem comer palavras, escolhe o gancho, cria legendas e monta as animações no estilo pedido.
5. A pessoa vê a prévia, ajusta o que quiser (texto de legenda, um corte, o estilo de um trecho, ou pede por texto: "mais calmo entre 12 s e 18 s").
6. Baixa o MP4 9:16 pronto para o Instagram.

Se não houver GPU nem IA disponível, o site continua cortando, legendando, animando por regras e exportando, avisando que a direção criativa automática ficou limitada.

## 3. Princípios que não mudam
- **Custo zero obrigatório** para quem usa e para o mantenedor. Nenhuma API paga, nenhum servidor pago.
- **Sem instalação.** Tudo é site estático.
- **Privacidade por padrão.** Vídeo e transcrição ficam no dispositivo. IA externa só com chave própria da pessoa e consentimento explícito.
- **IA nunca gera código.** Qualquer coisa vinda de IA (ou de arquivo salvo) é um JSON validado por esquema antes de chegar ao motor.
- **Prévia = exportação.** Uma única função desenha cada quadro a partir de `(plano, tempo)`. A prévia e o MP4 usam a mesma função.
- **Original intocado.** Edição é um plano não destrutivo sobre o arquivo original.
- **Provar antes de afirmar.** Cada fase termina com um teste real feito por pessoa, não só testes automáticos.

## 4. Arquitetura

```text
Navegador (site estático)
 ├─ UI (React)                          importar, prévia, ajustes, exportar
 ├─ Mídia (Mediabunny + WebCodecs)      abrir arquivo, decodificar, codificar MP4
 ├─ Análise de áudio (TS puro)          silêncios por energia RMS
 ├─ Transcrição (Transformers.js)       Whisper em Web Worker, WebGPU → WASM
 ├─ Motor editorial (TS puro)           cortes protegidos, legendas, ganchos
 ├─ Direção criativa                    Fase 1–3: regras; Fase 4+: IA local ou chave própria
 ├─ Validador (zod)                     toda entrada externa vira EditPlan validado
 ├─ Compositor (Canvas 2D)              drawFrame(plano, t): vídeo + cenas + legendas
 └─ Exportação                          drawFrame → CanvasSource → MP4 (H.264/AAC)
```

**Camadas puras primeiro.** Timeline, silêncios, cortes, legendas, layout, easing e cenas são funções puras testadas em Node. Só `media/`, `asr/` e `app/` tocam APIs do navegador.

### Contratos centrais (v1)
- `Word { id, text, start, end }` — tempo no original.
- `Segment { srcStart, srcEnd }` — trecho do original mantido, em ordem.
- `Caption { id, text, start, end, wordIds }` — tempo no vídeo editado.
- `SceneInstance { id, kind, text, start, end }` — `kind` é um enum fechado (Fase 1: `kinetic-title`).
- `EditPlan { version: 1, output, segments, captions, scenes }` — validado por `editPlanSchema`.

Fases seguintes acrescentam, sem quebrar o v1: `StyleDNA` (paleta, tipografia, ritmo, intensidade, forma), `CreativeBrief` (pedido + preset + restrições), parâmetros por cena, `locks` por trecho. Cada mudança de contrato sobe `version` e ganha migração testada.

### Como a qualidade criativa vai surgir (decisão)
A IA disponível de graça no navegador é fraca para inventar arte do zero. Por isso a qualidade vem de um **sistema de motion design curado** (cenas parametrizáveis, tipografia, ritmo, easing, paletas) e a IA atua como **diretora que escolhe e parametriza** esse sistema a partir do pedido e do conteúdo. Presets são combinações de parâmetros, não vídeos fixos. Isso cumpre o objetivo de "cada vídeo com identidade própria" com risco controlado, e é validado no gate criativo da Fase 3 (mesmo vídeo, três estilos claramente diferentes).

## 5. Decisões tomadas (detalhes no ADR-0005)
| Tema | Decisão |
|---|---|
| Linguagem e build | TypeScript + Vite, npm |
| UI | React 19 |
| Mídia | Mediabunny (MPL-2.0) + encoder AAC em WASM quando o navegador não tiver |
| Vídeo exportado | MP4 1080×1920 30 fps, H.264 + AAC; sem H.264, VP9 no MP4 com aviso |
| Compositor | Próprio em Canvas 2D, função pura do tempo |
| Transcrição | Whisper (base, multilíngue, com timestamps por palavra) via Transformers.js em Worker |
| Validação | zod |
| Testes | Vitest (unidade) + Playwright (ponta a ponta, verificando o MP4 gerado) |
| CI | GitHub Actions |
| Hospedagem | Cloudflare Pages (grátis, funciona com repositório privado, URL de prévia por branch) |
| Licença do código | MIT |
| Navegador-alvo inicial | Chrome/Edge atuais no computador |

## 6. Fases (resumo; detalhes no plano mestre)
1. **Primeiro MP4:** escolher vídeo → cortar silêncios → legendas → título animado → prévia → MP4. Sem IA generativa.
2. **Editor básico:** player com som em tempo real, linha do tempo, editar legendas e cortes, desfazer, salvar e reabrir.
3. **Sistema de motion design:** StyleDNA, biblioteca de cenas parametrizáveis, 3 presets bem diferentes. Gate criativo.
4. **Pedido por texto + IA:** interpretar o pedido, escolher gancho, estilo e cenas; IA local ou chave própria; sempre com fallback.
5. **Ajuste por trecho e por conversa:** travas, revisão focal, histórico.
6. **Beta público:** compatibilidade, desempenho, licenças, avaliação cega com pessoas.

## 7. Papel de cada um
- **Agente:** decide a parte técnica, registra em ADR, implementa com TDD, abre PRs, mantém CI verde, escreve o roteiro de teste de cada entrega.
- **murilo:** testa cada entrega com vídeos reais seguindo o roteiro e diz o que achou. Decide só o que muda o produto que ele vê (por exemplo, o nome de um estilo ou se algo ficou bom).

## 8. Fora do escopo até o beta
Servidor próprio, contas de usuário, render na nuvem, multicâmera, vídeos longos (> 3 min), celular como plataforma principal, biblioteca de assets de terceiros sem auditoria de licença.

## 9. Riscos principais e resposta
| Risco | Resposta |
|---|---|
| H.264 ausente em alguns navegadores | Detectar e cair para VP9 com aviso; alvo inicial Chrome/Edge |
| Transcrição lenta ou imprecisa em PT-BR | Medida na Fase 1 com vídeos reais; modelo trocável por constante; cortes usam energia do áudio, palavras só protegem |
| Corte comer palavra ou negação | Margem de 120 ms + palavra detectada nunca é cortada (teste dedicado) |
| Qualidade criativa genérica | Sistema curado + gate da Fase 3 com avaliação de pessoas |
| Arquivo de runtime > 25 MB na hospedagem | Runtime ONNX carregado do CDN jsdelivr; arquivo removido do build |
| Memória com vídeos grandes | Limite de 3 min na Fase 1; exportação em Worker e streaming na Fase 6 |

O registro completo continua em [riscos](../../risks.md).
