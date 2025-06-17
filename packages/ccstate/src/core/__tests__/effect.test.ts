import { describe, expect, it, vi } from 'vitest';
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

describe('effect', () => {
  it('should execute immediately', () => {
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

  it('should do nothing when mount a mounted effect', () => {
    const base$ = state(0);
    const trace = vi.fn();
    const innerUpdate$ = effect(({ get }) => {
      trace(get(base$));
    });

    const store = createStore();
    store.mount(innerUpdate$);

    expect(trace).toHaveBeenCalledTimes(1);

    store.mount(innerUpdate$);

    expect(trace).toHaveBeenCalledTimes(1);
  });

  it('should abort when signal is aborted', async () => {
    const trace = vi.fn();
    const innerUpdate$ = effect((_, signal: AbortSignal) => {
      void (async () => {
        await Promise.resolve();
        if (signal.aborted) {
          trace('aborted');
        }
      })();
    });

    const store = createStore();
    const ctrl = new AbortController();
    store.mount(innerUpdate$, { signal: ctrl.signal });
    ctrl.abort();

    await Promise.resolve();
    expect(trace).toBeCalledTimes(1);
  });
});
