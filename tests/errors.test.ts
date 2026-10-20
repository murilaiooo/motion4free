import { describe, expect, it } from 'vitest';
import { AppError, ERRORS, formatReport, httpErrorFromUrl, networkErrorFromUrl, toAppError } from '../src/core/errors';

describe('códigos de erro', () => {
  it('todos os códigos são únicos', () => {
    const codes = Object.values(ERRORS).map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('AppError mantém código, título e detalhe', () => {
    const e = new AppError('VIDEO_LONGO', 'duração 200 s');
    expect(e.code).toBe('M4F-104');
    expect(e.title).toContain('3 minutos');
    expect(e.detail).toBe('duração 200 s');
  });

  it('erro desconhecido vira M4F-999 com a mensagem original', () => {
    const e = toAppError(new TypeError('boom'), 'EXPORTACAO_FALHOU');
    expect(e.code).toBe('M4F-402');
    expect(e.detail).toContain('TypeError: boom');
    expect(toAppError('x').code).toBe('M4F-999');
  });

  it('AppError passa intacto', () => {
    const original = new AppError('SEM_VIDEO');
    expect(toAppError(original, 'EXPORTACAO_FALHOU')).toBe(original);
  });

  it('erro de rede identifica o servidor', () => {
    const e = networkErrorFromUrl('https://huggingface.co/onnx-community/x/resolve/main/config.json', new TypeError('Failed to fetch'));
    expect(e.code).toBe('M4F-301');
    expect(e.detail).toContain('huggingface.co');
    expect(e.detail).toContain('Failed to fetch');
  });

  it('resposta de erro do servidor vira M4F-305 com status e servidor', () => {
    const e = httpErrorFromUrl('https://motion4free.dev/hf/onnx-community/x/resolve/main/config.json', 502);
    expect(e.code).toBe('M4F-305');
    expect(e.detail).toContain('motion4free.dev');
    expect(e.detail).toContain('HTTP 502');
  });

  it('relatório inclui código, versão e detalhe', () => {
    const r = formatReport(new AppError('SEM_VIDEO', 'faixa ausente'), 'v0.1.1 · abc1234');
    expect(r).toContain('M4F-102');
    expect(r).toContain('v0.1.1 · abc1234');
    expect(r).toContain('faixa ausente');
  });
});
