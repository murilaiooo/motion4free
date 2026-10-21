import { describe, expect, it } from 'vitest';
import { contrast, hexToRgb } from '../src/core/color';
import { DEFAULT_SETUP } from '../src/core/production';
import { PRESETS } from '../src/core/presets';
import { autoEdit } from '../src/editorial/auto-edit';
import { applyBrief, applyReferencePalette, planStyle } from '../src/editorial/ops';
import { compileCreativeBrief } from '../src/editorial/production';
import { applyReference, MIN_CONTRAST } from '../src/editorial/reference';
import { applyRange } from '../src/editorial/ops';
import { interpretRangePrompt } from '../src/editorial/range-interpret';
import { styleAt } from '../src/editorial/ranges';
import { createHistory, pushHistory, undo, redo } from '../src/engine/history';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const colors = { colors: ['#C81E28', '#1428C8'] };
const brief = compileCreativeBrief(DEFAULT_SETUP);
const words = wordsFrom(SAMPLE_TEXT);
const ctx = { durationSec: words.at(-1)!.end + 0.5, words };

describe('prioridade de cores da imagem de referência #84', () => {
  it('imagem escolhida vence a cor padrão do Creative Setup em todos os presets', () => {
    for (const preset of PRESETS) {
      const fromBrief = planStyle(preset, brief, null);
      const withPhoto = planStyle(preset, brief, colors);
      expect(fromBrief.palette.accent, preset.id).toBe('#FFD400');
      expect(withPhoto.palette.accent, preset.id).not.toBe('#FFD400');
      expect(withPhoto.palette).toEqual(applyReference(fromBrief, colors).palette);
      expect(withPhoto.captions.colors.highlight).toBe(withPhoto.palette.accent);
      for (const hex of [withPhoto.palette.accent, withPhoto.palette.accent2]) {
        expect(contrast(hexToRgb(hex), [0, 0, 0])).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('preserva cor da legenda quando escolhida separadamente, sem confundir com destaque de marca', () => {
    const preset = PRESETS[0]!;
    const branded = planStyle(preset, brief, null);
    const custom = { ...branded, captions: { ...branded.captions, colors: { ...branded.captions.colors, highlight: '#12ADEF' } } };
    const withPhoto = applyReference(custom, colors);
    expect(withPhoto.captions.colors.highlight).toBe('#12ADEF');
    expect(withPhoto.palette.accent).not.toBe('#FFD400');
  });

  it('salvar/remover a referência restaura precisamente a cor do brief e preserva undo/redo', () => {
    const baseline = applyBrief(autoEdit(ctx.durationSec, [], words), ctx, brief);
    const withPhoto = applyReferencePalette(baseline, ctx, colors);
    expect(withPhoto.style.palette.accent).not.toBe('#FFD400');
    expect(withPhoto.brief).toEqual(baseline.brief);
    const restored = applyReferencePalette(withPhoto, ctx, null);
    expect(restored.style).toEqual(baseline.style);
    expect(restored.reference).toBeNull();

    const changes = pushHistory(createHistory(baseline), withPhoto);
    expect(undo(changes).present.style).toEqual(baseline.style);
    expect(redo(undo(changes)).present.style).toEqual(withPhoto.style);
  });

  it('um trecho com estilo próprio também usa a referência, sem voltar ao amarelo', () => {
    const original = applyBrief(autoEdit(ctx.durationSec, [], words), ctx, brief);
    const withPhoto = applyReferencePalette(original, ctx, colors);
    const revised = applyRange(withPhoto, ctx, { start: 5, end: 8 }, interpretRangePrompt('mais calmo aqui')).plan;
    expect(revised.ranges[0]!.style).not.toBeNull();
    expect(styleAt(revised, 6).palette.accent).toBe(withPhoto.style.palette.accent);
    expect(styleAt(revised, 6).palette.accent).not.toBe('#FFD400');
  });
});
