# Testes que só uma pessoa pode fazer — lista única (01/11/2026)

Em 01/11/2026 o responsável pediu para fechar todas as issues abertas. O código de cada uma está na `main`
(v0.31.0 a v0.34.0). O que sobrava nas issues antigas não é código: são testes com **vídeos reais
autorizados**, **Brave no Windows**, **chaves reais de API** ou **avaliação humana cega**. Isso não dá
para fazer no container da nuvem (sem vídeos seus, sem chaves, sem Brave/Windows) e não deve ser
inventado.

Para não perder nada, as pendências saíram das issues e ficam **aqui**. Cada issue fechada aponta para esta
lista; o comentário "Pendências após a v0.31.0" de cada issue tem o detalhe técnico original.
Quando um item falhar no teste, abra uma issue nova com o print (o código M4F-xxx ajuda a achar a causa).

## 1. Teste rápido do responsável (sem terminal)

Roteiro curto em `motion4free/roteiro-de-teste-v0.34.md` (arquivos do projeto). Cobre as novidades da v0.34.

## 2. Vídeos reais (fala, cortes, legenda, MP4)

| De onde veio | O que testar |
|---|---|
| #6 transcrição e cortes | Fala normal, sussurro, consoantes fracas, negação ("não é isso"), repetição, música, ruído, pausas expressivas, fala rápida. Conferir palavra perdida/inventada, corte comendo consoante, legenda em sincronia no MP4. Vídeo em inglês/espanhol: o app avisa antes que só transcreve português. |
| #102 clipes de vídeo longo | 20 gravações autorizadas (PT-BR e EN, entrevista, aula, live): cada clipe tem gancho, contexto e fim; nenhum corte inverte o sentido; MP4 com áudio e legenda certos; tempo e memória num PC comum. |
| #54 seguir o rosto | Vídeo deitado → em pé com uma pessoa andando, duas pessoas, troca de cena, rosto sumindo. O quadro não pula nem treme na prévia e no MP4. |
| #117 destaques nas palavras | Destaques continuam na palavra certa depois de cortar, mover e corrigir legendas, num vídeo de 1–3 min. |
| #118 variações | Criar 3 variações, comparar, restaurar, exportar duas delas; cortes e correções manuais continuam em todas. |
| #11 trocas parciais | "outro gancho", "tira o gancho", "outro estilo" mudam só aquela parte em vídeos reais. |
| #7 #8 #29 motor editorial | Frases negadas ou condicionais nunca ganham destaque de número/palavra; o storyboard bate com o vídeo. |

## 3. Chaves reais de API (opcional, só com a sua chave)

| De onde veio | O que testar |
|---|---|
| #127 transcrição por API | Groq (plano grátis) ou OpenAI: com a chave aberta e o áudio autorizado, transcrever não baixa o Whisper; sem autorização nada é enviado (ver Configurações › Privacidade, "O que sai agora"). Erros de chave/limite mostram o código certo. |
| #146 análise de clipes com IA | O caso original (vídeo de 2:25, 8 clipes): sem autorização não há envio e a tela diz por quê; autorizando, "Tentar a análise de novo" funciona sem transcrever outra vez. |
| #126 configuração guiada | Escolher modelo por finalidade e testar no cartão com uma conta real. |
| #153 privacidade | Com a transcrição por API autorizada, início, Armazenamento e Privacidade dizem que o áudio vai para o serviço (e que o vídeo nunca vai). |

## 4. Avaliação cega e benchmarks (precisa de outras pessoas)

| De onde veio | O que fazer |
|---|---|
| #10 dataset e benchmark | Material autorizado com consentimento, rodadas cegas com a rubrica de `docs/qualidade/avaliacao-cega.md` e as ferramentas de `research/blind-review/`. |
| #26 três composições | Pessoas comparam as três composições da mesma fala (pasta `research/`) sem saber qual é qual. |
| #28 motores de cena | Decidir, com teste de quadros/seek e licença, se algum motor de pesquisa vira parte do app. Hoje continuam fora do app. |
| #27 presets e pedido livre | Pessoas confirmam que pedido escrito e escolhas guiadas dão o mesmo resultado quando dizem a mesma coisa. |

## 5. Publicação ampla (decisão do responsável)

| De onde veio | O que fazer |
|---|---|
| #12 hospedagem e GitHub | Medir banda/limites do plano grátis da Cloudflare com o uso real; revisar GitHub Settings (proteção de branch, alertas de segurança) **só com autorização expressa**; decidir a publicação pelo `docs/release/RUNBOOK.md`. |
| #133 integração antiga | Já portado na v0.31.0. A branch `review/integration-static-hardening` continua no GitHub como histórico; nada mais a trazer sem uma necessidade nova. |
| #156 desempenho | Medir no Brave (aba anônima, sem cache) o tempo até a primeira tela e até o editor abrir, antes/depois. Os bytes já foram medidos: `docs/reviews/2026-11-01-v034-desempenho.md`. |

## 6. Testes automáticos no PC

`npm ci`, `npm test`, `npm run typecheck`, `npm run build` e `npx playwright test`. Os vídeos de teste
(`e2e/fixtures/*.webm`) são gerados sozinhos pelo FFmpeg antes do Playwright (#155); se o FFmpeg faltar,
a mensagem começa com `[SETUP]` e diz que é problema do ambiente, não do app. No Brave:
`CHROMIUM_PATH="C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" npx playwright test`.
