import type { Emoji } from '../core/emoji';
import { isQuestion, parseNumberAt } from './detect';

/**
 * Qual emoji combina com a fala: tabela determinística palavra → emoji (português, sem acento).
 * Palavra terminada em `*` vale como começo de palavra ("dinheir*" pega dinheiro, dinheirinho).
 * A primeira entrada que casar ganha; a ordem vai do mais específico ao mais genérico.
 * A IA pode sugerir emojis preferidos (só desta lista); a escolha por palavra continua sendo esta.
 */
export const EMOJI_KEYWORDS: [Emoji, string[]][] = [
  ['💰', ['dinheir*', 'grana', 'lucr*', 'reais', 'real', 'salario*', 'pagamento*', 'pagar', 'preco*', 'faturamento', 'faturar', 'renda', 'investiment*', 'investir', 'rico', 'rica', 'ricos', 'fortuna']],
  ['💸', ['gast*', 'caro', 'cara', 'caros', 'divida*', 'prejuizo*', 'desperdic*']],
  ['🤑', ['milionari*', 'riqueza']],
  ['🛒', ['compr*', 'loja*', 'mercado', 'carrinho', 'shopping']],
  ['🎁', ['presente*', 'gratis', 'gratuit*', 'brinde*', 'bonus', 'sorteio*']],
  ['🚀', ['crescer', 'cresc*', 'lancament*', 'lancar', 'decolar', 'escalar', 'acelerar', 'foguete', 'explodir']],
  ['📈', ['aument*', 'resultado*', 'vendas', 'vender', 'subir', 'subiu', 'alta', 'melhorar', 'melhor*', 'evolu*', 'progresso', 'porcent*']],
  ['📉', ['cair', 'caiu', 'queda', 'perder', 'perdeu', 'perda*', 'diminu*', 'baixa', 'piorar', 'pior']],
  ['💡', ['ideia*', 'dica*', 'truque*', 'aprend*', 'descobr*', 'entend*', 'sabia', 'saber', 'solucao', 'solucoes', 'criativ*']],
  ['🧠', ['cerebro', 'mente', 'inteligen*', 'pensar', 'memoria', 'raciocin*', 'psicolog*', 'estrategia*']],
  ['📚', ['estud*', 'livro*', 'ler', 'leitura', 'escola', 'faculdade', 'curso*', 'aula*', 'prova*']],
  ['✅', ['certo', 'certa', 'correto', 'funciona*', 'pronto', 'pronta', 'feito', 'aprovad*', 'conseguir', 'consegui*', 'sim', 'verdade']],
  ['❌', ['errado', 'errada', 'erro*', 'nunca', 'jamais', 'proibid*', 'pare', 'parar', 'evite', 'evitar', 'mentira', 'falso']],
  ['⚠️', ['cuidado', 'atencao', 'alerta', 'perigo*', 'risco*', 'aviso']],
  ['❤️', ['amor', 'amo', 'amar', 'coracao', 'apaixon*', 'carinho', 'namor*', 'familia']],
  ['😂', ['engracad*', 'rir', 'risada*', 'piada*', 'kkk*', 'hahaha*', 'zoeira', 'comedia']],
  ['😱', ['medo', 'susto', 'chocante', 'assustador*', 'absurdo', 'absurda', 'inacreditavel', 'socorro']],
  ['🤯', ['incrivel', 'incriveis', 'impressionante', 'surreal', 'genial', 'chocado', 'explodiu']],
  ['🤔', ['sera', 'duvida*', 'porque', 'motivo', 'pergunta*', 'curios*', 'misterio']],
  ['👀', ['olha', 'olhe', 'veja', 'repara', 'observe', 'segredo*', 'escondid*', 'revel*']],
  ['🔑', ['chave', 'segredo', 'acesso', 'senha']],
  ['💪', ['forca', 'forte', 'treino*', 'treinar', 'academia', 'musculo*', 'disciplina', 'foco', 'superar', 'determina*']],
  ['🎯', ['objetivo*', 'meta*', 'alvo', 'focar', 'precis*', 'estrateg*', 'mira']],
  ['⏰', ['tempo', 'hora*', 'minuto*', 'segundo*', 'rapido', 'rapida', 'prazo', 'atrasad*', 'cedo', 'agora', 'hoje']],
  ['📱', ['celular*', 'app', 'aplicativo*', 'instagram', 'reels', 'tiktok', 'whatsapp', 'stories', 'post*']],
  ['💻', ['computador*', 'notebook', 'internet', 'online', 'site*', 'programa*', 'codigo', 'tecnologia', 'digital']],
  ['🎉', ['festa*', 'parabens', 'comemor*', 'celebr*', 'aniversario', 'conquista*']],
  ['🥳', ['feliz', 'felicidade', 'alegria']],
  ['🏆', ['venc*', 'campea*', 'ganhar', 'ganhei', 'ganhou', 'premio*', 'vitoria*', 'sucesso*', 'primeiro', 'lugar']],
  ['🥇', ['medalha*', 'ouro']],
  ['⭐', ['estrela*', 'favorit*', 'top', 'destaque']],
  ['✨', ['novo', 'nova', 'novidade*', 'magic*', 'especial', 'bonit*', 'lind*', 'brilh*', 'transforma*']],
  ['🙏', ['obrigad*', 'gratidao', 'agradec*', 'favor', 'deus', 'fe']],
  ['👏', ['aplauso*', 'mandou bem', 'arrasou', 'excelente']],
  ['🍕', ['comida', 'comer', 'pizza', 'fome', 'almoco', 'jantar', 'receita*', 'cozinh*', 'lanche']],
  ['☕', ['cafe', 'manha', 'acordar', 'acordei']],
  ['🏠', ['casa', 'lar', 'apartamento', 'morar', 'aluguel']],
  ['✈️', ['viag*', 'viajar', 'aviao', 'ferias', 'turismo', 'aeroporto']],
  ['🌱', ['comec*', 'inicio', 'plantar', 'natureza', 'semente*', 'saude', 'saudavel', 'natural']],
  ['☀️', ['sol', 'verao', 'praia', 'calor', 'dia']],
  ['🌙', ['noite', 'lua', 'madrugada']],
  ['😴', ['dormir', 'durma', 'sono', 'cansad*', 'descans*']],
  ['🧘', ['calma', 'calmo', 'relax*', 'respir*', 'medita*', 'paz', 'ansiedade', 'estresse']],
  ['😍', ['amei', 'apaixonad*', 'perfeit*', 'maravilh*']],
  ['😎', ['legal', 'estilo', 'confian*', 'tranquilo']],
  ['💥', ['impacto', 'bomba', 'explos*', 'boom']],
  ['🔥', ['fogo', 'quente', 'brabo', 'brutal', 'insano', 'viral', 'bombando', 'tendencia', 'hype']],
  ['📣', ['anunci*', 'aviso', 'atencao', 'galera', 'pessoal']],
  ['🗣️', ['falar', 'fala', 'dizer', 'disse', 'conversar', 'voz', 'contar']],
  ['💬', ['coment*', 'mensagem*', 'responde*', 'conversa']],
  ['🔔', ['inscrev*', 'notifica*', 'sininho', 'ativa']],
  ['👍', ['bom', 'boa', 'beleza', 'ok', 'combinado', 'curtir', 'curte', 'like']],
  ['💯', ['cem', 'total', 'totalmente', 'cento', 'completo']],
  ['🤝', ['parceri*', 'acordo', 'juntos', 'equipe', 'time', 'cliente*', 'negocio*']],
  ['🎬', ['video*', 'gravar', 'gravei', 'filme*', 'cena*', 'editar', 'edicao']],
  ['📌', ['importante', 'anota*', 'lembr*', 'salva', 'salve', 'guarde']],
  ['🧩', ['problema*', 'quebra cabeca', 'peca*', 'encaixa*']],
  ['🔒', ['seguro', 'seguranca', 'protege*', 'privacidade', 'bloque*']],
  ['💎', ['valor', 'valioso', 'valiosa', 'premium', 'luxo', 'qualidade', 'diamante']],
  ['😢', ['triste', 'tristeza', 'chorar', 'chorei', 'saudade']],
  ['😡', ['raiva', 'odeio', 'irritad*', 'bravo']],
  ['👋', ['oi', 'ola', 'tchau', 'bem vindo*']],
  ['🙌', ['finalmente', 'consegui', 'aleluia']],
  ['👇', ['abaixo', 'embaixo', 'link', 'descricao']],
  ['💚', ['verde', 'brasil']],
  ['💛', ['amarelo', 'amarela']],
  ['⚡', ['energia', 'rapidez', 'instantane*', 'raio']],
];

