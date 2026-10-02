import { beforeEach, expect, it, vi } from 'vitest';
import { computed, state } from '../signal/factory';
import { createStore } from '../store/store';
import type { Store } from '../../../types/core/store';

let store: Store;
beforeEach(() => {
  store = createStore();
});

it('default state & computed is distincted', () => {
  const base$ = state(0);
  const computed$ = computed((get) => get(base$));

  const traceBase = vi.fn();
  const traceComputed = vi.fn();
  store.watch(base$, () => {
    traceBase();
  });
  store.watch(computed$, () => {
    traceComputed();
  });

  traceBase.mockClear();
  traceComputed.mockClear();

  store.set(base$, 0);
  expect(traceBase).not.toHaveBeenCalled();
  expect(traceComputed).not.toHaveBeenCalled();
});

it('will distinct computed calls', () => {
  const base$ = state({ a: 1 });
  const computed$ = computed((get) => {
    return get(base$).a;
  });
  const traceComputed = vi.fn();
  const computed2$ = computed((get) => {
    traceComputed();
    return get(computed$);
  });

  store.watch(computed2$, () => undefined);
  expect(traceComputed).toBeCalledTimes(1);

  store.set(base$, { a: 1 });
  expect(traceComputed).toBeCalledTimes(1);
});
