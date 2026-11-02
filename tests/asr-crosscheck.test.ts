import { describe, expect, it } from 'vitest';
import { crossCheck } from '../src/analysis/asr-crosscheck';
import type { RawWord } from '../src/analysis/asr-merge';

const seq = (text: string, from = 0, step = 0.4): RawWord[] => text.split(' ').map((t, i) => ({ text: t, start: from + i * step, end: from + i * step + step * 0.9 }));

describe('conferência dupla da legenda', () => {
  it('as duas IAs concordam: nada para revisar', () => {
    const r = crossCheck(seq('Três dicas rápidas para gravar melhor.'), seq('três dicas rápidas para gravar melhor', 0.05));
    expect(r.flagged).toBe(0);
    expect(r.words.some((w) => w.needsReview)).toBe(false);
  });

  it('marca só a palavra em que discordam, no mesmo instante', () => {
    const r = crossCheck(seq('a luz da janela na frente do rosto'), seq('a luz da janela na frente do resto'));
    expect(r.words.filter((w) => w.needsReview).map((w) => w.text)).toEqual(['rosto']);
    expect(r.flagged).toBe(1);
    expect(r.ignored).toBe(false);
  });

  it('a mesma palavra num instante distante não confirma', () => {
    const primary: RawWord[] = [...seq('olha só o meu', 8), { text: 'gato', start: 10, end: 10.4 }];
    const second: RawWord[] = [{ text: 'gato', start: 2, end: 2.4 }, ...seq('olha só o meu', 8), { text: 'pato', start: 10, end: 10.4 }];
    const r = crossCheck(primary, second);
    expect(r.words.filter((w) => w.needsReview).map((w) => w.text)).toEqual(['gato']);
  });

  it('palavra que a segunda IA não ouviu (possível invenção) fica para revisar', () => {
    const primary = [...seq('isso é muito bom'), { text: 'obrigado', start: 20, end: 20.5 }];
    const r = crossCheck(primary, seq('isso é muito bom'));
    expect(r.words.at(-1)).toMatchObject({ text: 'obrigado', needsReview: true });
  });

  it('pontuação, maiúsculas e palavra escrita junto ou separado não contam como erro', () => {
    const primary: RawWord[] = [{ text: 'Fazê-lo,', start: 0, end: 0.6 }, { text: 'porque', start: 0.7, end: 1.1 }];
    const second: RawWord[] = [{ text: 'fazê', start: 0, end: 0.3 }, { text: 'lo', start: 0.3, end: 0.6 }, { text: 'por', start: 0.7, end: 0.9 }, { text: 'que', start: 0.9, end: 1.1 }];
    expect(crossCheck(primary, second).flagged).toBe(0);
  });

  it('números não são marcados ("10" e "dez")', () => {
    const r = crossCheck([{ text: '10', start: 0, end: 0.4 }, { text: 'reais', start: 0.4, end: 0.8 }], [{ text: 'dez', start: 0, end: 0.4 }, { text: 'reais', start: 0.4, end: 0.8 }]);
    expect(r.flagged).toBe(0);
  });

  it('discordância demais (a outra IA ouviu outro idioma): ignora a conferência sem marcar nada', () => {
    const r = crossCheck(seq('hoje eu vou mostrar como editar um vídeo'), seq('today I will show how to edit a video'));
    expect(r.ignored).toBe(true);
    expect(r.flagged).toBe(0);
    expect(r.words.some((w) => w.needsReview)).toBe(false);
  });

  it('não muda o texto nem os tempos, e não altera a lista original', () => {
    const primary = seq('um dois três');
    const copy = JSON.parse(JSON.stringify(primary));
    const r = crossCheck(primary, seq('um dois treze'));
    expect(r.words.map(({ text, start, end }) => ({ text, start, end }))).toEqual(copy);
    expect(primary).toEqual(copy);
  });
});
