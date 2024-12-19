import { describe, expect, it, vi } from 'vitest';
import { computed, createStore, command, state } from '..';
import type { Getter } from '..';
import { suspense } from './utils';
import { createDebugStore, nestedAtomToString } from '../../debug';

it('should not fire on subscribe', () => {
  const store = createStore();
  const countAtom = state(0);
  const callback1 = vi.fn();
  const callback2 = vi.fn();
  store.sub(countAtom, command(callback1));
  store.sub(countAtom, command(callback2));
  expect(callback1).not.toHaveBeenCalled();
  expect(callback2).not.toHaveBeenCalled();
});

it('should fire subscription even if primitive atom value is the same', () => {
  const store = createStore();
  const countAtom = state(0);
  const callback = vi.fn();
  store.sub(countAtom, command(callback));
  callback.mockClear();
  store.set(countAtom, 0);
  expect(callback).toBeCalled();
});

it('should fire subscription even if derived atom value is the same', () => {
  const store = createStore();
  const countAtom = state(0);
  const derivedAtom = computed((get) => get(countAtom) * 0);
  const callback = vi.fn();
  store.sub(derivedAtom, command(callback));
  callback.mockClear();
  store.set(countAtom, 1);
  expect(callback).toBeCalled();
});

it('should unmount with store.get', () => {
  const store = createStore();
  const countAtom = state(0);
  const callback = vi.fn();
  const unsub = store.sub(countAtom, command(callback));
  unsub();
  store.set(countAtom, 1);
  expect(callback).not.toHaveBeenCalled();
});

it('should unmount dependencies with store.get', () => {
  const store = createStore();
  const countAtom = state(0);
  const derivedAtom = computed((get) => get(countAtom) * 2);
  const callback = vi.fn();
  const unsub = store.sub(derivedAtom, command(callback));
  unsub();

  store.set(countAtom, 1);
  expect(callback).not.toHaveBeenCalled();
});

it('should update async atom with delay (#1813)', async () => {
  const countAtom = state(0);

  const suspensedResolve: (() => void)[] = [];
  function restoreAll() {
    suspensedResolve.splice(0).forEach((fn) => {
      fn();
    });
  }

  const suspensedAtom = computed(async (get) => {
    const count = get(countAtom);
    await new Promise<void>((r) => suspensedResolve.push(r));
    return count;
  });

  const store = createStore();
  const firstPromise = store.get(suspensedAtom);
  store.set(countAtom, 1);
  restoreAll();

  expect(await firstPromise).toBe(0);
  const promise = store.get(suspensedAtom);
  restoreAll();

  expect(await promise).toBe(1);
});

it('should override a promise by setting', async () => {
  const store = createStore();
  const countAtom = state(Promise.resolve(0));
  const infinitePending = new Promise<never>(() => void 0);
  store.set(countAtom, infinitePending);
  const promise1 = store.get(countAtom);
  expect(promise1).toBe(infinitePending);
  store.set(countAtom, Promise.resolve(1));
  const promise2 = store.get(countAtom);
  expect(await promise2).toBe(1);
});

it('should update async atom with deps after await', async () => {
  const { pause, restore } = suspense();
  const countAtom = state(0, {
    debugLabel: 'countAtom',
  });

  const delayedAtom = computed(
    async (get) => {
      await pause();
      const count = get(countAtom);
      return count;
    },
    {
      debugLabel: 'delayedAtom',
    },
  );

  const derivedAtom = computed(
    async (get) => {
      const count = await get(delayedAtom);
      return count;
    },
    {
      debugLabel: 'derivedAtom',
    },
  );

  const store = createStore();
  let lastValue = store.get(derivedAtom);
  const unsub = store.sub(
    derivedAtom,
    command(({ get }) => {
      lastValue = get(derivedAtom);
    }),
  );

  store.set(countAtom, 1);
  restore();
  expect(await lastValue).toBe(1);

  store.set(countAtom, 2);
  restore();
  expect(await lastValue).toBe(2);

  store.set(countAtom, 3);
  restore();

  expect(await lastValue).toBe(3);
  unsub();
});

