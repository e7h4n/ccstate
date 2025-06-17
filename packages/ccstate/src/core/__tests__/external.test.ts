import { describe, expect, it, vi } from 'vitest';
import { state } from '../signal/factory';
import { createStore } from '../store/store';

describe('effect', () => {
  it('should execute immediately', () => {
    const base$ = state(0);
    const trace = vi.fn();

    const store = createStore();

    store._syncExternal((get, { signal }) => {
      trace(get(base$));
      signal.addEventListener('abort', () => {
        trace('aborted');
      });
    });

    expect(trace).toHaveBeenCalledTimes(1);
  });

  it('should abort when signal is aborted', async () => {
    const trace = vi.fn();

    const store = createStore();
    const ctrl = new AbortController();
    store._syncExternal(
      (_, { signal }) => {
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

  it('should trigger sync when dependency changes', () => {
    const base$ = state(0);
    const trace = vi.fn();

    const store = createStore();

    store._syncExternal((get) => {
      trace(get(base$));
    });

    expect(trace).toHaveBeenCalledTimes(1);

    store.set(base$, 1);
    expect(trace).toHaveBeenCalledTimes(2);
  });

  it('should abort signal for incompleted external effect', async () => {
    const base$ = state(0);
    const trace = vi.fn();

    const store = createStore();

    store._syncExternal((get, { signal }) => {
      get(base$);
      void (async () => {
        await Promise.resolve();
        if (signal.aborted) {
          trace('aborted');
        }
      })();
    });

    store.set(base$, 1);
    await Promise.resolve();
    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toBeCalledWith('aborted');
  });
});

it('should execute when dependency changes', () => {
  const base$ = state(0);
  const trace = vi.fn();

  const store = createStore();

  store._syncExternal((get) => {
    trace(get(base$));
  });

  expect(trace).toHaveBeenCalledTimes(1);

  store.set(base$, (x) => x + 1);
  store.set(base$, (x) => x + 1);
  store.set(base$, (x) => x + 1);
  store.set(base$, (x) => x + 1);
  expect(trace).toHaveBeenCalledTimes(5);
});
