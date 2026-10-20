/**
 * Tipos de conteúdo (nichos) que o app conhece (v0.12, ADR-0017). Só ids, nomes e as palavras do pedido
 * que identificam cada um; o que cada nicho muda no vídeo fica em `recipes.ts` (receitas).
 * Pesquisa por trás da lista: docs/produto/personas-e-fluxos.md.
 *
 * Palavras sem acento e em minúsculas (o intérprete compara com o texto já sem acento).
 * `self` = a pessoa diz o que é ("sou corretor", "tenho uma loja"); `about` = o vídeo é sobre isso
 * ("vídeo de receita", "pra minha loja"). As duas escolhem o nicho; a diferença é só documental.
 */
export const NICHE_IDS = [
  'coach',
  'infoprodutor',
  'loja',
  'restaurante',
  'beleza',
  'fitness',
  'saude',
  'juridico',
  'imoveis',
  'educacao',
  'financas',
  'religioso',
  'podcast',
  'humor',
  'noticia',
  'tech',
  'viagem',
  'maternidade',
  'b2b',
  'artista',
  'vlog',
] as const;
export type NicheId = (typeof NICHE_IDS)[number];

export interface NicheInfo {
  id: NicheId;
  /** nome curto (chip) */
  name: string;
  /** exemplos de quem é, para a pergunta "Qual o seu tipo de conteúdo?" */
  examples: string;
  /** frases do pedido que escolhem o nicho (sem acento) */
  words: readonly string[];
}

const w = (s: string) => s.split('|');

