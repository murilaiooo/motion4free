import { describe, expect, it } from 'vitest';
import { commitEdit } from '../src/editorial/commands';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory, redo, undo } from '../src/engine/history';

describe('atomic validated editing transactions', () => {
  const original = autoEdit(4, [], []);
  it('refuses invalid edits without changing undo or redo state', () => {
    const history = createHistory(original);
    const serialized = JSON.stringify(history);
    expect(() => commitEdit(history, { ...original, segments: [] })).toThrow('M4F-522');
    expect(JSON.stringify(history)).toBe(serialized);
  });
  it('records one accepted operation and replays the same full document', () => {
    const candidate = { ...original, framing: { ...original.framing, x: 0.25 } };
    const next = commitEdit(createHistory(original), candidate);
    expect(next.past).toHaveLength(1);
    expect(undo(next).present).toEqual(original);
    expect(redo(undo(next)).present).toEqual(candidate);
  });
  it('keeps no-op identity and invalidates redo only after a valid replacement', () => {
    const history = createHistory(original);
    expect(commitEdit(history, original)).toBe(history);
    const changed = commitEdit(history, { ...original, framing: { ...original.framing, x: 0.1 } });
    const undone = undo(changed);
    expect(() => commitEdit(undone, { ...original, output: { width: 0, height: 0, fps: 0 } })).toThrow();
    expect(undone.future).toHaveLength(1);
    expect(commitEdit(undone, { ...original, framing: { ...original.framing, x: 0.2 } }).future).toEqual([]);
  });
});
