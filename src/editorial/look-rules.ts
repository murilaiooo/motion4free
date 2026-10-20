import { colorFromWords } from '../core/color-names';
import { normalizeEmoji, type Emoji } from '../core/emoji';
import type { CutLevel, HookStyle, Look, LookCaptions, LookEmoji, SceneToggle } from '../core/look';
import type { FontFamily } from '../core/style';
import { emojiForWord } from './emoji-pick';
import { isBoundary, longestAt, numberAt, phraseAt, type Token } from './tokens';

/**
 * Regras do pedido para o "look" (v0.6): cores da legenda, tamanho, posição, caixa das letras, fonte,
 * entrada, palavras por linha, emojis, cortes, transição, cenas ligadas e estilo do gancho.
 * Funciona sem IA e sem internet; lê só o texto do pedido.
 *
 * Como lê: o pedido é dividido em partes por vírgula/ponto. Em cada parte, palavras-alvo dizem de quem
 * se fala ("legenda", "destaque", "contorno", "fundo", "emoji", "cor do vídeo") e os valores perto
 * delas (cor, "maior", "em cima", "pulando", "a cada 3 segundos") vão para esse alvo. Palavras usadas são
 * marcadas para não aparecerem em "ainda não sei fazer".
 */

export interface LookRulesResult {
  look: Look;
  wantsHook: boolean;
  hookStyle: HookStyle | null;
  notes: string[];
  /** o que foi reconhecido como pedido que o app ainda não faz */
  unsupported: string[];
  /** destaques pedidos junto com uma cor ("palavras-chave em amarelo" = destacar palavras-chave) */
  emphasize: 'palavras'[];
}

type Target = 'caption' | 'highlight' | 'stroke' | 'box' | 'emoji' | 'accent' | 'transition' | 'keyword' | 'brand';

const TARGETS: [string, Target][] = [
  ...'legenda|legendas|legeda|legendinha|lengenda|ledenda|letra|letras|letreiro|fonte|fontes|caption|captions|texto|textos|texto da legenda|textos da legenda|palavras da legenda'.split('|').map((p) => [p, 'caption'] as [string, Target]),
  ...'destaque|destaques|palavra falada|palavra destacada|palavras destacadas|palavra em destaque|palavra atual|realce|marcacao|marca texto|palavra que esta sendo falada'.split('|').map((p) => [p, 'highlight'] as [string, Target]),
  ...'contorno|contornos|borda|bordas|outline|stroke'.split('|').map((p) => [p, 'stroke'] as [string, Target]),
  ...'fundo|fundo da legenda|caixa|caixinha|tarja|faixa|box'.split('|').map((p) => [p, 'box'] as [string, Target]),
  ...'emoji|emojis|emojinho|emojinhos|emoticon|emoticons|figurinha|figurinhas|sticker|stickers|emotes'.split('|').map((p) => [p, 'emoji'] as [string, Target]),
  ...'cor do video|cores do video|cor principal|cores principais|tema|animacoes|titulos|detalhes|cor de destaque|cor das animacoes|cores das animacoes'.split('|').map((p) => [p, 'accent'] as [string, Target]),
  ...'transicao|transicoes'.split('|').map((p) => [p, 'transition'] as [string, Target]),
  // v0.12: cor das palavras-chave e cores da marca
  ...'palavra chave|palavras chave|palavras importantes|palavra importante|palavras fortes|palavras principais'.split('|').map((p) => [p, 'keyword'] as [string, Target]),
  ...'cor da marca|cores da marca|cor da minha marca|cores da minha marca|minha marca|identidade visual|cor da empresa|cores da empresa|paleta da marca|cor da loja|cores da loja|minhas cores'.split('|').map((p) => [p, 'brand'] as [string, Target]),
  ...'brilho|brilhos|brilhinho|brilhinhos'.split('|').map((p) => [p, 'emoji'] as [string, Target]),
];
const TARGET_PHRASES = TARGETS.map(([p]) => p);
const TARGET_OF = new Map(TARGETS);

const FORBID_BEFORE = new Set(['sem', 'nenhum', 'nenhuma', 'zero', 'evite', 'evitar', 'tire', 'tira', 'tirar', 'remova', 'remover', 'proibido', 'dispenso']);
const NEG_PAIRS = ['nada de', 'nao quero', 'nao use', 'nao coloque', 'nao precisa de', 'nao ponha', 'nao inclua', 'nao mostre'];

const SIZE: [string, number][] = [
  ['bem maior', 1.5], ['bem maiores', 1.5], ['bem grande', 1.5], ['bem grandes', 1.5], ['muito grande', 1.5], ['muito maior', 1.5], ['enorme', 1.5], ['enormes', 1.5], ['gigante', 1.6], ['gigantes', 1.6], ['grandona', 1.5], ['grandao', 1.5],
  ['maior', 1.25], ['maiores', 1.25], ['grande', 1.25], ['grandes', 1.25], ['grandinha', 1.15], ['aumenta', 1.25], ['aumentar', 1.25], ['aumente', 1.25], ['aumentada', 1.25],
  ['bem menor', 0.65], ['bem pequena', 0.65], ['bem pequeno', 0.65], ['bem menores', 0.65], ['pequenininha', 0.65], ['menor', 0.8], ['menores', 0.8], ['pequena', 0.8], ['pequeno', 0.8], ['pequenas', 0.8], ['pequenos', 0.8], ['diminui', 0.8], ['diminuir', 0.8], ['diminua', 0.8], ['discreta', 0.85], ['discretos', 0.85],
];
const SIZE_PHRASES = SIZE.map(([p]) => p);
const SIZE_OF = new Map(SIZE);

/** Posições; as com "tela" valem mesmo sem dizer de quem se fala (vão para a legenda). */
const POSITION: [string, 'top' | 'center' | 'bottom' | 'left' | 'right'][] = [
  ['em cima', 'top'], ['encima', 'top'], ['no topo', 'top'], ['topo', 'top'], ['no alto', 'top'], ['na parte de cima', 'top'], ['parte de cima', 'top'], ['acima', 'top'], ['em cima da tela', 'top'], ['no topo da tela', 'top'], ['parte de cima da tela', 'top'],
  ['no meio', 'center'], ['no centro', 'center'], ['centralizada', 'center'], ['centralizado', 'center'], ['centro', 'center'], ['meio da tela', 'center'], ['no meio da tela', 'center'], ['centro da tela', 'center'], ['no centro da tela', 'center'],
  ['embaixo', 'bottom'], ['em baixo', 'bottom'], ['na parte de baixo', 'bottom'], ['parte de baixo', 'bottom'], ['no rodape', 'bottom'], ['rodape', 'bottom'], ['abaixo', 'bottom'], ['embaixo da tela', 'bottom'], ['parte de baixo da tela', 'bottom'],
  ['na esquerda', 'left'], ['a esquerda', 'left'], ['esquerda', 'left'], ['na direita', 'right'], ['a direita', 'right'], ['direita', 'right'], ['do lado', 'right'], ['ao lado', 'right'], ['no canto', 'right'], ['na lateral', 'right'],
];
const POSITION_PHRASES = POSITION.map(([p]) => p);
const POSITION_OF = new Map(POSITION);

