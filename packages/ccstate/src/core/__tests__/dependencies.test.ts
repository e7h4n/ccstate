import { expect, it, vi } from 'vitest';
import { computed, createStore, command, state } from '..';
import { suspense } from './utils';
import { delay } from 'signal-timers';
import { createDebugStore } from '../../debug';

it('can propagate updates with async atom chains', async () => {
  const { pause, restore } = suspense();
  const store = createStore();

  const countAtom = state(1);

  const asyncAtom = computed(async (get) => {
    const count = get(countAtom);
    await pause();
    return count;
  });
  const async2Atom = computed((get) => get(asyncAtom));
  const async3Atom = computed((get) => get(async2Atom));

  expect(store.get(async3Atom) instanceof Promise).toBeTruthy();
  restore();
  await expect(store.get(async3Atom)).resolves.toBe(1);

  store.set(countAtom, (c) => c + 1);
  expect(store.get(async3Atom) instanceof Promise).toBeTruthy();
  restore();
  await expect(store.get(async3Atom)).resolves.toBe(2);

  store.set(countAtom, (c) => c + 1);
  expect(store.get(async3Atom) instanceof Promise).toBeTruthy();
  restore();
  await expect(store.get(async3Atom)).resolves.toBe(3);
});

it('can get async atom with deps more than once before resolving (#1668)', async () => {
  const { pause, restore } = suspense();
  const countAtom = state(0);

  const asyncAtom = computed(async (get) => {
    const count = get(countAtom);
    await pause();
    return count;
  });

  const store = createStore();

  store.set(countAtom, (c) => c + 1);
  void store.get(asyncAtom);
  store.set(countAtom, (c) => c + 1);
  const promise = store.get(asyncAtom);
  restore();
  await Promise.resolve();
  restore();
  const count = await promise;
  expect(count).toBe(2);
});

it('correctly updates async derived atom after get/set update', async () => {
  const baseAtom = state(0);
  const derivedAsyncAtom = computed(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (get) => get(baseAtom) + 1,
  );
  const updateDerivedAtom = command(
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ set }, val) => {
      set(baseAtom, val as number);
    },
  );

  const store = createStore();

  // NOTE: Have to .set() straight after await on .get(), so that it executes
  // in the same JS event loop cycle!
  let derived = await store.get(derivedAsyncAtom);
  await store.set(updateDerivedAtom, 2);

  expect(derived).toBe(1);
  expect(store.get(baseAtom)).toBe(2);

  derived = await store.get(derivedAsyncAtom);
  expect(derived).toBe(3);
});

it('correctly handles the same promise being returned twice from an atom getter (#2151)', async () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  const asyncDataAtom = computed(async () => {
    return 'Asynchronous Data';
  });

  const counterAtom = state(0);

  const derivedAtom = computed((get) => {
    get(counterAtom); // depending on sync data
    return get(asyncDataAtom); // returning a promise from another atom
  });

  const store = createStore();

  void store.get(derivedAtom);
  // setting the `counterAtom` dependency on the same JS event loop cycle, before
  // the `derivedAtom` promise resolves.
  store.set(counterAtom, 1);
  await expect(store.get(derivedAtom)).resolves.toBe('Asynchronous Data');
});

// jotai will keep atoms mounted between async recalculations
// we do not do this, just clean all deps when new calculation starts
it('do not keep atoms mounted between async recalculations', async () => {
  const { pause, restore } = suspense();
  const base = state(0);

  const derived = computed(async (get) => {
    await pause();
    get(base);
  });

  const store = createDebugStore();
  expect(store.getReadDependents(base)).toEqual([base]);
  store.sub(
    derived,
    command(() => void 0),
  );
  restore();
  await Promise.resolve();

  expect(store.getReadDependents(base)).toEqual([base, [derived]]);
  store.set(base, (c) => c + 1);
  restore();
  expect(store.getReadDependents(base)).toEqual([base]);
});

it('should not provide stale values to conditional dependents', () => {
  const baseAtom = state<number[]>([100]);
  const hasFilterAtom = state(false);
  const derivedAtom = computed((get) => {
    const data = get(baseAtom);
    const hasFilter = get(hasFilterAtom);
    if (hasFilter) {
      return [];
    } else {
      return data;
    }
  });
  const stageAtom = computed((get) => {
    const hasFilter = get(hasFilterAtom);
    if (hasFilter) {
      const filtered = get(derivedAtom);
      return filtered.length === 0 ? 'is-empty' : 'has-data';
    } else {
      return 'no-filter';
    }
  });

  const store = createStore();
  store.sub(
    derivedAtom,
    command(() => undefined),
  );
  store.sub(
    stageAtom,
    command(() => undefined),
  );

  expect(store.get(stageAtom)).toBe('no-filter');
  store.set(hasFilterAtom, true);
  expect(store.get(stageAtom)).toBe('is-empty');
});