it('should fire subscription when async atom promise is the same', () => {
  const promise = Promise.resolve();
  const promiseAtom = state(promise, {
    debugLabel: 'promiseAtom',
  });
  const derivedGetter = vi.fn((get: Getter) => get(promiseAtom));
  const derivedAtom = computed(derivedGetter, {
    debugLabel: 'derivedAtom',
  });

  const store = createStore();

  expect(derivedGetter).not.toHaveBeenCalled();

  const promiseListener = vi.fn();
  const promiseUnsub = store.sub(promiseAtom, command(promiseListener));
  const derivedListener = vi.fn();
  const derivedUnsub = store.sub(derivedAtom, command(derivedListener));

  expect(derivedGetter).toHaveBeenCalledOnce();
  expect(promiseListener).not.toHaveBeenCalled();
  expect(derivedListener).not.toHaveBeenCalled();

  void store.get(promiseAtom);
  void store.get(derivedAtom);

  expect(derivedGetter).toHaveBeenCalledOnce();
  expect(promiseListener).not.toHaveBeenCalled();
  expect(derivedListener).not.toHaveBeenCalled();

  store.set(promiseAtom, promise);

  expect(derivedGetter).toHaveBeenCalledTimes(2);
  expect(promiseListener).toBeCalled();
  expect(derivedListener).toBeCalled();

  store.set(promiseAtom, promise);
  expect(derivedGetter).toHaveBeenCalledTimes(3);
  expect(promiseListener).toBeCalled();
  expect(derivedListener).toBeCalled();

  promiseUnsub();
  derivedUnsub();
});

it('should notify subscription with tree dependencies', () => {
  const valueAtom = state(1, {
    debugLabel: 'valueAtom',
  });
  const dep1_doubleAtom = computed((get) => get(valueAtom) * 2, {
    debugLabel: 'dep1_doubleAtom',
  });
  const dep2_sumAtom = computed((get) => get(valueAtom) + get(dep1_doubleAtom), {
    debugLabel: 'dep2_sumAtom',
  });
  const dep3_mirrorDoubleAtom = computed((get) => get(dep1_doubleAtom), {
    debugLabel: 'dep3_mirrorDoubleAtom',
  });

  const traceDep3 = vi.fn();
  const store = createStore();
  store.sub(
    dep2_sumAtom,
    command(vi.fn(), {
      debugLabel: 'dep2_sumAtom',
    }),
  ); // this will cause the bug
  store.sub(
    dep3_mirrorDoubleAtom,
    command(traceDep3, {
      debugLabel: 'traceDep3',
    }),
  );

  expect(store.get(dep3_mirrorDoubleAtom)).toBe(2);
  store.set(valueAtom, (c) => c + 1);
  expect(traceDep3).toBeCalledTimes(1);
  expect(store.get(dep3_mirrorDoubleAtom)).toBe(4);
});

it('should notify subscription with tree dependencies with bail-out', () => {
  const valueAtom = state(1);
  const dep1Atom = computed((get) => get(valueAtom) * 2);
  const dep2Atom = computed((get) => get(valueAtom) * 0);
  const dep3Atom = computed((get) => get(dep1Atom) + get(dep2Atom));

  const cb = vi.fn();
  const store = createStore();
  store.sub(dep1Atom, command(vi.fn()));
  store.sub(dep3Atom, command(cb));

  expect(cb).toBeCalledTimes(0);
  expect(store.get(dep3Atom)).toBe(2);
  store.set(valueAtom, (c) => c + 1);
  expect(cb).toBeCalledTimes(1);
  expect(store.get(dep3Atom)).toBe(4);
});

