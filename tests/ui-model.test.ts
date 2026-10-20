import { describe, expect, it } from 'vitest';
import { PROCESSING_STEPS, processingStep } from '../src/core/steps';
import { filterTemplates, listTemplates, templateTags } from '../src/core/templates';
import { PRESETS } from '../src/core/presets';

describe('passos do processamento', () => {
  it('cada mensagem do processamento cai num passo, em ordem', () => {
    expect(processingStep('Abrindo o vídeo')).toBe(0);
    expect(processingStep('Abrindo o projeto salvo')).toBe(0);
    expect(processingStep('Lendo o áudio')).toBe(0);
    expect(processingStep('Procurando silêncios')).toBe(1);
    expect(processingStep('Baixando o modelo de transcrição (só na primeira vez)')).toBe(2);
    expect(processingStep('Transcrevendo a fala')).toBe(2);
    expect(processingStep('Montando a edição')).toBe(3);
    expect(processingStep('qualquer outra coisa')).toBe(0);
    expect(PROCESSING_STEPS).toHaveLength(4);
  });
});

describe('galeria de modelos (adaptador)', () => {
  it('um modelo por estilo, com nome, descrição, etiquetas e o estilo', () => {
    const list = listTemplates();
    expect(list.map((t) => t.id)).toEqual(PRESETS.map((p) => p.id));
    for (const t of list) {
      expect(t.name).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.style.id).toBe(t.id);
    }
  });

  it('filtra por etiqueta; "Todos" mostra tudo', () => {
    const list = listTemplates();
    const tags = templateTags(list);
    expect(new Set(tags).size).toBe(tags.length);
    expect(filterTemplates(list, null)).toEqual(list);
    const some = filterTemplates(list, tags[0]!);
    expect(some.length).toBeGreaterThan(0);
    expect(some.every((t) => t.tags.includes(tags[0]!))).toBe(true);
  });
});
