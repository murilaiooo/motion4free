import { describe, expect, it } from 'vitest';
import { privacyStatus, type PrivacyInputs } from '../src/core/privacy-status';

const base: PrivacyInputs = {
  asr: { kind: 'local', providerName: null, keyOpen: false, audioConsent: false, fallbackLocal: true },
  text: { kind: 'regras', providerName: null, keyOpen: false, textConsent: false },
};
const withAsr = (asr: Partial<PrivacyInputs['asr']>): PrivacyInputs => ({ ...base, asr: { ...base.asr, ...asr } });
const withText = (text: Partial<PrivacyInputs['text']>): PrivacyInputs => ({ ...base, text: { ...base.text, ...text } });

describe('o que sai do computador (#153)', () => {
  it('padrão: nada sai', () => {
    const s = privacyStatus(base);
    expect([s.video.state, s.audio.state, s.text.state]).toEqual(['local', 'local', 'local']);
    expect(s.anySends).toBe(false);
    expect(s.summary).toBe('Vídeo, áudio e transcrição ficam neste aparelho.');
  });

  it('só escolher a API não envia áudio: falta chave', () => {
    const s = privacyStatus(withAsr({ kind: 'api', providerName: 'Groq' }));
    expect(s.audio.state).toBe('blocked');
    expect(s.audio.text).toContain('a chave não está aberta');
    expect(s.audio.text).toContain('transcreve neste computador');
    expect(s.anySends).toBe(false);
  });

  it('com chave e sem autorização de áudio: nada é enviado', () => {
    const s = privacyStatus(withAsr({ kind: 'api', providerName: 'Groq', keyOpen: true, fallbackLocal: false }));
    expect(s.audio.state).toBe('blocked');
    expect(s.audio.text).toContain('falta autorizar o envio do áudio');
    expect(s.audio.text).not.toContain('transcreve neste computador');
  });

  it('autorizado: o áudio vai, o vídeo nunca', () => {
    const s = privacyStatus(withAsr({ kind: 'api', providerName: 'Groq', keyOpen: true, audioConsent: true }));
    expect(s.audio).toMatchObject({ state: 'sends', destination: 'Groq' });
    expect(s.video.state).toBe('local');
    expect(s.summary).toBe('O vídeo fica neste aparelho. Você autorizou enviar o áudio da fala para Groq.');
    expect(s.text.state).toBe('local');
  });

  it('autorização de texto não libera áudio, e vice-versa', () => {
    const t = privacyStatus({ asr: { ...base.asr, kind: 'api', providerName: 'OpenAI', keyOpen: true, audioConsent: false }, text: { kind: 'provedor', providerName: 'OpenAI', keyOpen: true, textConsent: true } });
    expect(t.text.state).toBe('sends');
    expect(t.audio.state).toBe('blocked');
    const a = privacyStatus({ asr: { ...base.asr, kind: 'api', providerName: 'OpenAI', keyOpen: true, audioConsent: true }, text: { kind: 'provedor', providerName: 'OpenAI', keyOpen: true, textConsent: false } });
    expect(a.audio.state).toBe('sends');
    expect(a.text.state).toBe('blocked');
  });

  it('texto e áudio autorizados aparecem os dois no resumo', () => {
    const s = privacyStatus({ asr: { ...base.asr, kind: 'api', providerName: 'Groq', keyOpen: true, audioConsent: true }, text: { kind: 'provedor', providerName: 'OpenRouter', keyOpen: true, textConsent: true } });
    expect(s.summary).toBe('O vídeo fica neste aparelho. Você autorizou enviar o áudio da fala para Groq e texto para OpenRouter.');
  });

  it('IA no navegador fica local', () => {
    expect(privacyStatus(withText({ kind: 'local' })).text.text).toContain('IA no navegador');
  });
});
