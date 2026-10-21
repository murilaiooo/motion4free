# UX criativa — prompts, presets e referências

**Status:** design proposto para revisão.

## Duas portas para o mesmo motor
1. **Prompt livre:** “Reel 30s, minimalista cinematográfico, impactante mas elegante, sem ícones genéricos, referências enviadas, motion ligado a cada conceito importante, áudio natural”.
2. **Preset guiado:** cartões de estilo com **preview visual real** e opções ajustáveis, não estilos fixos fechados.

Ambos compilam para o mesmo `CreativeBrief`. O usuário combina os dois: seleciona um preset e escreve “deixa a tipografia menos agressiva, anima os números como objeto 3D e usa o ritmo do terceiro exemplo”.

## Estrutura proposta
```ts
type CreativeBrief = {
  prompt: string;
  basePresetId?: string;
  target: "reels" | "shorts" | "tiktok" | "custom";
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  audience?: string;
  goals?: string[];
  mood?: string[];
  motionIntensity: "restrained" | "balanced" | "expressive";
  editPace: "natural" | "dynamic" | "fast";
  visualApproach?: string[];
  avoidStyles?: string[];
  referenceAssetIds?: string[];
  protectedSegments?: string[];
  userOverrides?: Record<string, unknown>;
};
```
Este é um **contrato ilustrativo**, sujeito a refinamento de tipos e validações.

## Presets iniciais sugeridos, não definitivos
- **Editorial Minimal**: tipografia distinta, respiros, cortes intencionais, gráficos essenciais.
- **Kinetic Documentary**: cinema documental, dados contextuais, B-roll e texto cinético.
- **Premium Product**: layouts de produto, materiais/lighting, informação hierarquizada.
- **Bold Creator**: motion tipográfico energético, ritmo da fala, números e ações claras.
- **Explainer Studio**: visualizações procedurais, etapas, esquemas e causalidade.

Todos têm **variáveis e limites**, não presets monocromáticos replicados. Usuário pode combinar estilos por seção (hook / explicação / prova / CTA).

## Regras UX
- Prioridade: instrução explícita do usuário > estilo de referência autorizada > preset > default por gênero.
- Preset deve apresentar o que muda e o que não muda. Prompt pode sobrescrever decisões por segmento.
- Mostrar storyboard proposto quando relevante; permitir “menos efeito”, “evite esse estilo”, “mude só 12s–18s”.
- Suporte de **referência de vídeo/imagem fornecida**: extrair características permitidas e respeitar direitos, sem replicar propriedade criativa de modo indevido.
- Salvar StyleDNA do canal/projeto para consistência quando solicitada; não forçar repetição entre autores.
- Interface exibe etapas reais da IA “analisando / planejando / compondo / revisando”; execução em workers/serviços permitidos enquanto aplicação está ativa, não prometer execução em background após fechar aba.
- A IA jamais pode sobrescrever um trecho travado sem pedir autorização ou explicar conflito.

## Critério de UX
Uma pessoa leiga consegue obter boa edição só com preset. Pessoa avançada consegue instruir cenas individuais por texto e controles finos. Prompt e preset produzem projeto editável com mesmo nível de precisão.

## Builder localizado e schema seguro (aprendizado do Editonny de 19/10)

**Proposta em revisão, não implementada.** O novo builder do [Editonny](https://github.com/soumatheusgomes/editonny/blob/05d3dedcddcf6717001b0a3ef91411ec08f614d4/web/src/features/request/draft.ts) demonstra três práticas úteis: IDs de opções estáveis, `parseDraft` defensivo e `applyExample` que modifica apenas campos aplicáveis. Para o Motion4Free, estas são regras de contrato, não código pronto para copiar.

1. **Entrada**: prompt livre, preset, marca, referências autorizadas, escolhas da UI e mudanças locais entram pelo mesmo `CreativeBrief`. Identidade de cena e opções são chaves estáveis, não textos traduzidos.
2. **Validação**: cada campo externo ou recuperado do storage deve ter tipo, enum/faixa, limite de comprimento e IDs reconhecidos. Descartar campo inválido sem eliminar escolhas válidas. Versionar schema e definir migrações explícitas antes de persistir projetos.
3. **Precedência**: segurança, integridade factual, licença, privacidade e trechos travados são constraints. Depois prevalece escolha explícita do usuário, regras de marca aprovadas, instruções contextuais, preset e defaults. Informar conflito em vez de escolher silenciosamente.
4. **Proibição explícita é persistente**: se a pessoa pedir *sem efeitos*, selecionar uma cena não liga efeitos automaticamente. O `withScene` do Editonny altera `effects: none` para `subtle`; esse comportamento é inadequado para nosso contrato.
5. **Aplicar preset é um patch com diff**: alterar só propriedades declaradas pelo preset e mostrar quais escolhas existentes seriam sobrescritas. Referências/locks/dados originais ficam intactos; revogar alterações deve ser possível.
6. **Localização**: UI e descrições inicialmente em pt-BR/en-US/es, enquanto conteúdo gravado, texto do usuário, nome de marca e transcrição preservam o idioma original. Gerar a mesma estrutura semântica e IDs independentemente do idioma da interface.
7. **Plano executável**: a string amigável de instruções nunca é usada como comando shell ou JS. O motor consome operações tipadas e validadas, com whitelist e possibilidade de rollback. `$editonny`/`/editonny` são entradas específicas do upstream, não dependências do navegador.
8. **Compartilhamento**: parâmetros de URL só descrevem opções públicas de catálogo. Nunca serializar prompt particular, transcrição, paths de mídia, tokens ou identidade privada na URL.

Campos adicionais candidatos ao schema existente: `schemaVersion`, `uiLocale`, `presetVersion`, `explicitChoices`, `perSceneOverrides`, `brandProfileId` e `saveStatus`. A tipagem final será acordada com `CreativeBrief`/SceneGraph na revisão da spec; **não** criar um segundo contrato incompatível.

**Casos de aceite a desenvolver**: campo inválido preserva os demais; versão de preset desconhecida; preset + prompt contraditórios; `none` + cena; texto em pt-BR com UI em inglês; alteração de 12–18s preserva o restante; referência excluída; trecho travado; rollback; modo sem LLM/API; storage bloqueado; link de preset sem dados pessoais. Testes de teclado e leitor de tela são obrigatórios no builder.

Ver [auditoria do commit](../research/updates/2026-10-19-editonny-guide.md) para módulos, versões e limites concretos.

## Precedência implementada em 21/10/2026 — não testada (#27)

`compileCreativeBrief` mantém um único contrato. Proibições/locks e integridade da fala continuam constraints; a referência de cores escolhida conserva a regra do #84. Campos explícitos reconhecidos do prompt prevalecem sobre a base guiada; campos ausentes preservam a base. As opções explícitas de desligar movimento/abertura e política de cortes geram restrição e diagnóstico quando o texto contradiz. Conflitos limitados e legíveis vão para `brief.notes.conflicts` e o resumo real de produção. Links de referência não são tratados como estilo analisado. Ver [handoff #27](../reviews/2026-10-21-issue27-implementation-handoff.md). Comparação criativa humana, mídia autorizada e paridade prévia/export são gates de QA.
