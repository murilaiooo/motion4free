# Integração autorizada das PRs #162 e #164 — v0.37.1

Data local: 01/11/2026. Pedido explícito do responsável no chat: “resolva o problema da PR 37.0 e faça o merge dos dois”. Isso autoriza os merges e a publicação automática associada à main; não certifica qualidade humana de IA/vídeo.

## Problema e preservação

- #162 ainda usava `claude/project-thread-hgl0ww` como base e estava em conflito. Sua head `85848c7` derivava da main v0.35, sem os arquivos da v0.36.
- #161 fora mesclada em uma branch antiga, não na main. O merge `93eae66` incorpora esse histórico e conserva integralmente a detecção de GPU, os degraus de Whisper, seus testes e ADR-0036. Conflitos resolvidos em versão/lock e CHANGELOG; versão final **0.37.1**, com histórico de ambas as versões.
- A #162 foi redirecionada à main. Ordem de integração: **#164 → #162 → main**, para publicar diretamente o conjunto com a correção OpenRouter.
- Auditoria portátil ([ADR-0038](../decisions/0038-notices-entre-plataformas.md)): conserva notices ausentes localmente com identidade/versão/SPDX/origem iguais; verifica integralmente os arquivos presentes. A atualização real acrescenta 232 linhas e retira apenas 10 linhas de placeholders, sem remover copyright anterior.

## Verificação local do conjunto

Windows, Node 24.19.0, Brave 156.1.98.63, sem GitHub Actions e sem chave/crédito real de IA.

| Gate | Evidência |
| --- | --- |
| TDD licença | Testes CLI de troca de plataforma falharam antes da correção; 10/10 passaram após corrigir e atualizar os notices |
| `npm test` | **108 arquivos / 1845 testes aprovados**, nenhuma falha |
| `npm run typecheck` | Passou |
| `npm run build` | Passou, incluindo licenças de dist e limite por arquivo |
| Brave completo | **136 aprovados, 2 skips opcionais**, de 138 casos / 42 arquivos; execução final em 1,9 min |
| Skips | Gravação opcional de imagens (`SAVE_FASE3`) e smoke público (`PRODUCTION_SMOKE`), que será executado separadamente após publicação |
| MP4 real sintético | Vertical 1080×1920, H.264 + AAC, **2,816 s**, confirmado por FFprobe; suíte também exportou demais proporções, recuperação e ordem de áudio/vídeo |
| Revisão independente | Sem defeitos no merge GPU/notice; verificação de visibilidade da privacidade mantida no smoke público |

A primeira suíte Brave encontrou 27 falhas de roteiros antigos: avisos recolhidos, estados padrão alterados anteriormente, referência visual com sufixo Windows ausente, seletor Exportar ambíguo e formato fora da aba Mídia. Corrigidos os passos dos testes conforme DOM realmente renderizado. **Nenhuma imagem de referência foi atualizada**: Windows compara as 50 imagens Linux já versionadas, com as tolerâncias anteriores. Nenhum código de interface foi alterado por esses ajustes.

Reprodução:

```powershell
npm test
npm run typecheck
npm run build
$env:CHROMIUM_PATH='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
npx playwright test --workers=2
```

## Publicação e limites

Antes dos merges, domínio público respondeu HTTP 200 com **v0.35.0 · 36b12ad**, conferido em Brave isolado. Esse é o SHA de produção anterior para referência de reversão. Consulta privada de deployment pelo Wrangler indisponível nesta sessão por falta de token; não foi criada conta temporária nem alterada configuração de segredo.

O smoke após publicação deve conferir o SHA da nova main no rodapé, carregamento dos modelos de demonstração, aviso de privacidade visível e acesso à galeria. Os estados efetivos de merge/deployment são verificados no GitHub e no domínio público, não inferidos de build local.

O teste Nemotron real continua pendente e não foi substituído por simulações. Não foram enviados vídeos privados nem usados créditos. Testes de exportação usam mídia sintética curta e não certificam sincronismo labial ou desempenho em gravações longas.

## Teste simples no site

1. Recarregue o site no Brave e confira **v0.37.1** no rodapé.
2. Em Clipes, importe o vídeo e use o mesmo Nemotron grátis, duração 30–60 s; clique em **Reanalisar toda a transcrição** e confira os envios antes de autorizar.
3. Confira o sentido dos clipes e exporte um trecho. Se o modelo continuar sem responder, M4F-1018 deve preservar os clipes locais. Confira também a placa detectada em Configurações › Transcrição.
