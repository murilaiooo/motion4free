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
  font: z.enum(FONT_FAMILIES),
  accent: z.string().regex(/^#[0-9A-F]{6}$/),
  motion: z.number().finite().min(0).max(1),
  transition: z.enum(TRANSITIONS),
  cta: z.string().trim().max(32).refine(value => !value || /^[\p{L}\p{N} .,!?:;'"“”‘’@#%&$+\-/()]{2,32}$/u.test(value)),
  reference: z.string().trim().max(240),
  preserve: z.string().trim().max(240),
  avoid: z.string().trim().max(240),
  prompt: z.string().trim().max(500),
});

export type CreativeSetup = z.infer<typeof creativeSetupSchema>;

export const DEFAULT_SETUP: CreativeSetup = {
  version: 1, goal: 'ensinar', audience: '', platform: 'reels', format: 'vertical',
  preset: 'editorial', tone: 'calmo', pace: 'normal', cutPolicy: 'balanced', durationSec: null,
  hook: true, captionStyle: 'highlight', font: 'Inter', accent: '#FFD400',
  motion: 0.35, transition: 'none', cta: '', reference: '', preserve: '', avoid: '', prompt: '',
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
