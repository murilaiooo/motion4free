import { M2M100Tokenizer } from '@huggingface/transformers';
import { describe, expect, it } from 'vitest';
import { groupPieces } from '../src/analysis/asr-merge';
import { ASR_CANDIDATES, NO_CAPABILITY, asrLadder, ladderForLanguage, whisperOptions, type AsrCapability } from '../src/core/asr-models';
import { LANGUAGES, LANGUAGE_CODES, arabicOrUrdu, dominantScript, readableText, scriptsIn, visualLength, wordWeight } from '../src/core/languages';
import { editPlanSchema } from '../src/core/schema';
import { buildCaptions } from '../src/editorial/captions';
import { applySubtitleTranslation, translatedCaptions, translationGroups } from '../src/editorial/subtitle-translation';
import { checkTranslation, detectTextLanguage } from '../src/editorial/translation-check';
import { autoEdit } from '../src/editorial/auto-edit';
import { layoutTokens } from '../src/render/captions';
import { wrapText } from '../src/render/layout';
import { scriptFontFilesFor } from '../src/media/script-fonts';
import { m2mInputIds, m2mLanguageId } from '../src/translation/m2m';
import { translationEngine } from '../src/translation/protocol';

const GPU: AsrCapability = { webgpu: true, f16: true, memoryGB: 8, gpu: 'dedicada', gpuName: 'RTX' };

describe('as 10 línguas mais faladas (v0.45.0)', () => {
  it('a tabela tem as 10, todas com nome no Whisper e código no M2M100', () => {
    expect(LANGUAGE_CODES).toEqual(['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur']);
    for (const code of LANGUAGE_CODES) {
      expect(whisperOptions(false, code).language).toBe(LANGUAGES[code].whisper);
      expect(LANGUAGES[code].m2m).toBe(code);
    }
  });

  it('Parakeet nunca transcreve chinês, hindi, árabe, bengali ou urdu; segue nas europeias', () => {
    const ladder = asrLadder('precisa', NO_CAPABILITY);
    expect(ladder).toContain('parakeet-wasm');
    for (const code of ['zh', 'hi', 'ar', 'bn', 'ur'] as const) {
      const l = ladderForLanguage(ladder, code, NO_CAPABILITY);
      expect(l.length).toBeGreaterThan(0);
      expect(l.every((id) => ASR_CANDIDATES[id].engine === 'whisper')).toBe(true);
    }
    expect(ladderForLanguage(ladder, 'es', NO_CAPABILITY)).toEqual(ladder);
    expect(ladderForLanguage(ladder, 'auto', NO_CAPABILITY)).toEqual(ladder);
    // a pessoa escolheu só o Parakeet no cardápio: cai na escada do Whisper
    expect(ladderForLanguage(['parakeet-webgpu'], 'hi', GPU)[0]).toBe('turbo-webgpu');
  });

  it('reconhece a escrita e a língua de cada uma', () => {
    const samples: Record<string, string> = {
      en: 'This is the first tip and you do not need anything else.',
      zh: '这是第一个技巧，你不需要别的东西。',
      hi: 'यह पहला सुझाव है और आपको कुछ और नहीं चाहिए।',
      es: 'Este es el primer consejo y no necesitas nada más, de verdad.',
      fr: "C'est le premier conseil et vous n'avez besoin de rien d'autre.",
      ar: 'هذه هي النصيحة الأولى ولا تحتاج إلى أي شيء آخر.',
      bn: 'এটি প্রথম পরামর্শ এবং আপনার আর কিছু দরকার নেই।',
      pt: 'Essa é a primeira dica e você não precisa de mais nada.',
      ru: 'Это первый совет, и вам больше ничего не нужно.',
      ur: 'یہ پہلا مشورہ ہے اور آپ کو کسی اور چیز کی ضرورت نہیں ہے۔',
    };
    for (const [code, text] of Object.entries(samples)) expect(detectTextLanguage(text), code).toBe(code);
    expect(detectTextLanguage('OK')).toBeNull();
    expect(arabicOrUrdu(samples.ur!)).toBe('ur');
    expect(arabicOrUrdu(samples.ar!)).toBe('ar');
    expect(dominantScript(samples.bn!)).toBe('bengali');
    expect([...scriptsIn('Olá 你好 مرحبا')].sort()).toEqual(['arabic', 'han', 'latin']);
  });

  it('chinês: cada caractere vira palavra com tempo próprio; pontuação fica com o anterior', () => {
    const words = groupPieces([
      { text: '你', timestamp: [0, 0.2] }, { text: '好', timestamp: [0.2, 0.4] }, { text: '，', timestamp: [0.4, 0.45] },
      { text: '世', timestamp: [0.5, 0.7] }, { text: '界', timestamp: [0.7, 0.9] }, { text: '。', timestamp: [0.9, 1] },
    ]);
    expect(words.map((w) => w.text)).toEqual(['你', '好，', '世', '界。']);
    // a legenda guarda espaço entre palavras (tempo de cada uma), mas se lê e conta sem ele
    expect(readableText('你 好， 世 界。')).toBe('你好，世界。');
    expect(visualLength('你 好')).toBe(4);
    expect(wordWeight('你')).toBe(0.5);
    expect(wordWeight('hello')).toBe(1);
  });

  it('chinês: a legenda junta caracteres pelo tamanho na tela e fecha no 。', () => {
    const chars = '我们今天学习三个技巧。然后开始。'.split('');
    const ws = chars.map((text, i) => ({ id: String(i), text, start: i * 0.15, end: i * 0.15 + 0.14 }));
    const caps = buildCaptions(ws, [{ srcStart: 0, srcEnd: 5 }], { maxChars: 22, maxWords: 8, maxDurationSec: 3 });
    expect(caps[0]!.text.endsWith('。')).toBe(true);
    for (const c of caps) expect(visualLength(c.text)).toBeLessThanOrEqual(22 + 8);
    expect(caps.map((c) => readableText(c.text)).join('')).toBe('我们今天学习三个技巧。然后开始。');
  });

  it('desenho: chinês sem espaço quebra por caractere; árabe fica uma palavra por token', () => {
    expect(layoutTokens('你好，世界')).toEqual(['你', '好，', '世', '界']);
    expect(layoutTokens('你 好')).toEqual(['你', '好']);
    expect(layoutTokens('مرحبا بالعالم')).toEqual(['مرحبا', 'بالعالم']);
    const lines = wrapText('我们今天学习三个技巧', 5, (s) => [...s].length);
    expect(lines).toEqual(['我们今天学', '习三个技巧']);
  });

  it('fontes: só baixa os pedaços da escrita que o texto usa', () => {
    expect(scriptFontFilesFor('Hello, olá, привет')).toEqual([]);
    const zh = scriptFontFilesFor('你好世界');
    expect(zh.length).toBeGreaterThan(0);
    expect(zh.every((f) => f.family === 'Noto Sans SC')).toBe(true);
    expect(zh.length).toBeLessThan(5);
    expect(scriptFontFilesFor('یہ پہلا').map((f) => f.family)).toEqual(['Noto Sans Arabic']);
    expect(scriptFontFilesFor('नमस्ते').map((f) => f.family)).toEqual(['Noto Sans Devanagari']);
    expect(scriptFontFilesFor('নমস্কার').map((f) => f.family)).toEqual(['Noto Sans Bengali']);
  });
});