const CASE_UPPER = ['maiuscula', 'maiusculas', 'maiusculo', 'maiusculos', 'caixa alta', 'caps', 'caps lock', 'tudo maiusculo', 'letras grandes de forma'];
const CASE_LOWER = ['minuscula', 'minusculas', 'minusculo', 'minusculos', 'caixa baixa', 'tudo minusculo'];

const FONTS: [string, FontFamily, boolean][] = [
  // [palavra, fonte, precisa de "fonte/letra" na mesma parte]
  ['anton', 'Anton', false], ['montserrat', 'Montserrat', false], ['inter', 'Inter', true], ['instrument', 'Instrument Serif', false], ['instrument serif', 'Instrument Serif', false],
  ['serifa', 'Instrument Serif', true], ['serifada', 'Instrument Serif', true], ['com serifa', 'Instrument Serif', true], ['classica', 'Instrument Serif', true], ['elegante', 'Instrument Serif', true], ['de revista', 'Instrument Serif', true],
  ['mono', 'IBM Plex Mono', true], ['monoespacada', 'IBM Plex Mono', true], ['de maquina de escrever', 'Courier Prime', true], ['de codigo', 'IBM Plex Mono', true], ['plex', 'IBM Plex Sans', false], ['ibm plex', 'IBM Plex Sans', false],
  ['condensada', 'IBM Plex Sans Condensed', true], ['estreita', 'IBM Plex Sans Condensed', true], ['grossa', 'Montserrat', true], ['gordinha', 'Montserrat', true], ['pesada', 'Montserrat', true], ['negrito', 'Montserrat', true],
  ['impactante', 'Anton', true], ['fina', 'Inter', true], ['simples', 'Inter', true], ['moderna', 'Inter', true], ['tecnica', 'IBM Plex Sans', true],
  // v0.9: fontes dos modelos novos (todas OFL, ver docs/licencas.md)
  ['archivo', 'Archivo Black', false], ['archivo black', 'Archivo Black', false], ['dm sans', 'DM Sans', false], ['space grotesk', 'Space Grotesk', false], ['nunito', 'Nunito', false], ['arredondada', 'Nunito', true],
  ['cormorant', 'Cormorant Garamond', false], ['garamond', 'Cormorant Garamond', false], ['de cinema', 'Cormorant Garamond', true], ['oswald', 'Oswald', false], ['de jornal', 'Oswald', true],
  ['vt323', 'VT323', false], ['pixel', 'VT323', true], ['pixelada', 'VT323', true], ['de computador antigo', 'VT323', true], ['retro', 'VT323', true], ['bungee', 'Bungee', false], ['de game', 'Bungee', true], ['rubik', 'Rubik', false],
  ['courier', 'Courier Prime', false], ['courier prime', 'Courier Prime', false], ['datilografada', 'Courier Prime', true], ['caveat', 'Caveat', false], ['kalam', 'Kalam', false], ['manuscrita', 'Kalam', true], ['escrita a mao', 'Kalam', true], ['de mao', 'Kalam', true], ['cursiva', 'Caveat', true],
  ['playfair', 'Playfair Display', false], ['playfair display', 'Playfair Display', false], ['de luxo', 'Playfair Display', true], ['luxuosa', 'Playfair Display', true],
];
const FONT_PHRASES = FONTS.map(([p]) => p);

const CAPTION_ANIM: [string, LookCaptions['animation']][] = [
  ['pulando', 'bounce'], ['quicando', 'bounce'], ['saltando', 'bounce'], ['bounce', 'bounce'], ['caindo', 'bounce'],
  ['digitando', 'typewriter'], ['maquina de escrever', 'typewriter'], ['letra por letra', 'typewriter'], ['aparecendo aos poucos', 'typewriter'], ['uma palavra de cada vez aparecendo', 'typewriter'], ['aparecendo palavra por palavra', 'typewriter'],
  ['subindo', 'rise'], ['deslizando', 'slide'], ['de lado', 'slide'], ['slide', 'slide'], ['entrando de lado', 'slide'],
  ['aparecendo suave', 'fade'], ['surgindo', 'fade'], ['fade', 'fade'], ['suave', 'fade'], ['suavemente', 'fade'], ['esmaecendo', 'fade'],
  ['pop', 'pop'], ['estourando', 'pop'], ['explodindo', 'pop'], ['crescendo', 'pop'], ['pipocando', 'pop'],
  ['parada', 'none'], ['parado', 'none'], ['estatica', 'none'], ['sem animacao', 'none'], ['sem animacoes', 'none'], ['sem movimento', 'none'],
];
const EMOJI_ANIM: [string, LookEmoji['animation']][] = [
  ['pulando', 'bounce'], ['quicando', 'bounce'], ['saltando', 'bounce'], ['girando', 'spin'], ['rodando', 'spin'], ['flutuando', 'float'], ['boiando', 'float'], ['balancando', 'float'],
  ['aparecendo suave', 'fade'], ['surgindo', 'fade'], ['suave', 'fade'], ['estourando', 'pop'], ['pop', 'pop'], ['pipocando', 'pop'], ['parados', 'none'], ['parado', 'none'], ['sem animacao', 'none'],
];

const HIGHLIGHT_MODE: [string, LookCaptions['highlightMode']][] = [
  ['em caixa', 'box'], ['numa caixa', 'box'], ['em caixinha', 'box'], ['com caixa', 'box'], ['sublinhado', 'underline'], ['sublinhada', 'underline'], ['sublinhar', 'underline'], ['grifado', 'underline'], ['grifada', 'underline'],
  ['karaoke', 'reveal'], ['acendendo', 'reveal'], ['acende', 'reveal'], ['colorida', 'color'], ['colorido', 'color'], ['em outra cor', 'color'],
  ['com marca texto', 'marker'], ['de marca texto', 'marker'], ['riscada', 'marker'], ['riscado', 'marker'], ['com marcador', 'marker'], ['marcada', 'marker'],
];

