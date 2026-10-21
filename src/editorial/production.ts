import { sceneEvidence } from './decision-evidence';
import { EMPTY_BRIEF, briefSchema, type CreativeBrief } from '../core/brief';
import { AppError } from '../core/errors';
import { profileFor } from '../core/formats';
import { mergeLook } from '../core/look';
import { creativeSetupSchema, type CreativeSetup, type EditorialPlan } from '../core/production';
import { editPlanSchema } from '../core/schema';
import type { EditPlan, TimeRange } from '../core/types';
import { splitAtClips } from '../engine/clips';
import { outputDuration, sourceToOutput } from '../engine/timeline';
import { planKeepSegments } from './cuts';
import { sentencesOf } from './hooks';
import { interpretPrompt } from './interpret';
import { preserveManualScenes } from './scene-preservation';
import { applyBrief, rebuildAll, type EditContext } from './ops';

export function compileCreativeBrief(input: CreativeSetup): CreativeBrief {
  const setup = creativeSetupSchema.parse(input);
  const free = setup.prompt ? interpretPrompt(setup.prompt).brief : structuredClone(EMPTY_BRIEF);
  const avoid = setup.avoid ? interpretPrompt(setup.avoid.startsWith('sem ') ? setup.avoid : `sem ${setup.avoid}`).brief : EMPTY_BRIEF;
  const forbid = [...new Set([...free.forbid, ...avoid.forbid])];
  if (setup.motion === 0) forbid.push('efeitos', 'zoom', 'transicoes');
  if (!setup.hook) forbid.push('titulo');
  const brief: CreativeBrief = {
    ...free, production: setup, prompt: setup.prompt, source: 'regras', goal: setup.goal,
    audience: setup.audience || null, preset: setup.preset, tone: setup.tone, pace: setup.pace,
    wantsHook: setup.hook, hook: null, forbid: [...new Set(forbid)],
    unsupported: [...new Set([...free.unsupported, ...avoid.unsupported, ...(setup.avoid && !avoid.forbid.length ? ['Restrições sobre conteúdo exigem sua revisão manual.'] : [])])].slice(0, 8),
    look: mergeLook(free.look, {
      motion: setup.motion, transition: setup.transition, accent: setup.accent,
      captions: { font: setup.font, highlight: setup.accent, animation: setup.captionStyle === 'minimal' ? 'none' : 'fade', highlightMode: 'color' },
      ...(setup.cta ? { cta: setup.cta, scenes: { chamada: true } } : {}),
    }),
  };
  return briefSchema.parse(brief);
}

function validated(plan: EditPlan): EditPlan {
  const parsed = editPlanSchema.safeParse(plan);
  if (!parsed.success || outputDuration(plan.segments) <= 0) {
    throw new AppError('PRODUCAO_INVALIDA', parsed.success ? 'Timeline vazia' : parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).slice(0, 4).join('; '));
  }
  // o próprio plano, não a cópia do zod: nada de campo perdido nem identidade trocada
  return plan;
}

function direction(plan: EditPlan, ctx: EditContext, setup: CreativeSetup): EditPlan {
  const brief = compileCreativeBrief(setup);
  const source = setup.hook ? plan : { ...plan, brief: { ...plan.brief, hook: null } };
  const next = applyBrief(source, ctx, { ...brief, look: { ...brief.look, cuts: undefined } });
  if (setup.captionStyle === 'minimal') {
    next.style = { ...next.style, captions: { ...next.style.captions, activeScale: 1 } };
  }
  return { ...next, output: profileFor(setup.format, plan.output.fps) };
}