it('should trigger subscriber even if the same value with chained dependency', () => {
  const store = createStore();
  const objAtom = state(
    { count: 1 },
    {
      debugLabel: 'objAtom',
    },
  );
  const countAtom = computed((get) => get(objAtom).count, {
    debugLabel: 'countAtom',
  });
  const deriveFn = vi.fn((get: Getter) => get(countAtom));
  const derivedAtom = computed(deriveFn, {
    debugLabel: 'derivedAtom',
  });
  const deriveFurtherFn = vi.fn((get: Getter) => {
    get(objAtom); // intentional extra dependency
    return get(derivedAtom);
  });
  const derivedFurtherAtom = computed(deriveFurtherFn, {
    debugLabel: 'derivedFurtherAtom',
  });
  const traceFurther = vi.fn();
  store.sub(
    derivedFurtherAtom,
    command(traceFurther, {
      debugLabel: 'traceFurther',
    }),
  );

  expect(store.get(derivedAtom)).toBe(1);
  expect(store.get(derivedFurtherAtom)).toBe(1);
  expect(traceFurther).toHaveBeenCalledTimes(0);
  expect(deriveFn).toHaveBeenCalledTimes(1);
  expect(deriveFurtherFn).toHaveBeenCalledTimes(1);

  store.set(objAtom, (obj) => ({ ...obj }));
  expect(traceFurther).toHaveBeenCalledTimes(1);
});

it('read function should called during subscription', () => {
  const store = createStore();
  const countAtom = state(1);
  const derive1Fn = vi.fn((get: Getter) => get(countAtom));
  const derived1Atom = computed(derive1Fn);
  const derive2Fn = vi.fn((get: Getter) => get(countAtom));
  const derived2Atom = computed(derive2Fn);
  expect(store.get(derived1Atom)).toBe(1);
  expect(store.get(derived2Atom)).toBe(1);
  expect(derive1Fn).toHaveBeenCalledTimes(1);
  expect(derive2Fn).toHaveBeenCalledTimes(1);

  store.sub(
    derived2Atom,
    command(() => void 0),
  );
  store.set(countAtom, (c) => c + 1);
  expect(derive1Fn).toHaveBeenCalledTimes(1);
  expect(derive2Fn).toHaveBeenCalledTimes(2);
});

it('should update with conditional dependencies', () => {
  const store = createStore();
  const f1 = state(false);
  const f2 = state(false);
  const f3 = computed((get) => get(f1) && get(f2));
  const updateFn = command(({ set }, val: boolean) => {
    set(f1, val);
    set(f2, val);
  });
  store.sub(
    f1,
    command(() => void 0),
  );
  store.sub(
    f2,
    command(() => void 0),
  );
  store.sub(
    f3,
    command(() => void 0),
  );
  store.set(updateFn, true);
  expect(store.get(f3)).toBe(true);
});

it('should update derived atoms during write', () => {
  const store = createStore();

  const baseCountAtom = state(1);
  const countAtom = computed((get) => get(baseCountAtom));

  const updateCountAtom = command(({ get, set }, newValue: number) => {
    set(baseCountAtom, newValue);
    if (get(countAtom) !== newValue) {
      throw new Error('mismatch');
    }
  });

  store.sub(
    countAtom,
    command(() => void 0),
  );
  expect(store.get(countAtom)).toBe(1);
  store.set(updateCountAtom, 2);
  expect(store.get(countAtom)).toBe(2);
});

it('should not recompute a derived atom value if unchanged (#2168)', () => {
  const store = createStore();
  const countAtom = state(1);
  const zeroAtom = computed((get) => get(countAtom) * 0);
  const deriveFn = vi.fn((get: Getter) => get(zeroAtom));
  const derivedAtom = computed(deriveFn);
  expect(store.get(derivedAtom)).toBe(0);
  store.set(countAtom, (c) => c + 1);
  expect(store.get(derivedAtom)).toBe(0);
  expect(deriveFn).toHaveBeenCalledTimes(1);
});

it('should notify pending write triggered asynchronously and indirectly (#2451)', async () => {
  const store = createStore();
  const anAtom = state('initial');

  const callbackFn = vi.fn();
  const unsub = store.sub(
    anAtom,
    command(({ get }) => {
      callbackFn(get(anAtom));
    }),
  );

  const actionAtom = command(async ({ set }) => {
    await Promise.resolve(); // waiting a microtask
    set(indirectSetAtom);
  });

  const indirectSetAtom = command(({ set }) => {
    set(anAtom, 'next');
  });

  // executing the chain reaction
  await store.set(actionAtom);

  expect(callbackFn).toHaveBeenCalledOnce();
  expect(callbackFn).toHaveBeenCalledWith('next');
  unsub();
});

