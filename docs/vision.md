# Visão e princípios de produto

**Motion4Free**: editor de vídeo inteligente acessado por URL, idealmente sem instalação e sem pagamento pelo criador nem pelo usuário. Foco inicial: converter gravações de fala em Reels de qualidade editorial elevada, com gancho, cortes naturais, legendas, motion design sincronizado, transições com intenção e exportação local.

## Problema
Editores profissionais exigem experiência, horas de trabalho ou assinaturas. IAs generativas podem operar ferramentas, mas custos, quotas, latência e imprevisibilidade impedem um serviço público ilimitado se toda operação depender delas.

## Tese
**A qualidade deve morar no produto, e não no tamanho do modelo.** Construir uma biblioteca de composições profissionais, um motor determinístico de edição e uma camada editorial especializada. Usar IA somente para compreender significado, comparar candidatos e selecionar decisões que não são redutíveis a regras.

## Princípios não negociáveis
1. **Custo monetário zero como objetivo de operação** para o usuário e mantenedor; não afirmar sustentabilidade ilimitada antes de medir banda, cotas e suporte.
2. **Browser-first:** processamento, cache, timeline, preview e MP4 no próprio dispositivo sempre que possível. Sem aplicativo auxiliar obrigatório no caminho principal.
3. **Privacidade:** arquivos brutos não saem do navegador por padrão; envio de transcrição/frames a serviços externos só com informação clara e consentimento apropriado.
4. **Qualidade antes de quantidade:** zero animações é melhor que uma animação irrelevante; transições modernas não são sinônimo de efeito a cada corte.
5. **Preservar sentido e origem:** sem valores inventados, falsas declarações, mudança indevida de negações ou recortes que deturpam falas.
6. **Fallback útil:** com cotas externas esgotadas, fornecer modo editorial determinístico e, quando suportado, modelo local, explicitando limitações criativas.
7. **Não prometer viralidade:** “viral” é um perfil de ritmo, gancho, narrativa e legibilidade, não garantia de alcance.
8. **Revisão real:** teste com gravações e comparações cegas, não apenas JSON válido.
9. **Uma pasta/projeto:** organizar interface, editor, ativos, worker e documentação no mesmo repositório, com módulos delimitados.
10. **Licenças transparentes:** código permissivo não concede automaticamente direitos sobre mídia, fontes e modelos.

## Usuários e plataforma
- Criadores que gravam falas, explicações, aulas, produtos, histórias pessoais e vídeos de vendas.
- Desktop Chrome/Edge é o alvo inicial de validação; outros browsers e mobile terão matriz de capacidade própria.
- Áudio na língua de origem; interface pode ser internacionalizada depois.

## Resultado mínimo memorável
De um vídeo real de pessoa falando + pedido em linguagem natural, entregar uma edição **revisável** em 9:16, com uma escolha justificada de gancho, cortes seguros, legendas, pelo menos um efeito semântico pertinente quando houver evidência, mixagem aceitável e MP4 exportável no navegador.

## Não objetivos iniciais
- Editor completo para cinema / múltiplas horas / workflows profissionais de color grading.
- Geração gratuita ilimitada de vídeo fotorrealista por modelos generativos.
- Servidor próprio de GPU para todos os usuários.
- Promessa de atender qualquer hardware com o mesmo desempenho.
- Criação de uma rede de contas/chaves para contornar termos de provedores.
