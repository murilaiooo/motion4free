import type { Emoji } from '../core/emoji';
import { isQuestion, parseNumberAt } from './detect';

/**
 * Qual emoji combina com a fala: tabela determinística palavra → emoji (português, sem acento).
 * Palavra terminada em `*` vale como começo de palavra ("dinheir*" pega dinheiro, dinheirinho).
 *
 * v0.41 (emojis no contexto): a tabela perdeu as palavras de duplo sentido ou de enchimento que davam
 * emoji errado ("cara" = pessoa virava 💸, "real" = de verdade virava 💰, "precisa" virava 🎯, "agora",
 * "hoje", "bom", "certo", "verdade", "olha", "novo"...); começos de palavra que pegavam outra palavra
 * ("compr*" pegava "compreender", "meta*" pegava "metade") viraram palavras exatas. Palavra negada
 * ("não é caro", "sem dinheiro") não escolhe emoji, a não ser os de negação (❌ ⚠️). Na janela de fala
 * vence a palavra mais específica (frase de duas palavras > palavra exata > começo de palavra), não a primeira.
 * A IA pode sugerir emojis preferidos (só desta lista); a escolha por palavra continua sendo esta.
 */
export const EMOJI_KEYWORDS: [Emoji, string[]][] = [
  ['💰', ['dinheir*', 'grana', 'lucro', 'lucros', 'lucrar', 'lucrativ*', 'salario*', 'pagamento*', 'faturamento', 'faturar', 'renda', 'investiment*', 'investir', 'investidor*', 'rico', 'rica', 'ricos', 'fortuna', 'reais', 'dolares', 'milhao', 'milhoes', 'mil reais']],
  ['💸', ['gastar', 'gastei', 'gastou', 'gasto', 'gastos', 'caro', 'caros', 'cara demais', 'divida', 'dividas', 'endividad*', 'prejuizo*', 'desperdic*', 'falir', 'falencia']],
  ['🤑', ['milionari*', 'riqueza', 'enriquec*']],
  ['🛒', ['comprar', 'compra', 'compras', 'comprei', 'comprou', 'comprando', 'loja', 'lojas', 'mercado', 'supermercado', 'carrinho', 'shopping', 'promocao', 'desconto*', 'oferta*']],
  ['🎁', ['presente', 'presentes', 'gratis', 'gratuit*', 'brinde*', 'bonus', 'sorteio*', 'surpresa']],
  ['🚀', ['crescer', 'cresceu', 'crescimento', 'lancamento*', 'lancar', 'decolar', 'escalar', 'acelerar', 'foguete', 'disparou']],
  ['📈', ['aumentar', 'aumentou', 'aumento', 'resultado', 'resultados', 'vendas', 'vender', 'vendi', 'subir', 'subiu', 'melhorar', 'melhorou', 'melhoria*', 'evoluir', 'evoluiu', 'evolucao', 'progresso', 'porcento']],
  ['📉', ['cair', 'caiu', 'queda', 'perder', 'perdeu', 'perdi', 'perda', 'perdas', 'diminuir', 'diminuiu', 'piorar', 'piorou', 'crise']],
  ['💡', ['ideia', 'ideias', 'dica', 'dicas', 'truque*', 'aprender', 'aprendi', 'aprendizado', 'descobri', 'descobrir', 'descoberta', 'solucao', 'solucoes', 'criativ*', 'insight']],
  ['🧠', ['cerebro', 'mente', 'mental', 'inteligencia', 'inteligente', 'pensamento*', 'memoria', 'raciocinio', 'psicologi*', 'neurocienc*']],
  ['📚', ['estudar', 'estudo', 'estudos', 'estudei', 'livro', 'livros', 'leitura', 'escola', 'faculdade', 'curso', 'cursos', 'aula', 'aulas', 'prova', 'vestibular', 'enem', 'concurso*']],
  ['✅', ['correto', 'funciona', 'funcionou', 'funcionar', 'aprovado', 'aprovada', 'aprovei', 'consegui', 'conseguiu', 'concluido', 'checklist']],
  ['❌', ['errado', 'errada', 'erro', 'erros', 'errei', 'proibido', 'proibida', 'evite', 'evitar', 'mentira', 'falso', 'falsa', 'nao faca', 'pare de']],
  ['⚠️', ['cuidado', 'atencao', 'alerta', 'perigo', 'perigoso', 'perigosa', 'risco', 'riscos', 'arriscado', 'golpe', 'golpes', 'fraude']],
  ['❤️', ['amor', 'amo', 'amar', 'coracao', 'carinho', 'namorad*', 'namoro', 'casamento', 'familia', 'filhos', 'filho', 'filha', 'mae', 'pai']],
  ['😂', ['engracad*', 'rir', 'risada*', 'piada*', 'kkk*', 'hahaha*', 'zoeira', 'comedia', 'hilario', 'hilaria']],
  ['😱', ['medo', 'susto', 'chocante', 'assustador*', 'absurdo', 'absurda', 'inacreditavel', 'socorro', 'desespero']],
  ['🤯', ['incrivel', 'incriveis', 'impressionante', 'surreal', 'genial', 'chocado', 'chocada', 'explodiu minha cabeca']],
  ['🤔', ['duvida', 'duvidas', 'pergunta', 'perguntas', 'curiosidade', 'curioso', 'curiosa', 'misterio', 'sera que']],
  ['👀', ['veja', 'repara', 'observe', 'segredo', 'segredos', 'escondido', 'escondida', 'revelar', 'revelei', 'spoiler']],
  ['🔑', ['chave', 'senha', 'acesso']],
  ['💪', ['forca', 'forte', 'treino', 'treinos', 'treinar', 'treinei', 'academia', 'musculo*', 'musculacao', 'disciplina', 'superar', 'superei', 'determinacao', 'malhar', 'hipertrofia']],
  ['🎯', ['objetivo', 'objetivos', 'meta', 'metas', 'alvo', 'focar', 'foco', 'precisao', 'estrategia', 'estrategias', 'mira']],
  ['⏰', ['prazo', 'prazos', 'atrasado', 'atrasada', 'relogio', 'despertador', 'pontual', 'minutos', 'horas']],
  ['📱', ['celular', 'celulares', 'aplicativo*', 'app', 'instagram', 'reels', 'tiktok', 'whatsapp', 'stories', 'postar', 'postei', 'post', 'posts', 'seguidores']],
  ['💻', ['computador*', 'notebook', 'internet', 'online', 'site', 'sites', 'programacao', 'programar', 'codigo', 'tecnologia', 'software', 'inteligencia artificial']],
  ['🎉', ['festa', 'festas', 'parabens', 'comemorar', 'comemoracao', 'celebrar', 'aniversario', 'conquista', 'conquistei', 'conquistas']],
  ['🥳', ['feliz', 'felicidade', 'alegria']],
  ['🏆', ['vencer', 'venceu', 'venci', 'vencedor*', 'campeao', 'campea', 'campeonato', 'ganhar', 'ganhei', 'ganhou', 'premio', 'premios', 'vitoria', 'vitorias', 'sucesso']],
  ['🥇', ['medalha*', 'ouro', 'primeiro lugar']],
  ['⭐', ['estrela', 'estrelas', 'favorito', 'favorita', 'destaque', 'avaliacao']],
  ['✨', ['novidade', 'novidades', 'magia', 'magico', 'magica', 'especial', 'bonito', 'bonita', 'lindo', 'linda', 'brilho', 'brilhante', 'transformacao', 'transformar', 'glow']],
  ['🙏', ['obrigado', 'obrigada', 'gratidao', 'agradeco', 'agradecer', 'deus', 'fe', 'oracao', 'abencoad*']],
  ['👏', ['aplauso*', 'mandou bem', 'arrasou', 'excelente', 'parabenizar']],
  ['🍕', ['comida', 'comer', 'pizza', 'fome', 'almoco', 'jantar', 'receita', 'receitas', 'cozinhar', 'cozinha', 'lanche', 'restaurante']],
  ['☕', ['cafe', 'cafezinho']],
  ['🏠', ['casa', 'apartamento', 'imovel', 'imoveis', 'morar', 'aluguel', 'mudanca']],
  ['✈️', ['viagem', 'viagens', 'viajar', 'viajei', 'aviao', 'ferias', 'turismo', 'aeroporto', 'passaporte']],
  ['🌱', ['comecar', 'comeco', 'inicio', 'iniciante*', 'plantar', 'natureza', 'semente*', 'saude', 'saudavel', 'natural', 'crescimento pessoal']],
  ['☀️', ['sol', 'verao', 'praia', 'calor', 'bom dia']],
  ['🌙', ['noite', 'lua', 'madrugada', 'boa noite']],
  ['😴', ['dormir', 'durma', 'sono', 'cansado', 'cansada', 'cansaco', 'descansar', 'descanso', 'insonia']],
  ['🧘', ['calma', 'relaxar', 'respirar', 'respiracao', 'meditar', 'meditacao', 'paz', 'ansiedade', 'estresse', 'yoga']],
  ['😍', ['amei', 'apaixonad*', 'perfeito', 'perfeita', 'maravilhos*']],
  ['😎', ['estiloso', 'estilosa', 'confianca', 'confiante']],
  ['💥', ['impacto', 'bomba', 'explosao', 'boom']],
  ['🔥', ['fogo', 'brabo', 'braba', 'insano', 'insana', 'viral', 'bombando', 'tendencia', 'hype', 'pegando fogo']],
  ['📣', ['anuncio', 'anunciar', 'novidade quente', 'comunicado']],
  ['💬', ['comenta', 'comente', 'comentario*', 'mensagem', 'mensagens', 'me responde', 'direct']],
  ['🔔', ['inscreva*', 'inscrever', 'notificacao', 'notificacoes', 'sininho', 'ativa o sininho']],
  ['👍', ['curtir', 'curte', 'curtida*', 'like', 'joinha']],
  ['💯', ['cem por cento', 'totalmente', 'garantido', 'garantia']],
  ['🤝', ['parceria', 'parcerias', 'parceiro*', 'acordo fechado', 'equipe', 'cliente', 'clientes', 'negocio', 'negocios', 'networking']],
  ['🎬', ['video', 'videos', 'gravar', 'gravei', 'gravando', 'filme', 'filmes', 'cena', 'cenas', 'editar', 'edicao', 'roteiro']],
  ['📌', ['importante', 'anota', 'anote', 'anotar', 'lembra', 'lembre', 'salva', 'salve', 'guarde']],
  ['🧩', ['problema', 'problemas', 'quebra cabeca', 'encaixar']],
  ['🔒', ['seguranca', 'protecao', 'proteger', 'privacidade', 'bloqueado', 'bloqueada']],
  ['💎', ['valioso', 'valiosa', 'premium', 'luxo', 'qualidade', 'diamante', 'exclusivo', 'exclusiva']],
  ['😢', ['triste', 'tristeza', 'chorar', 'chorei', 'saudade', 'luto']],
  ['😡', ['raiva', 'odeio', 'irritado', 'irritada', 'bravo', 'brava', 'odio']],
  ['👋', ['oi', 'ola', 'tchau', 'bem vindo', 'bem vinda', 'bem vindos']],
  ['🙌', ['finalmente', 'aleluia']],
  ['👇', ['abaixo', 'link na bio', 'descricao', 'nos comentarios']],
  ['⚡', ['energia', 'rapidez', 'instantaneo', 'instantanea', 'raio']],
];

