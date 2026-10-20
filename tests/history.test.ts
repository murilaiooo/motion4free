import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from '../src/engine/history';

describe('histórico de edição', () => {
  it('desfaz e refaz na ordem', () => {
    let h = createHistory('a');
    h = pushHistory(h, 'b');
    h = pushHistory(h, 'c');
    expect(h.present).toBe('c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
  });

  it('nova edição apaga o que podia ser refeito', () => {
    let h = pushHistory(pushHistory(createHistory(1), 2), 3);
    h = undo(h);
    h = pushHistory(h, 4);
    expect(h.present).toBe(4);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe(2);
  });

  it('mesmo valor não cria entrada', () => {
    const h = createHistory({ x: 1 });
    expect(pushHistory(h, h.present)).toBe(h);
  });

  it('desfazer/refazer sem entrada devolve o mesmo histórico', () => {
    const h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('guarda no máximo o limite de passos', () => {
    let h = createHistory(0, 3);
    for (let i = 1; i <= 10; i++) h = pushHistory(h, i);
    expect(h.past).toEqual([7, 8, 9]);
    expect(h.limit).toBe(3);
  });
});