const CUTS: [string, CutLevel][] = [
  ['cortes rapidos', 'agressivo'], ['corte rapido', 'agressivo'], ['cortes mais rapidos', 'agressivo'], ['mais cortes', 'agressivo'], ['corte agressivo', 'agressivo'], ['cortes agressivos', 'agressivo'], ['corte seco', 'agressivo'], ['cortes secos', 'agressivo'],
  ['corta as pausas', 'agressivo'], ['corte as pausas', 'agressivo'], ['cortar as pausas', 'agressivo'], ['corta os silencios', 'agressivo'], ['corte os silencios', 'agressivo'], ['cortar os silencios', 'agressivo'], ['corta os respiros', 'agressivo'],
  ['tira as pausas', 'agressivo'], ['tire as pausas', 'agressivo'], ['tirar as pausas', 'agressivo'], ['tira os silencios', 'agressivo'], ['tire os silencios', 'agressivo'], ['sem pausas', 'agressivo'], ['sem pausa', 'agressivo'], ['sem silencio', 'agressivo'], ['sem silencios', 'agressivo'],
  ['jump cut', 'agressivo'], ['jump cuts', 'agressivo'], ['edicao rapida', 'agressivo'], ['corta tudo', 'agressivo'], ['corta mais', 'agressivo'], ['cortes dinamicos', 'agressivo'], ['pausas curtas tambem', 'agressivo'],
  ['cortes suaves', 'suave'], ['corte suave', 'suave'], ['menos cortes', 'suave'], ['corta menos', 'suave'], ['corte menos', 'suave'], ['mantem as pausas', 'suave'], ['mantenha as pausas', 'suave'], ['deixa as pausas', 'suave'], ['deixe as pausas', 'suave'],
  ['sem enrolacao', 'agressivo'], ['corta a enrolacao', 'agressivo'], ['direto ao ponto', 'agressivo'], ['corta tudo que for pausa', 'agressivo'], ['ritmo de tiktok', 'agressivo'], ['sem respiro', 'agressivo'],
  ['sem cortes bruscos', 'suave'], ['sem corte brusco', 'suave'], ['sem cortar muito', 'suave'], ['nao corta demais', 'suave'], ['respeita as pausas', 'suave'],
  ['com pausas', 'suave'], ['nao corta muito', 'suave'], ['nao corte muito', 'suave'], ['respira mais', 'suave'], ['mais respiro', 'suave'], ['cortes normais', 'normal'],
];
const CUT_PHRASES = CUTS.map(([p]) => p);
const CUT_OF = new Map(CUTS);

const TRANSITION_KIND: [string, NonNullable<Look['transition']>][] = [
  ['de zoom', 'zoom'], ['zoom', 'zoom'], ['flash', 'flash'], ['piscando', 'flash'], ['piscada', 'flash'], ['branca', 'flash'], ['clarao', 'flash'],
  ['suave', 'dip'], ['suaves', 'dip'], ['escurecendo', 'dip'], ['preta', 'dip'], ['fade', 'dip'], ['escura', 'dip'], ['escurecer', 'dip'], ['nenhuma', 'none'],
];

const TOGGLE_ON = 'com|coloca|coloque|colocar|adiciona|adicione|adicionar|inclua|incluir|quero|mostra|mostre|mostrar|poe|ponha|bota|bote|use|usar|tenha|ter|liga|ligue|ative|ativa|volta|volte'.split('|');
const TOGGLES: [string, SceneToggle][] = [
  ['barra de progresso', 'barra'], ['barra', 'barra'], ['barrinha', 'barra'], ['titulo', 'titulo'], ['titulo de abertura', 'titulo'], ['zoom', 'zoom'], ['zooms', 'zoom'], ['transicao', 'transicoes'], ['transicoes', 'transicoes'],
  ['lista', 'listas'], ['listas', 'listas'], ['numeros grandes', 'numeros'], ['numero grande', 'numeros'], ['nome na tela', 'nome'], ['meu nome', 'nome'], ['chamada final', 'chamada'], ['cta', 'chamada'], ['palavras chave', 'destaques'], ['palavras em destaque', 'destaques'],
  ['perguntas em destaque', 'perguntas'],
];
const TOGGLE_PHRASES = TOGGLES.map(([p]) => p);
/** Valem sozinhas, em qualquer lugar (sem "com"/"coloca"): nome de quem fala na tela. */
const BARE_TOGGLES: [string, SceneToggle][] = [
  ['meu nome na tela', 'nome'], ['nome do convidado', 'nome'], ['nome do convidado na tela', 'nome'], ['nome de quem fala', 'nome'], ['nome do entrevistado', 'nome'], ['nome de quem esta falando', 'nome'],
];
const TOGGLE_OF = new Map(TOGGLES);

const HOOK_WORDS: [string, HookStyle][] = [
  ['criativo', 'criativo'], ['criativa', 'criativo'], ['diferente', 'criativo'], ['diferenciado', 'criativo'], ['diferenciada', 'criativo'], ['original', 'criativo'], ['inusitado', 'criativo'], ['unico', 'criativo'], ['surpreendente', 'criativo'],
  ['inesperado', 'criativo'], ['fora da caixa', 'criativo'], ['fora do comum', 'criativo'], ['inovador', 'criativo'], ['diferentao', 'criativo'], ['nao obvio', 'criativo'], ['menos obvio', 'criativo'],
  ['pergunta', 'pergunta'], ['perguntando', 'pergunta'], ['em pergunta', 'pergunta'], ['questionando', 'pergunta'], ['com pergunta', 'pergunta'],
  ['numero', 'numero'], ['com numero', 'numero'], ['dado', 'numero'], ['estatistica', 'numero'], ['com dado', 'numero'],
  ['impactante', 'impacto'], ['chocante', 'impacto'], ['polemico', 'impacto'], ['polemica', 'impacto'], ['agressivo', 'impacto'], ['de impacto', 'impacto'], ['marcante', 'impacto'],
];
const HOOK_PHRASES = HOOK_WORDS.map(([p]) => p);
const HOOK_OF = new Map(HOOK_WORDS);
const HOOK_NOUNS = ['gancho', 'hook', 'abertura', 'comeco', 'inicio', 'primeira frase'];

