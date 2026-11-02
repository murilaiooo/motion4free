import { MarianTokenizer } from '@huggingface/transformers';
import { describe, expect, it } from 'vitest';
import { availableLanguageTokens, marianInputIds, PT_BR_TOKENS, type MarianTokenizerLike } from '../src/translation/marian';

/**
 * #175: tokenizer Marian de verdade (transformers.js 4.x) com vocabulário sintético pequeno.
 * Prova o defeito da biblioteca (o código de idioma não vira o primeiro token) e a correção.
 */
function tokenizer(languageScore: number) {
  const vocab: [string, number][] = [
    ['<pad>', 0], ['</s>', 0], ['<unk>', 0], ['▁', -2], ['>>pt_BR<<', languageScore], ['>>fr<<', languageScore],
    ['▁Hello', -3], [',', -3], ['▁how', -3], ['▁are', -3], ['▁you', -3], ['?', -3],
    ['>', -8], ['<', -8], ['pt', -6], ['_', -6], ['BR', -6], ['fr', -6],
  ];
  const special = (id: number, content: string) => ({ id, content, single_word: false, lstrip: false, rstrip: false, normalized: false, special: true });
  const json = {
    version: '1.0', truncation: null, padding: null, normalizer: null,
    added_tokens: [special(0, '<pad>'), special(1, '</s>'), special(2, '<unk>')],
    pre_tokenizer: { type: 'Metaspace', replacement: '▁', add_prefix_space: true, prepend_scheme: 'always' },
    post_processor: {
      type: 'TemplateProcessing',
      single: [{ Sequence: { id: 'A', type_id: 0 } }, { SpecialToken: { id: '</s>', type_id: 0 } }],
      pair: [{ Sequence: { id: 'A', type_id: 0 } }, { Sequence: { id: 'B', type_id: 0 } }, { SpecialToken: { id: '</s>', type_id: 0 } }],
      special_tokens: { '</s>': { id: '</s>', ids: [1], tokens: ['</s>'] } },
    },
    decoder: { type: 'Metaspace', replacement: '▁', add_prefix_space: true, prepend_scheme: 'always' },
    model: { type: 'Unigram', unk_id: 2, vocab },
  };
  const tok = new MarianTokenizer(json, { model_max_length: 512, eos_token: '</s>', unk_token: '<unk>', pad_token: '<pad>' });
  return { tok, pieces: vocab.map(([p]) => p) };
}

describe('entrada do OPUS-MT com código de idioma (#175)', () => {
  it('reproduz o defeito: tokenizer(">>pt_BR<< texto") não põe o idioma como primeiro token', () => {
    for (const score of [-20, -1000]) {
      const { tok, pieces } = tokenizer(score);
      const ids = (tok('>>pt_BR<< Hello, how are you?', { return_tensor: false }) as { input_ids: number[] }).input_ids;
      expect(ids[0]).not.toBe(tok.convert_tokens_to_ids('>>pt_BR<<'));
      // com pontuação baixa o código vira pedaços de texto (">", "pt", "_", "BR"…), que o modelo copia para a saída
      if (score === -1000) expect(ids.map((i) => pieces[i])).toEqual(expect.arrayContaining(['pt', '_', 'BR']));
    }
  });

  it('marianInputIds monta [idioma, texto…, </s>] como o MarianTokenizer do Python', () => {
    for (const score of [-20, -1000]) {
      const { tok } = tokenizer(score);
      const like = tok as unknown as MarianTokenizerLike;
      const [pt] = availableLanguageTokens(like);
      expect(pt).toEqual({ token: '>>pt_BR<<', id: 4 });
      const ids = marianInputIds(like, pt!.id, '  Hello,   how are you? ');
      expect(ids).toEqual([4, ...tok.encode('Hello, how are you?')]);
      expect(ids.at(-1)).toBe(1);
      expect(ids.filter((i) => i === 4)).toHaveLength(1);
    }
  });

  it('só oferece códigos de português que existem no vocabulário e recusa texto com código embutido', () => {
    const { tok } = tokenizer(-20);
    const like = tok as unknown as MarianTokenizerLike;
    expect(availableLanguageTokens(like).map((l) => l.token)).toEqual(['>>pt_BR<<']);
    expect(availableLanguageTokens(like, ['>>es<<'])).toEqual([]);
    expect(PT_BR_TOKENS[0]).toBe('>>pt_BR<<');
    expect(() => marianInputIds(like, 4, '>>fr<< Hello')).toThrow();
  });
});
