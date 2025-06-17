import { expect, it, vi } from 'vitest';
import { createStore, command, state } from '..';
import { effect } from '../signal/factory';

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

it('should support effect as sub & command callback', () => {
  const base$ = state(0);
  const trace = vi.fn();
  const innerUpdate$ = effect(({ get }, signal: AbortSignal) => {
    trace(get(base$));
    signal.addEventListener('abort', () => {
      trace('aborted');
    });
  });

  const store = createStore();
  store.mount(innerUpdate$);

  expect(trace).toHaveBeenCalledTimes(1);
});