/** Pedidos conhecidos que o app ainda não faz (frase amigável para "Ainda não sei fazer"). */
const UNSUPPORTED: [string[], string][] = [
  [['melhora o audio', 'melhorar o audio', 'melhore o audio', 'audio melhor', 'limpa o audio', 'limpar o audio', 'tirar o ruido', 'tira o ruido', 'ruido', 'barulho de fundo', 'tira o barulho', 'tirar o barulho', 'eco', 'chiado no audio', 'aumenta o volume', 'volume da voz', 'voz mais alta'], 'melhorar o áudio (tirar ruído, eco, volume)'],
  [['contador regressivo', 'contagem regressiva', 'contador de tempo', 'contador na tela', 'cronometro', 'timer'], 'contador ou cronômetro na tela'],
  [['seta', 'setas', 'setinha', 'setinhas', 'flecha', 'apontando'], 'setas e marcações apontando coisas no vídeo'],
  [['loop', 'em looping'], 'vídeo em loop'],
  [['preco riscado', 'frete gratis', 'endereco', 'localizacao', 'crm', 'oab', 'numero da oab', 'registro profissional', 'telefone', 'texto escrito', 'escrever na tela', 'texto na tela', 'cupom', 'codigo de desconto'], 'texto na tela que você não falou (endereço, localização, preço, cupom, CRM, OAB)'],
  [['lado a lado', 'tela dividida', 'split screen', 'dividir a tela', 'tela dividida em duas'], 'tela dividida (lado a lado)'],
  [['quiz', 'enquete', 'caixinha de pergunta', 'caixinha de perguntas'], 'quiz ou enquete'],
  [['grafico', 'graficos', 'grafico subindo'], 'gráficos animados'],
  [['mapa', 'trajeto', 'mapa do trajeto'], 'mapa ou trajeto'],
  [['planta baixa'], 'planta do imóvel'],
  [['drone', 'imagem aerea', 'imagens aereas'], 'imagens de drone'],
  [['luz', 'luzes', 'luz celestial', 'efeito de luz', 'raio de luz', 'brilho no fundo'], 'efeitos de luz no vídeo'],
  [['tremer', 'tremer a tela', 'tela tremendo', 'tremida', 'shake'], 'tremer a tela'],
  [['print', 'prints', 'captura de tela', 'screenshot'], 'print ou imagem na tela'],
  [['spotify', 'deezer', 'youtube music', 'apple music'], 'link de música (Spotify e outros)'],
  [['divide em varios', 'dividir em varios', 'divide em varios cortes', 'varios cortes', 'varios videos', 'separar em cortes', 'separa em cortes', 'fazer varios cortes'], 'dividir em vários vídeos (cortes)'],
  [['legenda de cada um', 'cor por pessoa', 'cada pessoa com uma cor', 'duas pessoas falando'], 'uma cor de legenda para cada pessoa'],
  [['formato quadrado', 'pra quadrado', 'para quadrado', 'quadrado', 'horizontal', 'deitado', 'formato paisagem', 'modo paisagem', 'formato do youtube', '16 por 9', '1 por 1', '4 por 5', 'formato feed'], 'outro formato (o app faz só vertical 9:16)'],
  [['hashtag', 'hashtags', 'legenda do post', 'descricao do post', 'texto do post', 'copy do post', 'legenda pro post'], 'texto do post e hashtags'],
  [['tira o fundo do video', 'tirar o fundo do video', 'remover o fundo', 'remove o fundo', 'fundo desfocado', 'desfoca o fundo', 'desfocar o fundo', 'desfoque no fundo', 'chroma', 'chroma key', 'fundo verde', 'trocar o fundo', 'troca o fundo', 'mudar o fundo do video'], 'mudar o fundo do vídeo (desfocar ou trocar)'],
  [['agenda pra postar', 'agendar postagem', 'agendar a postagem', 'agenda a postagem', 'postar automatico', 'postar direto', 'publicar direto', 'posta pra mim', 'posta direto', 'programar a postagem', 'pra postar amanha'], 'agendar ou postar direto na rede'],
  [['vicios de linguagem', 'vicio de linguagem', 'vicios', 'gaguejada', 'gaguejadas', 'gagueira', 'repeticoes', 'erros de fala', 'tira os erros', 'tirar os erros'], 'tirar vícios de fala (é, hã, né) e gaguejadas'],
  [['corrige', 'corrigir', 'corrija', 'erros de portugues', 'ortografia', 'erro de portugues'], 'corrigir o português da legenda sozinho (corrija à mão na aba Legendas)'],
  [['transicao de roupa', 'troca de roupa', 'troca de look', 'transicao de look'], 'transição de roupa (troca de look)'],
  [['enquadra', 'enquadrar', 'enquadre', 'seguir quem fala', 'acompanhar o rosto'], 'reenquadrar seguindo o rosto'],
  [['cores mais vivas', 'mais vivas', 'mais vivo', 'mais saturado', 'saturar', 'cores vivas', 'filtro de pele', 'pele lisa'], 'filtro de cor no vídeo'],
  [['som de', 'barulhinho', 'barulhinhos'], 'música ou efeitos sonoros'],
  [['musica', 'musicas', 'musica de fundo', 'musicas de fundo', 'musiquinha de fundo', 'trilha de fundo', 'som ambiente', 'trilha', 'trilha sonora', 'som de fundo', 'efeito sonoro', 'efeitos sonoros', 'sonoplastia', 'barulho', 'barulhos', 'audio de fundo', 'audio em alta', 'audio do momento', 'trend'], 'música ou efeitos sonoros'],
  [['narracao', 'locucao', 'dublagem', 'voz de ia', 'voz robotica', 'mudar a voz'], 'voz ou narração'],
  [['filtro', 'filtros', 'filtro de cor', 'preto e branco', 'saturacao', 'brilho do video', 'contraste do video', 'vintage', 'cor do video mais', 'color grading', 'colorizacao'], 'filtro de cor no vídeo'],
  [['logo', 'logotipo', 'marca dagua', 'marca d agua', 'watermark'], 'logo ou marca-d’água'],
  [['gif', 'gifs', 'meme', 'memes'], 'GIFs e memes'],
  [['em ingles', 'em espanhol', 'traducao', 'traduzir', 'traduzida', 'bilingue', 'outro idioma'], 'legenda em outro idioma'],
  [['imagens', 'fotos', 'foto', 'b roll', 'broll', 'cenas extras', 'imagens de apoio', 'video de fundo'], 'imagens de apoio (b-roll)'],
  [['3d', 'tridimensional'], 'efeitos 3D'],
  [['seguir o rosto', 'reenquadrar', 'enquadramento', 'tracking', 'zoom no rosto'], 'reenquadrar seguindo o rosto'],
  [['camera lenta', 'slow motion', 'acelerar o video', 'velocidade', 'mais rapido o video', 'timelapse'], 'mudar a velocidade do vídeo'],
  [['degrade', 'gradiente', 'gradient'], 'degradê na legenda'],
  [['thumbnail', 'capa', 'miniatura'], 'capa do vídeo'],
  [['viral', 'viralizar', 'viralize', 'bombar', 'milhoes de views'], 'garantir que viralize (ninguém consegue prometer)'],
  [['legenda dupla', 'duas legendas', 'karaoke duplo'], 'duas legendas ao mesmo tempo'],
  [['cor dos emojis', 'emoji colorido de outra cor'], 'mudar a cor dos emojis'],
];

