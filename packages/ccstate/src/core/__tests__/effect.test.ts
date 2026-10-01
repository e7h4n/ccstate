import { expect, it, vi } from 'vitest';
import { createStore, command, state } from '..';

it('notifies once with the final value of nested synchronous commands', () => {
  const base$ = state(0);
  const innerUpdate$ = command(({ set }) => {
    set(base$, 1);
  });
  const update$ = command(({ set }) => {
    set(innerUpdate$);
    set(base$, 2);
  });

  const trace = vi.fn();
  const store = createStore();
  store.watch(base$, () => {
    trace();
  });

  trace.mockClear();
  store.set(update$);

  expect(store.get(base$)).toBe(2);
  expect(trace).toHaveBeenCalledTimes(1);
});

it('should trigger subscriber if func throws', () => {
  const base$ = state(0);
  const action$ = command(({ set }) => {
    set(base$, 1);
    throw new Error('test');
  });

  const trace = vi.fn();
  const store = createStore();
  store.watch(base$, () => {
    trace();
  });

  trace.mockClear();
  expect(() => {
    store.set(action$);
  }).toThrow('test');
  expect(trace).toHaveBeenCalledTimes(1);
});
