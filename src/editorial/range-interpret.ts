import { AppError } from '../core/errors';
import type { Emphasis, Level, Pace, Prohibition, Tone } from '../core/brief';
import { lookIsEmpty, rangeLook, type Look } from '../core/look';
import { interpretPrompt, stripAccents } from './interpret';

/**
 * Pedido para um trecho ("mais calmo aqui", "sem animação aqui", "troca essa animação",
 * "destaque isso", "trava esse pedaço"). Frases próprias de trecho são lidas primeiro; o resto do
 * texto passa pelo mesmo intérprete do pedido geral, do qual só valem tom, intensidade, ritmo,
 * proibições e destaques (estilo, objetivo, público e gancho são do vídeo inteiro).
 */
export interface RangeRequest {
  prompt: string;
  /** true = travar, false = destravar, null = não falou */
  lock: boolean | null;
  reset: boolean;
  swap: boolean;
  accent: boolean;
  quiet: boolean;
  tone: Tone | null;
  intensity: Level | null;
  pace: Pace | null;
  forbid: Prohibition[];
  emphasize: Emphasis[];
  /** cores, tamanho, posição, emojis etc. só deste trecho (sem os campos do vídeo inteiro) */
  look: Look;
  /** o que foi pedido e o app ainda não sabe fazer */
  unsupported: string[];
  notes: string[];
  ignored: string[];
  understood: boolean;
}

export const RANGE_PROMPT_MAX = 200;

interface Rule {
  re: RegExp;
  apply: (r: RangeRequest) => void;
}

/** Ordem importa: "destrava" antes de "trava"; cada trecho casado é apagado do texto antes da próxima regra. */
const RULES: Rule[] = [
  { re: /\b(destrav\w*|desbloque\w*|libera(r)?|solta(r)?)\b( (esse|este|essa|esta|o|a))?( (pedaco|trecho|parte))?/g, apply: (r) => (r.lock = false) },
  { re: /\b(trav\w*|bloque\w*|congel\w*|nao mex\w*( mais)?( nisso| aqui)?|deixa assim|fixa(r)?|fixe)\b( (esse|este|essa|esta|o|a))?( (pedaco|trecho|parte))?/g, apply: (r) => (r.lock = true) },
  { re: /\b(volta(r)? ao normal|volte ao normal|como (estava|era)|desfaz(er)? (aqui|isso|esse trecho)|tira(r)? os ajustes|sem ajustes|limpa(r)? os ajustes|normal de novo)\b/g, apply: (r) => (r.reset = true) },
  {
    re: /\b(troca(r)?|troque|muda(r)?|mude|substitu\w*)( (essa|esta|a|de|o|esse|este))? (animac\w*|efeito|efeitos|cena|cenas)\b|\b(outra animacao|outro efeito|outra cena|animacao diferente|outra coisa aqui|troca isso|troca aqui|troque isso)\b/g,
    apply: (r) => (r.swap = true),
  },
  {
    re: /\b(sem (nenhuma )?animac\w*|nenhuma animacao|sem nada|nada aqui|so a legenda|so legenda|sem efeito nenhum|limpo aqui|deixa limpo|tira (as )?animac\w*|tire (as )?animac\w*)\b/g,
    apply: (r) => (r.quiet = true),
  },
  {
    re: /\b(destaq\w*|destac\w*|realc\w*|enfatiz\w*|ressalt\w*) (isso|aqui|esse|essa|este|esta|esse trecho|essa parte|esse pedaco)\b|\b(da destaque|mais destaque|chama atencao aqui|chame atencao aqui)\b|^\s*(destaque|destaca|realce|enfatize)[\s!.]*$/g,
    apply: (r) => (r.accent = true),
  },
];

/** Palavras de "lugar" que só dizem que o pedido é para este trecho. */
const HERE = /\b(aqui|nesse|neste|nessa|nesta|esse|este|essa|esta|isso|trecho|pedaco|parte|so|por favor|favor)\b/g;

export function interpretRangePrompt(text: string): RangeRequest {
  const prompt = text.replace(/\s+/g, ' ').trim();
  if (!prompt) throw new AppError('PEDIDO_VAZIO');
  if (prompt.length > RANGE_PROMPT_MAX) throw new AppError('PEDIDO_LONGO', `${prompt.length} caracteres (no trecho, até ${RANGE_PROMPT_MAX})`);
  const r: RangeRequest = {
    prompt,
    lock: null,
    reset: false,
    swap: false,
    accent: false,
    quiet: false,
    tone: null,
    intensity: null,
    pace: null,
    forbid: [],
    emphasize: [],
    look: {},
    unsupported: [],
    notes: [],
    ignored: [],
    understood: false,
  };
  let rest = ` ${stripAccents(prompt.toLowerCase()).replace(/[^\p{L}\p{N}%$#,.;!? ]+/gu, ' ')} `;
  for (const rule of RULES) {
    rest = rest.replace(rule.re, () => {
      rule.apply(r);
      return ' , ';
    });
  }
  rest = rest.replace(HERE, ' ').replace(/\s+/g, ' ').trim();
  if (/[\p{L}\p{N}]/u.test(rest)) {
    const { brief, understood } = interpretPrompt(rest);
    if (understood) {
      r.tone = brief.tone;
      r.intensity = brief.intensity;
      r.pace = brief.pace;
      r.forbid = brief.forbid;
      r.emphasize = brief.emphasize;
      const { look, removed } = rangeLook(brief.look);
      r.look = look;
      r.notes.push(...brief.notes.conflicts);
      if (brief.preset || brief.goal || brief.audience || brief.wantsHook || removed.length > 0) {
        const extra = removed.length ? `, ${removed.join(', ')}` : '';
        r.notes.push(`Estilo, objetivo, público, gancho${extra} valem para o vídeo inteiro: use o pedido geral ("O que você quer?").`);
      }
    }
    r.unsupported = brief.unsupported;
    r.ignored = brief.notes.ignored;
  }
  if (r.quiet && (r.accent || r.swap || r.emphasize.length > 0)) {
    r.accent = false;
    r.swap = false;
    r.emphasize = [];
    if (r.look.emoji) delete r.look.emoji;
    r.notes.push('Você pediu "sem animação" e também um destaque ou troca: "sem animação" vale mais neste trecho.');
  }
  r.understood = r.lock !== null || r.reset || r.swap || r.accent || r.quiet || !!r.tone || !!r.intensity || !!r.pace || r.forbid.length > 0 || r.emphasize.length > 0 || !lookIsEmpty(r.look);
  return r;
}