export const NICHES: readonly NicheInfo[] = [
  {
    id: 'coach',
    name: 'Coach e mentoria',
    examples: 'coach, mentor, desenvolvimento pessoal',
    words: w('coach|sou coach|mentor|mentora|mentoria|mentorado|mentorados|desenvolvimento pessoal|life coach|coaching|terapeuta holistico|palestrante|palestra|palestras|lideranca|alta performance'),
  },
  {
    id: 'infoprodutor',
    name: 'Curso e infoproduto',
    examples: 'curso online, e-book, lançamento',
    words: w('infoprodutor|infoprodutora|infoproduto|infoprodutos|curso online|meu curso|e book|ebook|lancamento do curso|mentoria online|produto digital|produtos digitais|lancamento digital|afiliado|afiliada|hotmart|kiwify'),
  },
  {
    id: 'loja',
    name: 'Loja e produtos',
    examples: 'loja, e-commerce, moda, artesanato',
    words: w('loja|lojinha|minha loja|e commerce|ecommerce|loja virtual|loja online|brecho|boutique|moda feminina|roupas|semijoias|artesanato|marca de roupa|dropshipping|vendo roupa|vendo roupas|achadinhos|achadinho|unboxing de produto|catalogo'),
  },
  {
    id: 'restaurante',
    name: 'Comida e restaurante',
    examples: 'restaurante, delivery, confeitaria, receitas',
    words: w('restaurante|lanchonete|hamburgueria|pizzaria|cafeteria|confeitaria|confeiteira|confeiteiro|doceria|docinhos|bolo|bolos|receita|receitas|culinaria|delivery|cardapio|food|comida|marmita|marmitas|chef|cozinha|padaria|acai|sorveteria|churrasco|bar|ifood|prato|pratos|queijo|lanche|lanches'),
  },
  {
    id: 'beleza',
    name: 'Beleza e estética',
    examples: 'salão, maquiagem, unhas, estética',
    words: w('beleza|estetica|esteticista|salao|salao de beleza|cabeleireira|cabeleireiro|maquiagem|maquiadora|make|skincare|skin care|unha|unhas|manicure|nail|designer de sobrancelha|sobrancelha|sobrancelhas|cilios|lash|barbearia|barbeiro|harmonizacao|clinica de estetica|cabelo|cabelos|depilacao'),
  },
  {
    id: 'fitness',
    name: 'Fitness e treino',
    examples: 'personal, academia, treino',
    words: w('fitness|personal|personal trainer|academia|treino|treinos|musculacao|crossfit|pilates|yoga|ioga|corrida|maromba|hipertrofia|emagrecimento|emagrecer|funcional|educador fisico|educadora fisica'),
  },
  {
    id: 'saude',
    name: 'Saúde',
    examples: 'nutricionista, médico, dentista, psicólogo',
    words: w('saude|nutri|nutricionista|nutricao|medico|medica|doutor|doutora|dentista|odonto|odontologia|psicologo|psicologa|psicologia|terapia|terapeuta|fisioterapeuta|fisio|fisioterapia|clinica|consultorio|enfermeira|enfermeiro|farmaceutico|farmaceutica|fonoaudiologa|dermatologista|pediatra|ginecologista'),
  },
  {
    id: 'juridico',
    name: 'Advocacia e contabilidade',
    examples: 'advogado, contador, direito',
    words: w('advogado|advogada|advocacia|escritorio de advocacia|direito|juridico|juridica|contador|contadora|contabilidade|contabil|imposto de renda|tributario|previdenciario|trabalhista|inss|aposentadoria|despachante'),
  },
  {
    id: 'imoveis',
    name: 'Imóveis',
    examples: 'corretor, imobiliária, arquitetura',
    words: w('corretor|corretora|corretor de imoveis|corretora de imoveis|imobiliaria|imovel|imoveis|apartamento|apartamentos|casa a venda|tour pelo imovel|tour do apartamento|lancamento imobiliario|decorado|arquiteto|arquiteta|arquitetura|decoracao|design de interiores|reforma'),
  },
  {
    id: 'educacao',
    name: 'Educação',
    examples: 'professor, concurso, idiomas',
    words: w('professor|professora|prof|aula|aulas|educacao|ensino|concurso|concursos|concurseiro|concurseira|vestibular|enem|ingles|espanhol|idioma|idiomas|matematica|portugues|redacao|escola|alunos|explicadora'),
  },
  {
    id: 'financas',
    name: 'Finanças',
    examples: 'investimentos, educação financeira',
    words: w('financas|financeiro|financeira|educacao financeira|investimento|investimentos|investidor|investir|dinheiro|bolsa de valores|acoes|cripto|bitcoin|renda extra|economizar|economia domestica|dividas|planejamento financeiro|tesouro direto'),
  },
  {
    id: 'religioso',
    name: 'Fé e religião',
    examples: 'igreja, pastor, devocional, católico',
    words: w('igreja|pastor|pastora|padre|missionario|missionaria|devocional|pregacao|culto|fe|gospel|evangelico|evangelica|catolico|catolica|biblia|versiculo|oracao|louvor|espirita|ministerio|reflexao biblica'),
  },
  {
    id: 'podcast',
    name: 'Podcast e cortes',
    examples: 'corte de podcast, entrevista, live',
    words: w('corte de podcast|cortes de podcast|podcast|videocast|entrevista|trecho da live|corte da live|clip|clipe do podcast|episodio'),
  },
  {
    id: 'humor',
    name: 'Humor',
    examples: 'esquete, comédia, meme',
    words: w('humor|comedia|comediante|esquete|esquetes|piada|piadas|zoeira|engracado|stand up|standup|pegadinha|meme|memes|humorista'),
  },
  {
    id: 'noticia',
    name: 'Notícia e opinião',
    examples: 'notícia, política, opinião',
    words: w('noticia|noticias|jornalista|jornalismo|politica|opiniao|comentarista|analise politica|atualidades|fofoca|fofocas|polemica|polemicas|economia do pais|esportes|futebol'),
  },
  {
    id: 'tech',
    name: 'Tecnologia e review',
    examples: 'review, unboxing, apps, games',
    words: w('tech|tecnologia|review|reviews|resenha|unboxing|celular|celulares|smartphone|gadget|gadgets|programacao|programador|programadora|aplicativo|app|apps|inteligencia artificial|gamer|setup|iphone|android|notebook|computador'),
  },
  {
    id: 'viagem',
    name: 'Viagem',
    examples: 'viagem, turismo, passeios',
    words: w('viagem|viagens|viajar|turismo|turista|passeio|passeios|roteiro de viagem|destino|destinos|praia|mochilao|hotel|pousada|agencia de viagens|intercambio'),
  },
  {
    id: 'maternidade',
    name: 'Maternidade e família',
    examples: 'mãe, bebê, família, filhos',
    words: w('maternidade|mae|maes|mamae|paternidade|pai de primeira viagem|bebe|bebes|gravidez|gestante|gestacao|filho|filhos|filha|familia|criancas|rotina com bebe|amamentacao|puerperio|mae atipica'),
  },
  {
    id: 'b2b',
    name: 'Empresa e B2B',
    examples: 'SaaS, consultoria, agência, empresa',
    words: w('b2b|saas|software|startup|empresa|minha empresa|consultoria|consultor|consultora|agencia|agencia de marketing|marketing digital|gestor de trafego|social media|negocios|empreendedor|empreendedora|empreendedorismo|vendas b2b|linkedin|institucional'),
  },
  {
    id: 'artista',
    name: 'Música e arte',
    examples: 'cantor, músico, artista, ilustração',
    words: w('cantor|cantora|musico|musica autoral|banda|artista|arte|ilustrador|ilustradora|ilustracao|pintura|pintor|pintora|tatuador|tatuadora|tatuagem|fotografo|fotografa|fotografia|dancarino|danca|ator|atriz|poesia|poeta|single|clipe'),
  },
  {
    id: 'vlog',
    name: 'Dia a dia e vlog',
    examples: 'rotina, lifestyle, vlog',
    words: w('vlog|vlogs|rotina|lifestyle|dia a dia|meu dia|um dia comigo|arrume se comigo|arrume-se comigo|grwm|get ready with me|morning routine|organizacao da casa|casa organizada|faxina'),
  },
];

export function nicheById(id: string): NicheInfo | undefined {
  return NICHES.find((n) => n.id === id);
}

export const NICHE_NAMES = Object.fromEntries(NICHES.map((n) => [n.id, n.name])) as Record<NicheId, string>;
