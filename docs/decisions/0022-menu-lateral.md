# ADR-0022 — Menu lateral por tarefa (v0.19)

**Status:** aceito (21/10/2026)

## Contexto
O responsável achou o menu da esquerda desorganizado e difícil para leigos. As abas misturavam conceitos (Pedido, Gancho, Trechos) e não havia como adicionar texto, emoji ou forma pela tela, embora `addElement` existisse.

## Decisão
Seguir o padrão de editores de mercado (CapCut, Canva, Premiere Rush): trilho de ícones por tarefa, cada painel com o mais usado primeiro e um clique para aplicar.

- Abas: Modelos, Texto, Elementos, Legendas, Mídia, IA, Cores, Versões.
- Adicionar entra na agulha (`addElement`) por `run`, então cabe no desfazer, e o item novo fica escolhido.
- Estilo das legendas usa as operações existentes (`setCaptionPlacement`, `patchCaptionLook`, `resetAllCaptionEdits`) com escopo "todas"; cor e tamanho viram uma entrada do desfazer só ao soltar.
- Gancho e trechos ficam em seções recolhíveis da aba IA (uso menos frequente). Clipes, formato e enquadramento saem do painel da direita para a aba Mídia.

## Consequências
Nenhuma mudança no `EditPlan`. Os testes de ponta a ponta usam os nomes novos; o helper `tab()` aceita os antigos (Pedido, Gancho, Trechos) e abre a seção certa.
