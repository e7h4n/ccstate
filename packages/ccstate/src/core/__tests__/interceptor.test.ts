import { expect, it, vi } from 'vitest';
import { computed, command, state } from '../signal/factory';
import type { SetArgs, Store, StoreInterceptor, StoreOptions } from '../../../types/core/store';
import { StoreImpl } from '../store/store';
import type { Command, State } from '../../../types/core/signal';

function createStoreForTest(options: StoreOptions): Store {
  return new StoreImpl(options);
}

it('should intercept get', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      get: (atom, fn) => {
        const ret = fn();
        trace(atom, ret);
        return ret;
      },
    },
  });
  const base$ = state(0);
  store.set(base$, 1);
  expect(store.get(base$)).toBe(1);

  expect(trace).toBeCalledWith(base$, 1);
});

it('should intercept hierarchy get', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      get: (atom, fn) => {
        const ret = fn();
        trace(atom, ret);
      },
    },
  });

  const base$ = state(1);
  const derived$ = computed((get) => get(base$) + 1);

  expect(store.get(derived$)).toBe(2);
  expect(trace).toHaveBeenCalledTimes(2);
  expect(trace).nthCalledWith(1, base$, 1);
  expect(trace).nthCalledWith(2, derived$, 2);
});

it('interceptor must call fn sync', () => {
  const store = createStoreForTest({
    interceptor: {
      get: () => void 0,
    },
  });

  const base$ = state(0);
  expect(() => store.get(base$)).toThrow();
});

it('interceptor must call fn sync for set', () => {
  const store = createStoreForTest({
    interceptor: {
      set: () => void 0,
    },
  });

  const base$ = state(0);
  expect(() => {
    store.set(base$, 1);
  }).toThrow();
});

it('interceptor must call fn sync for derived', () => {
  const store = createStoreForTest({
    interceptor: {
      get: (atom, fn) => {
        if (atom.debugLabel === 'derived$') {
          fn();
        }
      },
    },
  });

  const base$ = state(0, {
    debugLabel: 'base$',
  });
  const derived$ = computed(
    (get) => {
      return get(base$);
    },
    {
      debugLabel: 'derived$',
    },
  );

  expect(() => store.get(derived$)).toThrow('interceptor must call fn sync');
});

it('should intercept set', () => {
  const trace = vi.fn();

  const store = createStoreForTest({
    interceptor: {
      set: <T, Args extends SetArgs<T, unknown[]>>(atom: State<T> | Command<T, Args>, fn: () => T, ...args: Args) => {
        const ret = fn();
        trace(atom, args, ret);
      },
    },
  });

  const base$ = state(0);
  store.set(base$, 1);
  expect(store.get(base$)).toBe(1);

  expect(trace).toBeCalledWith(base$, [1], undefined);
});

it('should intercept set hierarchy', () => {
  const trace = vi.fn();

  const store = createStoreForTest({
    interceptor: {
      set: <T, Args extends SetArgs<T, unknown[]>>(atom: State<T> | Command<T, Args>, fn: () => T, ...args: Args) => {
        const ret = fn();
        trace(atom, args, ret);
      },
    },
  });

  const foo$ = state(0, {
    debugLabel: 'foo',
  });
  const bar$ = command(
    ({ set }, value: number) => {
      set(foo$, value * 10);
    },
    {
      debugLabel: 'bar',
    },
  );
  store.set(bar$, 1);
  expect(store.get(foo$)).toBe(10);

  expect(trace).toHaveBeenCalledTimes(2);
  expect(trace).toHaveBeenNthCalledWith(1, foo$, [10], undefined);
  expect(trace).toHaveBeenNthCalledWith(2, bar$, [1], undefined);
});

it('intercept mount', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      mount: (atom$) => {
        trace(atom$);
      },
    },
  });
  const base$ = state(0);
  const derived$ = computed((get) => get(base$) + 1);
  store.watch((get) => {
    get(derived$);
  });

  expect(trace).toBeCalledTimes(3);
  expect(trace).toBeCalledWith(base$);
  expect(trace).toBeCalledWith(derived$);
});

it('should not intercept mount if atom is already mounted', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      mount: (atom$) => {
        trace(atom$);
      },
    },
  });
  const base$ = state(0, {
    debugLabel: 'base',
  });
  const derived$ = computed((get) => get(base$) + 1, {
    debugLabel: 'derived',
  });
  store.watch((get) => {
    get(derived$);
  });
  const derived2$ = computed((get) => get(derived$) + 1, {
    debugLabel: 'derived2',
  });

  trace.mockClear();
  store.watch((get) => {
    get(derived2$);
  });

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(derived2$);
});

it('intercept unmount', () => {
  const trace = vi.fn();
  const interceptor: StoreInterceptor = {
    unmount: (atom$) => {
      trace(atom$);
    },
  };

  const store = new StoreImpl({
    interceptor: interceptor,
  });

  const base$ = state(0);
  const derived$ = computed((get) => get(base$) + 1);
  const controller = new AbortController();
  store.watch(
    (get) => {
      get(derived$);
    },
    {
      signal: controller.signal,
    },
  );
  controller.abort();

  expect(trace).toBeCalledTimes(3);
  expect(trace).toBeCalledWith(derived$);
  expect(trace).toBeCalledWith(base$);
});

it('should intercept out get only', () => {
  const traceGet = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      get: (_, fn) => {
        traceGet();
        return fn();
      },
    },
  });
  const base$ = state(0);
  store.set(base$, 1);

  expect(traceGet).not.toBeCalled();
});

it('should intercept computed', () => {
  const traceRead = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      computed: (_, fn) => {
        traceRead();
        fn();
      },
    },
  });
  const base$ = state(0);
  const derived$ = computed((get) => {
    return get(base$);
  });
  store.set(base$, 1);

  expect(traceRead).not.toBeCalled();
  store.get(derived$);
  expect(traceRead).toBeCalled();

  traceRead.mockClear();
  store.watch((get) => {
    get(derived$);
  });
  expect(traceRead).toBeCalledTimes(1);

  store.set(base$, 2);
  expect(traceRead).toBeCalled();
});

it('computed must call fn sync', () => {
  const store = createStoreForTest({
    interceptor: {
      computed: () => void 0,
    },
  });
  const base$ = state(0);
  const derived$ = computed((get) => {
    return get(base$);
  });

  expect(() => store.get(derived$)).toThrow();
});
