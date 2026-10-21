# Licenças, proveniência e regras de integração

**Não é parecer jurídico.** Confirmação a partir de arquivos LICENSE/README inspecionados em 21/10/2026; a licença do repo não cobre necessariamente todos os arquivos, modelos de IA, fontes, assets ou serviços. Fixar SHA upstream e auditar notices/dependências antes de copiar.

| Repositório | Evidência | Regra para Motion4Free (MIT) |
|---|---|---|
| `opencut-app/opencut` | LICENSE MIT; rewrite em andamento | potencial para futuras ideias de API/plugins, editor ainda placeholder; não copiar stack |
| `opencut-app/opencut-classic` | LICENSE MIT; README afirma arquivado; GitHub confirma `archived=true` | código potencialmente reutilizável com notices/aviso, mas sem manutenção: versões congeladas, auditoria de dependências e código |
| `walterlow/freecut` | LICENSE MIT | código potencialmente reutilizável com copyright/notice, dependências/asset independentes |
| `S07K/cutaway` | LICENSE MIT | reutilização potencial, guardar notices e provenance |
| `afatabe/openreel` | LICENSE MIT | reutilização potencial com auditoria detalhada |
| `FairArena/fairarena-video` | LICENSE MIT, copyright semelhante a OpenReel | confirmar fork/linhagem e não duplicar origem |
| `ucsandman/Magnetic` | LICENSE MIT | referências arquiteturais; código desktop não portável diretamente |
| `metiutek/editorvideo-ai` | LICENSE MIT | ideias de comandos/keyframes; Python/FFmpeg requer adaptação |
| `Panoptik-Studio/Panoptik` | LICENSE raiz AGPL-3.0 | **não copiar UI** em projeto MIT sem reavaliação de licença |
| `Panoptik-Studio/Panoptik/packages/engine` | LICENSE MIT próprio | potencial reuse desse pacote isolado, conferir imports e atribuição |
| `Ektie/react-video-timeline-editor` | LICENSE AGPL-3.0 | **inspiração de comportamento**, não copiar arquivos para app MIT sem análise |
| `0xsline/OpenChatCut` | LICENSE AGPL-3.0 | inspiração conceitual, não copiar UI/comandos |
| `ViktorEj/VideoEditor` | LICENSE raiz DesignCombo e `editor/LICENSE` mais restritiva | **não copiar código do editor**, asset ou layout literal |
| `wassgha/rescript` | LICENSE PolyForm Noncommercial 1.0.0 | **não copiar código** para produto de uso comercial |
| `reactvideoeditor/free-react-video-editor` | README cita licença RVE própria + Remotion | licença potencialmente comercial, evitar integrar |
| `openvideodev/react-video-editor` | licença dual por tamanho de organização no README | evitar integração sem licença formal aplicável |
| `remotion-dev/remotion` | licença especial em alguns usos | não tornar dependência sem avaliação jurídica de distribuição |
| `Vanilagy/mediabunny` | MPL-2.0 (já dependência) | preservar notices e verificar obrigações da biblioteca |

## Procedimento para um PR futuro

1. Abrir o arquivo de origem no commit fixado, conferir LICENSE e possíveis cabeçalhos específicos.
2. Registrar `repository URL`, `commit SHA`, `source path`, `copyright`, `license/SPDX`, `destino`, `modificações`, bibliotecas/assets/weights transitive.
3. Preferir portar algoritmo pequeno testado a importar aplicação ou editor inteiro.
4. Se copiar código MIT: preservar aviso, acrescentar item ao inventário de licenças (`docs/licencas.md`) e rodar licenciamento/review. Para AGPL/proprietário/noncommercial, escrever implementação independente a partir do requisito funcional; não transcrever a fonte.
5. Não baixar automaticamente stickers, músicas, imagens, LUTs, fontes ou datasets sem comprovar direitos. Não coletar conteúdo protegido dos sites.
6. Revisar caso a caso pesos Whisper/LLM e quotas: licença do framework não cobre pesos nem custo de API.
7. Rodar os gates técnicos e indicar precisão do que realmente foi executado.

## Termos de decisão

- **Referência:** estudo de algoritmo/estrutura/interface, nenhum arquivo trazido.
- **Candidato:** análise de compatibilidade e licença pendente.
- **Spike:** experimento isolado sem migração de main.
- **Integrado:** apenas quando PR com código/notices/tests passou.
- **Rejeitado:** licença, custo, suporte ou qualidade incompatíveis.

**Estado deste pacote:** exclusivamente REFERÊNCIA. Nenhum código upstream ou asset copiado ao aplicativo.
