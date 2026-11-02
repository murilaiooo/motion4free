# ADR-0038 — Avisos de licença entre plataformas

Data: 01/11/2026. Status: aceita. Contexto: integração autorizada das PRs #162/#164, sem nova dependência.

## Problema

O lockfile inclui pacotes opcionais de Linux, Windows e outras plataformas. npm instala apenas os compatíveis; regenerar os notices em outro sistema substituía licenças completas já revisadas por “pacote sem arquivo LICENSE”. O `--check` falhava mesmo com o mesmo grafo npm e a regeneração removia copyright de terceiros.

## Decisão

O gerador conserva um bloco de licença anteriormente versionado quando o arquivo LICENSE não está disponível localmente e o bloco coincide **exatamente** em nome, versão, SPDX, origem e classificação nativa. Se há LICENSE local, seu conteúdo completo prevalece na comparação: modificação sem regeneração/revisão continua falhando. Não reaproveitar bloco de outra versão ou outro identificador legal.

`--write-notices` acrescenta licenças disponíveis na plataforma corrente e preserva as outras. `--check` aceita essa união; o fingerprint do grafo, o allowlist de licenças e o inventário de arquivos distribuídos continuam obrigatórios. Fontes, ícones, Noto Emoji e MediaPipe mantêm os gates existentes.

## Confiança e limites

Bloco arquivado é evidência **do repositório revisado**, não prova de verificação online do pacote ausente. Uma alteração maliciosa no notice arquivado sem pacote local exige revisão de diff; não é detectada por comparação com um arquivo inexistente. A atualização de versão/SPDX/origem invalida a reutilização e exige nova revisão. A inclusão de pacote nativo no lock não autoriza distribuí-lo no site.

Testes CLI isolados simulam alternância Linux/Windows, preservação de copyright, licença instalada alterada e divergência de versão/SPDX/origem. Nenhuma licença real foi substituída por fixture de teste.
