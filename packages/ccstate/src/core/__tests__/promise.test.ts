import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest';
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
    promise$ = computed((get) => {
      get(reload$);
      return Promise.resolve().then(() => {
        throw new Error(`test error ${String(count++)}`);
      });
    });

    store = createStore();
  });

  afterEach(() => {
    process.off('unhandledRejection', trace);
  });

  test('sub will raise unhandled rejection', async () => {
    store.sub(
      promise$,
      command(() => void 0),
    );

    await delay(0);
    expect(trace).toHaveBeenCalledTimes(0);
  });

  test('set to a mounted computed will raise unhandled rejection', async () => {
    store.sub(
      promise$,
      command(() => void 0),
    );

    await delay(0);
    trace.mockClear();

    store.set(reload$, (x) => x + 1);

    await delay(0);
    expect(trace).toHaveBeenCalledTimes(1);
  });

  test('manual process unhandled rejection', async () => {
    store.sub(
      promise$,
      command(({ get }) => {
        get(promise$).catch(() => void 0);
      }),
    );

    await delay(0);
    trace.mockClear();

    store.set(reload$, (x) => x + 1);

    await delay(0);
    expect(trace).toHaveBeenCalledTimes(0);
  });
});

describe('promise should be handled once in sub', () => {
  const trace = vi.fn();
  const computed$ = computed(() => {
    const promise = Promise.resolve();
    const originalCatch = promise.catch.bind(promise);
    vi.spyOn(promise, 'catch').mockImplementation((...args) => {
      trace();
      return originalCatch(...args);
    });
    return promise;
  });

  const store = createStore();
  store.sub(
    computed$,
    command(() => void 0),
  );
  expect(trace).toHaveBeenCalledTimes(1);

  store.sub(
    computed$,
    command(() => void 0),
  );
  expect(trace).toHaveBeenCalledTimes(1);
});