const MOOD: [string, string][] = [
  ['cores quentes', '#FF8C1A'], ['cor quente', '#FF8C1A'], ['tons quentes', '#FF8C1A'], ['cores frias', '#3B82F6'], ['tons frios', '#3B82F6'], ['cor fria', '#3B82F6'],
  ['tons pastel', '#FBCFE8'], ['cores pastel', '#FBCFE8'], ['tom pastel', '#FBCFE8'], ['cores neutras', '#E5E5E5'], ['tons neutros', '#E5E5E5'], ['tons terrosos', '#B45309'], ['cores terrosas', '#B45309'],
];
const MOOD_PHRASES = MOOD.map(([p]) => p);
const MOOD_OF = new Map(MOOD);

const SECONDS = new Set(['segundo', 'segundos', 'seg', 'segs', 's']);
const COLOR_GLUE = new Set(['cor', 'cores', 'tom', 'tons', 'na', 'no', 'em', 'de', 'da', 'do', 'com', 'e', 'a', 'o', 'as', 'os', 'bem', 'mais', 'tipo', 'estilo']);

export function parseLookRules(prompt: string, toks: Token[], used: boolean[]): LookRulesResult {
  const mark = (from: number, n: number) => {
    for (let k = from; k < from + n; k++) if (k >= 0 && k < used.length) used[k] = true;
  };
  const free = (i: number, n = 1) => {
    for (let k = i; k < i + n; k++) if (!toks[k] || used[k]) return false;
    return true;
  };
  const captions: LookCaptions = {};
  const emoji: LookEmoji = {};
  const look: Look = {};
  const notes: string[] = [];
  const unsupported: string[] = [];
  let wantsHook = false;
  let hookStyle: HookStyle | null = null;
  const prefer: Emoji[] = [];
  const emphasize: 'palavras'[] = [];

  // 0) emojis digitados no pedido viram preferidos (só os que o app tem)
  for (const m of prompt.matchAll(/\p{Extended_Pictographic}️?/gu)) {
    const e = normalizeEmoji(m[0]);
    if (e && !prefer.includes(e)) prefer.push(e);
    else if (!e && !unsupported.some((u) => u.includes(m[0]))) unsupported.push(`o emoji ${m[0]} (ainda não tenho esse)`);
  }

  // 1) pedidos conhecidos que ainda não existem
  for (let i = 0; i < toks.length; i++) {
    for (const [phrases, label] of UNSUPPORTED) {
      const p = longestAt(toks, i, phrases);
      if (p && free(i, p.split(' ').length)) {
        mark(i, p.split(' ').length);
        if (!unsupported.includes(label)) unsupported.push(label);
      }
    }
  }

  // 2) estilo do gancho: "gancho criativo", "gancho diferenciado e criativo", "começa com uma pergunta"
  for (let i = 0; i < toks.length; i++) {
    const noun = longestAt(toks, i, HOOK_NOUNS);
    if (!noun || used[i]) continue;
    let k = i + noun.split(' ').length;
    let hit = -1;
    while (k < toks.length && k <= i + 6 && !isBoundary(toks[k])) {
      const p = longestAt(toks, k, HOOK_PHRASES);
      if (p) {
        hookStyle ??= HOOK_OF.get(p)!;
        hit = k + p.split(' ').length - 1;
        k += p.split(' ').length;
        continue;
      }
      if (['e', 'mais', 'bem', 'mais', 'muito', 'com', 'uma', 'um', 'super', 'tipo', 'de', 'que', 'seja', 'algo', 'bastante'].includes(toks[k]!.norm)) {
        k++;
        continue;
      }
      break;
    }
    if (hit >= 0) {
      wantsHook = true;
      mark(i, hit - i + 1);
    }
  }
  for (let i = 0; i < toks.length; i++) {
    if (!free(i)) continue;
    const p = longestAt(toks, i, ['comeca com uma pergunta', 'comece com uma pergunta', 'comecar com uma pergunta', 'abre com uma pergunta', 'abrir com uma pergunta', 'comeca com pergunta', 'abre com pergunta']);
    if (p) {
      wantsHook = true;
      hookStyle ??= 'pergunta';
      mark(i, p.split(' ').length);
    }
  }

  // 3) ritmo dos cortes
  for (let i = 0; i < toks.length; i++) {
    const p = longestAt(toks, i, CUT_PHRASES);
    if (p && free(i, p.split(' ').length)) {
      if (look.cuts && look.cuts !== CUT_OF.get(p)) notes.push(`Cortes: você pediu "${look.cuts}" e "${CUT_OF.get(p)}"; ficou ${look.cuts} (o primeiro).`);
      look.cuts ??= CUT_OF.get(p)!;
      mark(i, p.split(' ').length);
    }
  }

  // 4) "N palavras por linha", "uma palavra por vez", "palavra por palavra"
  for (let i = 0; i < toks.length; i++) {
    if (!free(i)) continue;
    if (phraseAt(toks, i, 'palavra por palavra') && toks[i - 1]?.norm !== 'aparecendo') {
      captions.wordsAtOnce = 1;
      mark(i, 3);
      continue;
    }
    const n = numberAt(toks, i);
    if (!n) continue;
    const k = i + n.used;
    if (!['palavra', 'palavras'].includes(toks[k]?.norm ?? '')) continue;
    const tail = longestAt(toks, k + 1, ['por linha', 'em cada linha', 'por vez', 'de cada vez', 'por legenda', 'por tela', 'na tela']);
    if (!tail) continue;
    const v = Math.round(n.value);
    if (tail.includes('linha')) {
      if (v >= 1 && v <= 6) captions.wordsPerLine = v;
      else notes.push(`Palavras por linha vão de 1 a 6; ignorei ${v}.`);
    } else if (v >= 1 && v <= 8) captions.wordsAtOnce = v;
    else notes.push(`Palavras por vez vão de 1 a 8; ignorei ${v}.`);
    mark(i, k - i + 1 + tail.split(' ').length);
  }

  // 5) partes do pedido (separadas por pontuação)
  const clauses: [number, number][] = [];
  let start = 0;
  for (let i = 0; i <= toks.length; i++) {
    if (i === toks.length || isBoundary(toks[i]) || toks[i]!.norm === 'mas' || toks[i]!.norm === 'porem') {
      if (i > start) clauses.push([start, i]);
      start = i + 1;
    }
  }
  // alvo herdado: "legenda grande em cima, amarela com contorno preto" — a parte que começa com uma cor
  // sem dizer de quem fala continua falando da legenda da parte anterior
  let carry: { i: number; n: number; t: Target; neg: boolean } | null = null;
  for (const [a, b] of clauses) carry = parseClause(a, b, carry);

  function negatedBefore(i: number): boolean {
    const p1 = toks[i - 1]?.norm ?? '';
    const p2 = toks[i - 2]?.norm ?? '';
    if (FORBID_BEFORE.has(p1)) return true;
    if (FORBID_BEFORE.has(p2) && ['de', 'os', 'as', 'o', 'a', 'nenhum', 'nenhuma', 'mais'].includes(p1)) return true;
    return NEG_PAIRS.some((n) => `${p2} ${p1}` === n || `${toks[i - 3]?.norm} ${p2}` === n);
  }

  function parseClause(a: number, b: number, inherited: { i: number; n: number; t: Target; neg: boolean } | null): { i: number; n: number; t: Target; neg: boolean } | null {
    // alvos da parte
    const targets: { i: number; n: number; t: Target; neg: boolean }[] = [];
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const p = longestAt(toks, i, TARGET_PHRASES);
      if (!p) continue;
      // "caixa alta/baixa" é maiúscula/minúscula, não a caixa atrás da legenda
      if (p === 'caixa' && ['alta', 'baixa'].includes(toks[i + 1]?.norm ?? '')) continue;
      const n = p.split(' ').length;
      if (i + n > b) continue;
      targets.push({ i, n, t: TARGET_OF.get(p)!, neg: negatedBefore(i) });
      i += n - 1;
    }
    const usedTargets = new Set<number>();
    const ownerOf = (i: number): (typeof targets)[number] | null => {
      const before = targets.filter((t) => t.i < i).at(-1);
      if (before) return before;
      if (inherited && i === a) return inherited;
      return targets.find((t) => t.i > i) ?? null;
    };
    const claim = (i: number, n: number, owner: (typeof targets)[number] | null) => {
      mark(i, n);
      if (owner) usedTargets.add(owner.i);
    };
    const hasFontWord = targets.some((t) => t.t === 'caption' && ['fonte', 'fontes', 'letra', 'letras'].includes(toks[t.i]!.norm));

    // alvo negado: "sem fundo", "sem contorno", "sem emojis" (este fica para as proibições)
    for (const t of targets) {
      if (!t.neg) continue;
      if (t.t === 'box') {
        captions.box = 'none';
        claim(t.i - 1, t.n + 1, t);
      } else if (t.t === 'stroke') {
        captions.strokeWidth = 0;
        claim(t.i - 1, t.n + 1, t);
      }
    }
    const live = targets.filter((t) => !t.neg);
    const emojiTarget = live.find((t) => t.t === 'emoji');
    const anyNeg = targets.some((t) => t.neg && t.t === 'emoji');

    // cores pelo clima ("cores quentes", "tons pastel"): só a cor das animações, se a parte não disser outra
    let mood: string | null = null;
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const m = longestAt(toks, i, MOOD_PHRASES);
      if (!m) continue;
      mood = MOOD_OF.get(m)!;
      mark(i, m.split(' ').length);
    }
    // "marca-texto" como alvo já diz o jeito do destaque
    for (const t of targets) if (!t.neg && t.t === 'highlight' && phraseAt(toks, t.i, 'marca texto')) {
      captions.highlightMode = 'marker';
      usedTargets.add(t.i);
    }

    // cores
    const colors: { hex: string; owner: (typeof targets)[number] | null; i: number }[] = [];
    const words = toks.map((t) => t.norm);
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const flag = longestAt(toks, i, ['cor da bandeira', 'cores da bandeira', 'cor da bandeira do brasil', 'cores da bandeira do brasil', 'cores do brasil', 'cor do brasil', 'verde amarelo', 'verde amarela', 'cores brasileiras', 'bem brasileira']);
      if (flag) {
        const n = flag.split(' ').length;
        const owner = ownerOf(i);
        colors.push({ hex: '#22C55E', owner, i }, { hex: '#FFD400', owner, i });
        claim(i, n, owner);
        i += n - 1;
        continue;
      }
      const c = colorFromWords(words, i);
      if (!c || i + c.used > b) continue;
      // "preto e branco" logo depois de "vídeo"/"filtro" é filtro (já tratado como "ainda não sei")
      const owner = ownerOf(i);
      if (owner?.neg) continue;
      colors.push({ hex: c.hex, owner: owner && !owner.neg ? owner : null, i });
      claim(i, c.used, owner);
      i += c.used - 1;
    }
    if (colors.length) {
      for (let i = a; i < b; i++) if (!used[i] && ['cor', 'cores', 'tom', 'tons', 'tonalidade'].includes(toks[i]!.norm)) mark(i, 1);
      // cores da marca: a primeira vira a cor das animações e do destaque; a segunda, a do destaque
      const brand = colors.filter((c) => c.owner?.t === 'brand');
      if (brand.length) {
        look.accent = brand[0]!.hex;
        captions.highlight ??= (brand[1] ?? brand[0])!.hex;
      }
      const loose = colors.filter((c) => !c.owner || c.owner.t === 'caption');
      for (const c of colors) {
        const t = c.owner?.t;
        if (t === 'highlight') captions.highlight = c.hex;
        else if (t === 'stroke') captions.stroke = c.hex;
        else if (t === 'box') captions.box = c.hex;
        else if (t === 'accent' || t === 'transition') look.accent = c.hex;
        else if (t === 'keyword') {
          captions.keyword = c.hex;
          if (!emphasize.includes('palavras')) emphasize.push('palavras');
        }
        else if (t === 'emoji') {
          if (!unsupported.includes('mudar a cor dos emojis')) unsupported.push('mudar a cor dos emojis');
        }
      }
      const captionOwned = loose.some((c) => c.owner?.t === 'caption');
      if (loose.length >= 2) {
        captions.text = loose[0]!.hex;
        captions.highlight ??= loose[1]!.hex;
        if (loose.length >= 3) captions.stroke ??= loose[2]!.hex;
      } else if (loose.length === 1) {
        if (captionOwned) captions.text = loose[0]!.hex;
        else {
          captions.highlight ??= loose[0]!.hex;
          look.accent ??= loose[0]!.hex;
        }
      }
    }

    if (mood && colors.length === 0) look.accent ??= mood;

    // tamanho
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const p = longestAt(toks, i, SIZE_PHRASES);
      if (!p) continue;
      const owner = ownerOf(i);
      if (!owner || owner.neg || !['caption', 'emoji'].includes(owner.t)) continue;
      const v = SIZE_OF.get(p)!;
      if (owner.t === 'emoji') emoji.scale = v;
      else captions.scale = v;
      claim(i, p.split(' ').length, owner);
    }

    // posição e altura em porcentagem
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const p = longestAt(toks, i, POSITION_PHRASES);
      if (p) {
        const owner = ownerOf(i);
        const onScreen = p.endsWith('tela');
        if ((!owner && !onScreen) || owner?.neg) continue;
        const pos = POSITION_OF.get(p)!;
        if (owner?.t === 'emoji') emoji.position = pos === 'center' ? 'middle' : pos;
        else if (pos === 'left' || pos === 'right') continue;
        else captions.position = pos;
        claim(i, p.split(' ').length, owner);
        continue;
      }
      const m = /^(\d{1,2})%$/.exec(toks[i]!.norm);
      const owner = ownerOf(i);
      if (m && owner && owner.t === 'caption' && !owner.neg) {
        const v = Number(m[1]) / 100;
        if (v >= 0.05 && v <= 0.95) {
          captions.y = v;
          claim(i, 1, owner);
          const tail = longestAt(toks, i + 1, ['da tela', 'da altura', 'de altura', 'para baixo', 'do topo']);
          if (tail) mark(i + 1, tail.split(' ').length);
        }
      }
    }

    // caixa das letras (não precisa de alvo: só a legenda tem)
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const up = longestAt(toks, i, CASE_UPPER);
      const low = longestAt(toks, i, CASE_LOWER);
      const p = up && (!low || up.length >= low.length) ? up : low;
      if (!p) continue;
      const neg = ['sem', 'nao', 'nada'].includes(toks[i - 1]?.norm ?? '') || (toks[i - 2]?.norm === 'sem' && ['letra', 'letras', 'tudo'].includes(toks[i - 1]?.norm ?? ''));
      captions.case = neg ? 'none' : p === up ? 'upper' : 'lower';
      claim(neg ? i - 1 : i, neg ? p.split(' ').length + 1 : p.split(' ').length, ownerOf(i));
    }

    // fonte
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const p = longestAt(toks, i, FONT_PHRASES);
      if (!p) continue;
      const f = FONTS.find(([w]) => w === p)!;
      if (f[2] && !hasFontWord) continue;
      captions.font = f[1];
      claim(i, p.split(' ').length, ownerOf(i));
    }

    // entrada (da legenda ou dos emojis)
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const owner = ownerOf(i);
      if (!owner || owner.neg) continue;
      if (owner.t === 'emoji') {
        const p = longestAt(toks, i, EMOJI_ANIM.map(([w]) => w));
        if (!p) continue;
        emoji.animation = EMOJI_ANIM.find(([w]) => w === p)![1];
        claim(i, p.split(' ').length, owner);
      } else if (owner.t === 'caption' || owner.t === 'highlight') {
        const hm = longestAt(toks, i, HIGHLIGHT_MODE.map(([w]) => w));
        if (hm && (owner.t === 'highlight' || hm !== 'em caixa')) {
          captions.highlightMode = HIGHLIGHT_MODE.find(([w]) => w === hm)![1];
          claim(i, hm.split(' ').length, owner);
          continue;
        }
        const p = longestAt(toks, i, CAPTION_ANIM.map(([w]) => w));
        if (!p || owner.t !== 'caption') continue;
        captions.animation = CAPTION_ANIM.find(([w]) => w === p)![1];
        claim(i, p.split(' ').length, owner);
      }
    }

    // espessura do contorno: "contorno grosso", "contorno preto fino"
    for (let i = a; i < b; i++) {
      if (used[i]) continue;
      const w = toks[i]!.norm;
      const owner = ownerOf(i);
      if (owner?.t !== 'stroke' || owner.neg || !['grosso', 'grossa', 'fino', 'fina', 'forte', 'grossinho'].includes(w)) continue;
      captions.strokeWidth = w.startsWith('fin') ? 5 : 16;
      claim(i, 1, owner);
    }
    // contorno/fundo sem cor: "com contorno", "com fundo"
    for (const t of live) {
      if (t.t === 'stroke' && !captions.stroke && captions.strokeWidth === undefined) {
        if (toks[t.i - 1]?.norm === 'com') {
          captions.strokeWidth = 10;
          claim(t.i - 1, 1, t);
        }
      }
      if (t.t === 'box' && !captions.box && toks[t.i - 1]?.norm === 'com') {
        captions.box = '#111111';
        claim(t.i - 1, 1, t);
      }
    }

    // emojis: frequência, modo e preferidos
    if (emojiTarget && !anyNeg) {
      usedTargets.add(emojiTarget.i);
      let mode: LookEmoji['mode'] | null = null;
      for (let i = a; i < b; i++) {
        if (used[i]) continue;
        // "a cada 3 segundos", "a cada 3s", "a cada segundo", "de 5 em 5 segundos"
        if (phraseAt(toks, i, 'a cada') || phraseAt(toks, i, 'cada')) {
          const k = i + (toks[i]!.norm === 'a' ? 2 : 1);
          const n = numberAt(toks, k);
          if (n && (n.unitS || SECONDS.has(toks[k + n.used]?.norm ?? ''))) {
            const v = n.value;
            if (v >= 1 && v <= 30) {
              emoji.everySec = v;
              mode = 'interval';
            } else notes.push(`Emojis: o intervalo vai de 1 a 30 segundos; ignorei ${String(v).replace('.', ',')}.`);
            mark(i, k - i + n.used + (n.unitS ? 0 : 1));
            continue;
          }
          if (SECONDS.has(toks[k]?.norm ?? '')) {
            emoji.everySec = 1;
            mode = 'interval';
            mark(i, k - i + 1);
            continue;
          }
          const unit = longestAt(toks, k, ['frase', 'fala', 'palavra importante', 'palavra chave']);
          if (unit) {
            mode = 'keywords';
            mark(i, k - i + unit.split(' ').length);
            continue;
          }
        }
        if (toks[i]!.norm === 'de') {
          const n1 = numberAt(toks, i + 1);
          if (n1 && toks[i + 1 + n1.used]?.norm === 'em') {
            const n2 = numberAt(toks, i + 2 + n1.used);
            if (n2 && SECONDS.has(toks[i + 2 + n1.used + n2.used]?.norm ?? '')) {
              if (n1.value >= 1 && n1.value <= 30) {
                emoji.everySec = n1.value;
                mode = 'interval';
              }
              mark(i, 3 + n1.used + n2.used);
              continue;
            }
          }
        }
        const kw = longestAt(toks, i, ['nas palavras chave', 'nas palavras importantes', 'nas palavras', 'quando fizer sentido', 'combinando com a fala', 'que combinem', 'que combinem com a fala', 'de acordo com a fala', 'conforme a fala', 'no ritmo da fala']);
        if (kw) {
          mode = 'keywords';
          mark(i, kw.split(' ').length);
          continue;
        }
        const many = longestAt(toks, i, ['muitos', 'varios', 'bastante', 'monte de', 'o tempo todo', 'toda hora', 'muito']);
        if (many && !mode) {
          emoji.everySec = 2;
          mode = 'interval';
          mark(i, many.split(' ').length);
          continue;
        }
        const few = longestAt(toks, i, ['poucos', 'alguns', 'de vez em quando', 'as vezes', 'pouquinhos']);
        if (few && !mode) {
          emoji.everySec = 6;
          mode = 'interval';
          mark(i, few.split(' ').length);
          continue;
        }
        // "emoji de fogo", "emojis de coração e foguete"
        if ((toks[i]!.norm === 'de' || toks[i]!.norm === 'tipo') && i > emojiTarget.i) {
          let k = i + 1;
          while (k < b) {
            if (['e', 'ou', 'o', 'a'].includes(toks[k]!.norm)) {
              k++;
              continue;
            }
            const e = NAMED_EMOJI[toks[k]!.norm] ?? emojiForWord(toks[k]!.norm);
            if (!e) break;
            if (!prefer.includes(e)) prefer.push(e);
            mark(i, k - i + 1);
            k++;
          }
        }
      }
      emoji.mode = mode ?? emoji.mode ?? 'interval';
      if (emoji.mode === 'interval') emoji.everySec ??= 4;
    }

    // transição: "transição flash", "transição suave"
    for (const t of live.filter((x) => x.t === 'transition')) {
      const k = t.i + t.n;
      const p = longestAt(toks, k, TRANSITION_KIND.map(([w]) => w)) ?? longestAt(toks, k + 1, TRANSITION_KIND.map(([w]) => w));
      if (p) {
        look.transition = TRANSITION_KIND.find(([w]) => w === p)![1];
        const at = phraseAt(toks, k, p) ? k : k + 1;
        claim(t.i, at - t.i + p.split(' ').length, t);
      }
    }

    // intensidade exata: "intensidade 80%", "animação em 50%"
    for (let i = a; i < b; i++) {
      if (used[i] || !['intensidade', 'animacao', 'movimento'].includes(toks[i]!.norm)) continue;
      for (let k = i + 1; k <= i + 3 && k < b; k++) {
        const m = /^(\d{1,3})%$/.exec(toks[k]!.norm);
        if (m) {
          const v = Number(m[1]) / 100;
          if (v >= 0 && v <= 1) {
            look.motion = v;
            mark(i, k - i + 1);
          }
          break;
        }
      }
    }

    // marca os alvos usados
    for (const t of targets) if (usedTargets.has(t.i)) mark(t.i, t.n);
    return live.filter((t) => t.t === 'caption').at(-1) ?? null;
  }

  // 6) cenas ligadas: "com barra de progresso", "coloca zoom"
  for (let i = 0; i < toks.length; i++) {
    if (!free(i) || !TOGGLE_ON.includes(toks[i]!.norm)) continue;
    let k = i + 1;
    while (toks[k] && ['a', 'o', 'uma', 'um', 'os', 'as', 'de', 'novo'].includes(toks[k]!.norm)) k++;
    const p = longestAt(toks, k, TOGGLE_PHRASES);
    if (!p || !free(k, p.split(' ').length)) continue;
    look.scenes = { ...look.scenes, [TOGGLE_OF.get(p)!]: true };
    mark(i, k - i + p.split(' ').length);
  }

  // cena pedida sozinha numa parte ("barra de progresso", "meu nome na tela") ou "zoom no produto"
  for (let i = 0; i < toks.length; i++) {
    if (!free(i)) continue;
    const startOfClause = i === 0 || isBoundary(toks[i - 1]);
    const p = longestAt(toks, i, [...TOGGLE_PHRASES, ...BARE_TOGGLES.map(([w]) => w)]);
    if (!p || !free(i, p.split(' ').length)) continue;
    const n = p.split(' ').length;
    const zoomOn = (p === 'zoom' || p === 'zooms') && ['no', 'na', 'nos', 'nas', 'em'].includes(toks[i + 1]?.norm ?? '');
    const alone = startOfClause && (i + n === toks.length || isBoundary(toks[i + n]));
    const bare = BARE_TOGGLES.find(([w]) => w === p);
    if (!zoomOn && !alone && !bare) continue;
    const key = bare ? bare[1] : TOGGLE_OF.get(p)!;
    look.scenes = { ...look.scenes, [key]: true };
    mark(i, zoomOn ? n + 1 : n);
  }

  if (prefer.length) {
    emoji.prefer = prefer.slice(0, 8);
    if (!emoji.mode) {
      emoji.mode = 'interval';
      emoji.everySec ??= 4;
    }
  }
  if (Object.keys(captions).length) look.captions = captions;
  if (Object.keys(emoji).length) look.emoji = emoji;
  return { look, wantsHook, hookStyle, notes, unsupported, emphasize };
}

