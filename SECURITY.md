# Segurança e privacidade

Existe uma instalação acessível no endereço Cloudflare indicado no README, mas isso **não é evidência de que a versão atual esteja aprovada para release**. O projeto permanece em pré-lançamento, sem SLA nem e-mail oficial de segurança documentado. Evite issues públicas com tokens, vídeos, transcrições privadas ou PoCs exploráveis; entre em contato com o mantenedor por canal privado e habilite Private Vulnerability Reporting no GitHub quando apropriado.
Motion4Free implementa um editor local-first no navegador. Esta política descreve o desenho e os limites; não certifica uma auditoria ou SLA. Não publique chaves, URLs assinadas, mídia ou transcrições privadas em issues, logs ou screenshots.

## Dados e serviços

- Vídeo/áudio e projetos ficam no dispositivo, em memória/OPFS conforme o recurso. Não há backend de upload de projetos do Motion4Free.
- Modelos e runtimes são baixados sob demanda; hospedagem/CDNs recebem metadados normais de conexão. Cache local não garante disponibilidade offline nem retenção contra eviction.
- IA externa é opcional, com chave própria e envio direto ao provedor. O incremento #97 solicita consentimento sobre o payload exato; #99 limita requisições. Ambos aguardam QA independente.
- Credenciais persistentes usam o cofre criptografado; modo de sessão usa memória. Não armazenar chave em texto claro. Bloquear/apagar precisa revogar operações pendentes; confirmação funcional pertence ao QA.

## Limites de execução

Planos são dados declarativos, com schemas e operações permitidas. Respostas de modelo não podem executar JS, shaders arbitrários ou comandos. O CSP proposto em `public/_headers` restringe scripts, destinos e embedding; requer QA no deployment real e nos workers. Não há alegação de que CSP impeça toda exfiltração por um destino já autorizado.

## Reportar vulnerabilidades

Use o reporte privado do GitHub quando habilitado pelo administrador. A disponibilidade ainda precisa ser confirmada; não existe e-mail oficial anunciado. Se nenhum canal privado estiver disponível, solicite ao mantenedor um canal sem incluir o exploit ou dados sensíveis em público. Preserve versões e descrição mínima; compartilhe mídia somente com direitos e consentimento.

## Auditorias pendentes

Veja os handoffs #2/#12/#73 e o backlog: licenças dos binários/modelos e fontes correspondentes, CSP/CORS real, dependências, segurança do armazenamento, custo/hardware e avaliação independente permanecem abertos. Não habilitar serviços pagos, mudar visibilidade ou publicar dados privados durante investigação.