describe('tradução entre as 10 (v0.45.0)', () => {
  it('inglês → português continua no OPUS-MT; os outros pares vão pelo M2M100', () => {
    expect(translationEngine('en', 'pt')).toBe('opus');
    expect(translationEngine('pt', 'en')).toBe('m2m');
    expect(translationEngine('ru', 'zh')).toBe('m2m');
  });

  it('confere a escrita e a língua de destino de cada trecho', () => {
    expect(checkTranslation('Hello, how are you?', '你好，你好吗？', 'zh', 'en')).toBeNull();
    expect(checkTranslation('Hello, how are you?', 'Hello, how are you?', 'zh', 'en')).toBe('original');
    expect(checkTranslation('Привет, как дела?', 'Hola, ¿cómo estás?', 'es', 'ru')).toBeNull();
    expect(checkTranslation('Привет, как дела?', 'Привет, как дела?', 'es', 'ru')).toBe('outro-idioma');
    expect(checkTranslation('Hello friend', '__es__ Hola amigo', 'es', 'en')).toBe('marcador');
    expect(checkTranslation('This is the first tip.', 'यह पहला सुझाव है।', 'hi', 'en')).toBeNull();
    expect(checkTranslation('This is the first tip.', 'এটি প্রথম পরামর্শ।', 'hi', 'en')).toBe('outro-idioma');
    // urdu pedido, saiu árabe (sem as letras do urdu)
    expect(checkTranslation('This is the first tip and you need nothing else.', 'هذه هي النصيحة الأولى ولا تحتاج إلى أي شيء آخر.', 'ur', 'en')).toBe('outro-idioma');
    expect(checkTranslation('This is the first tip and you need nothing else.', 'یہ پہلا مشورہ ہے اور آپ کو کسی اور چیز کی ضرورت نہیں ہے۔', 'ur', 'en')).toBeNull();
    expect(checkTranslation('Essa é a dica.', 'This is the tip.', 'en', 'pt')).toBeNull();
    expect(checkTranslation('This is the tip.', 'Ceci est le conseil. Ceci est le conseil.', 'fr', 'en')).toBeNull();
    expect(checkTranslation('你好', '哈哈哈哈哈哈哈哈', 'zh', 'en')).toBe('repeticao');
  });

  it('faixa traduzida para chinês: legendas pelo tamanho na tela, sem espaços inventados', () => {
    const words = 'This is the first tip and it is simple. You do not need anything else.'.split(' ').map((text, i) => ({ id: `w${i}`, text, start: 0.5 + i * 0.3, end: 0.5 + i * 0.3 + 0.25 }));
    const plan = autoEdit(6, [], words);
    const groups = translationGroups(plan.captions);
    const zh = groups.map(() => '这是第一个技巧，很简单。你不需要别的东西。');
    const cues = translatedCaptions(groups, zh, 18, 'zh', 'en');
    expect(cues.every((c) => !c.text.includes(' '))).toBe(true);
    expect(cues.every((c) => visualLength(c.text) <= 18 + 2)).toBe(true);
    const out = applySubtitleTranslation(plan, cues, 'en', 'zh');
    expect(out.subtitleTranslation).toMatchObject({ sourceLanguage: 'en', targetLanguage: 'zh', active: 'translated' });
    expect(editPlanSchema.safeParse(out).success).toBe(true);
  });

  it('projeto salvo na v0.42–v0.44 (inglês → "pt-BR") abre como inglês → português', () => {
    const words = 'Hello world how are you'.split(' ').map((text, i) => ({ id: `w${i}`, text, start: i * 0.4, end: i * 0.4 + 0.3 }));
    const plan = autoEdit(3, [], words);
    const old = { ...plan, subtitleTranslation: { sourceLanguage: 'en', targetLanguage: 'pt-BR', active: 'pt-BR', original: plan.captions, translated: plan.captions } };
    const parsed = editPlanSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.subtitleTranslation).toMatchObject({ targetLanguage: 'pt', active: 'translated' });
    expect(editPlanSchema.safeParse({ ...old, subtitleTranslation: { ...old.subtitleTranslation, targetLanguage: 'en' } }).success).toBe(false);
  });
});

