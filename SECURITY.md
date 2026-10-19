# Segurança e privacidade

Estado pre-alpha: apenas documentação. Não existe aplicação publicada, SLA ou e-mail oficial de segurança. Evite issues públicas com tokens, vídeos, transcrições privadas ou PoCs exploráveis; utilize um canal privado com o mantenedor e habilite Private Vulnerability Reporting nas configurações do GitHub quando apropriado.

Princípios:
- Nenhum segredo no bundle público, repositório ou logs; arquivos de configuração locais ignorados.
- Vídeo e transcrição ficam locais por padrão. Qualquer envio a IA externa exige consentimento e minimização.
- Planos IA são dados não confiáveis: schemas, allowlist de operações, sem eval, shell ou execução arbitrária.
- Mídia importada pode ser maliciosa; limitar tamanho, tempo, memória e caminhos.
- Proteger contra prompt injection na própria fala do vídeo, SSRF por URLs de mídia, path traversal e dependências comprometidas.
- Cache de modelos e assets versionado e verificável, com recuperação de projetos e limpeza segura.
- Respeitar termos/licenças de todos os modelos e recursos; não ocultar custos ou quotas.