it('settles never resolving async derivations with deps picked up sync', async () => {
  const { pause, restore } = suspense();

  const syncAtom = state({
    promise: new Promise<void>(() => void 0),
  });

  const asyncAtom = computed(async (get) => {
    await get(syncAtom).promise;
  });

  const store = createStore();

  const trace = vi.fn();
  const traceSub = vi.fn();

  // first get should got a never resolving promise
  void store.get(asyncAtom).then(() => {
    trace('NEVER');
  });

  store.sub(
    asyncAtom,
    command(async ({ get }) => {
      traceSub();
      await get(asyncAtom);
      trace('OK');
    }),
  );

  store.set(syncAtom, {
    promise: pause(),
  });
  restore();

  await delay(0);
  expect(trace).toHaveBeenCalledTimes(1);
  expect(trace).toBeCalledWith('OK');
  expect(traceSub).toHaveBeenCalledTimes(1);
});

it('settles never resolving async derivations with deps picked up async', async () => {
  const syncAtom = state({
    promise: new Promise<void>(() => void 0),
  });

  const asyncAtom = computed(async (get) => {
    // we want to pick up `syncAtom` as an async dep
    await Promise.resolve();
    await get(syncAtom).promise;
  });

  const store = createStore();

  const trace = vi.fn();
  void store.get(asyncAtom).then(() => {
    trace('NEVER');
  });
  store.sub(
    asyncAtom,
    command(async ({ get }) => {
      trace('SUB');
      await get(asyncAtom);
      trace('OK');
    }),
  );

  await delay(0);
  store.set(syncAtom, {
    promise: Promise.resolve(),
  });

  await delay(0);
  expect(trace).toHaveBeenCalledTimes(2);
  expect(trace).nthCalledWith(1, 'SUB');
  expect(trace).nthCalledWith(2, 'OK');
});

it('refreshes deps for each async read', async () => {
  const { pause, restore } = suspense();

  const countAtom = state(0);
  const depAtom = state(false);

  const trace = vi.fn();
  const asyncAtom = computed(async (get) => {
    const count = get(countAtom);
    trace(count);
    if (count === 0) {
      get(depAtom);
    }
    await pause();
    return count;
  });
  const store = createStore();
  void store.get(asyncAtom);
  expect(trace).toHaveBeenCalledTimes(1);
  store.set(countAtom, (c) => c + 1);
  const ret = store.get(asyncAtom);
  expect(trace).toHaveBeenCalledTimes(2);
  restore();
  expect(await ret).toBe(1);
  expect(trace).toHaveBeenCalledTimes(2);
  expect(trace).nthCalledWith(1, 0);
  expect(trace).nthCalledWith(2, 1);
  trace.mockClear();

  store.set(depAtom, true);
  await store.get(asyncAtom);
  expect(trace).not.toBeCalled();
});

it('should re-evaluate stable derived atom values in situations where dependencies are re-ordered (#2738)', () => {
  const callCounter = vi.fn();
  const countAtom = state(0, {
    debugLabel: 'countAtom',
  });
  const rootAtom = state(false, {
    debugLabel: 'rootAtom',
  });
  const stableDep = computed(
    (get) => {
      get(rootAtom);
      return 1;
    },
    {
      debugLabel: 'stableDep',
    },
  );
  const stableDepDep = computed(
    (get) => {
      get(stableDep);
      callCounter();
      return 2 + get(countAtom);
    },
    { debugLabel: 'stableDepDep' },
  );

  const newAtom = computed(
    (get) => {
      if (get(rootAtom) || get(countAtom) > 0) {
        return get(stableDepDep);
      }

      return get(stableDep);
    },
    { debugLabel: 'newAtom' },
  );

  const store = createStore();
  store.sub(
    stableDepDep,
    command(() => void 0),
  );
  store.sub(
    newAtom,
    command(() => void 0),
  );
  expect(store.get(stableDepDep)).toBe(2);
  expect(callCounter).toHaveBeenCalledTimes(1);

  store.set(rootAtom, true);
  expect(store.get(newAtom)).toBe(2);
  expect(callCounter).toHaveBeenCalledTimes(2);

  callCounter.mockClear();
  store.set(rootAtom, false);
  expect(callCounter).toHaveBeenCalledTimes(0);

  callCounter.mockClear();
  store.set(countAtom, 1);
  expect(callCounter).toHaveBeenCalledTimes(1);
  expect(store.get(newAtom)).toBe(3);
});

it('handles complex dependency chains', async () => {
  const { pause, restore } = suspense();
  const baseAtom = state(1);
  const derived1 = computed((get) => get(baseAtom) * 2);
  const derived2 = computed((get) => get(derived1) + 1);

  const asyncDerived = computed(async (get) => {
    const ret = get(derived2);
    await pause();
    return ret * 2;
  });

  const store = createStore();
  const promise = store.get(asyncDerived);
  restore();
  expect(await promise).toBe(6);

  store.set(baseAtom, 2);
  const promise2 = store.get(asyncDerived);
  restore();
  expect(await promise2).toBe(10);
});