/** Emojis que fazem sentido mesmo depois de "não"/"nunca"/"sem": o próprio emoji já é a negação ou o alerta. */
const NEGATION_OK: ReadonlySet<Emoji> = new Set(['❌', '⚠️']);
const NEGATIONS = new Set(['nao', 'nunca', 'nem', 'sem', 'jamais', 'nenhum', 'nenhuma']);

/**
 * Emojis "coringa" do pedido sem tema (mantido para quem importa); desde a v0.41 o app não usa coringa
 * genérico: sem palavra que combine, vale o tema do vídeo inteiro (ver `topicEmojis`) ou nenhum emoji.
 */
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
  prefixes: keys.filter((k) => k.endsWith('*') && !k.includes(' ')).map((k) => k.slice(0, -1)),
  phrases: keys.filter((k) => k.includes(' ')).map((k) => k.replace(/\*$/, '')),
}));

export interface EmojiHit {
  emoji: Emoji;
  /** o quanto a palavra é específica: 3 = frase de duas/três palavras, 2 = palavra exata, 1 = começo de palavra */
  score: number;
  /** quantas palavras a frase usou (1, 2 ou 3) */
  span: number;
}

/** Emoji de uma palavra (ou de uma frase de até três, "mandou bem", "link na bio"), com a força do acerto. */
export function emojiHit(word: string, next = '', next2 = ''): EmojiHit | null {
  const w = normalizeWord(word);
  if (w.length < 2) return null;
  const n1 = next ? normalizeWord(next) : '';
  const pair = n1 ? `${w} ${n1}` : '';
  const triple = pair && next2 ? `${pair} ${normalizeWord(next2)}` : '';
  for (const m of MATCHERS) {
    if (triple && m.phrases.includes(triple)) return { emoji: m.emoji, score: 3, span: 3 };
    if (pair && m.phrases.includes(pair)) return { emoji: m.emoji, score: 3, span: 2 };
  }
  for (const m of MATCHERS) if (m.exact.has(w)) return { emoji: m.emoji, score: 2, span: 1 };
  if (w.length >= 4) for (const m of MATCHERS) if (m.prefixes.some((p) => w.startsWith(p))) return { emoji: m.emoji, score: 1, span: 1 };
  return null;
}