describe('async atom with subtle timing', () => {
  it('case 1', async () => {
    const { pause, restore } = suspense();
    const store = createStore();

    const a = state(1);
    const b = computed(async (get) => {
      await pause();
      return get(a);
    });
    const bValue = store.get(b);
    store.set(a, 2);
    restore();
    const bValue2 = store.get(b);
    restore();
    expect(await bValue).toBe(2);
    expect(await bValue2).toBe(2);
  });

  it('case 2', async () => {
    const { pause, restore } = suspense();
    const store = createStore();
    const a = state(1);
    const b = computed(async (get) => {
      const aValue = get(a);
      await pause();
      return aValue;
    });
    const bValue = store.get(b);
    store.set(a, 2);
    restore();
    const bValue2 = store.get(b);
    restore();
    expect(await bValue).toBe(1); // returns old value
    expect(await bValue2).toBe(2);
  });
});

it('Unmount an atom that is no longer dependent within a derived atom', () => {
  const condAtom = state(true, {
    debugLabel: 'condAtom',
  });

  const baseAtom = state(0, {
    debugLabel: 'baseAtom',
  });

  const derivedAtom = computed(
    (get) => {
      if (get(condAtom)) get(baseAtom);
    },
    {
      debugLabel: 'derivedAtom',
    },
  );

  const store = createStore();
  const trace = vi.fn();
  store.sub(derivedAtom, command(trace));

  store.set(condAtom, false);
  expect(trace).toHaveBeenCalledTimes(1);

  store.set(baseAtom, 2);
  expect(trace).toHaveBeenCalledTimes(1);
});

it('should update derived atom even if dependances changed (#2697)', () => {
  const primitiveAtom = state<number | undefined>(undefined);
  const derivedAtom = computed((get) => get(primitiveAtom));
  const conditionalAtom = computed((get) => {
    const base = get(primitiveAtom);
    if (!base) return;
    return get(derivedAtom);
  });

  const store = createStore();
  const onChangeDerived = vi.fn();

  store.sub(derivedAtom, command(onChangeDerived));
  store.sub(
    conditionalAtom,
    command(() => void 0),
  );

  expect(onChangeDerived).toHaveBeenCalledTimes(0);
  store.set(primitiveAtom, 1);
  expect(onChangeDerived).toHaveBeenCalledTimes(1);
});

it('double unmount should not cause new mount', () => {
  const base = state(0, {
    debugLabel: 'base',
  });
  const store = createDebugStore();
  const unmount = store.sub(
    base,
    command(() => void 0, {
      debugLabel: 'subBase',
    }),
  );

  unmount();
  unmount();

  expect(store.getSubscribeGraph()).toEqual([]);
});

it('mount multiple times on same atom', () => {
  const base = state(0, {
    debugLabel: 'base',
  });
  const store = createDebugStore();
  const unmount1 = store.sub(
    base,
    command(() => void 0, {
      debugLabel: 'subBase1',
    }),
  );
  const unmount2 = store.sub(
    base,
    command(() => void 0, {
      debugLabel: 'subBase2',
    }),
  );

  unmount1();
  unmount2();

  expect(store.getSubscribeGraph()).toEqual([]);
});

it('sub empty atoms', () => {
  const store = createStore();
  expect(() => {
    store.sub(
      [],
      command(() => void 0),
    );
  }).not.toThrow();
});

it('mount single atom in array', () => {
  const store = createStore();
  const base$ = state(0);
  const trace = vi.fn();

  store.sub(
    [base$],
    command(() => {
      trace();
    }),
  );

  store.set(base$, 1);
  expect(trace).toHaveBeenCalledTimes(1);
});

it('mount support signal', () => {
  const store = createStore();
  const base$ = state(0);
  const trace = vi.fn();

  const controller = new AbortController();
  store.sub(
    base$,
    command(() => {
      trace();
    }),
    {
      signal: controller.signal,
    },
  );

  controller.abort();

  store.set(base$, 1);
  expect(trace).not.toBeCalled();
});

