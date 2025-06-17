import { expect, test, vi } from 'vitest';
import { state, createStore, computed, command } from '..';
import type { Computed, Command, State } from '..';
import { createDebugStore } from '../../debug';

test('should work', () => {
  const store = createStore();
  const anAtom = state(1);

  expect(store.get(anAtom)).toBe(1);

  store.set(anAtom, 2);
  expect(store.get(anAtom)).toBe(2);

  const store2 = createStore();
  expect(store2.get(anAtom)).toBe(1);
});

test('computed value should work', () => {
  const store = createStore();
  const base = state(1);
  const derived = computed(
    (get) => {
      const num = get(base);
      return num * 2;
    },
    {
      debugLabel: 'derived',
    },
  );
  expect(store.get(derived)).toBe(2);
});

test('computed value should not writable', () => {
  const store = createStore();
  const anAtom = state(1);
  const doubleCmpt = computed((get) => {
    return get(anAtom) * 2;
  });

  store.set(doubleCmpt as unknown as State<number>, 3);
  expect(store.get(doubleCmpt)).toBe(2);
});

test('async value should works like sync value', async () => {
  const store = createStore();
  const anAtom = state(1);
  const asyncCmpt: Computed<Promise<number>> = computed(async (get) => {
    await Promise.resolve();
    return get(anAtom) * 2;
  });

  expect(await store.get(asyncCmpt)).toBe(2);
});

test('async computed should not follow old value', async () => {
  const store = createStore();
  const base = state('foo', {
    debugLabel: 'base',
  });
  const cmpt = computed(
    (get) => {
      return Promise.resolve(get(base) + get(base));
    },
    {
      debugLabel: 'cmpt',
    },
  );
  const derivedCmpt = computed(
    async (get) => {
      return get(base) + (await get(cmpt));
    },
    {
      debugLabel: 'derivedCmpt',
    },
  );

  const ret1 = store.get(derivedCmpt);
  store.set(base, 'bar');
  const ret2 = store.get(derivedCmpt);

  expect(await ret1).toBe('foofoofoo');
  expect(await ret2).toBe('barbarbar');
});

test('func can set other value', () => {
  const store = createStore();
  const base$ = state(1);
  const double$ = state(0);
  const setDouble$ = command(({ get, set }, num) => {
    set(base$, num);
    set(double$, get(base$) * 2);
  });
  store.set(setDouble$, 2);
  expect(store.get(base$)).toBe(2);
  expect(store.get(double$)).toBe(4);
});

test('set an atom should trigger subscribe', () => {
  const store = createStore();
  const base$ = state(1, {
    debugLabel: 'base',
  });
  const trace = vi.fn();
  store.watch((get) => {
    get(base$);
    trace();
  });
  store.set(base$, 2);
  expect(trace).toBeCalledTimes(2);
});

test('set an atom in func should trigger multiple times', () => {
  const store = createStore();
  const base$ = state(1, {
    debugLabel: 'base',
  });
  const trace = vi.fn();
  store.watch((get) => {
    get(base$);
    trace();
  });
  store.set(
    command(
      ({ set }) => {
        set(base$, 2);
        set(base$, 3);
        set(base$, 4);
      },
      {
        debugLabel: 'func$',
      },
    ),
  );

  expect(trace).toBeCalledTimes(4);
});

test('sub multiple atoms', () => {
  const store = createStore();
  const state1$ = state(1, {
    debugLabel: 'state1',
  });
  const state2$ = state(2, {
    debugLabel: 'state2',
  });

  const trace = vi.fn();

  store.watch((get) => {
    trace();
    return `${String(get(state1$))}:${String(get(state2$))}`;
  });

  store.set(state1$, (x) => x + 1);
  store.set(state2$, (x) => x + 1);
  expect(trace).toBeCalled();
});

test('sub computed atom', () => {
  const store = createStore();
  const base$ = state(1, {
    debugLabel: 'base',
  });
  const derived$ = computed(
    (get) => {
      return get(base$) * 2;
    },
    {
      debugLabel: 'cmpt',
    },
  );

  const trace = vi.fn();
  store.watch((get) => {
    get(derived$);
    trace();
  });

  expect(trace).toBeCalled();
  store.set(base$, 2);
  expect(trace).toBeCalledTimes(2);
});

test('get read deps', () => {
  const store = createDebugStore();
  const base$ = state({ a: 1 });
  const derived$ = computed((get) => {
    return Object.assign(get(base$), { b: 1 });
  });
  expect(store.getReadDependencies(derived$)).toEqual([derived$]);
  store.get(derived$);
  expect(store.getReadDependencies(derived$)).toEqual([derived$, [base$]]);
});

