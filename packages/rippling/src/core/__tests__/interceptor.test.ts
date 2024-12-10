import { expect, it, vi } from 'vitest';
import { $computed, $func, $value } from '../atom';
import type { CallbackFunc, Store, StoreInspector, StoreOptions } from '../../../types/core/store';
import { AtomManager, ListenerManager } from '../atom-manager';
import { StoreImpl } from '../store';
import type { Func, ReadableAtom, Updater, Value } from '../../../types/core/atom';

function createStoreForTest(options: StoreOptions): Store {
  const atomManager = new AtomManager(options);
  const listenerManager = new ListenerManager();

  return new StoreImpl(atomManager, listenerManager, options);
}

it('should intercept get', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      get: (atom, fn) => {
        const ret = fn();
        trace(atom, ret);
        return ret;
      },
    },
  });
  const base$ = $value(0);
  store.set(base$, 1);
  expect(store.get(base$)).toBe(1);

  expect(trace).toBeCalledWith(base$, 1);
});

it('should intercept hierarchy get', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      get: (atom, fn) => {
        const ret = fn();
        trace(atom, ret);
      },
    },
  });

  const base$ = $value(1);
  const derived$ = $computed((get) => get(base$) + 1);

  expect(store.get(derived$)).toBe(2);
  expect(trace).toHaveBeenCalledTimes(2);
  expect(trace).nthCalledWith(1, base$, 1);
  expect(trace).nthCalledWith(2, derived$, 2);
});

it('interceptor must call fn sync', () => {
  const store = createStoreForTest({
    inspector: {
      get: () => void 0,
    },
  });

  const base$ = $value(0);
  expect(() => store.get(base$)).toThrow();
});

it('should intercept set', () => {
  const trace = vi.fn();

  const store = createStoreForTest({
    inspector: {
      set: <T, Args extends unknown[]>(
        atom: Value<T> | Func<T, Args>,
        fn: () => T,
        ...args: Args | [T | Updater<T>]
      ) => {
        const ret = fn();
        trace(atom, args, ret);
      },
    },
  });

  const base$ = $value(0);
  store.set(base$, 1);
  expect(store.get(base$)).toBe(1);

  expect(trace).toBeCalledWith(base$, [1], undefined);
});

it('should intercept set hierarchy', () => {
  const trace = vi.fn();

  const store = createStoreForTest({
    inspector: {
      set: <T, Args extends unknown[]>(
        atom: Value<T> | Func<T, Args>,
        fn: () => T,
        ...args: Args | [T | Updater<T>]
      ) => {
        const ret = fn();
        trace(atom, args, ret);
      },
    },
  });

  const foo$ = $value(0, {
    debugLabel: 'foo',
  });
  const bar$ = $func(
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
  const base$ = $value(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      sub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = $func(() => 'foo');
  store.sub(base$, callback$);

  expect(trace).toBeCalledTimes(1);
  expect(trace).toBeCalledWith(base$, callback$);
});

it('should intercept multiple sub', () => {
  const base1$ = $value(0);
  const base2$ = $value(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      sub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = $func(() => 'foo');
  store.sub([base1$, base2$], callback$);

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base1$, callback$);
  expect(trace).toBeCalledWith(base2$, callback$);
});

it('intercept sub must call fn sync', () => {
  const base$ = $value(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      sub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>) => {
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = $func(() => 'foo');
  expect(() => store.sub(base$, callback$)).toThrow();
});

it('intercept mount', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      mount: (atom$) => {
        trace(atom$);
      },
    },
  });
  const base$ = $value(0);
  const derived$ = $computed((get) => get(base$) + 1);
  store.sub(
    derived$,
    $func(() => void 0),
  );

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base$);
  expect(trace).toBeCalledWith(derived$);
});

it('should not intercept mount if atom is already mounted', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      mount: (atom$) => {
        trace(atom$);
      },
    },
  });
  const base$ = $value(0, {
    debugLabel: 'base',
  });
  const derived$ = $computed((get) => get(base$) + 1, {
    debugLabel: 'derived',
  });
  store.sub(
    derived$,
    $func(() => void 0),
  );
  const derived2$ = $computed((get) => get(derived$) + 1, {
    debugLabel: 'derived2',
  });

  trace.mockClear();
  store.sub(
    derived2$,
    $func(() => void 0),
  );

  expect(trace).toBeCalledTimes(1);
  expect(trace).toBeCalledWith(derived2$);
});

it('should intercept unsub', () => {
  const base$ = $value(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      unsub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = $func(() => 'foo');
  store.sub(base$, callback$)();

  expect(trace).toBeCalledTimes(1);
  expect(trace).toBeCalledWith(base$, callback$);
});

it('intercept unsub fn must be called sync', () => {
  const base$ = $value(0);
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      unsub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>) => {
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = $func(() => 'foo');
  expect(() => {
    store.sub(base$, callback$)();
  }).toThrow();
});

it('should intercept multiple unsub', () => {
  const base1$ = $value(0);
  const base2$ = $value(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      unsub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const callback$ = $func(() => 'foo');
  store.sub([base1$, base2$], callback$)();

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base1$, callback$);
  expect(trace).toBeCalledWith(base2$, callback$);
});

it('should intercept signal triggered unsub', () => {
  const base1$ = $value(0);
  const base2$ = $value(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      unsub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const ctrl = new AbortController();
  const callback$ = $func(() => 'foo');
  store.sub([base1$, base2$], callback$, {
    signal: ctrl.signal,
  });
  ctrl.abort();

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(base1$, callback$);
  expect(trace).toBeCalledWith(base2$, callback$);
});

it('intercept unsub should not called if already unsub', () => {
  const base1$ = $value(0);
  const base2$ = $value(0);

  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      unsub: <T>(atom$: ReadableAtom<unknown>, callback$: CallbackFunc<T>, fn: () => void) => {
        fn();
        trace(atom$, callback$);
      },
    },
  });
  const ctrl = new AbortController();
  const callback$ = $func(() => 'foo');
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
  const interceptor: StoreInspector = {
    unmount: (atom$) => {
      trace(atom$);
    },
  };

  const atomManager = new AtomManager({
    inspector: interceptor,
  });
  const listenerManager = new ListenerManager();
  const store = new StoreImpl(atomManager, listenerManager, {
    inspector: interceptor,
  });

  const base$ = $value(0);
  const derived$ = $computed((get) => get(base$) + 1);
  store.sub(
    derived$,
    $func(() => void 0),
  )();

  expect(trace).toBeCalledTimes(2);
  expect(trace).toBeCalledWith(derived$);
  expect(trace).toBeCalledWith(base$);
});

it('intercept notify set', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      notify: <T>(callback$: CallbackFunc<T>, fn: () => T) => {
        const ret = fn();
        trace(callback$, ret);
      },
    },
  });

  const base$ = $value(0);
  const callback$ = $func(() => 'foo');
  store.sub(base$, callback$);
  store.set(base$, 1);

  expect(trace).toHaveBeenCalledTimes(1);
  expect(trace).toBeCalledWith(callback$, 'foo');
});

it('intercept notify must call fn sync', () => {
  const trace = vi.fn();
  const store = createStoreForTest({
    inspector: {
      notify: <T>(callback$: CallbackFunc<T>) => {
        trace(callback$);
      },
    },
  });

  const base$ = $value(0);
  const callback$ = $func(() => 'foo');
  store.sub(base$, callback$);
  expect(() => {
    store.set(base$, 1);
  }).toThrow();
});
