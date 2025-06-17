import { describe, expect, it, vi } from 'vitest';
import { state } from '../signal/factory';
import { createStore } from '../store/store';
import type { ExternalEffect } from '../../../types/core/signal';

describe('effect', () => {
  it('should execute immediately', () => {
    const base$ = state(0);
    const trace = vi.fn();

    const store = createStore();

    store.syncExternal((get, { signal }) => {
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

    const effect: ExternalEffect = (get, { signal }) => {
      trace(get(base$));
      signal.addEventListener('abort', () => {
        trace('aborted');
      });
    };

    store.syncExternal(effect);

    expect(() => {
      store.syncExternal(effect);
    }).toThrow('Effect is already mounted');
  });

  it('should abort when signal is aborted', async () => {
    const trace = vi.fn();

    const store = createStore();
    const ctrl = new AbortController();
    store.syncExternal(
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
});