test('get should return value directly', () => {
  const store = createStore();
  const base$ = state({ a: 1 });
  const derived$ = computed((get) => {
    return Object.assign(get(base$), { b: 1 });
  });

  const b = store.get(derived$);
  store.set(base$, { a: 2 });
  expect(b).toEqual({ a: 1, b: 1 });

  b.b = 2;
  expect(store.get(derived$)).property('a', 2);
  expect(store.get(derived$)).property('b', 1);
});

test('derived atom should trigger when deps changed', () => {
  const store = createStore();
  const stateA$ = state(0);
  const stateB$ = state(0);
  const stateC$ = state(0);
  const traceB = vi.fn();
  const traceC = vi.fn();
  const derived$ = computed((get) => {
    if (get(stateA$) == 0) {
      traceB();
      return get(stateB$);
    } else {
      traceC();
      return get(stateC$);
    }
  });
  expect(store.get(derived$)).toBe(0);

  store.set(stateC$, 1);
  expect(traceC).not.toBeCalled();

  store.get(derived$);
  expect(traceC).not.toBeCalled();

  store.set(stateB$, 100);
  store.get(derived$);
  expect(traceC).not.toBeCalled();

  traceB.mockClear();
  store.set(stateA$, 1);
  expect(traceB).not.toBeCalled();
  expect(traceC).not.toBeCalled();

  store.get(derived$);
  expect(traceB).not.toBeCalled();
  expect(traceC).toBeCalled();
});

test('outdated deps should not trigger sub', async () => {
  const store = createStore();
  const branch$ = state('A', {
    debugLabel: 'branch',
  });
  const refresh$ = state(0, {
    debugLabel: 'refresh',
  });
  const derived$ = computed(
    (get) => {
      if (get(branch$) == 'A') {
        return Promise.resolve().then(() => {
          get(refresh$);
          return 'A';
        });
      }
      return 'B';
    },
    {
      debugLabel: 'derived',
    },
  );

  const traceSub = vi.fn();
  store.watch((get) => {
    void get(derived$);
    traceSub();
  });
  await expect(store.get(derived$)).resolves.toBe('A');

  store.set(branch$, 'B');
  const derivedRet = store.get(derived$);
  expect(traceSub).toBeCalled();
  expect(await derivedRet).toBe('B');

  store.set(refresh$, (x) => x + 1);
  traceSub.mockClear();
  expect(traceSub).not.toBeCalled();
});

test('computed should only compute once if no deps changed', () => {
  const store = createStore();
  const base$ = state(1);
  const trace = vi.fn();
  const derived$ = computed((get) => {
    trace();
    return get(base$) * 2;
  });
  store.get(derived$);
  store.get(derived$);
  expect(trace).toBeCalledTimes(1);
});

test('an observable func process', async () => {
  function observableFunc<T, Args extends unknown[]>(func$: Command<T, Args>): [Computed<T | null>, Command<T, Args>] {
    const lastResult = state<T | null>(null);
    return [
      computed((get) => get(lastResult)),

      command(({ set }, ...args: Args) => {
        const result = set(func$, ...args);
        set(lastResult, result);
        return result;
      }),
    ];
  }

  const [result$, setup$] = observableFunc(
    command(async () => {
      await Promise.resolve();
      return 'ok';
    }),
  );
  const store = createStore();
  expect(store.get(result$)).toBeNull();
  const ret = store.set(setup$);
  expect(ret).toBeInstanceOf(Promise);
  await expect(ret).resolves.toBe('ok');
});

test('generator in func', () => {
  const step = state(0);
  const generator$ = command(function* ({ set }) {
    set(step, 1);
    yield;
    set(step, 2);
    yield;
    set(step, 3);
    return 3;
  });

  const store = createStore();
  const ret = store.set(generator$);
  ret.next();
  expect(store.get(step)).toBe(1);
  ret.next();
  expect(store.get(step)).toBe(2);
  ret.next();
  expect(store.get(step)).toBe(3);
});

test('diamond deps and distinct compute', () => {
  const trace = vi.fn();

  const obj$ = state(
    {
      id: 1,
      nodeId: 2,
    },
    { debugLabel: 'obj' },
  );

  const id$ = computed(
    (get) => {
      return get(obj$).id;
    },
    {
      debugLabel: 'id',
    },
  );

  const id2$ = computed(
    (get) => {
      trace();
      return get(id$);
    },
    {
      debugLabel: 'id2',
    },
  );

  const nodeId$ = computed(
    (get) => {
      return get(obj$).nodeId;
    },
    {
      debugLabel: 'nodeId',
    },
  );

  const test$ = computed(
    (get) => {
      return get(id2$) + get(nodeId$);
    },
    {
      debugLabel: 'test',
    },
  );

  const store = createStore();

  store.watch((get) => {
    get(test$);
  });

  trace.mockClear();

  store.set(obj$, (x) => {
    return {
      ...x,
      nodeId: x.nodeId + 1,
    };
  });

  expect(trace).not.toBeCalled();
});
