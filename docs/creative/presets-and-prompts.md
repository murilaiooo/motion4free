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
