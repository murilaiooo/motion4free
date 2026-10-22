# Avaliação cega local — formato v2

IMPLEMENTED — NOT TESTED / AWAITING QA. Nenhuma avaliação foi realizada pelo implementador.

Curadoria privada: `/research/blind-review/curator.html`. Avaliador: `/research/blind-review/index.html`, servidos pelo Vite existente quando QA autorizar. Estas páginas de pesquisa não fazem parte da entrada de produção.

Cada preparação cria um `packageId` UUID novo, mesmo com a mesma seed. Pacote, chave privada, respostas e resumo carregam esse ID. Não reutilize o ID numa nova rodada nem altere o pacote depois de distribuído. A seed só ordena; não identifica rodadas. O resumo rejeita respostas de outro pacote. Pacotes/respostas v1 devem ser recriados, pois seus IDs A001/case-1 não permitem inferir a rodada com segurança.

A chave privada tem formato `{version: 2, packageId, entries: [...]}`. Somente `entries` contém produtor, origem, arquivo original e nome cego. Nunca entregar a chave ou o dataset ao avaliador. O pacote público continua sem essas informações. UUID não autentica direitos, conteúdo ou anonimização real dos vídeos: o curador deve conferir cópias, nomes, metadados e eventuais pistas visuais.

Guardar resposta valida todos os campos antes de alterar notas/preferência. Tempos devem ser finitos, não negativos e dentro da duração do vídeo e do limite de quatro horas. Limpar escolha e justificativa remove a preferência; escolha incompleta pede correção. Abstenção não pode ser a versão preferida. Exportar exige todas as respostas e preferências válidas para a rodada.

QA deve incluir duas rodadas de mesma seed/IDs cegos, rejeição cruzada, revisão/remoção de preferência, tempos inválidos e retorno ao campo com erro. Confirmar privacidade, direitos, fluxo de abstenção e cálculos do resumo independentemente. Nenhuma nota ou evidência humana foi fabricada.
