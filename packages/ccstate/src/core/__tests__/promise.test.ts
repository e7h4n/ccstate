import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest';
import { computed, state } from '../signal/factory';
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

  test('syncExternal will not raise unhandled rejection', async () => {
    store._syncExternal((get) => {
      get(promise$).catch(() => void 0);
    });

    await delay(0);
    expect(trace).not.toBeCalled();
  });

  test('syncExternal to a mounted computed will raise unhandled rejection', async () => {
    store._syncExternal((get) => {
      void get(promise$);
    });

    await delay(0);
    trace.mockClear();

    store.set(reload$, (x) => x + 1);

    await delay(0);
    expect(trace).toHaveBeenCalledTimes(1);
  });

  test('manual process unhandled rejection will prevent unhandled rejection', async () => {
    store._syncExternal((get) => {
      get(promise$).catch(() => void 0);
    });

    await delay(0);
    trace.mockClear();

    store.set(reload$, (x) => x + 1);

    await delay(0);
    expect(trace).not.toBeCalled();
  });
});
