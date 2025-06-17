import { describe, expect, it, vi } from 'vitest';
import { createStore, command, state } from '..';
import type { Effect } from '../../../types/core/signal';

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

    const store = createStore();

    store.effect(({ get }, signal: AbortSignal) => {
      trace(get(base$));
      signal.addEventListener('abort', () => {
        trace('aborted');
      });
    });

    expect(trace).toHaveBeenCalledTimes(1);
  });

  it('mount same effect will raise exception', () => {
    const base$ = state(0);
    const trace = vi.fn();

    const store = createStore();

    const effect: Effect = ({ get }, signal: AbortSignal) => {
      trace(get(base$));
      signal.addEventListener('abort', () => {
        trace('aborted');
      });
    };

    store.effect(effect);

    expect(() => {
      store.effect(effect);
    }).toThrow('Effect is already mounted');
  });

  it('should abort when signal is aborted', async () => {
    const trace = vi.fn();

    const store = createStore();
    const ctrl = new AbortController();
    store.effect(
      (_, signal: AbortSignal) => {
        void (async () => {
          await Promise.resolve();
          if (signal.aborted) {
            trace('aborted');
          }
        })();
      },
      { signal: ctrl.signal },
    );
    ctrl.abort();

    await Promise.resolve();
    expect(trace).toBeCalledTimes(1);
  });
});