/** Emojis "coringa" quando a fala não sugere nenhum (em ciclo, sem repetir o anterior). */
export const FALLBACK_EMOJIS: Emoji[] = ['✨', '🔥', '👉', '💡', '🎯', '🚀', '👀', '💯'];

export const normalizeWord = (raw: string) =>
  raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9% ]+/g, '');

const MATCHERS = EMOJI_KEYWORDS.map(([emoji, keys]) => ({
  emoji,
  exact: new Set(keys.filter((k) => !k.endsWith('*') && !k.includes(' '))),
  prefixes: keys.filter((k) => k.endsWith('*')).map((k) => k.slice(0, -1)),
  phrases: keys.filter((k) => k.includes(' ') && !k.endsWith('*')),
}));

/** Emoji de uma palavra (ou de duas, "mandou bem"), ou null. */
export function emojiForWord(word: string, next = ''): Emoji | null {
  const w = normalizeWord(word);
  if (w.length < 2) return null;
  const pair = next ? `${w} ${normalizeWord(next)}` : '';
  for (const m of MATCHERS) {
    if (pair && m.phrases.includes(pair)) return m.emoji;
    if (m.exact.has(w)) return m.emoji;
    if (w.length >= 4 && m.prefixes.some((p) => w.startsWith(p))) return m.emoji;
  }
  return null;
}

/** Emoji pela frase: palavra da tabela; senão número com % ou R$ (📈/💰) e pergunta (🤔). */
export function emojiForWords(words: string[]): { emoji: Emoji; index: number } | null {
  for (let i = 0; i < words.length; i++) {
    const e = emojiForWord(words[i]!, words[i + 1]);
    if (e) return { emoji: e, index: i };
  }
  for (let i = 0; i < words.length; i++) {
    const n = parseNumberAt(words, i);
    if (n && /%/.test(n.value)) return { emoji: '📈', index: i };
    if (n && /\$/.test(n.value)) return { emoji: '💰', index: i };
  }
  if (words.length >= 3 && isQuestion(words)) return { emoji: '🤔', index: 0 };
  return null;
}
