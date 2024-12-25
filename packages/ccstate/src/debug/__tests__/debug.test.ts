import { describe, expect, it } from 'vitest';
import { computed, command, state, createStore } from '../../core';
import { createDebugStore } from '..';
import { nestedAtomToString } from '../../__tests__/util';
import { trace } from '../trace';

it('get all subscribed atoms', () => {
  const store = createDebugStore();
  const base = state(1, { debugLabel: 'base' });
  const derived = computed((get) => get(base) + 1, { debugLabel: 'derived' });
  store.sub(
    [base, derived],
    command(
      () => {
        void 0;
      },
      { debugLabel: 'sub' },
    ),
  );
  expect(nestedAtomToString(store.getSubscribeGraph())).toEqual([
    ['base', 'sub'],
    ['derived', 'sub'],
  ]);
});

it('cant get read depts if atom is not subscribed', () => {
  const store = createDebugStore();
  const base$ = state(1, { debugLabel: 'base' });
  const derived$ = computed((get) => get(base$), { debugLabel: 'derived' });

  expect(store.get(derived$)).toBe(1);

  expect(store.getReadDependents(base$)).toEqual([base$]);
});

it('nestedAtomToString will print anonymous if no debugLabel is provided', () => {
  const base$ = state(1);
  expect(nestedAtomToString([base$])).toEqual(['anonymous']);
});

it('correctly process unsub decount', () => {
  const store = createDebugStore();
  const controller = new AbortController();
  const base$ = state(1);
  const callback$ = command(() => void 0);
  store.sub(base$, callback$, { signal: controller.signal });

  expect(store.getSubscribeGraph()).toEqual([[base$, callback$]]);

  controller.abort();

  expect(store.getSubscribeGraph()).toEqual([]);
});

describe('predictPropagationGraph', () => {
  it('could get propagation graph', () => {
    const store = createDebugStore();
    const base$ = state(1);
    const callback$ = command(() => void 0);
    store.sub(base$, callback$);

    const propagationGraph = store.predictPropagationGraph(base$);
    expect(propagationGraph).toEqual([[base$, callback$]]);
  });

  it('derived propagation graph', () => {
    const store = createDebugStore();
    const base$ = state(1, {
      debugLabel: 'base',
    });
    const derived$ = computed((get) => get(base$) + 1, {
      debugLabel: 'derived',
    });
    const callback$ = command(() => void 0, {
      debugLabel: 'callback',
    });
    store.sub(derived$, callback$);

    const propagationGraph = store.predictPropagationGraph(base$);
    expect(propagationGraph).toEqual([
      [base$, derived$],
      [derived$, callback$],
    ]);
  });

  it('diamond propagation graph', () => {
    const store = createDebugStore();
    const base$ = state(1, {
      debugLabel: 'base',
    });
    const derived1$ = computed((get) => get(base$), {
      debugLabel: 'derived1',
    });
    const derived2$ = computed((get) => get(derived1$) + 1, {
      debugLabel: 'derived2',
    });
    const final$ = computed((get) => get(derived1$) + get(derived2$), {
      debugLabel: 'final',
    });
    const callback$ = command(() => void 0, {
      debugLabel: 'callback',
    });
    store.sub(final$, callback$);

    const propagationGraph = store.predictPropagationGraph(base$);
    expect(propagationGraph).toEqual([
      [base$, derived1$],
      [derived1$, final$],
      [derived1$, derived2$],
      [final$, callback$],
      [derived2$, final$],
    ]);
  });

  it.skip('scoped propagation graph', () => {
    const store = createStore();
    const base$ = state(1);
    const derived$ = computed((get) => get(base$) + 1);
    const callback$ = command(() => void 0);
    store.sub(derived$, callback$);

    const trace$ = trace(
      command(({ set }, val: number) => {
        set(base$, val);
      }),
    );

    store.set(trace$, 2);

    expect(trace$.calls[0].propagationGraph).toEqual([
      [base$, derived$],
      [derived$, callback$],
    ]);
  });
});
