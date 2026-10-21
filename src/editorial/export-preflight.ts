import { AppError } from '../core/errors';
import { editPlanSchema } from '../core/schema';
import type { EditPlan } from '../core/types';
import { clipLayout } from '../engine/clips';
import { outputDuration } from '../engine/timeline';

export interface ExportPreflight {
  durationSec: number;
  frames: number;
  sourceIds: string[];
  warnings: string[];
}

export function buildExportPreflight(plan: EditPlan, availableSources: ReadonlySet<string>, hasAudio: boolean): ExportPreflight {
  const parsed = editPlanSchema.safeParse(plan);
  if (!parsed.success) throw new AppError('PRODUCAO_INVALIDA', parsed.error.issues.map(issue => issue.path.join('.')).slice(0, 3).join(', '));
  const sourceIds = new Set<string>();
  const sources = clipLayout(plan.clips);
  for (const segment of plan.segments) {
    const source = sources.find(span => segment.srcStart >= span.start - 0.000001 && segment.srcEnd <= span.end + 0.000001);
    if (!source || !availableSources.has(source.id)) {
      throw new AppError('EXPORTACAO_FONTES', source?.id || 'trecho sem fonte válida');
    }
    sourceIds.add(source.id);
  }
  const durationSec = outputDuration(plan.segments);
  return { durationSec, frames: Math.ceil(durationSec * plan.output.fps), sourceIds: [...sourceIds], warnings: hasAudio ? [] : ['O arquivo será exportado sem áudio.'] };
}
