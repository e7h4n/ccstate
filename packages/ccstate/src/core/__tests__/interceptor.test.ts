import { expect, it, vi } from 'vitest';
import { computed, command, state } from '../atom';
import type { CallbackFunc, Store, StoreInterceptor, StoreOptions } from '../../../types/core/store';
import { StoreImpl } from '../store';
import type { Command, Signal, Updater, State } from '../../../types/core/atom';
import { delay } from 'signal-timers';

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
      set: <T, Args extends unknown[]>(
        atom: State<T> | Command<T, Args>,
        fn: () => T,
        ...args: Args | [T | Updater<T>]
      ) => {
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
      set: <T, Args extends unknown[]>(
        atom: State<T> | Command<T, Args>,
        fn: () => T,
        ...args: Args | [T | Updater<T>]
      ) => {
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

it('should intercept sub', () => {
  const base$ = state(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      sub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = command(() => 'foo');
  store.sub(base$, callback$);

  expect(trace).toBeCalledTimes(1);
  expect(trace).toBeCalledWith(base$, callback$);
});

it('should intercept multiple sub', () => {
  const base1$ = state(0);
  const base2$ = state(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      sub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = command(() => 'foo');
  store.sub([base1$, base2$], callback$);

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base1$, callback$);
  expect(trace).toBeCalledWith(base2$, callback$);
});

it('intercept sub must call fn sync', () => {
  const base$ = state(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      sub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>) => {
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = command(() => 'foo');
  expect(() => store.sub(base$, callback$)).toThrow();
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
  store.sub(
    derived$,
    command(() => void 0),
  );

  expect(trace).toBeCalledTimes(2);
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
  store.sub(
    derived$,
    command(() => void 0),
  );
  const derived2$ = computed((get) => get(derived$) + 1, {
    debugLabel: 'derived2',
  });

  trace.mockClear();
  store.sub(
    derived2$,
    command(() => void 0),
  );

  expect(trace).toBeCalledTimes(1);
  expect(trace).toBeCalledWith(derived2$);
});

it('should intercept unsub', () => {
  const base$ = state(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      unsub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = command(() => 'foo');
  store.sub(base$, callback$)();

  expect(trace).toBeCalledTimes(1);
  expect(trace).toBeCalledWith(base$, callback$);
});

it('intercept unsub fn must be called sync', async () => {
  const traceUncaughtException = vi.fn();
  process.on('uncaughtException', traceUncaughtException);

  const base$ = state(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      unsub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>) => {
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = command(() => 'foo');
  store.sub(base$, callback$)();
  await delay(0);
  expect(traceUncaughtException).toBeCalled();
  process.off('uncaughtException', traceUncaughtException);
});

it('should intercept multiple unsub', () => {
  const base1$ = state(0);
  const base2$ = state(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      unsub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = command(() => 'foo');
  store.sub([base1$, base2$], callback$)();

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base1$, callback$);
  expect(trace).toBeCalledWith(base2$, callback$);
});

it('should intercept signal triggered unsub', () => {
  const base1$ = state(0);
  const base2$ = state(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      unsub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const ctrl = new AbortController();
  const callback$ = command(() => 'foo');
  store.sub([base1$, base2$], callback$, {
    signal: ctrl.signal,
  });
  ctrl.abort();

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base1$, callback$);
  expect(trace).toBeCalledWith(base2$, callback$);
});

it('intercept unsub should not called if already unsub', () => {
  const base1$ = state(0);
  const base2$ = state(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      unsub: <T>(atom$: Signal<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const ctrl = new AbortController();
  const callback$ = command(() => 'foo');
  const unsub = store.sub([base1$, base2$], callback$, {
    signal: ctrl.signal,
  });
  ctrl.abort();

  trace.mockClear();
  unsub();

  expect(trace).toBeCalledTimes(0);
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
  store.sub(
    derived$,
    command(() => void 0),
  )();

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(derived$);
  expect(trace).toBeCalledWith(base$);
});

it('intercept notify set', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      notify: <T>(callback$: CallbackFunc<T>, fn: () => T) => {
        const ret = fn();
        trace(callback$, ret);
      },
    },
  });

  const base$ = state(0);
  const callback$ = command(() => 'foo');
  store.sub(base$, callback$);
  store.set(base$, 1);

  expect(trace).toHaveBeenCalledTimes(1);
  expect(trace).toBeCalledWith(callback$, 'foo');
});

it('intercept notify must call fn sync', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    interceptor: {
      notify: <T>(callback$: CallbackFunc<T>) => {
        trace(callback$);
      },
    },
  });

  const base$ = state(0);
  const callback$ = command(() => 'foo');
  store.sub(base$, callback$);
  expect(() => {
    store.set(base$, 1);
  }).toThrow();
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
  store.sub(
    derived$,
    command(() => void 0),
  );
  expect(traceRead).not.toBeCalled();

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
