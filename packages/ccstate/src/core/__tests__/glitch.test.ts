import { it, vi, expect, describe } from 'vitest';
import { state, computed, createStore, type State, type Computed } from '../..';

it('test glitch 1', () => {
  const base$ = state(0, { debugLabel: 'base$' });
  const basePlusZero$ = computed((get) => get(base$), { debugLabel: 'basePlusZero$' });
  const basePlusOne$ = computed((get) => get(basePlusZero$) + 1, { debugLabel: 'basePlusOne$' });
  const trace = vi.fn();
  const alwaysTrue$ = computed(
    (get) => {
      const basePlusZero = get(basePlusZero$);
      const ret = get(basePlusOne$) > basePlusZero;
      trace(ret);
      return ret;
    },
    { debugLabel: 'alwaysTrue$' },
  );

  const store = createStore();
  store.watch((get) => {
    get(alwaysTrue$);
  });

  expect(store.get(alwaysTrue$)).toBe(true);
  trace.mockClear();
  store.set(base$, 1);
  expect(trace).not.toHaveBeenCalledWith(false);
  expect(trace).toBeCalledTimes(1);
});

it('test glitch 2', () => {
  const base$ = state(0, { debugLabel: 'base$' });
  const basePlusZero$ = computed((get) => get(base$), { debugLabel: 'basePlusZero$' });
  const basePlusOne$ = computed((get) => get(basePlusZero$) + 1, { debugLabel: 'basePlusOne$' });
  const trace = vi.fn();
  const alwaysTrue$ = computed(
    (get) => {
      const ret = get(basePlusOne$) > get(basePlusZero$);
      trace(ret);
      return ret;
    },
    { debugLabel: 'alwaysTrue$' },
  );

  const store = createStore();
  store.watch((get) => {
    get(alwaysTrue$);
  });

  expect(store.get(alwaysTrue$)).toBe(true);
  trace.mockClear();
  store.set(base$, 1);
  expect(trace).not.toHaveBeenCalledWith(false);
  expect(trace).toBeCalledTimes(1);
});

/**
 * Create n layers of diamond-shaped computed properties
 * Each layer has a structure like:
 * Left:
 *     D       <---- top$
 *    / \
 *   C   |
 *    \ /
 *     B       <---- computed$
 *     |
 *   base$
 *
 * Right:
 *     D       <---- top$
 *    / \
 *   |   C
 *    \ /
 *     B       <---- computed$
 *     |
 *   base$
 * @param n number of layers
 * @param initialValue initial value
 * @returns returns a tuple [baseState, topComputed], representing the bottom state and top computed property
 */
export function createDiamondDeps(
  n: number,
  shape: 'left' | 'right' | 'alternate' | 'random',
  traceComputed: () => void,
): [State<number>, State<number> | Computed<number>, State<number> | Computed<number>] {
  if (n < 1) throw new Error('number of layers must be greater than 0');

  // create base state
  if (n === 1) {
    const base$ = state(0, {
      debugLabel: 'base$',
    });
    return [base$, base$, base$];
  }

  if (n === 2) {
    const [base$] = createDiamondDeps(n - 1, shape, traceComputed);
    const current$ = computed(
      (get) => {
        traceComputed();
        return get(base$);
      },
      {
        debugLabel: 'computed:0$',
      },
    );
    return [base$, current$, current$];
  }

  if (n === 3) {
    const [base$, firstComputed$] = createDiamondDeps(n - 1, shape, traceComputed);
    const top$ = computed(
      (get) => {
        traceComputed();
        return get(firstComputed$) + 1;
      },
      {
        debugLabel: `computed:1$`,
      },
    );
    return [base$, firstComputed$, top$];
  }

  const [base$, firstComputed$, top$] = createDiamondDeps(n - 1, shape, traceComputed);
  const currentComputed$ = computed((get) => get(firstComputed$), {
    debugLabel: `computed:${String(n - 2)}$`,
  });
  const currentLevelShape =
    shape === 'left' || (shape === 'alternate' && n % 7 === 0) || (shape === 'random' && Math.random() > 0.5)
      ? 'left'
      : 'right';
  const newTop$ = computed(
    (get) => {
      traceComputed();
      if (currentLevelShape === 'left') {
        if (get(top$) > get(currentComputed$)) {
          return get(top$);
        }
      } else {
        if (get(currentComputed$) <= get(top$)) {
          return get(top$);
        }
      }

      throw new Error('should never happen');
    },
    {
      debugLabel: `top:${String(n - 2)}:${currentLevelShape}$`,
    },
  );

  return [base$, currentComputed$, newTop$];
}

describe('diamond deps evaluation consistency', () => {
  it('test multiple diamond shape', () => {
    const traceComputed = vi.fn();
    const [base$, , top$] = createDiamondDeps(100, 'left', traceComputed);

    const store = createStore();
    store.watch((get) => {
      get(top$);
    });

    expect(() => {
      store.set(base$, (x) => x + 1);
    }).not.toThrow();
  });

  it('test multiple diamond shape right', () => {
    const traceComputed = vi.fn();
    const [base$, , top$] = createDiamondDeps(100, 'right', traceComputed);

    const store = createStore();
    store.watch((get) => {
      get(top$);
    });

    expect(() => {
      store.set(base$, (x) => x + 1);
    }).not.toThrow();
  });

  it('test multiple diamond shape alternate', () => {
    const traceComputed = vi.fn();
    const [base$, , top$] = createDiamondDeps(100, 'alternate', traceComputed);

    const store = createStore();
    store.watch((get) => {
      get(top$);
    });

    expect(() => {
      store.set(base$, (x) => x + 1);
    }).not.toThrow();
  });

  it('test multiple diamond shape random', () => {
    const traceComputed = vi.fn();
    const [base$, , top$] = createDiamondDeps(100, 'random', traceComputed);

    const store = createStore();
    store.watch((get) => {
      get(top$);
    });

    expect(() => {
      store.set(base$, (x) => x + 1);
    }).not.toThrow();
  });
});

describe('diamond deps evaluation performance', () => {
  it('should only eval once', () => {
    const traceComputed = vi.fn();
    const [base$, , top$] = createDiamondDeps(100, 'random', traceComputed);

    const store = createStore();
    store.watch((get) => {
      get(top$);
    });

    traceComputed.mockClear();
    store.set(base$, (x) => x + 1);
    expect(traceComputed).toHaveBeenCalledTimes(99);
  });
});
