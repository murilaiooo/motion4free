import { describe, expect, it } from 'vitest';
import { buildDictionary, translateText } from '../src/i18n/translate';
import { detectLocale } from '../src/i18n/locale';
import { EN } from '../src/i18n/dictionary';

describe('idioma da interface (ADR-0041)', () => {
  const dict = buildDictionary([
    {
      Exportar: 'Export',
      'Exportando {0}%': 'Exporting {0}%',
      'Gerando o clipe {0} de {1}': 'Creating clip {0} of {1}',
      'Projeto "{0}" apagado. Liberou {1}.': 'Project "{0}" deleted. Freed {1}.',
      'Sem {0}': 'Without {0}',
      emojis: 'emojis',
      '{0} de {1}': '{0} of {1}',
      'Ordem {1} antes de {0}': 'Order {0} after {1}',
    },
  ]);

  it('traduz texto exato e preserva os espaços das pontas', () => {
    expect(translateText('Exportar', dict)).toBe('Export');
    expect(translateText('  Exportar ', dict)).toBe('  Export ');
  });

  it('preenche as partes variáveis e troca vírgula decimal por ponto', () => {
    expect(translateText('Exportando 42%', dict)).toBe('Exporting 42%');
    expect(translateText('Gerando o clipe 3 de 10', dict)).toBe('Creating clip 3 of 10');
    expect(translateText('Projeto "Meu vídeo" apagado. Liberou 1,2 GB.', dict)).toBe('Project "Meu vídeo" deleted. Freed 1.2 GB.');
  });

  it('permite trocar a ordem das partes no inglês', () => {
    expect(translateText('Ordem B antes de A', dict)).toBe('Order A after B');
  });

  it('deixa em português o que não tem tradução, sem misturar idiomas', () => {
    expect(translateText('Texto novo ainda sem tradução', dict)).toBe('Texto novo ainda sem tradução');
    expect(translateText('Sem nada para fazer aqui', dict)).toBe('Sem nada para fazer aqui');
    expect(translateText('Sem emojis', dict)).toBe('Without emojis');
  });

  it('ignora padrões quase sem texto fixo', () => {
    expect(translateText('3 de 10', dict)).toBe('3 de 10');
  });

  it('segue o idioma do navegador: português fica em PT, o resto em EN', () => {
    expect(detectLocale(['pt-BR', 'en'])).toBe('pt');
    expect(detectLocale(['pt-PT'])).toBe('pt');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['es-ES', 'pt-BR'])).toBe('pt');
    expect(detectLocale(['fr-FR'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('o dicionário real traduz as mensagens de erro e mantém o código M4F', () => {
    expect(translateText('Formato de arquivo não reconhecido.', EN)).toBe('File format not recognized.');
    expect(translateText('Erro', EN)).toBe('Error');
    expect(translateText('Configurações', EN)).toBe('Settings');
  });
});
