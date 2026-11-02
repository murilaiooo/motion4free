# ADR-0041 — Interface em inglês e português

Data: 02/11/2026. Status: aceita. Contexto: pedido do responsável para o lançamento global (app em inglês com botão visível para trocar entre inglês e português).

## Problema

O app tem cerca de 2.500 textos de interface em português, espalhados por ~120 arquivos (telas, mensagens de erro M4F, explicações do motor editorial). Outras frentes mexem nesses mesmos arquivos ao mesmo tempo (transcrição, clipes). Trocar cada texto por uma chave (`t('editor.export')`) tocaria quase todas as linhas com texto e geraria conflito de merge em todo PR aberto.

## Decisão

1. **Os componentes continuam escrevendo em português.** O português é o texto-fonte e a chave do dicionário.
2. **Dicionário por área** em `src/i18n/en/*.ts` (`home`, `editor`, `setup`, `clips`, `settings`, `transcription`, `errors`, `editorial`, `core`, `extra`): `"texto em português": "English text"`. `{0}`, `{1}`… marcam partes variáveis; no inglês podem mudar de ordem. Cada frente edita só o arquivo da sua área.
3. **Camada de tela** (`src/i18n/dom.ts`): um `MutationObserver` ligado antes do primeiro desenho troca texto e atributos de leitura (`title`, `placeholder`, `aria-label`, `alt`, `data-tip`) pela tradução. Guarda o original de cada nó para voltar ao português na hora, sem recarregar. Roda em microtarefa, antes da pintura: não há piscada em português.
4. **Conteúdo da pessoa nunca é traduzido**: transcrição, legenda na prévia, texto dos itens da linha do tempo, nomes de projeto, `textarea`, campos editáveis e qualquer área com `translate="no"`.
5. **Padrões com pouco texto fixo** ("Sem {0}") só valem se a parte variável for curta ou também tiver tradução, para não gerar frase metade em cada idioma.
6. **Idioma inicial** segue `navigator.languages` (português → pt; qualquer outro → en). A escolha do botão fica em `localStorage` (`m4f-idioma`). Datas e números da interface usam `localeTag()`.
7. **Botão sempre visível**: `LanguageToggle` (EN | PT) acompanha o botão de Configurações em todas as telas, e Configurações › Editor e aparência tem a mesma escolha.
8. **Testes E2E** fixam `locale: 'pt-BR'` no Playwright, porque leem os textos em português.

## O que não muda

- Códigos de erro `M4F-xxx` são os mesmos nos dois idiomas; só a frase muda.
- O vídeo exportado não muda de idioma: legenda é a fala; chamadas finais ("Siga para mais") e títulos de exemplo continuam como estão. A transcrição continua só em português nesta versão; o texto da interface diz isso.
- O relatório de "Copiar detalhes" continua em português (é para suporte; o código M4F identifica o problema).
- Pedido por texto sem IA (regras) entende só português. Com IA (no navegador ou com chave) entende pedidos em inglês.

## Como manter

- Texto novo sem tradução aparece em português, nada quebra. `node scripts/i18n-missing.mjs [pasta]` lista candidatos sem tradução (heurístico: pode listar palavras-chave e prompts que não aparecem na tela).
- Código que procura elementos pelo texto ou `aria-label` quebra em inglês: usar `data-*` (ex.: `data-clip-number` no criador de clipes).
- Em conflito de merge num arquivo de `src/i18n/en/`, manter as duas linhas: cada linha é independente.

## Alternativas descartadas

- **i18n por chaves (react-i18next/Lingui)**: padrão de mercado, mas exige reescrever ~2.500 trechos de uma vez e conflita com todo PR aberto. Pode ser adotado depois, área por área, aproveitando os mesmos dicionários.
- **Tradutor automático do navegador / IA em tempo real**: depende de serviço externo, não é determinístico e pode traduzir a fala da pessoa.
