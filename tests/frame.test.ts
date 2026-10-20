import { describe, expect, it } from 'vitest';
import { activeAt } from '../src/render/frame';

describe('activeAt', () => {
  it('inclui o início e exclui o fim', () => {
    const items = [{ start: 0, end: 1 }, { start: 1, end: 2 }];
    expect(activeAt(items, 1)).toEqual([{ start: 1, end: 2 }]);
    expect(activeAt(items, 2)).toEqual([]);
  });
});
