import { z } from 'zod';
import { FORMAT_IDS } from './formats';
import { FONT_FAMILIES, TRANSITIONS } from './style';
import { TEMPLATE_IDS } from './templates';

export const creativeSetupSchema = z.object({
  version: z.literal(1),
  goal: z.enum(['ensinar', 'vender', 'inspirar', 'entreter', 'informar']),
  audience: z.string().trim().max(60),
  platform: z.enum(['reels', 'tiktok', 'shorts', 'youtube', 'feed', 'other']),
  format: z.enum(FORMAT_IDS),
  preset: z.enum(TEMPLATE_IDS),
  tone: z.enum(['calmo', 'energetico', 'elegante', 'serio', 'divertido', 'inspirador', 'acolhedor']),
  pace: z.enum(['lento', 'normal', 'rapido']),
  cutPolicy: z.enum(['preserve', 'gentle', 'balanced']),
  durationSec: z.number().finite().int().min(15).max(180).nullable(),
  hook: z.boolean(),
  captionStyle: z.enum(['highlight', 'minimal']),
  /** 'auto' (v0.41) = a fonte, a cor, o movimento e a transição do próprio modelo escolhido */
  font: z.union([z.literal('auto'), z.enum(FONT_FAMILIES)]),
  accent: z.union([z.literal('auto'), z.string().regex(/^#[0-9A-F]{6}$/)]),
  motion: z.union([z.literal('auto'), z.number().finite().min(0).max(1)]),
  transition: z.enum(['auto', ...TRANSITIONS]),
  cta: z.string().trim().max(32).refine(value => !value || /^[\p{L}\p{N} .,!?:;'"“”‘’@#%&$+\-/()]{2,32}$/u.test(value)),
  reference: z.string().trim().max(240),
  preserve: z.string().trim().max(240),
  avoid: z.string().trim().max(240),
  prompt: z.string().trim().max(500),
});

export type CreativeSetup = z.infer<typeof creativeSetupSchema>;

/**
 * Até a v0.40 as perguntas iniciais gravavam Inter, amarelo, movimento 35% e corte seco como se fossem
 * escolhas, e isso apagava a cara de todo modelo. Quem ainda tem exatamente esses valores salvos passa
 * para "do modelo" (v0.41); um valor diferente foi escolhido de propósito e fica.
 */
export function migrateSetupDefaults<T extends Pick<CreativeSetup, 'font' | 'accent' | 'motion' | 'transition'>>(setup: T): T {
  return {
    ...setup,
    font: setup.font === 'Inter' ? 'auto' : setup.font,
    accent: setup.accent === '#FFD400' ? 'auto' : setup.accent,
    motion: setup.motion === 0.35 ? 'auto' : setup.motion,
    transition: setup.transition === 'none' ? 'auto' : setup.transition,
  };
}

export const DEFAULT_SETUP: CreativeSetup = {
  version: 1, goal: 'ensinar', audience: '', platform: 'reels', format: 'vertical',
  preset: 'gigante', tone: 'calmo', pace: 'normal', cutPolicy: 'balanced', durationSec: null,
  hook: true, captionStyle: 'highlight', font: 'auto', accent: 'auto',
  motion: 'auto', transition: 'auto', cta: '', reference: '', preserve: '', avoid: '', prompt: '',
};

export const PLATFORM_LABELS: Record<CreativeSetup['platform'], string> = {
  reels: 'Instagram Reels', tiktok: 'TikTok', shorts: 'YouTube Shorts', youtube: 'YouTube', feed: 'Feed / anúncio', other: 'Outro destino',
};

export interface EditorialDecision {
  kind: 'cuts' | 'duration' | 'style' | 'captions' | 'hook' | 'audio';
  description: string;
}

export interface SceneEvidence {
  sceneId: string;
  name: string;
  start: number;
  end: number;
  wordIds: string[];
  coverage: 'nearby-speech' | 'configured-or-manual';
  notes: string[];
}
export interface EditorialPlan {
  version: 1;
  decisions: EditorialDecision[];
  warnings: string[];
  sceneEvidence?: SceneEvidence[];
  metrics: { sourceSeconds: number; outputSeconds: number; removedSeconds: number; captionCount: number; sceneCount: number };
}