it('call unsub for multiple atoms will unsub all listeners', () => {
  const store = createStore();
  const base1$ = state(0);
  const base2$ = state(0);
  const trace = vi.fn();

  const unsub = store.sub([base1$, base2$], command(trace));
  unsub();
  store.set(base1$, 1);
  store.set(base2$, 2);
  expect(trace).not.toBeCalled();
});

it('should unmount base automatically when unmount listener', () => {
  const store = createStore();
  const base$ = state(0, {
    debugLabel: 'base$',
  });
  const trace = vi.fn();
  const computed$ = computed(
    (get) => {
      trace();
      return get(base$);
    },
    {
      debugLabel: 'computed$',
    },
  );

  const derived$ = computed(
    (get) => {
      return get(computed$);
    },
    {
      debugLabel: 'derived$',
    },
  );

  const unsub = store.sub(
    derived$,
    command(() => void 0, {
      debugLabel: 'callback$',
    }),
  );
  trace.mockClear();
  store.set(base$, 1);
  expect(trace).toHaveBeenCalledTimes(1);

  unsub();
  trace.mockClear();
  store.set(base$, 2);
  expect(trace).not.toHaveBeenCalled();
});

it('should recompute derived atom when dependencies changed', () => {
  const store = createStore();
  const base$ = state(0);
  const trace = vi.fn();
  const double$ = computed((get) => {
    trace();
    return get(base$) * 2;
  });
  store.get(double$);
  expect(trace).toHaveBeenCalledTimes(1);
  trace.mockClear();

  store.set(base$, 1);
  store.get(double$);
  expect(trace).toHaveBeenCalledTimes(1);
});

it('should unmount base$ atom in this complex scenario', () => {
  const trace = vi.fn();
  const base$ = state(0, {
    debugLabel: 'base$',
  });
  const derived1$ = computed((get) => get(base$), {
    debugLabel: 'derived1$',
  });
  const derived2$ = computed(
    (get) => {
      trace();
      get(base$);
      return 0;
    },
    {
      debugLabel: 'derived2$',
    },
  );

  const store = createDebugStore();
  const unsub = store.sub(
    derived1$,
    command(() => void 0),
  );
  store.get(derived2$);
  unsub();

  trace.mockClear();
  store.set(base$, 1);
  expect(trace).not.toBeCalled();

  expect(nestedAtomToString(store.getReadDependents(base$))).toEqual(['base$']);
});

it('shoule unmount base$ atom in this complex scenario 2', () => {
  const base1$ = state(0, {
    debugLabel: 'base1$',
  });
  const base2$ = state(0, {
    debugLabel: 'base2$',
  });
  const branch$ = state(true, {
    debugLabel: 'branch$',
  });
  const derived$ = computed(
    (get) => {
      if (get(branch$)) {
        return get(base1$);
      }
      return get(base2$);
    },
    {
      debugLabel: 'derived$',
    },
  );

  const store = createDebugStore();
  const unsub = store.sub(
    derived$,
    command(() => void 0),
  );
  store.set(branch$, false);
  unsub();

  expect(nestedAtomToString(store.getReadDependents(base2$))).toEqual(['base2$']);
});

it('shoule unmount base$ atom in this complex scenario 3', () => {
  const base$ = state(0);
  const branch$ = state(true);
  const derived$ = computed((get) => {
    if (!get(branch$)) {
      return;
    }
    return get(base$);
  });

  const store = createDebugStore();
  store.sub(
    derived$,
    command(() => void 0),
  );
  expect(store.isMounted(base$)).toBeTruthy();

  store.set(branch$, false);

  expect(store.isMounted(base$)).toBeFalsy();
});

it('shoule unmount base$ atom in this complex scenario 4', () => {
  const base$ = state(0);
  const branch$ = state(true);
  const derived$ = computed((get) => {
    if (!get(branch$)) {
      return;
    }
    return get(base$);
  });

  const store = createDebugStore();
  store.sub(
    derived$,
    command(() => void 0),
  );
  store.sub(
    base$,
    command(() => void 0),
  );

  store.set(branch$, false);

  expect(store.isMounted(base$)).toBeTruthy();
});