export function produceFirstDraft(base: EditPlan, ctx: EditContext, silences: TimeRange[], input: CreativeSetup): { plan: EditPlan; editorial: EditorialPlan } {
  const safeBase = validated(base.segments.length ? base : { ...base, segments: splitAtClips([{ srcStart: 0, srcEnd: ctx.durationSec }], base.clips) });
  const setup = creativeSetupSchema.parse(input);
  const hasSpeech = ctx.words.length > 0;
  const cutting = setup.cutPolicy !== 'preserve' && hasSpeech;
  const padSec = setup.cutPolicy === 'gentle' ? 0.22 : 0.12;
  const intervals = cutting ? silences.filter(range => range.end - range.start >= (setup.cutPolicy === 'gentle' ? 0.9 : 0.45)) : [];
  const kept = planKeepSegments(ctx.durationSec, intervals, ctx.words, { padSec, minKeepSec: 0.2 });
  const segments = splitAtClips(kept.length ? kept : [{ srcStart: 0, srcEnd: ctx.durationSec }], base.clips);
  let plan = direction({ ...safeBase, segments }, ctx, setup);
  if (setup.durationSec && hasSpeech && outputDuration(plan.segments) > setup.durationSec) {
    const ends = sentencesOf(ctx.words).filter(sentence => !sentence.byPause).map(sentence => sentence.words.at(-1)!.end);
    const candidates = ends.map(end => ({ end, output: sourceToOutput(plan.segments, end - 0.001) }))
      .filter((item): item is { end: number; output: number } => item.output !== null && item.output >= setup.durationSec! * 0.5 && item.output + 0.12 <= setup.durationSec!);
    const boundary = candidates.at(-1);
    if (boundary) {
      const lastWord = ctx.words.find(word => word.start >= boundary.end);
      const end = Math.min(ctx.durationSec, boundary.end + 0.12, lastWord?.start ?? ctx.durationSec);
      plan = rebuildAll({ ...plan, segments: plan.segments.filter(segment => segment.srcStart < end).map(segment => ({ ...segment, srcEnd: Math.min(segment.srcEnd, end) })) }, ctx);
    }
  }
  plan = validated(plan);
  return { plan, editorial: evaluateDraft(plan, ctx) };
}

export function reviseCreativeDirection(base: EditPlan, ctx: EditContext, input: CreativeSetup): EditPlan {
  validated(base);
  const setup = creativeSetupSchema.parse(input);
  const next = direction(base, ctx, setup);
  return validated(preserveManualScenes(base, { ...next, segments: base.segments, captions: base.captions, edits: base.edits }));
}

export function evaluateDraft(plan: EditPlan, ctx: EditContext): EditorialPlan {
  const setup = plan.brief.production;
  const duration = outputDuration(plan.segments);
  const warnings = [...plan.brief.unsupported, ...plan.brief.notes.conflicts, ...plan.brief.notes.ignored.map(note => `Não aplicado: ${note}`)];
  if (!ctx.words.length) warnings.push('Sem fala transcrita: preservei a sequência, sem inventar legendas ou gancho.');
  if (setup?.durationSec && Math.abs(duration - setup.durationSec) > 0.5) warnings.push(`Duração desejada: ${setup.durationSec} s. Mantive frases completas; o resultado tem ${duration.toFixed(1)} s.`);
  if (setup?.reference) warnings.push('A referência foi guardada como contexto. Não analisei nem copiei o estilo do link.');
  if (setup?.audience || setup?.preserve) warnings.push('Público e observações ficam no briefing. Não removi assuntos nem reordenei a fala por interpretação semântica.');
  warnings.push('Música e efeitos sonoros automáticos ainda não estão disponíveis. Mantive o áudio original.');
  if (setup?.hook && !plan.brief.hook) warnings.push('Não encontrei uma frase curta confiável para destacar na abertura.');
  const decisions: EditorialPlan['decisions'] = [
    { kind: 'cuts', description: ctx.durationSec - duration < 0.01 ? 'Sequência original preservada, sem cortes de pausas.' : `${Math.max(0, ctx.durationSec - duration).toFixed(1)} s fora da edição. Confira os cortes e o sentido na prévia.` },
    { kind: 'style', description: `Direção ${plan.style.name}; movimento ${Math.round(plan.style.motion.intensity * 100)}%.` },
    { kind: 'captions', description: `${plan.captions.length} legendas sincronizadas com o vídeo editado.` },
    { kind: 'hook', description: plan.brief.hook ? 'Frase real destacada como título de abertura; a fala mantém sua ordem.' : 'Abertura natural, sem frase inventada.' },
    { kind: 'audio', description: 'Áudio original acompanha os mesmos cortes do vídeo.' },
  ];
  return { version: 1, decisions, sceneEvidence: sceneEvidence(plan, ctx.words), warnings: [...new Set(warnings)], metrics: { sourceSeconds: ctx.durationSec, outputSeconds: duration, removedSeconds: Math.max(0, ctx.durationSec - duration), captionCount: plan.captions.length, sceneCount: plan.scenes.length } };
}