/** Tokenizer M2M100 de verdade (transformers.js 4.x) com vocabulário sintético pequeno. */
function m2mTokenizer() {
  const vocab: [string, number][] = [['<s>', 0], ['<pad>', 0], ['</s>', 0], ['<unk>', 0], ['▁Hello', -3], [',', -3], ['▁world', -3], ['▁', -2], ['__en__', 0], ['__pt__', 0], ['__zh__', 0]];
  const special = (id: number, content: string) => ({ id, content, single_word: false, lstrip: false, rstrip: false, normalized: false, special: true });
  const json = {
    version: '1.0', truncation: null, padding: null, normalizer: null,
    added_tokens: [special(0, '<s>'), special(1, '<pad>'), special(2, '</s>'), special(3, '<unk>'), special(8, '__en__'), special(9, '__pt__'), special(10, '__zh__')],
    pre_tokenizer: { type: 'Metaspace', replacement: '▁', add_prefix_space: true, prepend_scheme: 'always' },
    post_processor: {
      type: 'TemplateProcessing',
      single: [{ SpecialToken: { id: '__en__', type_id: 0 } }, { Sequence: { id: 'A', type_id: 0 } }, { SpecialToken: { id: '</s>', type_id: 0 } }],
      pair: [{ SpecialToken: { id: '__en__', type_id: 0 } }, { Sequence: { id: 'A', type_id: 0 } }, { Sequence: { id: 'B', type_id: 0 } }, { SpecialToken: { id: '</s>', type_id: 0 } }],
      special_tokens: { '__en__': { id: '__en__', ids: [8], tokens: ['__en__'] }, '</s>': { id: '</s>', ids: [2], tokens: ['</s>'] } },
    },
    decoder: { type: 'Metaspace', replacement: '▁', add_prefix_space: true, prepend_scheme: 'always' },
    model: { type: 'Unigram', unk_id: 3, vocab },
  };
  return new M2M100Tokenizer(json, { model_max_length: 512, eos_token: '</s>', unk_token: '<unk>', pad_token: '<pad>', bos_token: '<s>' });
}

describe('entrada do M2M100 montada à mão (v0.45.0)', () => {
  it('origem no começo, </s> no fim, nenhum código de língua dentro do texto', () => {
    const tok = m2mTokenizer();
    const pt = m2mLanguageId(tok, 'pt');
    const zh = m2mLanguageId(tok, 'zh');
    expect(pt).toBe(9);
    expect(zh).toBe(10);
    expect(m2mLanguageId(tok, 'xx')).toBeNull();
    // origem chinesa: o pós-processador padrão poria __en__; a montagem à mão põe __zh__
    const ids = m2mInputIds(tok, zh!, 'Hello, world');
    expect(ids[0]).toBe(10);
    expect(ids.at(-1)).toBe(2);
    expect(ids.slice(1, -1)).not.toContain(8);
    expect(ids.slice(1, -1)).toEqual(tok.encode('Hello, world', { add_special_tokens: false }));
    expect(() => m2mInputIds(tok, pt!, '__pt__ Hello')).toThrow();
  });
});
