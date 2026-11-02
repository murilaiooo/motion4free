import { describe, expect, it } from 'vitest';
import { WHISPER_MAX_TOKENS, afterStall, maxNewTokens, stallLimitSec } from '../src/core/asr-watchdog';
import { translateText } from '../src/i18n/translate';
import { EN } from '../src/i18n/dictionary';
import { formatDuration } from '../src/core/progress';

describe('vigia da transcrição (v0.45.1)', () => {
  it('limita o texto do Whisper pelo tamanho do trecho, sem passar do limite do modelo', () => {
    expect(maxNewTokens(10, 'en')).toBe(124);
    expect(maxNewTokens(30, 'en')).toBe(324);
    expect(maxNewTokens(30, 'zh')).toBe(384);
    // escritas que gastam mais pedaços (hindi, árabe…) e o automático ficam no limite do modelo em trechos longos
    expect(maxNewTokens(30, 'hi')).toBe(WHISPER_MAX_TOKENS);
    expect(maxNewTokens(30, 'auto')).toBe(WHISPER_MAX_TOKENS);
    expect(maxNewTokens(5, 'ar')).toBe(149);
    expect(maxNewTokens(Number.NaN, 'en')).toBe(324);
  });

  it('dá a cada trecho um tempo máximo folgado, maior no processador', () => {
    expect(stallLimitSec('webgpu', 20)).toBe(150);
    expect(stallLimitSec('webgpu', 30)).toBe(180);
    expect(stallLimitSec('wasm', 10)).toBe(360);
    expect(stallLimitSec('wasm', 30)).toBe(600);
  });

  it('trecho travado: recomeça o mesmo modelo, depois o próximo, e só então para', () => {
    expect(afterStall(1, 0, 3)).toBe('mesmo-modelo');
    expect(afterStall(2, 0, 3)).toBe('proximo-modelo');
    expect(afterStall(2, 2, 3)).toBe('parar');
    expect(afterStall(1, 2, 3)).toBe('mesmo-modelo');
  });

  it('"Passou 8 min 08 s" sai todo em inglês', () => {
    expect(translateText(`Passou ${formatDuration(488)}`, EN)).toBe('8 min 08 s elapsed');
    expect(translateText(`Passou ${formatDuration(4000)}`, EN)).toBe('1 h 06 min elapsed');
    expect(translateText(`Passou ${formatDuration(45)}`, EN)).toBe('45 s elapsed');
  });
});
