# Conversa de concepção — registro consolidado

Data da consolidação: 18/10/2026. Registro temático, não transcrição literal.

1. **Editonny:** inspiração para editor automático orientado por conversa. Editonny é skill para Codex/Claude Code, com motor local Python/FFmpeg/Whisper, HyperFrames, cenas HTML e guia de prompts; o guia não edita vídeo no navegador.
2. **Meta central:** programar a maior parte das operações e usar IA gratuita somente para decisões editoriais essenciais; preservar qualidade e não cobrar usuário nem mantenedor.
3. **Distribuição:** usar site estático, WebAssembly/WebGPU, browser cache e loading de módulos/modelos. Sem instalação obrigatória. Limites de storage, GPU, codecs e banda exigem testes.
4. **Ports AAA no browser:** pesquisa em GTA V web snapshot, Vice City WASM, reVC e Q3JS. Padrões aproveitáveis: chunks, HTTP Range, Service Worker, OPFS, workers, Emscripten. Não equivalem a prova de desempenho universal.
5. **Motor de edição:** OpenReel como candidato à timeline, Mediabunny/WebCodecs como candidato a codecs/browser export, FFmpeg.wasm eventual fallback.
6. **Prompt Reels:** transformar gravação em 9:16 dinâmico com hook nos primeiros 3s, cortes naturais, legendas, motion ligado à fala e transições moderadas. Virais não são garantidos.
7. **Função da IA:** selecionar hooks, blocos da narrativa e cenas semânticas entre alternativas filtradas; motor executa operações precisas. Preservar negações, fatos e frases completas.
8. **Origem dos assets:** cenas Editonny de HTML/CSS/GSAP combinam objetos WebM transparentes, fundos MP4, SFX, música, ícones 3D e composições; Claude não precisa gerar tudo sob demanda.
9. **Aprimorar IAs gratuitas:** microtarefas, few-shot, embeddings, classificador local, schema restrito, validação, cache, roteamento seletivo, benchmark humano. Ferramentas avaliadas: DSPy, Promptfoo, Semantic Router, TypeChat, Outlines, WebLLM, Transformers.js, LiteLLM, Auto-Editor.
10. **Cotas:** Gemini, Groq, OpenRouter e Cloudflare Workers AI foram candidatos, não integração; quotas mudam e podem ser por projeto/organização. Fallback local obrigatório, sem burlar limites.
11. **Qualidade:** comparar baseline determinístico, Motion4Free, Editonny e referência humana em teste cego. Testar português, ruído, números, correções, sincronia, animações e codecs.
12. **Organização:** centralizar tudo em um único GitHub, usar Superpowers, specs e roadmap, registrar decisões, riscos e issues. Nenhum editor foi implementado nesta fase.

[Índice](../INDEX.md) · [Spec](../superpowers/specs/2026-10-18-motion4free-design.md) · [Pesquisa](../research/repositories.md).