/** Emoji de uma palavra (ou de duas, "mandou bem"), ou null. */
export function emojiForWord(word: string, next = '', next2 = ''): Emoji | null {
  return emojiHit(word, next, next2)?.emoji ?? null;
}

/** A palavra i vem depois de uma negação ("não é caro", "sem dinheiro", "nunca mais")? */
function negatedAt(words: readonly string[], i: number): boolean {
  for (let k = Math.max(0, i - 2); k < i; k++) if (NEGATIONS.has(normalizeWord(words[k]!))) return true;
  return false;
}

/**
 * Emoji pela frase: a palavra mais específica da tabela (empate: a primeira), sem contar palavra negada;
 * senão número com % ou R$ (📈/💰) e pergunta (🤔).
 */
export function emojiForWords(words: string[]): { emoji: Emoji; index: number } | null {
  let best: { emoji: Emoji; index: number; score: number } | null = null;
  for (let i = 0; i < words.length; i++) {
    const h = emojiHit(words[i]!, words[i + 1], words[i + 2]);
    if (!h) continue;
    if (!NEGATION_OK.has(h.emoji) && negatedAt(words, i)) continue;
    if (!best || h.score > best.score) best = { emoji: h.emoji, index: i, score: h.score };
  }
  if (best) return { emoji: best.emoji, index: best.index };
  for (let i = 0; i < words.length; i++) {
    const n = parseNumberAt(words, i);
    if (n && /%/.test(n.value)) return { emoji: '📈', index: i };
    if (n && /\$/.test(n.value)) return { emoji: '💰', index: i };
  }
  if (words.length >= 3 && isQuestion(words)) return { emoji: '🤔', index: 0 };
  return null;
}

/**
 * Tema do vídeo (v0.41): os emojis que mais aparecem na fala inteira (pelo menos duas vezes), do mais
 * frequente ao menos. Quando um trecho não tem palavra que combine, o emoji vem do assunto do vídeo
 * (vídeo de academia → 💪), nunca de uma lista genérica.
 */
export function topicEmojis(words: readonly string[], max = 3): Emoji[] {
  const count = new Map<Emoji, number>();
  for (let i = 0; i < words.length; i++) {
    const h = emojiHit(words[i]!, words[i + 1], words[i + 2]);
    if (!h || (!NEGATION_OK.has(h.emoji) && negatedAt(words, i))) continue;
    count.set(h.emoji, (count.get(h.emoji) ?? 0) + h.score);
  }
  return [...count.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, max).map(([e]) => e);
}
