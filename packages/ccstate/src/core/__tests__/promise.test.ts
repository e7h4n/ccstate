import { afterEach, beforeEach, describe, expect, it, test, vi, type Mock } from 'vitest';
import { command, computed, state } from '../signal/factory';
import { createStore } from '../store/store';
import { delay } from 'signal-timers';
import type { Computed, State } from '../../../types/core/signal';
import type { Store } from '../../../types/core/store';

describe('unhandled rejections', () => {
  let trace: Mock<(err: unknown) => void>;
  let promise$: Computed<Promise<unknown>>;
  let reload$: State<number>;
  let store: Store;
  beforeEach(() => {
    trace = vi.fn();
    process.on('unhandledRejection', trace);
    reload$ = state(0);
    let count = 0;
    promise$ = computed(async (get) => {
      get(reload$);
      await Promise.resolve();
      throw new Error(`test error ${String(count++)}`);
    });

    store = createStore();
  });

  afterEach(() => {
    process.off('unhandledRejection', trace);
  });

  test('watch will raise unhandled rejection', async () => {
    store.watch((get) => {
      void get(promise$);
    });

    await delay(0);
    expect(trace).toBeCalledTimes(1);
  });

  test('set to a mounted computed will raise unhandled rejection', async () => {
    store.watch((get) => {
      void get(promise$);
    });
    store.set(reload$, (x) => x + 1);

    await delay(0);
    expect(trace).toHaveBeenCalledTimes(2);
  });

  test('manual process unhandled rejection will prevent unhandled rejection', async () => {
    store.watch((get) => {
      get(promise$).catch(() => void 0);
    });

    await delay(0);
    trace.mockClear();

    store.set(reload$, (x) => x + 1);

    await delay(0);
    expect(trace).not.toBeCalled();
  });
});

describe('signal in computed', () => {
  it('should abort when next calculation is triggered', async () => {
    const base$ = state(0);
    const trace = vi.fn();
    const cmpt$ = computed(async (get, { signal }) => {
      get(base$);
      await Promise.resolve();
      signal.throwIfAborted();
      trace();
      return get(base$) + 1;
    });

    const store = createStore();
    const firstRunPromise = store.get(cmpt$);
    store.set(base$, 1);
    await store.get(cmpt$);

    await expect(firstRunPromise).rejects.toThrow();
    expect(trace).toBeCalledTimes(1);
  });

  it.skip('should abort when caller command is aborted', async () => {
    const trace = vi.fn();
    const cmpt$ = computed(async (get, { signal }) => {
      await Promise.resolve();
      signal.throwIfAborted();
      trace();
      return 0;
    });

    const fetch$ = command(async ({ get }, signal: AbortSignal) => {
      return await get(cmpt$, { signal });
    });

    const store = createStore();
    const controller = new AbortController();
    const promise = store.set(fetch$, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
  });
});
