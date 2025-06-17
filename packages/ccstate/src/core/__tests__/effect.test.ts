import { expect, it, vi } from 'vitest';
import { createStore, command, state } from '..';

it('should trigger multiple times when hierarchy func is set', () => {
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
  store.sub(
    base$,
    command(() => {
      trace();
    }),
  );

  store.set(update$);

  expect(trace).toHaveBeenCalledTimes(2);
});

it('should trigger subscriber if func throws', () => {
  const base$ = state(0);
  const action$ = command(({ set }) => {
    set(base$, 1);
    throw new Error('test');
  });

  const trace = vi.fn();
  const store = createStore();
  store.sub(
    base$,
    command(() => {
      trace();
    }),
  );

  expect(() => {
    store.set(action$);
  }).toThrow('test');
  expect(trace).toHaveBeenCalledTimes(1);
});
