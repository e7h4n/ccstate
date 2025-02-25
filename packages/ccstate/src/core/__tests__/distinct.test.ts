import { expect, it, vi } from 'vitest';
import { command, computed, state } from '../signal/factory';
import { getDefaultStore } from '../store/store';

it('default state & computed is distincted', () => {
  const base$ = state(0);
  const computed$ = computed((get) => get(base$));

  const traceBase = vi.fn();
  const traceComputed = vi.fn();
  getDefaultStore().sub(base$, command(traceBase));
  getDefaultStore().sub(computed$, command(traceComputed));

  getDefaultStore().set(base$, 0);
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

  getDefaultStore().sub(
    computed2$,
    command(() => void 0),
  );
  expect(traceComputed).toBeCalledTimes(1);

  getDefaultStore().set(base$, { a: 1 });
  expect(traceComputed).toBeCalledTimes(1);
});