/** Nomes de emoji comuns ("emoji de fogo"). */
const NAMED_EMOJI: Record<string, Emoji> = {
  fogo: '🔥', foguinho: '🔥', coracao: '❤️', coracoes: '❤️', foguete: '🚀', dinheiro: '💰', risada: '😂', risadas: '😂', rindo: '😂', estrela: '⭐', estrelas: '⭐',
  brilho: '✨', brilhos: '✨', lampada: '💡', trofeu: '🏆', alvo: '🎯', raio: '⚡', check: '✅', certinho: '✅', joinha: '👍', palmas: '👏', olhos: '👀', olhinho: '👀',
  sacola: '🛒', sacolinha: '🛒', carrinho: '🛒', compras: '🛒', presente: '🎁', presentes: '🎁', musculo: '💪', biceps: '💪', forca: '💪', livro: '📚', livros: '📚', celular: '📱', computador: '💻',
  oracao: '🙏', maos: '🙏', amem: '🙏', susto: '😱', choque: '😱', duvida: '🤔', pensando: '🤔', apaixonado: '😍', apaixonada: '😍', oculos: '😎', relogio: '⏰', grafico: '📈', megafone: '📣', sino: '🔔', cem: '💯', chave: '🔑',
  explosao: '💥', cerebro: '🧠', medalha: '🥇', diamante: '💎', festa: '🎉', sol: '☀️', lua: '🌙', planta: '🌱', cafe: '☕', pizza: '🍕', casa: '🏠', aviao: '✈️',
};
